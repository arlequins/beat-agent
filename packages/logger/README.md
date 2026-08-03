# `@arlequins/logger`

Small structured JSON logger shared by server applications and packages.

- Create one root logger per process with `createLogger({ service })`.
- Create child loggers for request IDs, batch IDs, and components.
- Use stable event names such as `http.request.completed` instead of prose messages.
- Pass identifiers and counts as fields. Do not log request bodies or authentication data.
- Keys containing authorization, cookies, passwords, secrets, tokens, or API keys are redacted recursively.

Applications can inject a custom `sink` for tests or alternate log transports.

## OpenTelemetry

`startObservability()` installs the Node SDK, Node auto-instrumentations, and
OTLP/HTTP exporters for traces and metrics. Call it before importing instrumented
runtime modules. An omitted endpoint is an intentional no-op, so local startup
does not require a collector.

```ts
await startObservability({
  endpoint: serverEnv.OTEL_EXPORTER_OTLP_ENDPOINT,
  serviceName: "api",
});
```

Call `shutdownObservability()` before a controlled process exit to flush pending
telemetry. Lambda initializes the SDK once during module loading and reuses it
across warm invocations.
