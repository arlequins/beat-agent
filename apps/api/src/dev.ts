import { serverEnv } from "@arlequins/env";
import { createLogger, startObservability } from "@arlequins/logger";

await startObservability({
  endpoint: serverEnv.OTEL_EXPORTER_OTLP_ENDPOINT,
  environment: serverEnv.SST_STAGE,
  headers: serverEnv.OTEL_EXPORTER_OTLP_HEADERS,
  serviceName: serverEnv.OTEL_SERVICE_NAME ?? "api",
  serviceVersion: serverEnv.OTEL_SERVICE_VERSION,
});

const [{ serve }, { app }] = await Promise.all([
  import("@hono/node-server"),
  import("./app"),
]);

const port = serverEnv.API_PORT ?? 5000;
const logger = createLogger({ service: "api" });

serve({ fetch: app.fetch, port }, (info) => {
  logger.info("api.started", {
    port: info.port,
    storage: {
      bucket: serverEnv.S3_AGENT_BUCKET,
      endpoint: serverEnv.S3_AGENT_ENDPOINT,
      forcePathStyle: serverEnv.S3_AGENT_FORCE_PATH_STYLE,
      prefix: serverEnv.S3_AGENT_PREFIX,
    },
  });
});
