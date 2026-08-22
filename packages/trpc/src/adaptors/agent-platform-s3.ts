import { createHash, randomUUID } from "node:crypto";
import {
  evaluateCitationPrecision,
  type FeedbackKind,
  type ModelUsage,
} from "@arlequins/agent-core";
import type { JsonObjectStore } from "./s3-json-store";
import { ObjectAlreadyExistsError, ObjectConflictError } from "./s3-json-store";

export type WorkspaceActor = { userId: string; workspaceId: string };

type Workspace = {
  createdAt: string;
  id: string;
  name: string;
  slug: string;
  updatedAt: string;
};
type Membership = {
  createdAt: string;
  role: "member" | "owner";
  userId: string;
  workspaceId: string;
};
type Conversation = {
  archivedAt?: string;
  createdAt: string;
  createdByUserId: string;
  id: string;
  summary?: string;
  title: string;
  updatedAt: string;
  workspaceId: string;
};
type Message = {
  content: string;
  conversationId: string;
  createdAt: string;
  id: string;
  metadata?: {
    idempotencyKey?: string;
    knowledgeReleaseId?: string;
    latencyMs?: number;
    promptVersion?: string;
    retrievalDegraded?: boolean;
    usage?: ModelUsage;
  };
  model?: string;
  role: "assistant" | "system" | "user";
};
type MessageIdempotencyRecord = {
  contentHash: string;
  conversationId: string;
  messageId: string;
  status: "committed" | "reserved";
};
type MemoryRecord = {
  content: string;
  createdAt: string;
  deletedAt?: string;
  expiresAt?: string;
  id: string;
  importance: number;
  reviewedAt?: string;
  sourceConversationId?: string;
  status: "approved" | "candidate" | "rejected";
  workspaceId: string;
};
type Document = {
  contentHash: string;
  contentType: string;
  createdAt: string;
  deletedAt?: string;
  filename: string;
  id: string;
  sizeBytes: number;
  sourceUri: string;
  status: string;
  uploadedByUserId: string;
  workspaceId: string;
};
type DocumentChunk = {
  content: string;
  createdAt: string;
  documentId: string;
  embedding?: number[];
  id: string;
  locator?: string;
  ordinal: number;
  vectorRecordId?: string;
};
type CitationRecord = {
  chunkId: string;
  createdAt: string;
  knowledgeReleaseId: string;
  messageId: string;
  ordinal: number;
};
type IndexRun = {
  attempts?: number;
  completedAt?: string;
  createdAt: string;
  documentId: string;
  error?: string;
  id: string;
  leaseExpiresAt?: string;
  provider: string;
  startedAt?: string;
  status: string;
  workspaceId: string;
};
type Feedback = {
  comment?: string;
  createdAt: string;
  id: string;
  kind: FeedbackKind;
  messageId: string;
  submittedByUserId: string;
  workspaceId: string;
};
type Investigation = {
  attempts?: number;
  completedAt?: string;
  createdAt: string;
  error?: string;
  feedbackId: string;
  findings?: {
    citationCount: number;
    comment?: string;
    feedbackKind: FeedbackKind;
    messageExcerpt: string;
  };
  id: string;
  leaseExpiresAt?: string;
  resolution?: string;
  startedAt?: string;
  status: string;
};
type EvaluationCase = {
  createdAt: string;
  createdByUserId: string;
  expectedChunkIds: string[];
  id: string;
  question: string;
  status: string;
  workspaceId: string;
};
type EvaluationRun = {
  attempts?: number;
  completedAt?: string;
  createdAt: string;
  error?: string;
  id: string;
  leaseExpiresAt?: string;
  results?: Array<{
    caseId: string;
    citationRecall: number;
    retrievedChunkIds: string[];
  }>;
  startedAt?: string;
  status: string;
  summary?: {
    averageCitationPrecision?: number;
    averageCitationRecall: number;
    cases: number;
  };
  trigger: "manual" | "weekly";
  workspaceId: string;
};
type AuditEvent = {
  action: string;
  actorUserId: string;
  createdAt: string;
  id: string;
  metadata?: Record<string, unknown>;
  subjectId?: string;
  type: "audit";
  workspaceId: string;
};
type ReleaseSnapshot = {
  createdAt: string;
  knowledgeChunks: Array<{
    chunkId: string;
    content: string;
    documentId: string;
    embedding?: number[];
    label: string;
    locator?: string;
  }>;
  memories: MemoryRecord[];
  releaseId: string;
  workspaceId: string;
};
type ReleaseHead = {
  activatedAt: string;
  manifestKey: string;
  previousReleaseId?: string;
  releaseId: string;
  snapshotKey: string;
};
export type AgentJobLease = {
  estimatedCompletionAt: string;
  etag: string;
  jobId: string;
  leaseExpiresAt: string;
  startedAt: string;
  status: "running";
  userId: string;
};
type AgentJobHead = Omit<AgentJobLease, "etag" | "status"> & {
  status: "idle" | "running";
};

const date = (value: string | undefined) =>
  value === undefined ? undefined : new Date(value);
const timestamp = () => new Date().toISOString();
const stateKey = (workspaceId: string, type: string, id: string) =>
  `workspaces/${workspaceId}/state/${type}/${id}.json`;
const collectionPrefix = (workspaceId: string, type: string) =>
  `workspaces/${workspaceId}/state/${type}/`;

function stableUuid(value: string) {
  const characters = createHash("sha256")
    .update(value)
    .digest("hex")
    .slice(0, 32)
    .split("");
  characters[12] = "4";
  characters[16] = "8";
  const hex = characters.join("");
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
}

function eventKey(workspaceId: string, id: string, stable = false) {
  if (stable) return `workspaces/${workspaceId}/events/idempotent-${id}.json`;
  return `workspaces/${workspaceId}/events/${Date.now()
    .toString()
    .padStart(13, "0")}-${id}.json`;
}

function publicWorkspace(value: Workspace, role?: string) {
  return {
    ...value,
    createdAt: new Date(value.createdAt),
    updatedAt: new Date(value.updatedAt),
    ...(role ? { role } : {}),
  };
}

function publicConversation(value: Conversation) {
  return {
    ...value,
    archivedAt: date(value.archivedAt) ?? null,
    createdAt: new Date(value.createdAt),
    summary: value.summary ?? null,
    updatedAt: new Date(value.updatedAt),
  };
}

function publicMessage(value: Message) {
  return {
    ...value,
    createdAt: new Date(value.createdAt),
    model: value.model ?? null,
    ...(value.metadata ? { metadata: value.metadata } : {}),
  };
}

function publicDocument(value: Document) {
  return {
    ...value,
    createdAt: new Date(value.createdAt),
    deletedAt: date(value.deletedAt) ?? null,
  };
}

