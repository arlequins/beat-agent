/**
 * Shared env: {@link serverEnv} (server/tooling), {@link clientEnv} (`NEXT_PUBLIC_*`), helpers.
 */

import { clientEnv } from "./env-client.js";
import { serverEnv } from "./env-server.js";

export {
  type ApiDeploymentConfig,
  type ApiDeploymentInput,
  ApiDeploymentPreset,
  type ApiDeploymentPreset as ApiDeploymentPresetType,
  resolveApiDeploymentConfig,
} from "./api-deployment.js";
export { type DatabaseEnv, loadDatabaseEnv } from "./database.js";
export { clientEnv } from "./env-client.js";
export {
  DEFAULT_SST_AWS_REGION,
  globalEnv,
  serverEnv,
  sstAwsRegion,
} from "./env-server.js";
export {
  DEFAULT_LOCALHOST_API_URL,
  DEFAULT_LOCALHOST_SITE_URL,
} from "./public-defaults.js";
export { skipEnvValidation } from "./skip-validation.js";
export {
  DEFAULT_DEPLOY_STAGE,
  DEFAULT_RAW_SST_STAGE,
  DEPLOY_STAGES,
  type DeployStage,
  rawSstStage,
  resolveDeployStage,
  Stage,
  sstStageForResourceNames,
} from "./stage.js";
export { parseAwsIdList, vpcFromEnv, vpcIdFromEnv } from "./vpc.js";

export const LambdaEnvironment = {
  NODE_ENV: "production",
  DATABASE_HOST: serverEnv.DATABASE_HOST!,
  DATABASE_PORT: serverEnv.DATABASE_PORT!,
  DATABASE_USER: serverEnv.DATABASE_USER!,
  DATABASE_PASSWORD: serverEnv.DATABASE_PASSWORD!,
  DATABASE_NAME: serverEnv.DATABASE_NAME!,
  DATABASE_SSL_MODE: serverEnv.DATABASE_SSL_MODE ?? "require",
  OIDC_ISSUER_URL: serverEnv.OIDC_ISSUER_URL!,
  OIDC_AUDIENCE: serverEnv.OIDC_AUDIENCE!,
  ...(serverEnv.OIDC_JWKS_URI
    ? { OIDC_JWKS_URI: serverEnv.OIDC_JWKS_URI }
    : {}),
  ...(serverEnv.OIDC_PROVIDERS_JSON
    ? { OIDC_PROVIDERS_JSON: serverEnv.OIDC_PROVIDERS_JSON }
    : {}),
  ...(serverEnv.AUTH_BOOTSTRAP_ADMIN_IDENTITIES
    ? {
        AUTH_BOOTSTRAP_ADMIN_IDENTITIES:
          serverEnv.AUTH_BOOTSTRAP_ADMIN_IDENTITIES,
      }
    : {}),
  OIDC_ALLOWED_ALGORITHMS: serverEnv.OIDC_ALLOWED_ALGORITHMS ?? "RS256",
  API_CORS_ORIGINS:
    serverEnv.API_CORS_ORIGINS ?? clientEnv.NEXT_PUBLIC_SITE_URL,
  API_BODY_LIMIT_BYTES: String(serverEnv.API_BODY_LIMIT_BYTES ?? 1_048_576),
  API_RATE_LIMIT_REQUESTS: String(serverEnv.API_RATE_LIMIT_REQUESTS ?? 120),
  API_RATE_LIMIT_WINDOW_SECONDS: String(
    serverEnv.API_RATE_LIMIT_WINDOW_SECONDS ?? 60,
  ),

  NEXT_PUBLIC_SITE_URL: clientEnv.NEXT_PUBLIC_SITE_URL,
  NEXT_PUBLIC_API_URL: clientEnv.NEXT_PUBLIC_API_URL,
  NEXT_PUBLIC_OIDC_AUTHORITY: clientEnv.NEXT_PUBLIC_OIDC_AUTHORITY,
  NEXT_PUBLIC_OIDC_CLIENT_ID: clientEnv.NEXT_PUBLIC_OIDC_CLIENT_ID,
  ...(clientEnv.NEXT_PUBLIC_OIDC_RESOURCE
    ? { NEXT_PUBLIC_OIDC_RESOURCE: clientEnv.NEXT_PUBLIC_OIDC_RESOURCE }
    : {}),
  NEXT_PUBLIC_OIDC_SCOPE: clientEnv.NEXT_PUBLIC_OIDC_SCOPE,
  ...(serverEnv.OTEL_EXPORTER_OTLP_ENDPOINT
    ? { OTEL_EXPORTER_OTLP_ENDPOINT: serverEnv.OTEL_EXPORTER_OTLP_ENDPOINT }
    : {}),
  ...(serverEnv.OTEL_EXPORTER_OTLP_HEADERS
    ? { OTEL_EXPORTER_OTLP_HEADERS: serverEnv.OTEL_EXPORTER_OTLP_HEADERS }
    : {}),
  OTEL_SERVICE_NAME: serverEnv.OTEL_SERVICE_NAME ?? "api",
  ...(serverEnv.OTEL_SERVICE_VERSION
    ? { OTEL_SERVICE_VERSION: serverEnv.OTEL_SERVICE_VERSION }
    : {}),
  ...(serverEnv.S3_CACHE_BUCKET
    ? { S3_CACHE_BUCKET: serverEnv.S3_CACHE_BUCKET }
    : {}),
  ...(serverEnv.S3_CACHE_PREFIX
    ? { S3_CACHE_PREFIX: serverEnv.S3_CACHE_PREFIX }
    : {}),
  ...(serverEnv.S3_CACHE_TTL_SECONDS
    ? { S3_CACHE_TTL_SECONDS: String(serverEnv.S3_CACHE_TTL_SECONDS) }
    : {}),
  ...(serverEnv.S3_UPLOAD_BUCKET
    ? { S3_UPLOAD_BUCKET: serverEnv.S3_UPLOAD_BUCKET }
    : {}),
  ...(serverEnv.S3_UPLOAD_PREFIX
    ? { S3_UPLOAD_PREFIX: serverEnv.S3_UPLOAD_PREFIX }
    : {}),
};
