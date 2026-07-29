import { createEnv } from "@t3-oss/env-core";
import { z } from "zod/v4";

import { skipEnvValidation } from "./skip-validation.js";

/** Default for `SST_AWS_REGION` (Zod + {@link sstAwsRegion} fallback when validation is skipped). */
export const DEFAULT_SST_AWS_REGION = "us-east-1" as const;
/**
 * Single source of truth for `process.env` reads in this package.
 * All keys used by `@arlequins/env` are listed in `server` + `runtimeEnv` (no scattered `process.env`).
 *
 * Apps should import this validated object instead of reading `process.env` directly.
 */
export const serverEnv = createEnv({
  server: {
    /** Deploy / workspace name; may be a personal sandbox (not always a known `DeployStage`). */
    SST_STAGE: z.string().optional(),
    /** Local AWS named profile for `sst dev` / CLI; omit in CI. */
    SST_AWS_PROFILE: z.string().optional(),
    /** Region for SST `providers.aws.region`; use {@link sstAwsRegion} for a guaranteed `string`. */
    SST_AWS_REGION: z.string().optional().default(DEFAULT_SST_AWS_REGION),
    /** Optional documentation / tooling; Lambda VPC uses subnet + SG ids only. */
    VPC_ID: z.string().optional(),
    /** Comma-separated subnet ids; if empty with SG, Lambdas are not placed in a VPC. */
    SUBNET_IDS: z.string().optional(),
    SECURITY_GROUP_IDS: z.string().optional(),

    /** Explicit opt-in for the optional SST Aurora Serverless v2 stack. */
    AURORA_ENABLED: z
      .enum(["true", "false"])
      .transform((value) => value === "true")
      .optional()
      .default(false),
    AURORA_SUBNET_IDS: z.string().optional(),
    AURORA_SECURITY_GROUP_IDS: z.string().optional(),
    AURORA_DATABASE_NAME: z
      .string()
      .regex(/^[a-z][a-z0-9_]{0,62}$/)
      .optional(),
    AURORA_MASTER_USERNAME: z
      .string()
      .regex(/^[a-z][a-z0-9_]{0,62}$/)
      .optional(),
    AURORA_MASTER_PASSWORD: z.string().min(16).optional(),
    AURORA_MIN_ACU: z.coerce.number().min(0.5).max(128).optional().default(0.5),
    AURORA_MAX_ACU: z.coerce.number().min(0.5).max(128).optional().default(1),

    DATABASE_HOST: z.string().optional(),
    DATABASE_PORT: z.string().optional(),
    DATABASE_USER: z.string().optional(),
    DATABASE_PASSWORD: z.string().optional(),
    DATABASE_NAME: z.string().optional(),
    POSTGRES_POOL_MAX: z.string().optional(),
    DATABASE_SSL_MODE: z.enum(["disable", "require", "verify-full"]).optional(),
    /** Explicit opt-in for example data outside local and test stages. */
    SEED_SAMPLE_DATA: z
      .enum(["true", "false"])
      .transform((value) => value === "true")
      .optional(),
    /** OIDC issuer expected in API access tokens. */
    OIDC_ISSUER_URL: z.url().optional(),
    /** OAuth resource-server audience expected in API access tokens. */
    OIDC_AUDIENCE: z.string().min(1).optional(),
    /** Optional discovery override for providers with a non-standard JWKS URI. */
    OIDC_JWKS_URI: z.url().optional(),
    /** Comma-separated asymmetric JWT algorithms accepted by the API. */
    OIDC_ALLOWED_ALGORITHMS: z.string().optional(),
    /** JSON array of named issuer, audience, JWKS, and algorithm configurations. */
    OIDC_PROVIDERS_JSON: z.string().optional(),
    /** Comma-separated OIDC `issuer|subject` identities promoted to administrator. */
    AUTH_BOOTSTRAP_ADMIN_IDENTITIES: z.string().optional(),
    /** Initial Beat-owned administrator login. Required only until provisioned. */
    AUTH_INITIAL_ADMIN_EMAIL: z.string().email().optional(),
    /** Initial Beat-owned administrator password; it never reaches the browser. */
    AUTH_INITIAL_ADMIN_PASSWORD: z.string().min(16).optional(),
    /** JSON Web Key with private ES256 material for Beat's OIDC issuer. */
    OIDC_SIGNING_PRIVATE_JWK: z.string().min(1).optional(),
    /** Stable key identifier exposed from Beat's JWKS endpoint. */
    OIDC_SIGNING_KEY_ID: z.string().min(1).optional(),
    /** Enables Beat's first-party production OIDC issuer. */
    INTERNAL_OIDC_ENABLED: z
      .enum(["true", "false"])
      .transform((value) => value === "true")
      .optional()
      .default(false),
    /** Lifetime of a rotating refresh token. */
    OIDC_REFRESH_TOKEN_TTL_DAYS: z.coerce
      .number()
      .int()
      .min(1)
      .max(90)
      .optional(),
    /** Comma-separated browser origins accepted by the Hono API. */
    API_CORS_ORIGINS: z.string().optional(),
    /** Local Hono server port. */
    API_PORT: z.coerce.number().int().min(1).max(65535).optional(),
    /** Public AWS endpoint used by the API deployment. */
    API_DEPLOYMENT_PRESET: z.enum(["function-url", "api-gateway"]).optional(),
    /** Optional Route 53 domain managed by SST. */
    API_CUSTOM_DOMAIN: z.string().min(1).optional(),
    /** Enable an edge WAF for the Function URL preset. */
    API_WAF_ENABLED: z
      .enum(["true", "false"])
      .transform((value) => value === "true")
      .optional(),
    /** API Gateway steady-state requests per second. */
    API_THROTTLE_RATE_LIMIT: z.coerce.number().positive().optional(),
    /** API Gateway maximum request burst. */
    API_THROTTLE_BURST_LIMIT: z.coerce.number().int().positive().optional(),
    /** Maximum JSON request body accepted by the application API. */
    API_BODY_LIMIT_BYTES: z.coerce.number().int().positive().optional(),
    /** Per-instance request allowance for the default application limiter. */
    API_RATE_LIMIT_REQUESTS: z.coerce.number().int().positive().optional(),
    /** Fixed-window duration for the default application limiter. */
    API_RATE_LIMIT_WINDOW_SECONDS: z.coerce
      .number()
      .int()
      .positive()
      .optional(),
    /** Optional SNS topic receiving CloudWatch alarm notifications. */
    ALERT_TOPIC_ARN: z.string().startsWith("arn:aws:sns:").optional(),
    /** OTLP/HTTP collector base URL. Omit to keep export disabled. */
    OTEL_EXPORTER_OTLP_ENDPOINT: z.url().optional(),
    /** Comma-separated OTLP headers in key=value form. */
    OTEL_EXPORTER_OTLP_HEADERS: z.string().optional(),
    /** Logical service identity included in exported resource attributes. */
    OTEL_SERVICE_NAME: z.string().min(1).optional(),
    /** Deployed application version included in exported resource attributes. */
    OTEL_SERVICE_VERSION: z.string().min(1).optional(),
    /** S3 bucket used as an application cache. Omit to disable caching. */
    S3_CACHE_BUCKET: z.string().min(3).optional(),
    /** Object-key prefix used to isolate stages and applications. */
    S3_CACHE_PREFIX: z.string().min(1).optional(),
    /** Default cache lifetime. */
    S3_CACHE_TTL_SECONDS: z.coerce.number().int().positive().optional(),
    /** Optional S3-compatible endpoint for local development. */
    S3_CACHE_ENDPOINT: z.url().optional(),
    /** Required by many local S3-compatible endpoints. */
    S3_CACHE_FORCE_PATH_STYLE: z
      .enum(["true", "false"])
      .transform((value) => value === "true")
      .optional(),
    S3_UPLOAD_BUCKET: z.string().min(3).optional(),
    S3_UPLOAD_PREFIX: z.string().min(1).optional(),
    /** Local-only Ollama endpoint. Omit to keep model completion disabled. */
    OLLAMA_BASE_URL: z.url().optional(),
    /** Pulled Ollama model tag; `qwen3:4b` is the low-memory default. */
    OLLAMA_MODEL: z.string().min(1).optional(),
    /** Pulled local embedding model used by document retrieval. */
    OLLAMA_EMBEDDING_MODEL: z.string().min(1).optional(),
  },
  runtimeEnv: {
    SST_STAGE: process.env.SST_STAGE,
    SST_AWS_PROFILE: process.env.SST_AWS_PROFILE,
    SST_AWS_REGION: process.env.SST_AWS_REGION,
    VPC_ID: process.env.VPC_ID,
    SUBNET_IDS: process.env.SUBNET_IDS,
    SECURITY_GROUP_IDS: process.env.SECURITY_GROUP_IDS,
    AURORA_ENABLED: process.env.AURORA_ENABLED,
    AURORA_SUBNET_IDS: process.env.AURORA_SUBNET_IDS,
    AURORA_SECURITY_GROUP_IDS: process.env.AURORA_SECURITY_GROUP_IDS,
    AURORA_DATABASE_NAME: process.env.AURORA_DATABASE_NAME,
    AURORA_MASTER_USERNAME: process.env.AURORA_MASTER_USERNAME,
    AURORA_MASTER_PASSWORD: process.env.AURORA_MASTER_PASSWORD,
    AURORA_MIN_ACU: process.env.AURORA_MIN_ACU,
    AURORA_MAX_ACU: process.env.AURORA_MAX_ACU,

    DATABASE_HOST: process.env.DATABASE_HOST,
    DATABASE_PORT: process.env.DATABASE_PORT,
    DATABASE_USER: process.env.DATABASE_USER,
    DATABASE_PASSWORD: process.env.DATABASE_PASSWORD,
    DATABASE_NAME: process.env.DATABASE_NAME,
    POSTGRES_POOL_MAX: process.env.POSTGRES_POOL_MAX,
    DATABASE_SSL_MODE: process.env.DATABASE_SSL_MODE,
    SEED_SAMPLE_DATA: process.env.SEED_SAMPLE_DATA,
    OIDC_ISSUER_URL: process.env.OIDC_ISSUER_URL,
    OIDC_AUDIENCE: process.env.OIDC_AUDIENCE,
    OIDC_JWKS_URI: process.env.OIDC_JWKS_URI,
    OIDC_ALLOWED_ALGORITHMS: process.env.OIDC_ALLOWED_ALGORITHMS,
    OIDC_PROVIDERS_JSON: process.env.OIDC_PROVIDERS_JSON,
    AUTH_BOOTSTRAP_ADMIN_IDENTITIES:
      process.env.AUTH_BOOTSTRAP_ADMIN_IDENTITIES,
    AUTH_INITIAL_ADMIN_EMAIL: process.env.AUTH_INITIAL_ADMIN_EMAIL,
    AUTH_INITIAL_ADMIN_PASSWORD: process.env.AUTH_INITIAL_ADMIN_PASSWORD,
    OIDC_SIGNING_PRIVATE_JWK: process.env.OIDC_SIGNING_PRIVATE_JWK,
    OIDC_SIGNING_KEY_ID: process.env.OIDC_SIGNING_KEY_ID,
    INTERNAL_OIDC_ENABLED: process.env.INTERNAL_OIDC_ENABLED,
    OIDC_REFRESH_TOKEN_TTL_DAYS: process.env.OIDC_REFRESH_TOKEN_TTL_DAYS,
    API_CORS_ORIGINS: process.env.API_CORS_ORIGINS,
    API_PORT: process.env.API_PORT,
    API_DEPLOYMENT_PRESET: process.env.API_DEPLOYMENT_PRESET,
    API_CUSTOM_DOMAIN: process.env.API_CUSTOM_DOMAIN,
    API_WAF_ENABLED: process.env.API_WAF_ENABLED,
    API_THROTTLE_RATE_LIMIT: process.env.API_THROTTLE_RATE_LIMIT,
    API_THROTTLE_BURST_LIMIT: process.env.API_THROTTLE_BURST_LIMIT,
    API_BODY_LIMIT_BYTES: process.env.API_BODY_LIMIT_BYTES,
    API_RATE_LIMIT_REQUESTS: process.env.API_RATE_LIMIT_REQUESTS,
    API_RATE_LIMIT_WINDOW_SECONDS: process.env.API_RATE_LIMIT_WINDOW_SECONDS,
    ALERT_TOPIC_ARN: process.env.ALERT_TOPIC_ARN,
    OTEL_EXPORTER_OTLP_ENDPOINT: process.env.OTEL_EXPORTER_OTLP_ENDPOINT,
    OTEL_EXPORTER_OTLP_HEADERS: process.env.OTEL_EXPORTER_OTLP_HEADERS,
    OTEL_SERVICE_NAME: process.env.OTEL_SERVICE_NAME,
    OTEL_SERVICE_VERSION: process.env.OTEL_SERVICE_VERSION,
    S3_CACHE_BUCKET: process.env.S3_CACHE_BUCKET,
    S3_CACHE_PREFIX: process.env.S3_CACHE_PREFIX,
    S3_CACHE_TTL_SECONDS: process.env.S3_CACHE_TTL_SECONDS,
    S3_CACHE_ENDPOINT: process.env.S3_CACHE_ENDPOINT,
    S3_CACHE_FORCE_PATH_STYLE: process.env.S3_CACHE_FORCE_PATH_STYLE,
    S3_UPLOAD_BUCKET: process.env.S3_UPLOAD_BUCKET,
    S3_UPLOAD_PREFIX: process.env.S3_UPLOAD_PREFIX,
    OLLAMA_BASE_URL: process.env.OLLAMA_BASE_URL,
    OLLAMA_MODEL: process.env.OLLAMA_MODEL,
    OLLAMA_EMBEDDING_MODEL: process.env.OLLAMA_EMBEDDING_MODEL,
  },
  emptyStringAsUndefined: true,
  skipValidation: skipEnvValidation,
});

/**
 * For `createEnv({ extends: [globalEnv(), …] })` — same validated object as {@link serverEnv}.
 */
export function globalEnv() {
  return serverEnv;
}

/**
 * SST `providers.aws.region` — always a non-empty string (matches Zod default; covers `skipValidation` / loose typing).
 */
export function sstAwsRegion(): string {
  const r = serverEnv.SST_AWS_REGION;
  if (typeof r === "string" && r.trim().length > 0) {
    return r.trim();
  }
  return DEFAULT_SST_AWS_REGION;
}
