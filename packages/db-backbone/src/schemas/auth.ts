import { sql } from "drizzle-orm";
import { index, pgSchema, primaryKey, uniqueIndex } from "drizzle-orm/pg-core";

export const authSchema = pgSchema("auth");

export const AppUser = authSchema.table(
  "app_user",
  (t) => ({
    id: t.uuid().primaryKey().defaultRandom(),
    issuer: t.text().notNull(),
    subject: t.text().notNull(),
    name: t.text(),
    email: t.text(),
    lastLoginAt: t.timestamp({ withTimezone: true }).notNull().defaultNow(),
    createdAt: t.timestamp({ withTimezone: true }).notNull().defaultNow(),
    updatedAt: t
      .timestamp({ withTimezone: true })
      .notNull()
      .defaultNow()
      .$onUpdateFn(() => sql`now()`),
  }),
  (table) => [
    uniqueIndex("app_user_issuer_subject_uidx").on(table.issuer, table.subject),
    index("app_user_email_idx").on(table.email),
  ],
);

export const UserRole = authSchema.table(
  "user_role",
  (t) => ({
    userId: t
      .uuid()
      .notNull()
      .references(() => AppUser.id, { onDelete: "cascade" }),
    role: t.varchar({ length: 32 }).notNull(),
    createdAt: t.timestamp({ withTimezone: true }).notNull().defaultNow(),
  }),
  (table) => [primaryKey({ columns: [table.userId, table.role] })],
);
