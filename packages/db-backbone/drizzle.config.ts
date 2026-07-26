/// <reference types="node" />

import { loadDatabaseEnv } from "@arlequins/env";
import type { Config } from "drizzle-kit";

const dbEnv = loadDatabaseEnv();

export default {
  schema: ["./src/schema.ts"],
  out: "./drizzle",
  dialect: "postgresql",
  schemaFilter: ["sample"],
  migrations: {
    schema: "drizzle",
    table: "__drizzle_migrations",
  },
  dbCredentials: {
    host: dbEnv.host,
    port: dbEnv.port,
    user: dbEnv.user,
    password: dbEnv.password,
    database: dbEnv.database,
    ssl: dbEnv.sslMode === "disable" ? false : dbEnv.sslMode,
  },
  casing: "snake_case",
  strict: true,
  verbose: true,
} satisfies Config;
