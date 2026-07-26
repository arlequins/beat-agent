#!/usr/bin/env node
import { spawnSync } from "node:child_process";
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";

const project = "template-migration-upgrade";
const compose = ["compose", "-p", project, "-f", "compose.yml"];
const env = {
  ...process.env,
  DATABASE_HOST: "localhost",
  DATABASE_NAME: "app",
  DATABASE_PASSWORD: "postgres",
  DATABASE_PORT: "55435",
  DATABASE_SSL_MODE: "disable",
  DATABASE_USER: "postgres",
  POSTGRES_HOST_PORT: "55435",
};

function run(command, args, options = {}) {
  const result = spawnSync(command, args, {
    env,
    stdio: "inherit",
    ...options,
  });
  if (result.error) throw result.error;
  if (result.status !== 0)
    throw new Error(`${command} exited with ${result.status}`);
}

try {
  run("docker", [...compose, "up", "-d", "--wait", "postgres"]);
  run(
    "docker",
    [
      ...compose,
      "exec",
      "-T",
      "postgres",
      "psql",
      "-h",
      "127.0.0.1",
      "-U",
      "postgres",
      "-d",
      "app",
      "-v",
      "ON_ERROR_STOP=1",
    ],
    { input: readFileSync("packages/db-backbone/drizzle/0000_init.sql") },
  );
  const initialMigration = readFileSync(
    "packages/db-backbone/drizzle/0000_init.sql",
    "utf8",
  );
  const journal = JSON.parse(
    readFileSync("packages/db-backbone/drizzle/meta/_journal.json", "utf8"),
  );
  const migrationHash = createHash("sha256")
    .update(initialMigration)
    .digest("hex");
  const appliedAt = journal.entries[0].when;
  run(
    "docker",
    [
      ...compose,
      "exec",
      "-T",
      "postgres",
      "psql",
      "-h",
      "127.0.0.1",
      "-U",
      "postgres",
      "-d",
      "app",
      "-v",
      "ON_ERROR_STOP=1",
    ],
    {
      input: `create schema drizzle;
create table drizzle.__drizzle_migrations (id serial primary key, hash text not null, created_at bigint);
insert into drizzle.__drizzle_migrations (hash, created_at) values ('${migrationHash}', ${appliedAt});
`,
    },
  );
  run("pnpm", [
    "exec",
    "dotenv",
    "-e",
    ".env.localhost",
    "--",
    "pnpm",
    "db:migrate",
  ]);
  run("docker", [
    ...compose,
    "exec",
    "-T",
    "postgres",
    "psql",
    "-h",
    "127.0.0.1",
    "-U",
    "postgres",
    "-d",
    "app",
    "-v",
    "ON_ERROR_STOP=1",
    "-c",
    `do $$ begin
      if to_regclass('sample.post') is null then raise exception 'sample.post is missing'; end if;
      if to_regclass('auth.app_user') is null then raise exception 'auth.app_user is missing'; end if;
      if to_regclass('sample.idempotency_record') is null then raise exception 'idempotency table is missing'; end if;
      if not exists (select 1 from information_schema.columns where table_schema = 'sample' and table_name = 'post' and column_name = 'version') then raise exception 'post.version is missing'; end if;
    end $$`,
  ]);
} finally {
  run("docker", [...compose, "down", "--volumes"]);
}
