import { getNodeAutoInstrumentations } from "@opentelemetry/auto-instrumentations-node";
import { OTLPMetricExporter } from "@opentelemetry/exporter-metrics-otlp-http";
import { OTLPTraceExporter } from "@opentelemetry/exporter-trace-otlp-http";
import { resourceFromAttributes } from "@opentelemetry/resources";
import { PeriodicExportingMetricReader } from "@opentelemetry/sdk-metrics";
import { NodeSDK } from "@opentelemetry/sdk-node";

export type ObservabilityOptions = {
  endpoint?: string;
  environment?: string;
  headers?: string;
  serviceName: string;
  serviceVersion?: string;
};

let sdk: NodeSDK | undefined;

export function parseOtlpHeaders(value?: string): Record<string, string> {
  if (!value) return {};

  return Object.fromEntries(
    value
      .split(",")
      .map((entry) => entry.trim())
      .filter(Boolean)
      .map((entry) => {
        const separator = entry.indexOf("=");
        if (separator < 1) {
          throw new Error(`Invalid OTLP header: ${entry}`);
        }
        return [
          decodeURIComponent(entry.slice(0, separator).trim()),
          decodeURIComponent(entry.slice(separator + 1).trim()),
        ];
      }),
  );
}

function signalUrl(endpoint: string, signal: "metrics" | "traces"): string {
  return `${endpoint.replace(/\/$/, "")}/v1/${signal}`;
}

export async function startObservability(
  options: ObservabilityOptions,
): Promise<boolean> {
  if (!options.endpoint || sdk) return false;

  const headers = parseOtlpHeaders(options.headers);
  sdk = new NodeSDK({
    resource: resourceFromAttributes({
      "deployment.environment.name": options.environment ?? "local",
      "service.name": options.serviceName,
      ...(options.serviceVersion
        ? { "service.version": options.serviceVersion }
        : {}),
    }),
    traceExporter: new OTLPTraceExporter({
      url: signalUrl(options.endpoint, "traces"),
      headers,
    }),
    metricReader: new PeriodicExportingMetricReader({
      exporter: new OTLPMetricExporter({
        url: signalUrl(options.endpoint, "metrics"),
        headers,
      }),
    }),
    instrumentations: [
      getNodeAutoInstrumentations({
        "@opentelemetry/instrumentation-fs": { enabled: false },
      }),
    ],
  });

  sdk.start();
  return true;
}

export async function shutdownObservability(): Promise<void> {
  const activeSdk = sdk;
  sdk = undefined;
  await activeSdk?.shutdown();
}
