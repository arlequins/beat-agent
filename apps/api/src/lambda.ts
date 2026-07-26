import { serverEnv } from "@arlequins/env";
import { startObservability } from "@arlequins/logger";

await startObservability({
  endpoint: serverEnv.OTEL_EXPORTER_OTLP_ENDPOINT,
  environment: serverEnv.SST_STAGE,
  headers: serverEnv.OTEL_EXPORTER_OTLP_HEADERS,
  serviceName: serverEnv.OTEL_SERVICE_NAME ?? "api",
  serviceVersion: serverEnv.OTEL_SERVICE_VERSION,
});

const [{ handle }, { app }] = await Promise.all([
  import("hono/aws-lambda"),
  import("./app"),
]);

export const handler = handle(app);
