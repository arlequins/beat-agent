import type { Counter, Histogram } from "@opentelemetry/api";
import { metrics, SpanStatusCode, trace } from "@opentelemetry/api";

export type TraceAttributes = Record<string, boolean | number | string>;

export type Telemetry = {
  trace<T>(
    name: string,
    attributes: TraceAttributes,
    operation: () => Promise<T>,
  ): Promise<T>;
  metric(
    name: string,
    value: number,
    unit: "Count" | "Milliseconds",
    dimensions?: Record<string, string>,
  ): void;
};

export type ErrorReporter = {
  report(
    error: unknown,
    context?: Record<string, unknown>,
  ): void | Promise<void>;
};

export const noopErrorReporter: ErrorReporter = { report: () => undefined };

export function createTelemetry(options: {
  service: string;
  metricNamespace?: string;
  metricSink?: (line: string) => void;
}): Telemetry {
  const tracer = trace.getTracer(options.service);
  const meter = metrics.getMeter(options.service);
  const counters = new Map<string, Counter>();
  const histograms = new Map<string, Histogram>();
  const metricSink = options.metricSink ?? console.log;
  const namespace = options.metricNamespace ?? "Template/Application";

  return {
    async trace(name, attributes, operation) {
      return tracer.startActiveSpan(name, { attributes }, async (span) => {
        try {
          const result = await operation();
          span.setStatus({ code: SpanStatusCode.OK });
          return result;
        } catch (error) {
          span.recordException(error instanceof Error ? error : String(error));
          span.setStatus({ code: SpanStatusCode.ERROR });
          throw error;
        } finally {
          span.end();
        }
      });
    },
    metric(name, value, unit, dimensions = {}) {
      if (unit === "Milliseconds") {
        let histogram = histograms.get(name);
        if (!histogram) {
          histogram = meter.createHistogram(name, { unit: "ms" });
          histograms.set(name, histogram);
        }
        histogram.record(value, dimensions);
      } else {
        let counter = counters.get(name);
        if (!counter) {
          counter = meter.createCounter(name, { unit: "1" });
          counters.set(name, counter);
        }
        counter.add(value, dimensions);
      }
      metricSink(
        JSON.stringify({
          _aws: {
            Timestamp: Date.now(),
            CloudWatchMetrics: [
              {
                Namespace: namespace,
                Dimensions: [Object.keys(dimensions)],
                Metrics: [{ Name: name, Unit: unit }],
              },
            ],
          },
          ...dimensions,
          [name]: value,
        }),
      );
    },
  };
}
