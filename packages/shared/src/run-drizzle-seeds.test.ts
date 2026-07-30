import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("@arlequins/env", () => ({
  resolveDeployStage: () => "test",
}));

import { runDrizzleSeeds } from "./seed";

const temporaryDirectories: string[] = [];

async function seedWorkspace() {
  const scriptDir = await mkdtemp(join(tmpdir(), "beat-agent-seeds-"));
  temporaryDirectories.push(scriptDir);
  await mkdir(join(scriptDir, "seeds/reference"), { recursive: true });
  return scriptDir;
}

function database(applied: string[] = []) {
  const transactionExecute = vi.fn().mockResolvedValue(undefined);
  const execute = vi
    .fn()
    .mockResolvedValueOnce(undefined)
    .mockResolvedValueOnce(undefined)
    .mockResolvedValueOnce(applied.map((name) => ({ name })));
  const transaction = vi.fn(
    async (run: (tx: { execute: typeof transactionExecute }) => unknown) =>
      run({ execute: transactionExecute }),
  );
  return { db: { execute, transaction }, execute, transactionExecute };
}

afterEach(async () => {
  vi.restoreAllMocks();
  await Promise.all(
    temporaryDirectories
      .splice(0)
      .map((path) => rm(path, { recursive: true, force: true })),
  );
});

describe("runDrizzleSeeds", () => {
  it("creates the ledger and exits cleanly when no seed directory exists", async () => {
    const scriptDir = await mkdtemp(join(tmpdir(), "beat-agent-seeds-"));
    temporaryDirectories.push(scriptDir);
    const { db, execute } = database();

    await runDrizzleSeeds({ db, scriptDir });

    expect(execute).toHaveBeenCalledTimes(2);
  });

  it("skips underscore, non-TypeScript, and previously applied seeds", async () => {
    const scriptDir = await seedWorkspace();
    await writeFile(
      join(scriptDir, "seeds/reference/_helper.ts"),
      "throw new Error('must not load');",
    );
    await writeFile(join(scriptDir, "seeds/reference/readme.md"), "not a seed");
    await writeFile(
      join(scriptDir, "seeds/reference/001-applied.ts"),
      "throw new Error('must not load');",
    );
    const appliedName = "seeds/reference/001-applied.ts";
    const { db, execute } = database([appliedName, { invalid: true } as never]);

    await runDrizzleSeeds({ db, scriptDir });

    expect(execute).toHaveBeenCalledTimes(3);
  });

  it("runs seeds in sorted order and records each in its transaction", async () => {
    const scriptDir = await seedWorkspace();
    await writeFile(
      join(scriptDir, "seeds/reference/020-second.ts"),
      "export default async ({ tx, stage }) => tx.execute({ seed: 'second', stage });",
    );
    await writeFile(
      join(scriptDir, "seeds/reference/010-first.ts"),
      "export default async ({ tx, stage }) => tx.execute({ seed: 'first', stage });",
    );
    const { db, transactionExecute } = database();

    await runDrizzleSeeds({ db, scriptDir });

    expect(transactionExecute).toHaveBeenCalledTimes(4);
    expect(transactionExecute.mock.calls[0]?.[0]).toMatchObject({
      seed: "first",
    });
    expect(transactionExecute.mock.calls[2]?.[0]).toMatchObject({
      seed: "second",
    });
  });

  it("rejects a seed without a default function", async () => {
    const scriptDir = await seedWorkspace();
    await writeFile(
      join(scriptDir, "seeds/reference/001-invalid.ts"),
      "export const value = true;",
    );

    await expect(
      runDrizzleSeeds({ db: database().db, scriptDir }),
    ).rejects.toThrow("must default-export async");
  });

  it("propagates filesystem errors outside a missing directory", async () => {
    const scriptDir = await seedWorkspace();
    await writeFile(join(scriptDir, "not-a-directory"), "blocked");

    await expect(
      runDrizzleSeeds({
        db: database().db,
        scriptDir,
        seedDirectories: ["not-a-directory"],
      }),
    ).rejects.toMatchObject({ code: "ENOTDIR" });
  });
});
