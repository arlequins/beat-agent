import { ResourceConflictError } from "../errors";
import type { IdempotencyStorePort } from "../ports/idempotency-store";

export function createIdempotencyService(deps: {
  now?: () => number;
  store: IdempotencyStorePort;
  ttlSeconds?: number;
}) {
  const now = deps.now ?? Date.now;
  const ttlSeconds = deps.ttlSeconds ?? 86_400;
  return {
    async execute<T>(
      input: { fingerprint: string; key: string; scope: string },
      operation: () => Promise<T>,
    ): Promise<T> {
      const claim = await deps.store.begin({
        ...input,
        expiresAt: new Date(now() + ttlSeconds * 1_000),
      });
      if (claim.status === "replay") return claim.value as T;
      if (claim.status === "conflict") {
        throw new ResourceConflictError("Idempotency key is already in use", {
          key: input.key,
          scope: input.scope,
        });
      }
      try {
        const value = await operation();
        await deps.store.complete(input, value);
        return value;
      } catch (error) {
        await deps.store.abandon(input);
        throw error;
      }
    },
  };
}

export type IdempotencyService = ReturnType<typeof createIdempotencyService>;
