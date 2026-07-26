import { createRoute, type OpenAPIHono, z } from "@hono/zod-openapi";
import { Scalar } from "@scalar/hono-api-reference";
import type { ApiBindings } from "./app";

const RequestIdSchema = z.string().openapi({
  description: "Identifier propagated through logs and response headers",
  example: "01J4JQ9X8Y7R6T5S4V3W2X1Z0A",
});

const LivenessSchema = z
  .object({
    checks: z.object({ process: z.literal("ok") }),
    requestId: RequestIdSchema,
    status: z.literal("ok"),
  })
  .openapi("Liveness");

const ReadinessSchema = z
  .object({
    checks: z.object({ database: z.enum(["ok", "unavailable"]) }),
    requestId: RequestIdSchema,
    status: z.enum(["ok", "unavailable"]),
  })
  .openapi("Readiness");

const EchoRequestSchema = z
  .object({
    message: z.string().min(1).max(1_000).openapi({
      description: "Text returned by the API",
      example: "Hello from the API explorer",
    }),
  })
  .openapi("EchoRequest");

const EchoResponseSchema = z
  .object({
    message: z.string(),
    receivedAt: z.string().datetime(),
    requestId: RequestIdSchema,
  })
  .openapi("EchoResponse");

const ErrorSchema = z
  .object({
    error: z.string(),
    requestId: RequestIdSchema,
  })
  .openapi("ApiError");

const ScalarCdn = "https://cdn.jsdelivr.net/npm/@scalar/api-reference@1.63.0";

const livenessRoute = createRoute({
  description: "Reports whether the API process can receive requests.",
  method: "get",
  path: "/health/live",
  responses: {
    200: {
      content: { "application/json": { schema: LivenessSchema } },
      description: "The process is alive.",
    },
  },
  summary: "Liveness check",
  tags: ["Operations"],
});

const readinessRoute = createRoute({
  description: "Checks PostgreSQL and any configured external dependencies.",
  method: "get",
  path: "/health/ready",
  responses: {
    200: {
      content: { "application/json": { schema: ReadinessSchema } },
      description: "All required dependencies are available.",
    },
    503: {
      content: { "application/json": { schema: ReadinessSchema } },
      description: "At least one required dependency is unavailable.",
    },
  },
  summary: "Readiness check",
  tags: ["Operations"],
});

const echoRoute = createRoute({
  description:
    "Sends a JSON request through the real API and returns the validated message.",
  method: "post",
  path: "/api/echo",
  request: {
    body: {
      content: { "application/json": { schema: EchoRequestSchema } },
      required: true,
    },
  },
  responses: {
    200: {
      content: { "application/json": { schema: EchoResponseSchema } },
      description: "The API accepted and echoed the request.",
    },
    400: {
      content: { "application/json": { schema: ErrorSchema } },
      description: "The request body did not match the API contract.",
    },
  },
  summary: "Test a JSON request",
  tags: ["Examples"],
});

export function registerOpenApiRoutes(
  app: OpenAPIHono<ApiBindings>,
  options: {
    externalReadinessChecks: Record<string, () => Promise<void>>;
    readinessCheck: () => Promise<void>;
  },
) {
  const liveResponse = (requestId: string) => ({
    checks: { process: "ok" as const },
    requestId,
    status: "ok" as const,
  });

  app.openapi(livenessRoute, (context) =>
    context.json(liveResponse(context.get("requestId")), 200),
  );
  app.get("/health", (context) =>
    context.json(liveResponse(context.get("requestId"))),
  );

  app.openapi(readinessRoute, async (context) => {
    try {
      await options.readinessCheck();
      for (const check of Object.values(options.externalReadinessChecks)) {
        await check();
      }
      return context.json(
        {
          checks: { database: "ok" as const },
          requestId: context.get("requestId"),
          status: "ok" as const,
        },
        200,
      );
    } catch (error) {
      context.get("logger").warn("health.readiness.failed", { error });
      return context.json(
        {
          checks: { database: "unavailable" as const },
          requestId: context.get("requestId"),
          status: "unavailable" as const,
        },
        503,
      );
    }
  });

  app.openapi(echoRoute, (context) => {
    const input = context.req.valid("json");
    return context.json(
      {
        message: input.message,
        receivedAt: new Date().toISOString(),
        requestId: context.get("requestId"),
      },
      200,
    );
  });

  app.doc("/openapi.json", (context) => ({
    info: {
      description:
        "Executable HTTP API contract. The typed tRPC transport remains documented by its TypeScript router contract.",
      title: "Application API",
      version: "1.0.0",
    },
    openapi: "3.1.0",
    servers: [
      {
        description: "Current API host",
        url: new URL(context.req.url).origin,
      },
    ],
  }));
  app.get(
    "/docs",
    Scalar({
      cdn: ScalarCdn,
      defaultHttpClient: { clientKey: "fetch", targetKey: "js" },
      layout: "modern",
      pageTitle: "Application API Explorer",
      persistAuth: true,
      spec: { url: "/openapi.json" },
      theme: "saturn",
    }),
  );
}
