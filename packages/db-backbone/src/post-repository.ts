import type { ContentListInput, ContentRepository } from "@arlequins/service";
import { and, asc, count, desc, eq, ilike, or, sql } from "drizzle-orm";

import type { Database } from "./client";
import { Post } from "./schema";

export function createDrizzlePostRepository(
  database: Database,
): ContentRepository {
  return {
    async list(input: Required<ContentListInput>) {
      const filter = input.query
        ? or(
            ilike(Post.title, `%${input.query}%`),
            ilike(Post.content, `%${input.query}%`),
          )
        : undefined;
      const orderColumn = input.sort === "title" ? Post.title : Post.createdAt;
      const orderBy =
        input.direction === "asc" ? asc(orderColumn) : desc(orderColumn);
      const [items, totals] = await Promise.all([
        database
          .select()
          .from(Post)
          .where(filter)
          .orderBy(orderBy)
          .limit(input.pageSize)
          .offset((input.page - 1) * input.pageSize),
        database.select({ value: count() }).from(Post).where(filter),
      ]);
      return {
        items,
        page: input.page,
        pageSize: input.pageSize,
        total: totals[0]?.value ?? 0,
      };
    },

    findById(id) {
      return database.query.Post.findFirst({ where: eq(Post.id, id) });
    },

    async create(input) {
      const [created] = await database.insert(Post).values(input).returning();
      if (!created) throw new Error("Content creation returned no record");
      return created;
    },

    async update(id, input, expectedVersion) {
      const [updated] = await database
        .update(Post)
        .set({
          ...input,
          updatedAt: new Date(),
          version: sql`${Post.version} + 1`,
        })
        .where(and(eq(Post.id, id), eq(Post.version, expectedVersion)))
        .returning();
      if (updated) return { status: "updated", value: updated };
      const existing = await database.query.Post.findFirst({
        columns: { id: true },
        where: eq(Post.id, id),
      });
      return existing ? { status: "conflict" } : { status: "not-found" };
    },

    async delete(id) {
      const rows = await database
        .delete(Post)
        .where(eq(Post.id, id))
        .returning({ id: Post.id });
      return rows.length > 0;
    },
  };
}
