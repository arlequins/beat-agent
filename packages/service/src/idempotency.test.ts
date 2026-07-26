import { describe, expect, it, vi } from "vitest";

import type { IdempotencyStorePort } from "./application/ports/idempotency-store";
import { createIdempotencyService } from "./application/use-cases/idempotency";

function storeDouble(
  claim: Awaited<ReturnType<IdempotencyStorePort["begin"]>>,
) {
  return {
    abandon: vi.fn(),
    begin: vi.fn().mockResolvedValue(claim),
    complete: vi.fn(),
  } satisfies IdempotencyStorePort;
}

describe("idempotency service", () => {
  it("persists the first result and replays a completed result", async () => {
    const firstStore = storeDouble({ status: "acquired" });
    const first = createIdempotencyService({ store: firstStore });
    await expect(
      first.execute(
        { fingerprint: "hash", key: "key", scope: "post.create" },
        async () => ({ id: "one" }),
      ),
    ).resolves.toEqual({ id: "one" });
    expect(firstStore.complete).toHaveBeenCalledWith(
      { fingerprint: "hash", key: "key", scope: "post.create" },
      { id: "one" },
    );

    const operation = vi.fn();
    const replay = createIdempotencyService({
      store: storeDouble({ status: "replay", value: { id: "one" } }),
    });
    await expect(
      replay.execute(
        { fingerprint: "hash", key: "key", scope: "post.create" },
        operation,
      ),
    ).resolves.toEqual({ id: "one" });
    expect(operation).not.toHaveBeenCalled();
  });

  it("rejects a key collision and abandons failed work", async () => {
    const conflict = createIdempotencyService({
      store: storeDouble({ status: "conflict" }),
    });
    await expect(
      conflict.execute(
        { fingerprint: "other", key: "key", scope: "post.create" },
        vi.fn(),
      ),
    ).rejects.toThrow("Idempotency key is already in use");
    const failedStore = storeDouble({ status: "acquired" });
    const failed = createIdempotencyService({ store: failedStore });
    await expect(
      failed.execute(
        { fingerprint: "hash", key: "key", scope: "post.create" },
        async () => {
          throw new Error("failed");
        },
      ),
    ).rejects.toThrow("failed");
    expect(failedStore.abandon).toHaveBeenCalledOnce();
  });
});
