import { db } from "@arlequins/db-backbone/client";
import { clientEnv, serverEnv } from "@arlequins/env";
import type { ErrorReporter, Logger, Telemetry } from "@arlequins/logger";
import {
  createLogger,
  createTelemetry,
  noopErrorReporter,
} from "@arlequins/logger";
import type { RateLimitPort } from "@arlequins/service";
import { AppRouter, createTRPCContext, TRPC_HTTP_PATH } from "@arlequins/trpc";
import { streamAgentCompletion } from "@arlequins/trpc/agent-completion";
import { completeAgentInputSchema } from "@arlequins/validators";
import { OpenAPIHono } from "@hono/zod-openapi";
import { fetchRequestHandler } from "@trpc/server/adapters/fetch";
import { sql } from "drizzle-orm";
import { bodyLimit } from "hono/body-limit";
import { cors } from "hono/cors";
import { requestId } from "hono/request-id";
import { secureHeaders } from "hono/secure-headers";
import { createInMemoryRateLimitAdapter } from "./adaptors/in-memory-rate-limit";
import { mapApplicationErrorToHttp } from "./application-error";
import { createInternalOidcRouter } from "./internal-oidc";
import { registerOpenApiRoutes } from "./openapi";

export type ApiBindings = {
  Variables: {
    logger: Logger;
    requestId: string;
  };
};

export type CreateApiAppOptions = {
  corsOrigins?: string[];
  logger?: Logger;
  readinessCheck?: () => Promise<void>;
  externalReadinessChecks?: Record<string, () => Promise<void>>;
  errorReporter?: ErrorReporter;
  telemetry?: Telemetry;
  bodyLimitBytes?: number;
  rateLimit?: { requests: number; windowMs: number };
  rateLimiter?: false | RateLimitPort;
};

let coldStart = true;

async function checkDatabaseReadiness(): Promise<void> {
  await db.execute(sql`select 1`);
}

function configuredCorsOrigins(): string[] {
  const configured =
    serverEnv.API_CORS_ORIGINS ?? clientEnv.NEXT_PUBLIC_SITE_URL;
  return configured
    .split(",")
    .map((origin) => origin.trim().replace(/\/$/, ""))
    .filter(Boolean);
}

function handleTrpcRequest(
  request: Request,
  logger: Logger,
  telemetry: Telemetry,
): Promise<Response> {
  return fetchRequestHandler({
    endpoint: TRPC_HTTP_PATH,
    req: request,
    router: AppRouter,
    createContext: () =>
      createTRPCContext({ headers: request.headers, logger, telemetry }),
    onError({ error, path }) {
      logger.error("trpc.request.failed", {
        error,
        procedure: path ?? "unknown",
      });
    },
  });
}

