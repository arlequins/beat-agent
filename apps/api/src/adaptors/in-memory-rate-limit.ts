import type { RateLimitPort } from "@arlequins/service";

type WindowEntry = { count: number; resetAt: Date };

export function createInMemoryRateLimitAdapter(
  options: { maxEntries?: number } = {},
): RateLimitPort {
  const entries = new Map<string, WindowEntry>();
  const maxEntries = options.maxEntries ?? 10_000;

  function removeExpired(now: Date) {
    for (const [key, entry] of entries) {
      if (entry.resetAt <= now) entries.delete(key);
    }
  }

  return {
    async consume(input) {
      let entry = entries.get(input.key);
      if (!entry || entry.resetAt <= input.now) {
        if (entries.size >= maxEntries) removeExpired(input.now);
        if (entries.size >= maxEntries) {
          const oldestKey = entries.keys().next().value;
          if (oldestKey) entries.delete(oldestKey);
        }
        entry = {
          count: 0,
          resetAt: new Date(input.now.getTime() + input.windowMs),
        };
        entries.set(input.key, entry);
      }
      entry.count += 1;
      return {
        allowed: entry.count <= input.limit,
        limit: input.limit,
        remaining: Math.max(0, input.limit - entry.count),
        resetAt: entry.resetAt,
      };
    },
  };
}
