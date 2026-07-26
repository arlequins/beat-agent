/// <reference types="node" />
import { loadDatabaseEnv } from "@arlequins/env";
import { sql } from "drizzle-orm";
import { drizzle } from "drizzle-orm/postgres-js";
import { migrate } from "drizzle-orm/postgres-js/migrator";
import postgres from "postgres";

const MIGRATION_LOCK_ID = 7_243_110_593_127_411n;
const env = loadDatabaseEnv();
const client = postgres({
  host: env.host,
  port: env.port,
  user: env.user,
  password: env.password,
  database: env.database,
  max: 1,
  ssl: env.sslMode === "disable" ? false : env.sslMode,
});
const migrationDb = drizzle(client);

try {
  await migrationDb.execute(sql`select pg_advisory_lock(${MIGRATION_LOCK_ID})`);
  console.log("Acquired the database migration lock.");
  await migrate(migrationDb, { migrationsFolder: "./drizzle" });
  console.log("Database migrations completed.");
} finally {
  await migrationDb.execute(
    sql`select pg_advisory_unlock(${MIGRATION_LOCK_ID})`,
  );
  await client.end({ timeout: 5 });
}
