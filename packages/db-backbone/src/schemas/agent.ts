import { index, pgSchema, primaryKey, uniqueIndex } from "drizzle-orm/pg-core";

/**
 * Durable, workspace-scoped agent records.  Keep source content and vector ids
 * separate: relational data remains the authorization and citation source of truth.
 */
export const agent = pgSchema("agent");

export const Workspace = agent.table(
  "workspace",
  (t) => ({
    id: t.uuid().primaryKey().defaultRandom(),
    slug: t.varchar({ length: 96 }).notNull(),
    name: t.varchar({ length: 256 }).notNull(),
    createdAt: t.timestamp({ withTimezone: true }).notNull().defaultNow(),
    updatedAt: t.timestamp({ withTimezone: true }).notNull().defaultNow(),
  }),
  (table) => [uniqueIndex("workspace_slug_uidx").on(table.slug)],
);

export const WorkspaceMember = agent.table(
  "workspace_member",
  (t) => ({
    workspaceId: t
      .uuid()
      .notNull()
      .references(() => Workspace.id, { onDelete: "cascade" }),
    userId: t.uuid().notNull(),
    role: t.varchar({ length: 32 }).notNull().default("member"),
    createdAt: t.timestamp({ withTimezone: true }).notNull().defaultNow(),
  }),
  (table) => [
    primaryKey({ columns: [table.workspaceId, table.userId] }),
    index("workspace_member_user_idx").on(table.userId),
  ],
);

export const Conversation = agent.table(
  "conversation",
  (t) => ({
    id: t.uuid().primaryKey().defaultRandom(),
    workspaceId: t
      .uuid()
      .notNull()
      .references(() => Workspace.id, { onDelete: "cascade" }),
    createdByUserId: t.uuid().notNull(),
    title: t.varchar({ length: 256 }).notNull().default("New conversation"),
    summary: t.text(),
    createdAt: t.timestamp({ withTimezone: true }).notNull().defaultNow(),
    updatedAt: t.timestamp({ withTimezone: true }).notNull().defaultNow(),
    archivedAt: t.timestamp({ withTimezone: true }),
  }),
  (table) => [
    index("conversation_workspace_updated_idx").on(
      table.workspaceId,
      table.updatedAt,
    ),
  ],
);

export const Message = agent.table(
  "message",
  (t) => ({
    id: t.uuid().primaryKey().defaultRandom(),
    conversationId: t
      .uuid()
      .notNull()
      .references(() => Conversation.id, { onDelete: "cascade" }),
    role: t.varchar({ length: 16 }).notNull(),
    content: t.text().notNull(),
    model: t.varchar({ length: 128 }),
    createdAt: t.timestamp({ withTimezone: true }).notNull().defaultNow(),
  }),
  (table) => [
    index("message_conversation_created_idx").on(
      table.conversationId,
      table.createdAt,
    ),
  ],
);

export const MemoryRecord = agent.table(
  "memory",
  (t) => ({
    id: t.uuid().primaryKey().defaultRandom(),
    workspaceId: t
      .uuid()
      .notNull()
      .references(() => Workspace.id, { onDelete: "cascade" }),
    sourceConversationId: t
      .uuid()
      .references(() => Conversation.id, { onDelete: "set null" }),
    content: t.text().notNull(),
    importance: t.integer().notNull().default(50),
    status: t.varchar({ length: 24 }).notNull().default("candidate"),
    expiresAt: t.timestamp({ withTimezone: true }),
    createdAt: t.timestamp({ withTimezone: true }).notNull().defaultNow(),
    reviewedAt: t.timestamp({ withTimezone: true }),
  }),
  (table) => [
    index("memory_workspace_status_idx").on(table.workspaceId, table.status),
  ],
);

export const Document = agent.table(
  "document",
  (t) => ({
    id: t.uuid().primaryKey().defaultRandom(),
    workspaceId: t
      .uuid()
      .notNull()
      .references(() => Workspace.id, { onDelete: "cascade" }),
    uploadedByUserId: t.uuid().notNull(),
    filename: t.varchar({ length: 512 }).notNull(),
    contentType: t.varchar({ length: 256 }).notNull(),
    sourceUri: t.text().notNull(),
    contentHash: t.varchar({ length: 128 }).notNull(),
    sizeBytes: t.bigint({ mode: "number" }).notNull(),
    status: t.varchar({ length: 24 }).notNull().default("pending"),
    createdAt: t.timestamp({ withTimezone: true }).notNull().defaultNow(),
    deletedAt: t.timestamp({ withTimezone: true }),
  }),
  (table) => [
    uniqueIndex("document_workspace_hash_uidx").on(
      table.workspaceId,
      table.contentHash,
    ),
    index("document_workspace_status_idx").on(table.workspaceId, table.status),
  ],
);

export const DocumentChunk = agent.table(
  "document_chunk",
  (t) => ({
    id: t.uuid().primaryKey().defaultRandom(),
    documentId: t
      .uuid()
      .notNull()
      .references(() => Document.id, { onDelete: "cascade" }),
    ordinal: t.integer().notNull(),
    content: t.text().notNull(),
    locator: t.varchar({ length: 256 }),
    vectorRecordId: t.varchar({ length: 256 }),
    /** Local embeddings live with their authorized chunk; cloud vector ids remain metadata. */
    embedding: t.jsonb().$type<number[]>(),
    createdAt: t.timestamp({ withTimezone: true }).notNull().defaultNow(),
  }),
  (table) => [
    uniqueIndex("document_chunk_document_ordinal_uidx").on(
      table.documentId,
      table.ordinal,
    ),
    index("document_chunk_vector_record_idx").on(table.vectorRecordId),
  ],
);

