import { describe, expect, it } from "vitest";

import type { LogRecord } from "./index";
import { createLogger } from "./index";
import { createTelemetry } from "./telemetry";

describe("createLogger", () => {
  it("emits structured child bindings", () => {
    const records: LogRecord[] = [];
    const logger = createLogger({
      service: "api",
      sink: (record) => records.push(record),
      now: () => new Date("2026-01-01T00:00:00.000Z"),
    });

    logger.child({ requestId: "request-1" }).info("request.completed", {
      status: 200,
    });

    expect(records).toEqual([
      {
        level: "info",
        message: "request.completed",
        requestId: "request-1",
        service: "api",
        status: 200,
        timestamp: "2026-01-01T00:00:00.000Z",
      },
    ]);
  });

  it("redacts sensitive fields recursively", () => {
    const records: LogRecord[] = [];
    const logger = createLogger({
      service: "api",
      sink: (record) => records.push(record),
    });

    logger.error("request.failed", {
      authorization: "Bearer value",
      nested: { accessToken: "token", safe: "visible" },
    });

    expect(records[0]).toMatchObject({
      authorization: "[REDACTED]",
      nested: { accessToken: "[REDACTED]", safe: "visible" },
    });
  });
});

describe("createTelemetry", () => {
  it("emits CloudWatch embedded metric format", () => {
    const lines: string[] = [];
    const telemetry = createTelemetry({
      service: "api",
      metricSink: (line) => lines.push(line),
    });
    telemetry.metric("RequestCount", 1, "Count", { stage: "test" });
    expect(JSON.parse(lines[0] ?? "{}")).toMatchObject({
      RequestCount: 1,
      stage: "test",
      _aws: { CloudWatchMetrics: [{ Namespace: "Template/Application" }] },
    });
  });
});