function publicMemory(value: MemoryRecord) {
  return {
    ...value,
    createdAt: new Date(value.createdAt),
    expiresAt: date(value.expiresAt) ?? null,
    reviewedAt: date(value.reviewedAt) ?? null,
    sourceConversationId: value.sourceConversationId ?? null,
  };
}

function publicIndexRun(value: IndexRun) {
  return {
    ...value,
    completedAt: date(value.completedAt) ?? null,
    createdAt: new Date(value.createdAt),
    error: value.error ?? null,
    startedAt: date(value.startedAt) ?? null,
  };
}

function publicInvestigation(value: Investigation) {
  return {
    ...value,
    completedAt: date(value.completedAt) ?? null,
    createdAt: new Date(value.createdAt),
    error: value.error ?? null,
    findings: value.findings ?? null,
    resolution: value.resolution ?? null,
    startedAt: date(value.startedAt) ?? null,
  };
}

function publicEvaluationRun(value: EvaluationRun) {
  return {
    ...value,
    completedAt: date(value.completedAt) ?? null,
    createdAt: new Date(value.createdAt),
    error: value.error ?? null,
    startedAt: date(value.startedAt) ?? null,
    summary: value.summary ?? null,
  };
}

async function required<T>(
  store: JsonObjectStore,
  key: string,
  message: string,
) {
  const record = await store.get<T>(key);
  if (!record) throw new Error(message);
  return record;
}

async function mutate<T>(
  store: JsonObjectStore,
  key: string,
  update: (current: T) => T,
): Promise<T> {
  for (let attempt = 0; attempt < 5; attempt += 1) {
    const current = await store.get<T>(key);
    if (!current?.etag) throw new Error(`Object was not found: ${key}`);
    const next = update(current.value);
    try {
      return (await store.replace(key, next, current.etag)).value;
    } catch (error) {
      if (!(error instanceof ObjectConflictError) || attempt === 4) throw error;
    }
  }
  throw new Error(`Could not update object after retries: ${key}`);
}

async function values<T>(store: JsonObjectStore, prefix: string) {
  return (await store.list<T>(prefix)).map(({ value }) => value);
}

