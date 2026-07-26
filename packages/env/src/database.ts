import { z } from "zod/v4";

import { serverEnv } from "./env-server.js";

export type DatabaseEnv = {
  host: string;
  port: number;
  user: string;
  password: string;
  database: string;
  poolMax: number;
  sslMode: "disable" | "require" | "verify-full";
};

/**
 * Strict connection shape — values come from {@link serverEnv} (validated at load time).
 * Use `loadDatabaseEnv()` for the shape expected by `postgres` / Drizzle.
 */
const databaseConnectionSchema = z.object({
  DATABASE_HOST: z.string().min(1),
  DATABASE_PORT: z.coerce.number().int().min(1).max(65535),
  DATABASE_USER: z.string().min(1),
  DATABASE_PASSWORD: z.string().min(1),
  DATABASE_NAME: z.string().min(1),
  POSTGRES_POOL_MAX: z.preprocess(
    (val) => (val === "" || val === undefined ? undefined : val),
    z.coerce.number().int().min(1).max(500).default(10),
  ),
  DATABASE_SSL_MODE: z
    .enum(["disable", "require", "verify-full"])
    .default("require"),
});

/** Shared by `@arlequins/db-backbone` `client.ts` and `drizzle.config.ts`. */
export function loadDatabaseEnv(): DatabaseEnv {
  const row = databaseConnectionSchema.parse({
    DATABASE_HOST: serverEnv.DATABASE_HOST,
    DATABASE_PORT: serverEnv.DATABASE_PORT,
    DATABASE_USER: serverEnv.DATABASE_USER,
    DATABASE_PASSWORD: serverEnv.DATABASE_PASSWORD,
    DATABASE_NAME: serverEnv.DATABASE_NAME,
    POSTGRES_POOL_MAX: serverEnv.POSTGRES_POOL_MAX,
    DATABASE_SSL_MODE: serverEnv.DATABASE_SSL_MODE,
  });
  return {
    host: row.DATABASE_HOST,
    port: row.DATABASE_PORT,
    user: row.DATABASE_USER,
    password: row.DATABASE_PASSWORD,
    database: row.DATABASE_NAME,
    poolMax: row.POSTGRES_POOL_MAX,
    sslMode: row.DATABASE_SSL_MODE,
  };
}
