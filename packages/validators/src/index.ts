import { z } from "zod/v4";

/** Shared with API `post.create` input — keep in sync with DB constraints */
export const createPostInputSchema = z.object({
  title: z.string().trim().min(1).max(256),
  content: z.string().trim().min(1).max(10_000),
});

export type CreatePostInput = z.infer<typeof createPostInputSchema>;

export const updatePostInputSchema = z.object({
  id: z.uuid(),
  data: createPostInputSchema.extend({ version: z.number().int().positive() }),
});

export const listPostsInputSchema = z.object({
  direction: z.enum(["asc", "desc"]).default("desc"),
  page: z.number().int().positive().default(1),
  pageSize: z.number().int().min(1).max(50).default(10),
  query: z.string().max(256).default(""),
  sort: z.enum(["createdAt", "title"]).default("createdAt"),
});

export type ListPostsInput = z.infer<typeof listPostsInputSchema>;
export type UpdatePostInput = z.infer<typeof updatePostInputSchema>;

const workspaceSlug = z
  .string()
  .trim()
  .toLowerCase()
  .regex(/^[a-z0-9][a-z0-9-]{1,95}$/);
export const createWorkspaceInputSchema = z.object({
  name: z.string().trim().min(1).max(256),
  slug: workspaceSlug,
});
export const workspaceScopeInputSchema = z.object({ workspaceId: z.uuid() });
export const createConversationInputSchema = workspaceScopeInputSchema.extend({
  title: z.string().trim().min(1).max(256).optional(),
});
export const addMessageInputSchema = workspaceScopeInputSchema.extend({
  conversationId: z.uuid(),
  content: z.string().trim().min(1).max(100_000),
  model: z.string().trim().max(128).optional(),
  role: z.enum(["assistant", "system", "user"]),
});
export const createDocumentInputSchema = workspaceScopeInputSchema.extend({
  filename: z.string().trim().min(1).max(512),
  contentType: z.string().trim().min(1).max(256),
  sourceUri: z
    .string()
    .max(2_048)
    .regex(/^(https?|s3):\/\//),
  contentHash: z.string().regex(/^[a-f0-9]{64}$/),
  sizeBytes: z.number().int().positive().max(1_073_741_824),
});
export const startIndexInputSchema = workspaceScopeInputSchema.extend({
  documentId: z.uuid(),
  provider: z.enum(["local", "s3-vectors"]).default("local"),
});
export const documentScopeInputSchema = workspaceScopeInputSchema.extend({
  documentId: z.uuid(),
});
export const messageCitationInputSchema = workspaceScopeInputSchema.extend({
  messageId: z.uuid(),
});
export const submitFeedbackInputSchema = workspaceScopeInputSchema.extend({
  messageId: z.uuid(),
  kind: z.enum(["helpful", "incorrect", "missing", "needs-investigation"]),
  comment: z.string().trim().max(10_000).optional(),
});
export const completeAgentInputSchema = workspaceScopeInputSchema.extend({
  conversationId: z.uuid(),
  question: z.string().trim().min(1).max(100_000),
});
export const conversationScopeInputSchema = workspaceScopeInputSchema.extend({
  conversationId: z.uuid(),
});
export const ingestTextDocumentInputSchema = workspaceScopeInputSchema.extend({
  content: z.string().trim().min(1).max(1_000_000),
  contentType: z
    .enum(["text/html", "text/markdown", "text/plain"])
    .default("text/plain"),
  filename: z.string().trim().min(1).max(512),
});
export const createMemoryInputSchema = workspaceScopeInputSchema.extend({
  content: z.string().trim().min(1).max(10_000),
  importance: z.number().int().min(1).max(100).optional(),
  sourceConversationId: z.uuid().optional(),
});
export const reviewMemoryInputSchema = workspaceScopeInputSchema.extend({
  memoryId: z.uuid(),
  status: z.enum(["approved", "rejected"]),
});
export const memoryScopeInputSchema = workspaceScopeInputSchema.extend({
  memoryId: z.uuid(),
});
export const addWorkspaceMemberInputSchema = workspaceScopeInputSchema.extend({
  role: z.enum(["member", "owner"]).default("member"),
  userId: z.uuid(),
});
export const createEvaluationCaseInputSchema = workspaceScopeInputSchema.extend(
  {
    expectedChunkIds: z.array(z.uuid()).min(1).max(12),
    question: z.string().trim().min(1).max(10_000),
  },
);
export const publishReleaseInputSchema = workspaceScopeInputSchema.extend({
  minimumCitationRecall: z.number().min(0).max(1).default(0.75),
});
