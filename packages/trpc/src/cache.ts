import { serverEnv } from "@arlequins/env";
import { createLogger, createTelemetry } from "@arlequins/logger";
import type { Cache } from "@arlequins/s3-cache";
import { CacheNamespace, createS3Cache } from "@arlequins/s3-cache";
import { S3Client } from "@aws-sdk/client-s3";

let databaseCache: Cache | undefined;
const cacheLogger = createLogger({
  bindings: { component: "s3-cache" },
  service: "api",
});
const cacheTelemetry = createTelemetry({ service: "api-cache" });

export function getPostCache(): Cache | undefined {
  if (!serverEnv.S3_CACHE_BUCKET) return undefined;
  if (databaseCache) return databaseCache;

  const client = new S3Client({
    endpoint: serverEnv.S3_CACHE_ENDPOINT,
    forcePathStyle: serverEnv.S3_CACHE_FORCE_PATH_STYLE,
    region: serverEnv.SST_AWS_REGION,
  });
  databaseCache = createS3Cache({
    bucket: serverEnv.S3_CACHE_BUCKET,
    client,
    defaultTtlSeconds: serverEnv.S3_CACHE_TTL_SECONDS,
    onError: (error, operation) =>
      cacheLogger.warn("cache.s3.failed", { error, operation }),
    onMetric: ({ durationMs, operation, outcome }) => {
      const dimensions = { operation, outcome };
      cacheTelemetry.metric("CacheOperationCount", 1, "Count", dimensions);
      cacheTelemetry.metric(
        "CacheOperationLatency",
        durationMs,
        "Milliseconds",
        dimensions,
      );
    },
    prefix: serverEnv.S3_CACHE_PREFIX ?? serverEnv.SST_STAGE ?? "local",
  })
    .namespace(CacheNamespace.DATABASE)
    .namespace("posts");
  return databaseCache;
}
