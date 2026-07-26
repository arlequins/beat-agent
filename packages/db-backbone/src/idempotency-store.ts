import type { IdempotencyStorePort } from "@arlequins/service";
import { and, eq, lt } from "drizzle-orm";

import type { Database } from "./client";
import { IdempotencyRecord } from "./schema";

export function createDrizzleIdempotencyStore(
  database: Database,
): IdempotencyStorePort {
  return {
    async begin(request) {
      await database
        .delete(IdempotencyRecord)
        .where(
          and(
            eq(IdempotencyRecord.scope, request.scope),
            eq(IdempotencyRecord.key, request.key),
            lt(IdempotencyRecord.expiresAt, new Date()),
          ),
        );
      const [created] = await database
        .insert(IdempotencyRecord)
        .values(request)
        .onConflictDoNothing()
        .returning({ key: IdempotencyRecord.key });
      if (created) return { status: "acquired" };
      const existing = await database.query.IdempotencyRecord.findFirst({
        where: and(
          eq(IdempotencyRecord.scope, request.scope),
          eq(IdempotencyRecord.key, request.key),
        ),
      });
      if (!existing || existing.fingerprint !== request.fingerprint)
        return { status: "conflict" };
      if (existing.completedAt)
        return { status: "replay", value: existing.result };
      return { status: "conflict" };
    },
    async complete(request, value) {
      await database
        .update(IdempotencyRecord)
        .set({ completedAt: new Date(), result: value })
        .where(
          and(
            eq(IdempotencyRecord.scope, request.scope),
            eq(IdempotencyRecord.key, request.key),
            eq(IdempotencyRecord.fingerprint, request.fingerprint),
          ),
        );
    },
    async abandon(request) {
      await database
        .delete(IdempotencyRecord)
        .where(
          and(
            eq(IdempotencyRecord.scope, request.scope),
            eq(IdempotencyRecord.key, request.key),
            eq(IdempotencyRecord.fingerprint, request.fingerprint),
          ),
        );
    },
  };
}
