/**
 * YOU PROBABLY DON'T NEED TO EDIT THIS FILE, UNLESS:
 * 1. You want to modify request context (see Part 1)
 * 2. You want to create a new middleware or type of procedure (see Part 3)
 *
 * tl;dr - this is where all the tRPC server stuff is created and plugged in.
 * The pieces you will need to use are documented accordingly near the end
 */

import type { Permission } from "@arlequins/auth";
import { hasPermission } from "@arlequins/auth";
import { initTRPC, TRPCError } from "@trpc/server";
import superjson from "superjson";
import { ZodError, z } from "zod/v4";
import { mapApplicationErrorToTrpc } from "./application-error";
import type { TRPCContext } from "./context";
import { formatTrpcErrorShape } from "./errors";

/**
 * 1. CONTEXT
 *
 * This section defines the "contexts" that are available in the backend API.
 *
 * These allow access to request-scoped services, storage, and the session.
 *
 * This helper generates the "internals" for a tRPC context. The API handler and RSC clients each
 * wrap this and provides the required context.
 *
 * @see https://trpc.io/docs/server/context
 */

/**
 * 2. INITIALIZATION
 *
 * This is where the trpc api is initialized, connecting the context and
 * transformer
 */
const t = initTRPC.context<TRPCContext>().create({
  transformer: superjson,
  errorFormatter: ({ shape, error }) =>
    formatTrpcErrorShape({
      shape,
      error,
      zodError:
        error.cause instanceof ZodError
          ? z.flattenError(error.cause as ZodError<Record<string, unknown>>)
          : null,
    }),
});

/**
 * 3. ROUTER & PROCEDURE (THE IMPORTANT BIT)
 *
 * These are the pieces you use to build your tRPC API. You should import these
 * a lot in the /src/server/api/routers folder
 */

/**
 * This is how you create new routers and subrouters in your tRPC API
 * @see https://trpc.io/docs/router
 */
export const createTRPCRouter = t.router;

/**
 * Middleware for lightweight procedure timing.
 */
const timingMiddleware = t.middleware(async ({ ctx, next, path }) => {
  const start = Date.now();

  const result = await ctx.telemetry.trace(
    "trpc.procedure",
    { "trpc.path": path },
    next,
  );

  ctx.logger.info("trpc.procedure.completed", {
    durationMs: Date.now() - start,
    procedure: path,
    status: result.ok ? "ok" : "error",
  });

  return result;
});

const applicationErrorMiddleware = t.middleware(async ({ next }) => {
  try {
    return await next();
  } catch (error) {
    const mapped = mapApplicationErrorToTrpc(error);
    if (mapped)
      throw new TRPCError({
        code: mapped.code,
        cause: error,
        message: mapped.contract.message,
      });
    throw error;
  }
});

/**
 * Public (unauthed) procedure
 *
 * This is the base piece you use to build new queries and mutations on your
 * tRPC API. It does not guarantee that a user querying is authorized, but you
 * can still access user session data if they are logged in
 */
export const publicProcedure = t.procedure
  .use(timingMiddleware)
  .use(applicationErrorMiddleware);

/**
 * Protected (authenticated) procedure
 *
 * If you want a query or mutation to ONLY be accessible to logged in users, use this. It verifies
 * the session is valid and guarantees `ctx.session.user` is not null.
 *
 * @see https://trpc.io/docs/procedures
 */
export const protectedProcedure = t.procedure
  .use(timingMiddleware)
  .use(applicationErrorMiddleware)
  .use(({ ctx, next }) => {
    if (!ctx.session?.user) {
      throw new TRPCError({ code: "UNAUTHORIZED" });
    }
    return next({
      ctx: {
        // infers the `session` as non-nullable
        session: { ...ctx.session, user: ctx.session.user },
      },
    });
  });

export function permissionProcedure(permission: Permission) {
  return protectedProcedure.use(({ ctx, next }) => {
    if (!hasPermission(ctx.session.user.roles, permission)) {
      ctx.logger.warn("auth.authorization.denied", {
        permission,
        roles: ctx.session.user.roles,
        userId: ctx.session.user.id,
      });
      throw new TRPCError({ code: "FORBIDDEN" });
    }
    return next({ ctx });
  });
}