export function createS3AgentPlatformRepository(
  store: JsonObjectStore,
  options: {
    jobLeaseMs?: number;
    now?: () => Date;
  } = {},
) {
  const now = options.now ?? (() => new Date());
  const jobLeaseMs = options.jobLeaseMs ?? 5 * 60_000;

  async function appendEvent(
    actor: WorkspaceActor,
    action: string,
    subjectId?: string,
    metadata?: Record<string, unknown>,
    options?: { stableId?: string },
  ) {
    const createdAt = timestamp();
    const stableId = options?.stableId;
    const event: AuditEvent = {
      action,
      actorUserId: actor.userId,
      createdAt,
      id: stableId ?? randomUUID(),
      ...(metadata ? { metadata } : {}),
      ...(subjectId ? { subjectId } : {}),
      type: "audit",
      workspaceId: actor.workspaceId,
    };
    try {
      await store.create(
        eventKey(actor.workspaceId, event.id, stableId !== undefined),
        event,
      );
    } catch (error) {
      if (!(stableId && error instanceof ObjectAlreadyExistsError)) throw error;
    }
    return event;
  }

  async function membership(actor: WorkspaceActor) {
    return (
      await store.get<Membership>(
        stateKey(actor.workspaceId, "members", actor.userId),
      )
    )?.value;
  }

  async function assertMember(actor: WorkspaceActor): Promise<void> {
    if (!(await membership(actor)))
      throw new Error("Workspace membership is required");
  }

  async function assertOwner(actor: WorkspaceActor): Promise<void> {
    if ((await membership(actor))?.role !== "owner")
      throw new Error("Workspace owner role is required");
  }

  async function ensureConversation(
    actor: WorkspaceActor,
    conversationId: string,
  ) {
    const conversation = (
      await required<Conversation>(
        store,
        stateKey(actor.workspaceId, "conversations", conversationId),
        "Conversation was not found in this workspace",
      )
    ).value;
    if (conversation.archivedAt)
      throw new Error("Conversation is archived and cannot accept messages");
    return conversation;
  }

  return {
    assertMember,
    assertOwner,
    async acquireJob(
      userId: string,
      input: { estimatedDurationMs?: number; kind: string },
    ): Promise<AgentJobLease> {
      const key = `identities/${userId}/heads/active-job.json`;
      const startedAt = now();
      const lease: Omit<AgentJobLease, "etag"> = {
        estimatedCompletionAt: new Date(
          startedAt.getTime() + (input.estimatedDurationMs ?? 120_000),
        ).toISOString(),
        jobId: randomUUID(),
        leaseExpiresAt: new Date(
          startedAt.getTime() + jobLeaseMs,
        ).toISOString(),
        startedAt: startedAt.toISOString(),
        status: "running",
        userId,
      };
      try {
        const created = await store.create(key, lease);
        return { ...lease, etag: created.etag ?? "" };
      } catch (error) {
        if (!(error instanceof ObjectAlreadyExistsError)) throw error;
      }
      for (let attempt = 0; attempt < 5; attempt += 1) {
        const current = await store.get<AgentJobHead>(key);
        if (!current?.etag) continue;
        const expired =
          current.value.status === "idle" ||
          Date.parse(current.value.leaseExpiresAt) <= startedAt.getTime();
        if (!expired)
          throw new AgentJobBusyError({
            estimatedCompletionAt: current.value.estimatedCompletionAt,
            jobId: current.value.jobId,
          });
        try {
          const replaced = await store.replace(key, lease, current.etag);
          return { ...lease, etag: replaced.etag ?? "" };
        } catch (error) {
          if (!(error instanceof ObjectConflictError) || attempt === 4)
            throw error;
        }
      }
      throw new Error("Could not acquire the agent job lease");
    },
    async releaseJob(lease: AgentJobLease) {
      const key = `identities/${lease.userId}/heads/active-job.json`;
      const current = await store.get<Omit<AgentJobLease, "etag">>(key);
      if (!current?.etag || current.value.jobId !== lease.jobId) return;
      await store.replace(
        key,
        {
          ...current.value,
          leaseExpiresAt: now().toISOString(),
          status: "idle",
        },
        current.etag,
      );
    },
    async createWorkspace(input: {
      name: string;
      slug: string;
      userId: string;
    }) {
      const id = randomUUID();
      const createdAt = timestamp();
      const workspace: Workspace = {
        createdAt,
        id,
        name: input.name,
        slug: input.slug,
        updatedAt: createdAt,
      };
      const member: Membership = {
        createdAt,
        role: "owner",
        userId: input.userId,
        workspaceId: id,
      };
      await store.create(`workspaces/${id}/workspace.json`, workspace);
      await store.create(stateKey(id, "members", input.userId), member);
      await store.create(
        `identities/${input.userId}/workspaces/${id}.json`,
        member,
      );
      await appendEvent(
        { userId: input.userId, workspaceId: id },
        "workspace.created",
        id,
      );
      return publicWorkspace(workspace);
    },
    async listWorkspaces(userId: string) {
      const links = await values<Membership>(
        store,
        `identities/${userId}/workspaces/`,
      );
      const rows = await Promise.all(
        links.map(async (link) => {
          const workspace = await store.get<Workspace>(
            `workspaces/${link.workspaceId}/workspace.json`,
          );
          return workspace
            ? publicWorkspace(workspace.value, link.role)
            : undefined;
        }),
      );
      return rows
        .filter((row): row is NonNullable<typeof row> => row !== undefined)
        .sort((left, right) => left.name.localeCompare(right.name));
    },
    async listWorkspaceOwners() {
      const rows = await store.list<unknown>("workspaces/");
      return rows.flatMap(({ key, value }) => {
        if (
          !key.includes("/state/members/") ||
          !value ||
          typeof value !== "object"
        )
          return [];
        const candidate = value as Partial<Membership>;
        if (
          candidate.role !== "owner" ||
          typeof candidate.userId !== "string" ||
          typeof candidate.workspaceId !== "string"
        )
          return [];
        return [
          { userId: candidate.userId, workspaceId: candidate.workspaceId },
        ];
      });
    },
    async addWorkspaceMember(
      actor: WorkspaceActor,
      userId: string,
      role: "member" | "owner",
    ) {
      await assertOwner(actor);
      const key = stateKey(actor.workspaceId, "members", userId);
      const existing = await store.get<Membership>(key);
      const member: Membership = {
        createdAt: existing?.value.createdAt ?? timestamp(),
        role,
        userId,
        workspaceId: actor.workspaceId,
      };
      if (existing?.etag) await store.replace(key, member, existing.etag);
      else await store.create(key, member);
      const linkKey = `identities/${userId}/workspaces/${actor.workspaceId}.json`;
      const link = await store.get<Membership>(linkKey);
      if (link?.etag) await store.replace(linkKey, member, link.etag);
      else await store.create(linkKey, member);
      await appendEvent(actor, "workspace.member.updated", userId, { role });
      return {
        ...member,
        createdAt: new Date(member.createdAt),
      };
    },
    async createConversation(actor: WorkspaceActor, title?: string) {
      await assertMember(actor);
      const id = randomUUID();
      const createdAt = timestamp();
      const conversation: Conversation = {
        createdAt,
        createdByUserId: actor.userId,
        id,
        title: title ?? "New conversation",
        updatedAt: createdAt,
        workspaceId: actor.workspaceId,
      };
      await store.create(
        stateKey(actor.workspaceId, "conversations", id),
        conversation,
      );
      await appendEvent(actor, "conversation.created", id);
      return publicConversation(conversation);
    },
    async listConversations(actor: WorkspaceActor) {
      await assertMember(actor);
      return (
        await values<Conversation>(
          store,
          collectionPrefix(actor.workspaceId, "conversations"),
        )
      )
        .filter((item) => !item.archivedAt)
        .sort((left, right) => right.updatedAt.localeCompare(left.updatedAt))
        .map(publicConversation);
    },
    async archiveConversation(actor: WorkspaceActor, conversationId: string) {
      await assertMember(actor);
      const archivedAt = timestamp();
      const value = await mutate<Conversation>(
        store,
        stateKey(actor.workspaceId, "conversations", conversationId),
        (current) => ({
          ...current,
          archivedAt,
          updatedAt: archivedAt,
        }),
      );
      await appendEvent(actor, "conversation.archived", conversationId);
      return publicConversation(value);
    },
    async addMessage(
      actor: WorkspaceActor,
      input: {
        content: string;
        conversationId: string;
        idempotencyKey?: string;
        metadata?: Message["metadata"];
        model?: string;
        role: "assistant" | "system" | "user";
      },
    ) {
      await assertMember(actor);
      await ensureConversation(actor, input.conversationId);
      const { idempotencyKey, ...messageInput } = input;
      const contentHash = createHash("sha256")
        .update(
          JSON.stringify({
            content: messageInput.content,
            conversationId: messageInput.conversationId,
            model: messageInput.model,
            role: messageInput.role,
          }),
        )
        .digest("hex");
      const reservationKey = idempotencyKey
        ? stateKey(
            actor.workspaceId,
            "idempotency/messages",
            createHash("sha256")
              .update(`${actor.userId}:${idempotencyKey}`)
              .digest("hex"),
          )
        : undefined;
      let reservation:
        | {
            etag?: string;
            value: MessageIdempotencyRecord;
          }
        | undefined;
      if (reservationKey) {
        reservation = await store.get<MessageIdempotencyRecord>(reservationKey);
        if (reservation && reservation.value.contentHash !== contentHash)
          throw new ObjectConflictError(reservationKey);
        if (!reservation) {
          const candidate: MessageIdempotencyRecord = {
            contentHash,
            conversationId: input.conversationId,
            messageId: stableUuid(
              `${actor.workspaceId}:${actor.userId}:${idempotencyKey}`,
            ),
            status: "reserved",
          };
          try {
            const created = await store.create(reservationKey, candidate);
            reservation = { etag: created.etag, value: candidate };
          } catch (error) {
            if (!(error instanceof ObjectAlreadyExistsError)) throw error;
            reservation =
              (await store.get<MessageIdempotencyRecord>(reservationKey)) ??
              undefined;
            if (!reservation) throw error;
            if (reservation.value.contentHash !== contentHash)
              throw new ObjectConflictError(reservationKey);
          }
        }
        if (reservation.value.status === "committed") {
          const existing = await store.get<Message>(
            stateKey(
              actor.workspaceId,
              `messages/${input.conversationId}`,
              reservation.value.messageId,
            ),
          );
          if (existing) return publicMessage(existing.value);
          throw new Error("Idempotent message record is missing its message");
        }
      }
      const createdAt = timestamp();
      await mutate<Conversation>(
        store,
        stateKey(actor.workspaceId, "conversations", input.conversationId),
        (current) => {
          if (current.archivedAt)
            throw new Error(
              "Conversation is archived and cannot accept messages",
            );
          return { ...current, updatedAt: createdAt };
        },
      );
      const message: Message = {
        ...messageInput,
        createdAt,
        id: reservation?.value.messageId ?? randomUUID(),
      };
      const messageKey = stateKey(
        actor.workspaceId,
        `messages/${input.conversationId}`,
        message.id,
      );
      let created = true;
      let persistedMessage = message;
      try {
        await store.create(messageKey, message);
      } catch (error) {
        if (!(reservation && error instanceof ObjectAlreadyExistsError))
          throw error;
        created = false;
      }
      if (!created) {
        const existing = await store.get<Message>(messageKey);
        if (!existing) throw new Error("Idempotent message was not found");
        persistedMessage = existing.value;
        if (reservation?.value.status === "committed")
          return publicMessage(existing.value);
      }
      await appendEvent(
        actor,
        "message.created",
        persistedMessage.id,
        {
          conversationId: input.conversationId,
          role: input.role,
        },
        reservation
          ? { stableId: stableUuid(`message-event:${persistedMessage.id}`) }
          : undefined,
      );
      if (reservationKey && reservation?.value.status === "reserved") {
        const current =
          await store.get<MessageIdempotencyRecord>(reservationKey);
        if (current?.etag) {
          try {
            await store.replace(
              reservationKey,
              { ...current.value, status: "committed" },
              current.etag,
            );
          } catch (error) {
            if (!(error instanceof ObjectConflictError)) throw error;
          }
        }
      }
      return publicMessage(persistedMessage);
    },
    async listMessages(actor: WorkspaceActor, conversationId: string) {
      await assertMember(actor);
      await required(
        store,
        stateKey(actor.workspaceId, "conversations", conversationId),
        "Conversation was not found in this workspace",
      );
      return (
        await values<Message>(
          store,
          collectionPrefix(actor.workspaceId, `messages/${conversationId}`),
        )
      )
        .sort((left, right) => left.createdAt.localeCompare(right.createdAt))
        .map(publicMessage);
    },
    async createDocument(
      actor: WorkspaceActor,
      input: {
        contentHash: string;
        contentType: string;
        filename: string;
        sizeBytes: number;
        sourceUri: string;
      },
    ) {
      await assertMember(actor);
      const duplicate = (
        await values<Document>(
          store,
          collectionPrefix(actor.workspaceId, "documents"),
        )
      ).find(
        (document) =>
          document.contentHash === input.contentHash && !document.deletedAt,
      );
      if (duplicate) throw new Error("Document content already exists");
      const document: Document = {
        ...input,
        createdAt: timestamp(),
        id: randomUUID(),
        status: "pending",
        uploadedByUserId: actor.userId,
        workspaceId: actor.workspaceId,
      };
      await store.create(
        stateKey(actor.workspaceId, "documents", document.id),
        document,
      );
      await appendEvent(actor, "document.created", document.id, {
        contentHash: document.contentHash,
      });
      return publicDocument(document);
    },
    async completeDocumentExtraction(
      actor: WorkspaceActor,
      input: { documentId: string; text: string; warnings: string[] },
    ) {
      await assertMember(actor);
      const record = await required<Document>(
        store,
        stateKey(actor.workspaceId, "documents", input.documentId),
        "Document was not found in this workspace",
      );
      if (record.value.status === "completed")
        return publicDocument(record.value);
      if (record.value.deletedAt)
        throw new Error("Document was not found in this workspace");
      const createdAt = timestamp();
      const blobKey = `workspaces/${actor.workspaceId}/blobs/sha256/${record.value.contentHash}.json`;
      try {
        await store.create(blobKey, {
          content: input.text,
          contentHash: record.value.contentHash,
          contentType: "text/plain",
          createdAt,
          sourceUri: record.value.sourceUri,
        });
      } catch (error) {
        if (!(error instanceof ObjectAlreadyExistsError)) throw error;
      }
      const chunks = input.text.match(/[\s\S]{1,1200}/g) ?? [];
      for (const [ordinal, content] of chunks.entries()) {
        const chunk: DocumentChunk = {
          content,
          createdAt,
          documentId: record.value.id,
          id: stableUuid(`${record.value.id}:${ordinal}`),
          ordinal,
        };
        try {
          await store.create(
            stateKey(actor.workspaceId, `chunks/${record.value.id}`, chunk.id),
            chunk,
          );
        } catch (error) {
          if (!(error instanceof ObjectAlreadyExistsError)) throw error;
        }
      }
      const document = await mutate<Document>(
        store,
        stateKey(actor.workspaceId, "documents", record.value.id),
        (current) => ({ ...current, status: "completed" }),
      );
      await appendEvent(actor, "document.extracted", document.id, {
        chunks: chunks.length,
        warnings: input.warnings.length,
      });
      return publicDocument(document);
    },
    async ingestTextDocument(
      actor: WorkspaceActor,
      input: { content: string; filename: string },
    ) {
      await assertMember(actor);
      const contentHash = createHash("sha256")
        .update(input.content)
        .digest("hex");
      const existing = (
        await values<Document>(
          store,
          collectionPrefix(actor.workspaceId, "documents"),
        )
      ).find(
        (document) =>
          document.contentHash === contentHash && !document.deletedAt,
      );
      if (existing) throw new Error("Document content already exists");
      const createdAt = timestamp();
      const blobKey = `workspaces/${actor.workspaceId}/blobs/sha256/${contentHash}.json`;
      try {
        await store.create(blobKey, {
          content: input.content,
          contentHash,
          contentType: "text/plain",
          createdAt,
        });
      } catch (error) {
        if (!(error instanceof ObjectAlreadyExistsError)) throw error;
      }
      const document: Document = {
        contentHash,
        contentType: "text/plain",
        createdAt,
        filename: input.filename,
        id: randomUUID(),
        sizeBytes: Buffer.byteLength(input.content),
        sourceUri: `s3-content://${blobKey}`,
        status: "completed",
        uploadedByUserId: actor.userId,
        workspaceId: actor.workspaceId,
      };
      await store.create(
        stateKey(actor.workspaceId, "documents", document.id),
        document,
      );
      const chunks = input.content.match(/[\s\S]{1,1200}/g) ?? [];
      await Promise.all(
        chunks.map((content, ordinal) => {
          const chunk: DocumentChunk = {
            content,
            createdAt,
            documentId: document.id,
            id: randomUUID(),
            ordinal,
          };
          return store.create(
            stateKey(actor.workspaceId, `chunks/${document.id}`, chunk.id),
            chunk,
          );
        }),
      );
      await appendEvent(actor, "document.ingested", document.id, {
        chunks: chunks.length,
        contentHash,
      });
      return publicDocument(document);
    },
    async listDocuments(actor: WorkspaceActor) {
      await assertMember(actor);
      return (
        await values<Document>(
          store,
          collectionPrefix(actor.workspaceId, "documents"),
        )
      )
        .filter((document) => !document.deletedAt)
        .sort((left, right) => right.createdAt.localeCompare(left.createdAt))
        .map(publicDocument);
    },
    async deleteDocument(actor: WorkspaceActor, documentId: string) {
      await assertOwner(actor);
      const value = await mutate<Document>(
        store,
        stateKey(actor.workspaceId, "documents", documentId),
        (current) => ({
          ...current,
          deletedAt: timestamp(),
          status: "deleted",
        }),
      );
      await appendEvent(actor, "document.deleted", documentId);
      return { id: value.id };
    },
    async listDocumentChunks(actor: WorkspaceActor, documentId: string) {
      await assertMember(actor);
      const document = (
        await required<Document>(
          store,
          stateKey(actor.workspaceId, "documents", documentId),
          "Document was not found in this workspace",
        )
      ).value;
      if (document.deletedAt)
        throw new Error("Document was not found in this workspace");
      return (
        await values<DocumentChunk>(
          store,
          collectionPrefix(actor.workspaceId, `chunks/${documentId}`),
        )
      )
        .sort((left, right) => left.ordinal - right.ordinal)
        .map(({ content, id }) => ({ content, id }));
    },
    async setChunkEmbeddings(
      actor: WorkspaceActor,
      input: Array<{ embedding: number[]; id: string }>,
    ) {
      await assertMember(actor);
      const allChunks = await store.list<DocumentChunk>(
        collectionPrefix(actor.workspaceId, "chunks"),
      );
      for (const item of input) {
        const found = allChunks.find(({ value }) => value.id === item.id);
        if (!found)
          throw new Error("Document chunk was not found in this workspace");
        await mutate<DocumentChunk>(store, found.key, (current) => ({
          ...current,
          embedding: item.embedding,
        }));
      }
      await appendEvent(actor, "document.embeddings.updated", undefined, {
        chunks: input.length,
      });
    },
    async listIndexRuns(actor: WorkspaceActor, documentId?: string) {
      await assertMember(actor);
      return (
        await values<IndexRun>(
          store,
          collectionPrefix(actor.workspaceId, "index-runs"),
        )
      )
        .filter((run) => !documentId || run.documentId === documentId)
        .sort((left, right) => right.createdAt.localeCompare(left.createdAt))
        .map(publicIndexRun);
    },
    async claimIndexRun(actor: WorkspaceActor, indexRunId: string) {
      await assertMember(actor);
      let acquired = false;
      const claimedAt = now();
      const run = await mutate<IndexRun>(
        store,
        stateKey(actor.workspaceId, "index-runs", indexRunId),
        (current) => {
          acquired = false;
          if (["completed", "failed"].includes(current.status)) return current;
          if (
            current.status === "running" &&
            current.leaseExpiresAt &&
            Date.parse(current.leaseExpiresAt) > claimedAt.getTime()
          )
            return current;
          acquired = true;
          return {
            ...current,
            attempts: (current.attempts ?? 0) + 1,
            leaseExpiresAt: new Date(
              claimedAt.getTime() + jobLeaseMs,
            ).toISOString(),
            startedAt: current.startedAt ?? claimedAt.toISOString(),
            status: "running",
          };
        },
      );
      if (acquired)
        await appendEvent(actor, "index.running", run.id, {
          attempt: run.attempts,
          provider: run.provider,
        });
      return { acquired, run: publicIndexRun(run) };
    },
    async listMessageCitations(actor: WorkspaceActor, messageId: string) {
      await assertMember(actor);
      const records = await values<CitationRecord>(
        store,
        collectionPrefix(actor.workspaceId, `citations/${messageId}`),
      );
      const chunks = await store.list<DocumentChunk>(
        collectionPrefix(actor.workspaceId, "chunks"),
      );
      const documents = await values<Document>(
        store,
        collectionPrefix(actor.workspaceId, "documents"),
      );
      return records
        .sort((left, right) => left.ordinal - right.ordinal)
        .flatMap((citation) => {
          const chunk = chunks.find(
            ({ value }) => value.id === citation.chunkId,
          )?.value;
          const document = documents.find(
            (item) => item.id === chunk?.documentId && !item.deletedAt,
          );
          if (!chunk || !document) return [];
          return [
            {
              content: chunk.content,
              chunkId: chunk.id,
              documentId: document.id,
              filename: document.filename,
              locator: chunk.locator ?? null,
              ordinal: citation.ordinal,
              knowledgeReleaseId: citation.knowledgeReleaseId,
            },
          ];
        });
    },
    async addMessageCitations(
      actor: WorkspaceActor,
      input: {
        chunkIds: string[];
        knowledgeReleaseId?: string;
        messageId: string;
      },
    ) {
      await assertMember(actor);
      await Promise.all(
        input.chunkIds.map((chunkId, ordinal) => {
          const citation: CitationRecord = {
            chunkId,
            createdAt: timestamp(),
            knowledgeReleaseId: input.knowledgeReleaseId ?? "live",
            messageId: input.messageId,
            ordinal,
          };
          return store.create(
            stateKey(
              actor.workspaceId,
              `citations/${input.messageId}`,
              `${ordinal}-${chunkId}`,
            ),
            citation,
          );
        }),
      );
      if (input.chunkIds.length)
        await appendEvent(actor, "message.citations.created", input.messageId, {
          chunks: input.chunkIds,
          knowledgeReleaseId: input.knowledgeReleaseId ?? "live",
        });
    },
    async createMemory(
      actor: WorkspaceActor,
      input: {
        content: string;
        importance?: number;
        sourceConversationId?: string;
      },
    ) {
      await assertMember(actor);
      if (input.sourceConversationId)
        await required(
          store,
          stateKey(
            actor.workspaceId,
            "conversations",
            input.sourceConversationId,
          ),
          "Conversation was not found in this workspace",
        );
      const memory: MemoryRecord = {
        content: input.content,
        createdAt: timestamp(),
        id: randomUUID(),
        importance: input.importance ?? 50,
        ...(input.sourceConversationId
          ? { sourceConversationId: input.sourceConversationId }
          : {}),
        status: "candidate",
        workspaceId: actor.workspaceId,
      };
      await store.create(
        stateKey(actor.workspaceId, "memories", memory.id),
        memory,
      );
      await appendEvent(actor, "memory.candidate.created", memory.id);
      return publicMemory(memory);
    },
    async reviewMemory(
      actor: WorkspaceActor,
      input: { memoryId: string; status: "approved" | "rejected" },
    ) {
      await assertOwner(actor);
      const memory = await mutate<MemoryRecord>(
        store,
        stateKey(actor.workspaceId, "memories", input.memoryId),
        (current) => ({
          ...current,
          reviewedAt: timestamp(),
          status: input.status,
        }),
      );
      await appendEvent(actor, `memory.${input.status}`, memory.id);
      return publicMemory(memory);
    },
    async listMemories(actor: WorkspaceActor) {
      await assertMember(actor);
      return (
        await values<MemoryRecord>(
          store,
          collectionPrefix(actor.workspaceId, "memories"),
        )
      )
        .filter((memory) => !memory.deletedAt)
        .sort((left, right) => right.createdAt.localeCompare(left.createdAt))
        .map(publicMemory);
    },
    async deleteMemory(actor: WorkspaceActor, memoryId: string) {
      await assertOwner(actor);
      const memory = await mutate<MemoryRecord>(
        store,
        stateKey(actor.workspaceId, "memories", memoryId),
        (current) => ({ ...current, deletedAt: timestamp() }),
      );
      await appendEvent(actor, "memory.deleted", memory.id);
      return { id: memory.id };
    },
    async purgeExpiredMemories(actor: WorkspaceActor) {
      await assertOwner(actor);
      const expired = (
        await store.list<MemoryRecord>(
          collectionPrefix(actor.workspaceId, "memories"),
        )
      ).filter(
        ({ value }) =>
          !value.deletedAt &&
          value.expiresAt &&
          Date.parse(value.expiresAt) < now().getTime(),
      );
      for (const { key } of expired)
        await mutate<MemoryRecord>(store, key, (current) => ({
          ...current,
          deletedAt: timestamp(),
        }));
      await appendEvent(actor, "memory.expired.purged", undefined, {
        count: expired.length,
      });
      return { count: expired.length };
    },
    async createIndexRun(
      actor: WorkspaceActor,
      documentId: string,
      provider = "local",
    ) {
      await assertMember(actor);
      await required(
        store,
        stateKey(actor.workspaceId, "documents", documentId),
        "Document was not found in this workspace",
      );
      const run: IndexRun = {
        createdAt: timestamp(),
        documentId,
        id: randomUUID(),
        provider,
        status: "queued",
        workspaceId: actor.workspaceId,
      };
      await store.create(
        stateKey(actor.workspaceId, "index-runs", run.id),
        run,
      );
      await appendEvent(actor, "index.queued", run.id, { provider });
      return publicIndexRun(run);
    },
    async finishIndexRun(
      actor: WorkspaceActor,
      input: {
        error?: string;
        indexRunId: string;
        status: "completed" | "failed";
      },
    ) {
      await assertMember(actor);
      const completedAt = timestamp();
      const run = await mutate<IndexRun>(
        store,
        stateKey(actor.workspaceId, "index-runs", input.indexRunId),
        (current) => ({
          ...current,
          completedAt,
          ...(input.error ? { error: input.error.slice(0, 1_000) } : {}),
          startedAt: current.startedAt ?? completedAt,
          status: input.status,
        }),
      );
      await appendEvent(actor, `index.${input.status}`, run.id, {
        provider: run.provider,
      });
      if (run.provider === "extract" && input.status === "failed")
        await mutate<Document>(
          store,
          stateKey(actor.workspaceId, "documents", run.documentId),
          (current) => ({ ...current, status: "failed" }),
        );
      return publicIndexRun(run);
    },
    async submitFeedback(
      actor: WorkspaceActor,
      input: {
        comment?: string;
        kind: FeedbackKind;
        messageId: string;
      },
    ) {
      await assertMember(actor);
      const messages = await store.list<Message>(
        collectionPrefix(actor.workspaceId, "messages"),
      );
      if (!messages.some(({ value }) => value.id === input.messageId))
        throw new Error("Message was not found in this workspace");
      const feedback: Feedback = {
        ...input,
        createdAt: timestamp(),
        id: randomUUID(),
        submittedByUserId: actor.userId,
        workspaceId: actor.workspaceId,
      };
      await store.create(
        stateKey(actor.workspaceId, "feedback", feedback.id),
        feedback,
      );
      const investigation =
        input.kind === "needs-investigation"
          ? ({
              createdAt: timestamp(),
              feedbackId: feedback.id,
              id: randomUUID(),
              status: "queued",
            } satisfies Investigation)
          : undefined;
      if (investigation)
        await store.create(
          stateKey(actor.workspaceId, "investigations", investigation.id),
          investigation,
        );
      await appendEvent(actor, "feedback.submitted", feedback.id, {
        kind: feedback.kind,
      });
      return {
        feedback: {
          ...feedback,
          createdAt: new Date(feedback.createdAt),
        },
        investigation: investigation
          ? {
              ...investigation,
              createdAt: new Date(investigation.createdAt),
              completedAt: null,
              findings: null,
              resolution: null,
              startedAt: null,
            }
          : undefined,
      };
    },
    async listInvestigations(actor: WorkspaceActor) {
      await assertOwner(actor);
      return (
        await values<Investigation>(
          store,
          collectionPrefix(actor.workspaceId, "investigations"),
        )
      )
        .sort((left, right) => right.createdAt.localeCompare(left.createdAt))
        .map(publicInvestigation);
    },
    async claimInvestigation(actor: WorkspaceActor, investigationId: string) {
      await assertMember(actor);
      let acquired = false;
      const claimedAt = now();
      const investigation = await mutate<Investigation>(
        store,
        stateKey(actor.workspaceId, "investigations", investigationId),
        (current) => {
          acquired = false;
          if (["completed", "failed"].includes(current.status)) return current;
          if (
            current.status === "running" &&
            current.leaseExpiresAt &&
            Date.parse(current.leaseExpiresAt) > claimedAt.getTime()
          )
            return current;
          acquired = true;
          return {
            ...current,
            attempts: (current.attempts ?? 0) + 1,
            leaseExpiresAt: new Date(
              claimedAt.getTime() + jobLeaseMs,
            ).toISOString(),
            startedAt: current.startedAt ?? claimedAt.toISOString(),
            status: "running",
          };
        },
      );
      if (acquired)
        await appendEvent(actor, "investigation.running", investigation.id, {
          attempt: investigation.attempts,
        });
      return { acquired, investigation: publicInvestigation(investigation) };
    },
    async finishInvestigation(
      actor: WorkspaceActor,
      input: {
        error?: string;
        investigationId: string;
        status: "completed" | "failed";
      },
    ) {
      await assertMember(actor);
      const current = (
        await required<Investigation>(
          store,
          stateKey(actor.workspaceId, "investigations", input.investigationId),
          "Investigation was not found in this workspace",
        )
      ).value;
      const feedback = (
        await required<Feedback>(
          store,
          stateKey(actor.workspaceId, "feedback", current.feedbackId),
          "Feedback was not found in this workspace",
        )
      ).value;
      const messages = await store.list<Message>(
        collectionPrefix(actor.workspaceId, "messages"),
      );
      const message = messages.find(
        ({ value }) => value.id === feedback.messageId,
      )?.value;
      const citations = await values<CitationRecord>(
        store,
        collectionPrefix(actor.workspaceId, `citations/${feedback.messageId}`),
      );
      const completedAt = timestamp();
      const investigation = await mutate<Investigation>(
        store,
        stateKey(actor.workspaceId, "investigations", input.investigationId),
        (value) => ({
          ...value,
          completedAt,
          ...(input.error ? { error: input.error.slice(0, 1_000) } : {}),
          ...(input.status === "completed"
            ? {
                findings: {
                  citationCount: citations.length,
                  ...(feedback.comment ? { comment: feedback.comment } : {}),
                  feedbackKind: feedback.kind,
                  messageExcerpt: (message?.content ?? "").slice(0, 500),
                },
                resolution:
                  "근거와 답변을 검토한 뒤 승인된 평가 사례로 등록하세요.",
              }
            : {}),
          startedAt: value.startedAt ?? completedAt,
          status: input.status,
        }),
      );
      await appendEvent(
        actor,
        `investigation.${input.status}`,
        investigation.id,
      );
      return publicInvestigation(investigation);
    },
    async listAuditLog(actor: WorkspaceActor) {
      await assertOwner(actor);
      return (
        await values<AuditEvent>(
          store,
          `workspaces/${actor.workspaceId}/events/`,
        )
      )
        .sort((left, right) => right.createdAt.localeCompare(left.createdAt))
        .slice(0, 100)
        .map((event) => ({
          action: event.action,
          createdAt: new Date(event.createdAt),
          id: event.id,
          metadata: event.metadata ?? null,
          subjectId: event.subjectId ?? null,
        }));
    },
    async workspaceUsage(actor: WorkspaceActor) {
      await assertMember(actor);
      const [documents, messages, memories] = await Promise.all([
        values<Document>(
          store,
          collectionPrefix(actor.workspaceId, "documents"),
        ),
        values<Message>(store, collectionPrefix(actor.workspaceId, "messages")),
        values<MemoryRecord>(
          store,
          collectionPrefix(actor.workspaceId, "memories"),
        ),
      ]);
      const monthPrefix = timestamp().slice(0, 7);
      return {
        documents: documents.filter((item) => !item.deletedAt).length,
        memories: memories.filter((item) => !item.deletedAt).length,
        messages: messages.length,
        monthlyModelTokens: messages
          .filter(
            (item) =>
              item.role === "assistant" &&
              item.createdAt.startsWith(monthPrefix),
          )
          .reduce((total, item) => {
            const usage = item.metadata?.usage;
            return (
              total +
              (usage?.totalTokens ??
                (usage?.inputTokens ?? 0) + (usage?.outputTokens ?? 0))
            );
          }, 0),
        storageBytes: documents
          .filter((item) => !item.deletedAt)
          .reduce((total, item) => total + item.sizeBytes, 0),
      };
    },
    async createEvaluationCase(
      actor: WorkspaceActor,
      input: { expectedChunkIds: string[]; question: string },
    ) {
      await assertOwner(actor);
      const evaluationCase: EvaluationCase = {
        ...input,
        createdAt: timestamp(),
        createdByUserId: actor.userId,
        id: randomUUID(),
        status: "approved",
        workspaceId: actor.workspaceId,
      };
      await store.create(
        stateKey(actor.workspaceId, "evaluation-cases", evaluationCase.id),
        evaluationCase,
      );
      await appendEvent(actor, "evaluation.case.created", evaluationCase.id);
      return {
        ...evaluationCase,
        createdAt: new Date(evaluationCase.createdAt),
      };
    },
    async listEvaluationCases(actor: WorkspaceActor) {
      await assertOwner(actor);
      return (
        await values<EvaluationCase>(
          store,
          collectionPrefix(actor.workspaceId, "evaluation-cases"),
        )
      )
        .filter((item) => item.status === "approved")
        .sort((left, right) => right.createdAt.localeCompare(left.createdAt))
        .map((item) => ({ ...item, createdAt: new Date(item.createdAt) }));
    },
    async createEvaluationRun(
      actor: WorkspaceActor,
      trigger: "manual" | "weekly",
    ) {
      await assertOwner(actor);
      const createdAt = timestamp();
      const run: EvaluationRun = {
        createdAt,
        id: randomUUID(),
        status: "queued",
        trigger,
        workspaceId: actor.workspaceId,
      };
      await store.create(
        stateKey(actor.workspaceId, "evaluation-runs", run.id),
        run,
      );
      await appendEvent(actor, "evaluation.run.queued", run.id, { trigger });
      return publicEvaluationRun(run);
    },
    async claimEvaluationRun(actor: WorkspaceActor, runId: string) {
      await assertOwner(actor);
      let acquired = false;
      const claimedAt = now();
      const run = await mutate<EvaluationRun>(
        store,
        stateKey(actor.workspaceId, "evaluation-runs", runId),
        (current) => {
          acquired = false;
          if (["completed", "failed"].includes(current.status)) return current;
          if (
            current.status === "running" &&
            current.leaseExpiresAt &&
            Date.parse(current.leaseExpiresAt) > claimedAt.getTime()
          )
            return current;
          acquired = true;
          return {
            ...current,
            attempts: (current.attempts ?? 0) + 1,
            leaseExpiresAt: new Date(
              claimedAt.getTime() + jobLeaseMs,
            ).toISOString(),
            startedAt: current.startedAt ?? claimedAt.toISOString(),
            status: "running",
          };
        },
      );
      if (acquired)
        await appendEvent(actor, "evaluation.run.started", run.id, {
          attempt: run.attempts,
          trigger: run.trigger,
        });
      return { acquired, run: publicEvaluationRun(run) };
    },
    async failEvaluationRun(
      actor: WorkspaceActor,
      input: { error: string; runId: string },
    ) {
      await assertOwner(actor);
      const completedAt = timestamp();
      const run = await mutate<EvaluationRun>(
        store,
        stateKey(actor.workspaceId, "evaluation-runs", input.runId),
        (current) => ({
          ...current,
          completedAt,
          error: input.error.slice(0, 1_000),
          startedAt: current.startedAt ?? completedAt,
          status: "failed",
        }),
      );
      await appendEvent(actor, "evaluation.run.failed", run.id);
      return publicEvaluationRun(run);
    },
    async completeEvaluationRun(
      actor: WorkspaceActor,
      input: {
        results: Array<{
          caseId: string;
          citationRecall: number;
          retrievedChunkIds: string[];
        }>;
        runId: string;
      },
    ) {
      await assertOwner(actor);
      const ids = input.results.map((result) => result.caseId);
      if (new Set(ids).size !== ids.length)
        throw new Error(
          "Evaluation results must contain each case at most once",
        );
      const cases = await values<EvaluationCase>(
        store,
        collectionPrefix(actor.workspaceId, "evaluation-cases"),
      );
      if (
        ids.some(
          (id) =>
            !cases.some((item) => item.id === id && item.status === "approved"),
        )
      )
        throw new Error("Evaluation results include an invalid workspace case");
      const averageCitationRecall = input.results.length
        ? input.results.reduce(
            (sum, result) => sum + result.citationRecall,
            0,
          ) / input.results.length
        : 0;
      const averageCitationPrecision = input.results.length
        ? input.results.reduce((sum, result) => {
            const evaluationCase = cases.find(
              (item) => item.id === result.caseId,
            );
            return (
              sum +
              evaluateCitationPrecision({
                expectedChunkIds: evaluationCase?.expectedChunkIds ?? [],
                retrievedChunkIds: result.retrievedChunkIds,
              })
            );
          }, 0) / input.results.length
        : 0;
      await mutate<EvaluationRun>(
        store,
        stateKey(actor.workspaceId, "evaluation-runs", input.runId),
        (current) => {
          if (current.status !== "running")
            throw new Error("Evaluation run was not found or is not running");
          return {
            ...current,
            completedAt: timestamp(),
            results: input.results,
            status: "completed",
            summary: {
              averageCitationPrecision,
              averageCitationRecall,
              cases: input.results.length,
            },
          };
        },
      );
      await appendEvent(actor, "evaluation.run.completed", input.runId, {
        averageCitationPrecision,
        averageCitationRecall,
      });
      return {
        averageCitationPrecision,
        averageCitationRecall,
        cases: input.results.length,
      };
    },
    async listEvaluationRuns(actor: WorkspaceActor) {
      await assertOwner(actor);
      return (
        await values<EvaluationRun>(
          store,
          collectionPrefix(actor.workspaceId, "evaluation-runs"),
        )
      )
        .sort((left, right) => right.createdAt.localeCompare(left.createdAt))
        .slice(0, 24)
        .map(publicEvaluationRun);
    },
    async activeRelease(workspaceId: string) {
      return (
        await store.get<ReleaseHead>(
          `workspaces/${workspaceId}/heads/active-release.json`,
        )
      )?.value;
    },
    async publishRelease(
      actor: WorkspaceActor,
      input: { minimumCitationRecall?: number } = {},
    ) {
      await assertOwner(actor);
      const minimumCitationRecall = input.minimumCitationRecall ?? 0.75;
      const runs = (
        await values<EvaluationRun>(
          store,
          collectionPrefix(actor.workspaceId, "evaluation-runs"),
        )
      )
        .filter((run) => run.status === "completed" && run.summary)
        .sort((left, right) => right.createdAt.localeCompare(left.createdAt));
      const evaluation = runs[0];
      if (
        !evaluation?.summary ||
        evaluation.summary.averageCitationRecall < minimumCitationRecall
      )
        throw new Error(
          `A completed evaluation with citation recall >= ${minimumCitationRecall} is required`,
        );
      const [knowledgeChunks, memories] = await Promise.all([
        liveKnowledgeChunks(actor.workspaceId),
        liveApprovedMemories(actor.workspaceId),
      ]);
      const releaseId = `${Date.now().toString(36)}-${randomUUID()}`;
      const createdAt = timestamp();
      const snapshot: ReleaseSnapshot = {
        createdAt,
        knowledgeChunks,
        memories,
        releaseId,
        workspaceId: actor.workspaceId,
      };
      const snapshotKey = `workspaces/${actor.workspaceId}/releases/${releaseId}/snapshot.json`;
      const manifestKey = `workspaces/${actor.workspaceId}/releases/${releaseId}/manifest.json`;
      const body = JSON.stringify(snapshot);
      await store.create(snapshotKey, snapshot);
      await store.create(manifestKey, {
        createdAt,
        evaluationRunId: evaluation.id,
        minimumCitationRecall,
        releaseId,
        schemaVersion: 1,
        sha256: createHash("sha256").update(body).digest("hex"),
        snapshotKey,
        workspaceId: actor.workspaceId,
      });
      const headKey = `workspaces/${actor.workspaceId}/heads/active-release.json`;
      const current = await store.get<ReleaseHead>(headKey);
      const head: ReleaseHead = {
        activatedAt: timestamp(),
        manifestKey,
        ...(current ? { previousReleaseId: current.value.releaseId } : {}),
        releaseId,
        snapshotKey,
      };
      if (current?.etag) await store.replace(headKey, head, current.etag);
      else await store.create(headKey, head);
      await appendEvent(actor, "release.activated", releaseId, {
        evaluationRunId: evaluation.id,
        previousReleaseId: head.previousReleaseId,
      });
      return head;
    },
    async listKnowledgeChunks(workspaceId: string, expectedReleaseId?: string) {
      const head = await store.get<ReleaseHead>(
        `workspaces/${workspaceId}/heads/active-release.json`,
      );
      if (expectedReleaseId === "live" && head)
        throw new Error("Knowledge release changed during agent run");
      if (
        expectedReleaseId &&
        expectedReleaseId !== "live" &&
        head?.value.releaseId !== expectedReleaseId
      )
        throw new Error("Knowledge release changed during agent run");
      if (head) {
        const snapshot = await store.get<ReleaseSnapshot>(
          head.value.snapshotKey,
        );
        if (!snapshot) throw new Error("Active release snapshot was not found");
        return snapshot.value.knowledgeChunks;
      }
      return liveKnowledgeChunks(workspaceId);
    },
    async listApprovedMemories(
      workspaceId: string,
      expectedReleaseId?: string,
    ) {
      const head = await store.get<ReleaseHead>(
        `workspaces/${workspaceId}/heads/active-release.json`,
      );
      if (expectedReleaseId === "live" && head)
        throw new Error("Knowledge release changed during agent run");
      if (
        expectedReleaseId &&
        expectedReleaseId !== "live" &&
        head?.value.releaseId !== expectedReleaseId
      )
        throw new Error("Knowledge release changed during agent run");
      if (head) {
        const snapshot = await store.get<ReleaseSnapshot>(
          head.value.snapshotKey,
        );
        if (!snapshot) throw new Error("Active release snapshot was not found");
        return snapshot.value.memories;
      }
      return liveApprovedMemories(workspaceId);
    },
  };

  async function liveKnowledgeChunks(workspaceId: string) {
    const documents = await values<Document>(
      store,
      collectionPrefix(workspaceId, "documents"),
    );
    const chunks = await values<DocumentChunk>(
      store,
      collectionPrefix(workspaceId, "chunks"),
    );
    return chunks.flatMap((chunk) => {
      const document = documents.find(
        (item) =>
          item.id === chunk.documentId &&
          item.status === "completed" &&
          !item.deletedAt,
      );
      return document
        ? [
            {
              chunkId: chunk.id,
              content: chunk.content,
              documentId: document.id,
              embedding: chunk.embedding,
              label: document.filename,
              locator: chunk.locator,
            },
          ]
        : [];
    });
  }

  async function liveApprovedMemories(workspaceId: string) {
    return (
      await values<MemoryRecord>(
        store,
        collectionPrefix(workspaceId, "memories"),
      )
    ).filter(
      (memory) =>
        memory.status === "approved" &&
        !memory.deletedAt &&
        (!memory.expiresAt || Date.parse(memory.expiresAt) >= now().getTime()),
    );
  }
}

export type S3AgentPlatformRepository = ReturnType<
  typeof createS3AgentPlatformRepository
>;

export class AgentJobBusyError extends Error {
  readonly estimatedCompletionAt: string;
  readonly jobId: string;

  constructor(input: { estimatedCompletionAt: string; jobId: string }) {
    super("An agent request is already being processed");
    this.name = "AgentJobBusyError";
    this.estimatedCompletionAt = input.estimatedCompletionAt;
    this.jobId = input.jobId;
  }
}
