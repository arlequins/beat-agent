import { afterEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  autoInstrumentations: vi.fn(() => ["instrumentation"]),
  metricExporter: vi.fn(function MetricExporter() {}),
  metricReader: vi.fn(function MetricReader() {}),
  nodeSdk: vi.fn(),
  resource: vi.fn(() => ({ resource: true })),
  shutdown: vi.fn(),
  start: vi.fn(),
  traceExporter: vi.fn(function TraceExporter() {}),
}));

vi.mock("@opentelemetry/auto-instrumentations-node", () => ({
  getNodeAutoInstrumentations: mocks.autoInstrumentations,
}));
vi.mock("@opentelemetry/exporter-metrics-otlp-http", () => ({
  OTLPMetricExporter: mocks.metricExporter,
}));
vi.mock("@opentelemetry/exporter-trace-otlp-http", () => ({
  OTLPTraceExporter: mocks.traceExporter,
}));
vi.mock("@opentelemetry/resources", () => ({
  resourceFromAttributes: mocks.resource,
}));
vi.mock("@opentelemetry/sdk-metrics", () => ({
  PeriodicExportingMetricReader: mocks.metricReader,
}));
vi.mock("@opentelemetry/sdk-node", () => ({
  NodeSDK: mocks.nodeSdk,
}));

import {
  parseOtlpHeaders,
  shutdownObservability,
  startObservability,
} from "./sdk";

mocks.nodeSdk.mockImplementation(function NodeSdkDouble() {
  return { shutdown: mocks.shutdown, start: mocks.start };
});

afterEach(async () => {
  await shutdownObservability();
  vi.clearAllMocks();
});

describe("parseOtlpHeaders", () => {
  it("parses and decodes standard OTLP headers", () => {
    expect(
      parseOtlpHeaders("authorization=Bearer%20token,x-tenant=acme"),
    ).toEqual({
      authorization: "Bearer token",
      "x-tenant": "acme",
    });
  });

  it("rejects malformed entries", () => {
    expect(() => parseOtlpHeaders("authorization")).toThrow(
      "Invalid OTLP header",
    );
  });

  it("returns an empty header set when configuration is absent", () => {
    expect(parseOtlpHeaders()).toEqual({});
  });
});

describe("OpenTelemetry SDK lifecycle", () => {
  it("stays disabled without an endpoint", async () => {
    await expect(startObservability({ serviceName: "beat-api" })).resolves.toBe(
      false,
    );
    expect(mocks.nodeSdk).not.toHaveBeenCalled();
  });

  it("starts once with normalized signal URLs and resource attributes", async () => {
    await expect(
      startObservability({
        endpoint: "https://otel.beat.test/",
        environment: "production",
        headers: "authorization=Bearer%20token",
        serviceName: "beat-api",
        serviceVersion: "1.2.3",
      }),
    ).resolves.toBe(true);
    await expect(
      startObservability({
        endpoint: "https://ignored.test",
        serviceName: "ignored",
      }),
    ).resolves.toBe(false);

    expect(mocks.resource).toHaveBeenCalledWith({
      "deployment.environment.name": "production",
      "service.name": "beat-api",
      "service.version": "1.2.3",
    });
    expect(mocks.traceExporter).toHaveBeenCalledWith({
      headers: { authorization: "Bearer token" },
      url: "https://otel.beat.test/v1/traces",
    });
    expect(mocks.metricExporter).toHaveBeenCalledWith({
      headers: { authorization: "Bearer token" },
      url: "https://otel.beat.test/v1/metrics",
    });
    expect(mocks.start).toHaveBeenCalledOnce();
  });

  it("uses local resource defaults and shuts down idempotently", async () => {
    await startObservability({
      endpoint: "https://otel.beat.test",
      serviceName: "beat-worker",
    });

    await shutdownObservability();
    await shutdownObservability();

    expect(mocks.resource).toHaveBeenCalledWith({
      "deployment.environment.name": "local",
      "service.name": "beat-worker",
    });
    expect(mocks.shutdown).toHaveBeenCalledOnce();
  });
});
