import type { Database } from "@arlequins/db-backbone/client";
import { createDrizzlePostRepository as createRepository } from "@arlequins/db-backbone/post-repository";
import type { Cache } from "@arlequins/s3-cache";
import type { ContentRepository } from "@arlequins/service";

export function createDrizzlePostRepository(
  database: Database,
  options: { cache?: Cache; cacheTtlSeconds?: number } = {},
): ContentRepository {
  const repository = createRepository(database);
  const cache = options.cache;
  const ttlSeconds = options.cacheTtlSeconds ?? 60;

  return {
    list: (input) =>
      cache
        ? cache.getOrSet(
            `list:${JSON.stringify(input)}`,
            () => repository.list(input),
            { ttlSeconds },
          )
        : repository.list(input),
    findById: (id) =>
      cache
        ? cache.getOrSet(`by-id:${id}`, () => repository.findById(id), {
            ttlSeconds,
          })
        : repository.findById(id),
    async create(input) {
      const result = await repository.create(input);
      await cache?.clear();
      return result;
    },
    async update(id, input, expectedVersion) {
      const result = await repository.update(id, input, expectedVersion);
      await cache?.clear();
      return result;
    },
    async delete(id) {
      const result = await repository.delete(id);
      await cache?.clear();
      return result;
    },
  };
}