export function createApiApp(options: CreateApiAppOptions = {}) {
  const app = new OpenAPIHono<ApiBindings>({
    defaultHook(result, context) {
      if (!result.success) {
        return context.json(
          {
            error: "Invalid Request",
            requestId: context.get("requestId"),
          },
          400,
        );
      }
    },
  });
  const corsOrigins = options.corsOrigins ?? configuredCorsOrigins();
  const rootLogger = options.logger ?? createLogger({ service: "api" });
  const readinessCheck = options.readinessCheck ?? checkDatabaseReadiness;
  const externalChecks = options.externalReadinessChecks ?? {};
  const errorReporter = options.errorReporter ?? noopErrorReporter;
  const telemetry =
    options.telemetry ??
    createTelemetry({ service: "api", metricNamespace: "Template/Api" });
  const stage = process.env.SST_STAGE ?? "local";
  const bodyLimitBytes =
    options.bodyLimitBytes ?? serverEnv.API_BODY_LIMIT_BYTES ?? 1_048_576;
  const rateLimit = options.rateLimit ?? {
    requests: serverEnv.API_RATE_LIMIT_REQUESTS ?? 120,
    windowMs: (serverEnv.API_RATE_LIMIT_WINDOW_SECONDS ?? 60) * 1_000,
  };
  const rateLimiter =
    options.rateLimiter === false
      ? undefined
      : (options.rateLimiter ?? createInMemoryRateLimitAdapter());

  app.use("*", requestId());
  app.use("*", async (context, next) => {
    const startedAt = Date.now();
    const logger = rootLogger.child({ requestId: context.get("requestId") });
    context.set("logger", logger);

    await telemetry.trace(
      "http.request",
      { "http.method": context.req.method, "http.route": context.req.path },
      next,
    );

    const durationMs = Date.now() - startedAt;
    logger.info("http.request.completed", {
      durationMs,
      method: context.req.method,
      path: context.req.path,
      status: context.res.status,
    });
    telemetry.metric("RequestCount", 1, "Count", { stage });
    telemetry.metric("RequestDuration", durationMs, "Milliseconds", { stage });
    if (context.res.status >= 500)
      telemetry.metric("ServerErrorCount", 1, "Count", { stage });
    if (coldStart) {
      coldStart = false;
      telemetry.metric("ColdStart", 1, "Count", { stage });
    }
  });
  app.use(
    "*",
    secureHeaders({
      crossOriginResourcePolicy: "same-site",
      permissionsPolicy: {
        camera: [],
        geolocation: [],
        microphone: [],
      },
      referrerPolicy: "no-referrer",
    }),
  );
  app.use(
    "*",
    cors({
      origin: corsOrigins,
      allowHeaders: [
        "Authorization",
        "Content-Type",
        "Trpc-Accept",
        "X-Request-Id",
      ],
      allowMethods: ["GET", "POST", "OPTIONS"],
      exposeHeaders: [
        "RateLimit-Limit",
        "RateLimit-Remaining",
        "RateLimit-Reset",
        "Retry-After",
        "X-Request-Id",
      ],
      maxAge: 86_400,
    }),
  );

  const trpcPaths = [TRPC_HTTP_PATH, `${TRPC_HTTP_PATH}/*`, "/agent/stream"];
  for (const path of trpcPaths) {
    app.use(
      path,
      bodyLimit({
        maxSize: bodyLimitBytes,
        onError: (context) =>
          context.json(
            {
              error: "Payload Too Large",
              requestId: context.get("requestId"),
            },
            413,
          ),
      }),
    );
    app.use(path, async (context, next) => {
      if (!rateLimiter || context.req.method === "OPTIONS") return next();
      const forwardedFor = context.req.header("x-forwarded-for") ?? "local";
      const clientKey = forwardedFor.split(",")[0]?.trim() || "unknown";
      const decision = await rateLimiter.consume({
        key: clientKey,
        limit: rateLimit.requests,
        now: new Date(),
        windowMs: rateLimit.windowMs,
      });
      context.header("RateLimit-Limit", String(decision.limit));
      context.header("RateLimit-Remaining", String(decision.remaining));
      context.header(
        "RateLimit-Reset",
        String(Math.ceil(decision.resetAt.getTime() / 1_000)),
      );
      if (!decision.allowed) {
        const retryAfter = Math.max(
          1,
          Math.ceil((decision.resetAt.getTime() - Date.now()) / 1_000),
        );
        context.header("Retry-After", String(retryAfter));
        context.get("logger").warn("http.rate_limit.exceeded");
        telemetry.metric("RateLimitExceeded", 1, "Count", { stage });
        return context.json(
          {
            error: "Too Many Requests",
            requestId: context.get("requestId"),
          },
          429,
        );
      }
      return next();
    });
  }

  registerOpenApiRoutes(app, {
    externalReadinessChecks: externalChecks,
    readinessCheck,
  });

  if (serverEnv.INTERNAL_OIDC_ENABLED) {
    app.route("/oidc", createInternalOidcRouter(db, { rateLimiter }));
  }

  app.post("/agent/stream", async (context) => {
    const parsed = completeAgentInputSchema.safeParse(await context.req.json());
    if (!parsed.success) {
      return context.json(
        { error: "Invalid Request", requestId: context.get("requestId") },
        400,
      );
    }
    const trpcContext = await createTRPCContext({
      headers: context.req.raw.headers,
      logger: context.get("logger"),
      telemetry,
    });
    const session = trpcContext.session;
    if (!session?.user) {
      return context.json(
        { error: "Unauthorized", requestId: context.get("requestId") },
        401,
      );
    }
    const encoder = new TextEncoder();
    const body = new ReadableStream<Uint8Array>({
      async start(controller) {
        try {
          for await (const event of streamAgentCompletion(
            trpcContext.services,
            session.user.id,
            parsed.data,
          )) {
            controller.enqueue(encoder.encode(`${JSON.stringify(event)}\n`));
          }
        } catch (error) {
          context.get("logger").error("agent.stream.failed", { error });
          controller.enqueue(
            encoder.encode(
              `${JSON.stringify({ message: "Local model request failed", type: "error" })}\n`,
            ),
          );
        } finally {
          controller.close();
        }
      },
    });
    return new Response(body, {
      headers: {
        "Cache-Control": "no-cache",
        "Content-Type": "application/x-ndjson",
        "X-Accel-Buffering": "no",
      },
    });
  });

  app.all(TRPC_HTTP_PATH, (context) =>
    handleTrpcRequest(context.req.raw, context.get("logger"), telemetry),
  );
  app.all(`${TRPC_HTTP_PATH}/*`, (context) =>
    handleTrpcRequest(context.req.raw, context.get("logger"), telemetry),
  );

  app.notFound((context) =>
    context.json(
      { error: "Not Found", requestId: context.get("requestId") },
      404,
    ),
  );

  app.onError((error, context) => {
    const applicationError = mapApplicationErrorToHttp(error);
    if (applicationError) {
      context.get("logger").warn("http.application-error", {
        code: applicationError.body.error.code,
        error,
      });
      return context.json(
        { ...applicationError.body, requestId: context.get("requestId") },
        applicationError.status,
      );
    }
    context.get("logger").error("http.request.failed", { error });
    void errorReporter.report(error, {
      method: context.req.method,
      path: context.req.path,
      requestId: context.get("requestId"),
    });
    return context.json(
      { error: "Internal Server Error", requestId: context.get("requestId") },
      500,
    );
  });

  return app;
}

export const app = createApiApp();
