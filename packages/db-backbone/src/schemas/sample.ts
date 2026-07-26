import { sql } from "drizzle-orm";
import { pgSchema, primaryKey } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const sample = pgSchema("sample");

export const Post = sample.table("post", (t) => ({
  id: t.uuid().notNull().primaryKey().defaultRandom(),
  title: t.varchar({ length: 256 }).notNull(),
  content: t.text().notNull(),
  createdAt: t.timestamp().defaultNow().notNull(),
  updatedAt: t
    .timestamp({ mode: "date", withTimezone: true })
    .$onUpdateFn(() => sql`now()`),
  version: t.integer().default(1).notNull(),
}));

export const IdempotencyRecord = sample.table(
  "idempotency_record",
  (t) => ({
    completedAt: t.timestamp({ withTimezone: true }),
    createdAt: t.timestamp({ withTimezone: true }).defaultNow().notNull(),
    expiresAt: t.timestamp({ withTimezone: true }).notNull(),
    fingerprint: t.varchar({ length: 128 }).notNull(),
    key: t.varchar({ length: 256 }).notNull(),
    result: t.jsonb(),
    scope: t.varchar({ length: 128 }).notNull(),
  }),
  (table) => [primaryKey({ columns: [table.scope, table.key] })],
);

export const CreatePostSchema = createInsertSchema(Post, {
  title: z.string().max(256),
  content: z.string().max(256),
}).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});
