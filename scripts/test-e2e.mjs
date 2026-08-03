import { spawnSync } from "node:child_process";
import { readFileSync } from "node:fs";

const e2eEnv = {
  ...process.env,
  ...Object.fromEntries(
    readFileSync(".env.e2e", "utf8")
      .split(/\r?\n/)
      .map((line) => line.trim())
      .filter((line) => line.length > 0 && !line.startsWith("#"))
      .map((line) => {
        const separator = line.indexOf("=");
        if (separator <= 0) throw new Error(`Invalid .env.e2e line: ${line}`);
        return [line.slice(0, separator), line.slice(separator + 1)];
      }),
  ),
};

const composeArgs = [
  "compose",
  "-p",
  "beat-agent-e2e",
  "-f",
  "compose.e2e.yml",
];

function run(command, args, env = e2eEnv) {
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