export const MessageCitation = agent.table(
  "message_citation",
  (t) => ({
    messageId: t
      .uuid()
      .notNull()
      .references(() => Message.id, { onDelete: "cascade" }),
    chunkId: t
      .uuid()
      .notNull()
      .references(() => DocumentChunk.id, { onDelete: "restrict" }),
    ordinal: t.integer().notNull(),
    createdAt: t.timestamp({ withTimezone: true }).notNull().defaultNow(),
  }),
  (table) => [primaryKey({ columns: [table.messageId, table.chunkId] })],
);

export const Feedback = agent.table(
  "feedback",
  (t) => ({
    id: t.uuid().primaryKey().defaultRandom(),
    workspaceId: t
      .uuid()
      .notNull()
      .references(() => Workspace.id, { onDelete: "cascade" }),
    messageId: t
      .uuid()
      .notNull()
      .references(() => Message.id, { onDelete: "cascade" }),
    submittedByUserId: t.uuid().notNull(),
    kind: t.varchar({ length: 32 }).notNull(),
    comment: t.text(),
    createdAt: t.timestamp({ withTimezone: true }).notNull().defaultNow(),
  }),
  (table) => [
    index("feedback_workspace_created_idx").on(
      table.workspaceId,
      table.createdAt,
    ),
  ],
);

export const Investigation = agent.table(
  "investigation",
  (t) => ({
    id: t.uuid().primaryKey().defaultRandom(),
    feedbackId: t
      .uuid()
      .notNull()
      .unique()
      .references(() => Feedback.id, { onDelete: "cascade" }),
    status: t.varchar({ length: 24 }).notNull().default("queued"),
    findings: t.jsonb(),
    resolution: t.text(),
    startedAt: t.timestamp({ withTimezone: true }),
    completedAt: t.timestamp({ withTimezone: true }),
    createdAt: t.timestamp({ withTimezone: true }).notNull().defaultNow(),
  }),
  (table) => [
    index("investigation_status_created_idx").on(table.status, table.createdAt),
  ],
);

export const IndexRun = agent.table(
  "index_run",
  (t) => ({
    id: t.uuid().primaryKey().defaultRandom(),
    workspaceId: t
      .uuid()
      .notNull()
      .references(() => Workspace.id, { onDelete: "cascade" }),
    documentId: t
      .uuid()
      .references(() => Document.id, { onDelete: "set null" }),
    status: t.varchar({ length: 24 }).notNull().default("queued"),
    provider: t.varchar({ length: 64 }).notNull().default("local"),
    error: t.text(),
    startedAt: t.timestamp({ withTimezone: true }),
    completedAt: t.timestamp({ withTimezone: true }),
    createdAt: t.timestamp({ withTimezone: true }).notNull().defaultNow(),
  }),
  (table) => [
    index("index_run_workspace_status_idx").on(table.workspaceId, table.status),
  ],
);

/** Immutable, workspace-scoped operational trail; do not put document content in this table. */
export const AuditLog = agent.table(
  "audit_log",
  (t) => ({
    id: t.uuid().primaryKey().defaultRandom(),
    workspaceId: t
      .uuid()
      .notNull()
      .references(() => Workspace.id, { onDelete: "cascade" }),
    actorUserId: t.uuid().notNull(),
    action: t.varchar({ length: 96 }).notNull(),
    subjectId: t.uuid(),
    metadata: t.jsonb(),
    createdAt: t.timestamp({ withTimezone: true }).notNull().defaultNow(),
  }),
  (table) => [
    index("audit_log_workspace_created_idx").on(
      table.workspaceId,
      table.createdAt,
    ),
  ],
);

export const EvaluationCase = agent.table(
  "evaluation_case",
  (t) => ({
    id: t.uuid().primaryKey().defaultRandom(),
    workspaceId: t
      .uuid()
      .notNull()
      .references(() => Workspace.id, { onDelete: "cascade" }),
    question: t.text().notNull(),
    expectedChunkIds: t.jsonb().$type<string[]>().notNull(),
    status: t.varchar({ length: 24 }).notNull().default("approved"),
    createdByUserId: t.uuid().notNull(),
    createdAt: t.timestamp({ withTimezone: true }).notNull().defaultNow(),
  }),
  (table) => [
    index("evaluation_case_workspace_status_idx").on(
      table.workspaceId,
      table.status,
    ),
  ],
);

export const EvaluationRun = agent.table(
  "evaluation_run",
  (t) => ({
    id: t.uuid().primaryKey().defaultRandom(),
    workspaceId: t
      .uuid()
      .notNull()
      .references(() => Workspace.id, { onDelete: "cascade" }),
    trigger: t.varchar({ length: 32 }).notNull(),
    status: t.varchar({ length: 24 }).notNull().default("queued"),
    summary: t.jsonb(),
    startedAt: t.timestamp({ withTimezone: true }),
    completedAt: t.timestamp({ withTimezone: true }),
    createdAt: t.timestamp({ withTimezone: true }).notNull().defaultNow(),
  }),
  (table) => [
    index("evaluation_run_workspace_created_idx").on(
      table.workspaceId,
      table.createdAt,
    ),
  ],
);

export const EvaluationResult = agent.table(
  "evaluation_result",
  (t) => ({
    evaluationRunId: t
      .uuid()
      .notNull()
      .references(() => EvaluationRun.id, { onDelete: "cascade" }),
    evaluationCaseId: t
      .uuid()
      .notNull()
      .references(() => EvaluationCase.id, { onDelete: "cascade" }),
    citationRecall: t.real().notNull(),
    retrievedChunkIds: t.jsonb().$type<string[]>().notNull(),
    createdAt: t.timestamp({ withTimezone: true }).notNull().defaultNow(),
  }),
  (table) => [
    primaryKey({ columns: [table.evaluationRunId, table.evaluationCaseId] }),
  ],
);
