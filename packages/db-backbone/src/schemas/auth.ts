import { sql } from "drizzle-orm";
import {
  index,
  pgSchema,
  primaryKey,
  timestamp,
  uniqueIndex,
  varchar,
} from "drizzle-orm/pg-core";

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

export const LocalIdentity = authSchema.table(
  "local_identity",
  (t) => ({
    userId: t
      .uuid()
      .primaryKey()
      .references(() => AppUser.id, { onDelete: "cascade" }),
    email: t.text().notNull(),
    passwordHash: t.text().notNull(),
    createdAt: t.timestamp({ withTimezone: true }).notNull().defaultNow(),
    updatedAt: t
      .timestamp({ withTimezone: true })
      .notNull()
      .defaultNow()
      .$onUpdateFn(() => sql`now()`),
  }),
  (table) => [uniqueIndex("local_identity_email_uidx").on(table.email)],
);

export const AuthorizationCode = authSchema.table(
  "authorization_code",
  (t) => ({
    codeHash: varchar({ length: 64 }).primaryKey(),
    userId: t
      .uuid()
      .notNull()
      .references(() => AppUser.id, { onDelete: "cascade" }),
    clientId: t.text().notNull(),
    redirectUri: t.text().notNull(),
    codeChallenge: t.text().notNull(),
    nonce: t.text(),
    scope: t.text().notNull(),
    expiresAt: timestamp({ withTimezone: true }).notNull(),
    consumedAt: timestamp({ withTimezone: true }),
    createdAt: timestamp({ withTimezone: true }).notNull().defaultNow(),
  }),
  (table) => [index("authorization_code_expires_at_idx").on(table.expiresAt)],
);

export const RefreshToken = authSchema.table(
  "refresh_token",
  (t) => ({
    tokenHash: varchar({ length: 64 }).primaryKey(),
    userId: t
      .uuid()
      .notNull()
      .references(() => AppUser.id, { onDelete: "cascade" }),
    clientId: t.text().notNull(),
    scope: t.text().notNull(),
    expiresAt: timestamp({ withTimezone: true }).notNull(),
    revokedAt: timestamp({ withTimezone: true }),
    createdAt: timestamp({ withTimezone: true }).notNull().defaultNow(),
  }),
  (table) => [index("refresh_token_expires_at_idx").on(table.expiresAt)],
);
