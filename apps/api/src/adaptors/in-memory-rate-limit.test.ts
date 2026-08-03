import { describe, expect, it } from "vitest";
import { createInMemoryRateLimitAdapter } from "./in-memory-rate-limit";

describe("createInMemoryRateLimitAdapter", () => {
  it("resets fixed windows without exposing HTTP concerns", async () => {
    const limiter = createInMemoryRateLimitAdapter();
    const input = {
      key: "client-1",
      limit: 1,
      now: new Date(0),
      windowMs: 1_000,
    };
    await expect(limiter.consume(input)).resolves.toMatchObject({
      allowed: true,
      remaining: 0,
    });
    await expect(limiter.consume(input)).resolves.toMatchObject({
      allowed: false,
      remaining: 0,
    });
    await expect(
      limiter.consume({ ...input, now: new Date(1_000) }),
    ).resolves.toMatchObject({ allowed: true, remaining: 0 });
  });
});
