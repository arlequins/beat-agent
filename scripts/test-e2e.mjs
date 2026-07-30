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
  run("pnpm", ["turbo", "run", "build", "--filter=@arlequins/api..."]);
  run("docker", [...composeArgs, "up", "-d", "--wait", "minio-e2e"]);
  run("docker", [...composeArgs, "run", "--rm", "minio-init"]);
  run("pnpm", ["exec", "playwright", "test", ...process.argv.slice(2)]);
} finally {
  run("docker", [...composeArgs, "down", "--volumes"]);
}
