import { spawnSync } from "node:child_process";

const composeArgs = [
  "compose",
  "-p",
  "beat-agent-e2e",
  "-f",
  "compose.e2e.yml",
];

function run(command, args, env = process.env) {
  const result = spawnSync(command, args, {
    env,
    stdio: "inherit",
  });
  if (result.error) throw result.error;
  if (result.status !== 0) {
    throw new Error(`${command} exited with status ${result.status}`);
  }
}

try {
  run("docker", [...composeArgs, "up", "-d", "--wait"]);
  run("pnpm", ["exec", "dotenv", "-e", ".env.e2e", "--", "pnpm", "db:migrate"]);
  run("pnpm", ["exec", "dotenv", "-e", ".env.e2e", "--", "pnpm", "db:seed"], {
    ...process.env,
    SEED_SAMPLE_DATA: "false",
    SST_STAGE: "production",
  });
  run("pnpm", ["exec", "dotenv", "-e", ".env.e2e", "--", "pnpm", "db:seed"]);
  run("pnpm", ["exec", "dotenv", "-e", ".env.e2e", "--", "pnpm", "db:seed"]);
  run("pnpm", ["exec", "playwright", "test", ...process.argv.slice(2)]);
} finally {
  run("docker", [...composeArgs, "down", "--volumes"]);
}
