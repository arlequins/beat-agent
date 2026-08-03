import type { LogRecord } from "@arlequins/logger";
import { createLogger } from "@arlequins/logger";
import { describe, expect, it } from "vitest";

import { createApiApp } from "./app";

describe("API app", () => {
  const app = createApiApp({
    corsOrigins: ["http://localhost:3000"],
    logger: createLogger({ service: "api", sink: () => {} }),
  });

  it("reports process liveness without checking dependencies", async () => {
    const response = await app.request("/health/live");

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toMatchObject({
      checks: { process: "ok" },
      status: "ok",
    });
    expect(response.headers.get("x-request-id")).toBeTruthy();
  });

  it("reports readiness when required dependencies are available", async () => {
    const readyApp = createApiApp({
      corsOrigins: ["http://localhost:3000"],
      logger: createLogger({ service: "api", sink: () => {} }),
      readinessCheck: async () => {},
    });

    const response = await readyApp.request("/health/ready");

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toMatchObject({
      checks: { storage: "ok" },
      status: "ok",
    });
  });

  it("reports unavailable when a required dependency fails", async () => {
    const records: LogRecord[] = [];
    const unavailableApp = createApiApp({
      corsOrigins: ["http://localhost:3000"],
      logger: createLogger({
        service: "api",
        sink: (record) => records.push(record),
      }),
      readinessCheck: async () => {
        throw new Error("storage unavailable");
      },
    });

    const response = await unavailableApp.request("/health/ready");

    expect(response.status).toBe(503);
    await expect(response.json()).resolves.toMatchObject({
      checks: { storage: "unavailable" },
      status: "unavailable",
    });
    expect(records).toContainEqual(
      expect.objectContaining({ message: "health.readiness.failed" }),
    );
  });

  it("returns a structured not-found response", async () => {
    const response = await app.request("/missing");

    expect(response.status).toBe(404);
    await expect(response.json()).resolves.toMatchObject({
      error: "Not Found",
    });
  });

  it("mounts the tRPC fetch handler", async () => {
    const response = await app.request("/api/trpc/missing");

    expect(response.status).toBe(404);
    await expect(response.text()).resolves.toContain("No procedure found");
  });

  it("hosts an executable OpenAPI document", async () => {
    const response = await app.request("/openapi.json");
    const document = (await response.json()) as {
      openapi: string;
      paths: Record<string, Record<string, unknown>>;
    };

    expect(response.status).toBe(200);
    expect(document.openapi).toBe("3.1.0");
    expect(document.paths["/health/live"]?.get).toBeTruthy();
    expect(document.paths["/health/ready"]?.get).toBeTruthy();
    expect(document.paths["/api/echo"]?.post).toBeTruthy();
  });

  it("hosts the API explorer against the local OpenAPI document", async () => {
    const response = await app.request("/docs");
    const html = await response.text();

    expect(response.status).toBe(200);
    expect(response.headers.get("content-type")).toContain("text/html");
    expect(html).toContain("Application API Explorer");
    expect(html).toContain("/openapi.json");
  });

  it("executes a documented JSON request", async () => {
    const response = await app.request("/api/echo", {
      body: JSON.stringify({ message: "Hello from the test client" }),
      headers: {
        "Content-Type": "application/json",
        "X-Request-Id": "echo-request-1",
      },
      method: "POST",
    });

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toMatchObject({
      message: "Hello from the test client",
      requestId: "echo-request-1",
    });
  });

  it("rejects requests that do not match the OpenAPI contract", async () => {
    const response = await app.request("/api/echo", {
      body: JSON.stringify({ message: "" }),
      headers: { "Content-Type": "application/json" },
      method: "POST",
    });

    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toMatchObject({
      error: "Invalid Request",
      requestId: expect.any(String),
    });
  });

  it("propagates the request ID into HTTP and tRPC logs", async () => {
    const records: LogRecord[] = [];
    const loggedApp = createApiApp({
      corsOrigins: ["http://localhost:3000"],
      logger: createLogger({
        service: "api",
        sink: (record) => records.push(record),
      }),
    });

    await loggedApp.request("/api/trpc/missing", {
      headers: { "X-Request-Id": "request-123" },
    });

    expect(records).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          message: "trpc.request.failed",
          requestId: "request-123",
        }),
        expect.objectContaining({
          message: "http.request.completed",
          requestId: "request-123",
        }),
      ]),
    );
  });

  it("allows configured browser origins", async () => {
    const response = await app.request("/api/trpc", {
      method: "OPTIONS",
      headers: {
        Origin: "http://localhost:3000",
        "Access-Control-Request-Method": "POST",
        "Access-Control-Request-Headers": "authorization,trpc-accept",
      },
    });

    expect(response.status).toBe(204);
    expect(response.headers.get("access-control-allow-origin")).toBe(
      "http://localhost:3000",
    );
    expect(response.headers.get("access-control-allow-headers")).toContain(
      "Trpc-Accept",
    );
    expect(response.headers.get("access-control-expose-headers")).toContain(
      "RateLimit-Reset",
    );
  });

  it("rejects oversized tRPC request bodies", async () => {
    const limitedApp = createApiApp({
      bodyLimitBytes: 8,
      corsOrigins: ["http://localhost:3000"],
      logger: createLogger({ service: "api", sink: () => {} }),
      rateLimiter: false,
    });
    const response = await limitedApp.request("/api/trpc/post.create", {
      body: JSON.stringify({ content: "long content" }),
      headers: { "Content-Type": "application/json" },
      method: "POST",
    });
    expect(response.status).toBe(413);
    await expect(response.json()).resolves.toMatchObject({
      error: "Payload Too Large",
    });
  });

  it("returns standard rate-limit metadata", async () => {
    const limitedApp = createApiApp({
      corsOrigins: ["http://localhost:3000"],
      logger: createLogger({ service: "api", sink: () => {} }),
      rateLimit: { requests: 1, windowMs: 60_000 },
    });
    await limitedApp.request("/api/trpc/missing");
    const response = await limitedApp.request("/api/trpc/missing");
    expect(response.status).toBe(429);
    expect(response.headers.get("ratelimit-limit")).toBe("1");
    expect(response.headers.get("retry-after")).toBeTruthy();
  });

  it("sets restrictive API response headers", async () => {
    const response = await app.request("/health/live");
    expect(response.headers.get("referrer-policy")).toBe("no-referrer");
    expect(response.headers.get("permissions-policy")).toContain("camera=()");
    expect(response.headers.get("x-content-type-options")).toBe("nosniff");
  });
});
