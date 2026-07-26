# Agent Platform Template

This template is a reusable conversational-agent foundation, not a code-agent
implementation. A project made from it can begin as a personal assistant,
reflection partner, or enterprise document assistant; repository analysis and
data lineage are later additions.

## Runtime boundary

`@arlequins/agent-core` owns the provider-neutral agent loop:

```text
question
  -> workspace-scoped memory search
  -> workspace-scoped knowledge search
  -> model provider stream
  -> text events and citations
```

It deliberately has no AWS SDK, database, HTTP, or UI dependency. Adapters are
added at the boundary:

| Port | Local implementation | AWS implementation |
| --- | --- | --- |
| Model provider | Ollama or a deterministic test double | Amazon Bedrock adapter |
| Memory | PostgreSQL/Docker | Aurora PostgreSQL or a DynamoDB adapter |
| Knowledge retrieval | Ollama embeddings stored with authorized chunks, then keyword fallback | S3 source objects + S3 Vectors adapter |
| Long-running work | direct local runner | Step Functions + Lambda |

The API converts agent events into a streaming response. tRPC remains the typed
CRUD transport for conversations, documents, workspaces, feedback, and admin
operations.

## First template milestones

1. **Conversation:** profile selection, streaming messages, titles, history,
   summaries, and workspace isolation.
2. **Memory and feedback:** durable memories are candidates until reviewed;
   feedback can be helpful, incorrect, missing, or needs-investigation.
3. **Document RAG:** original files in S3, retrieval IDs in S3 Vectors, and
   authorization plus citation resolution in the relational store.
4. **Learning loop:** feedback becomes a reviewed investigation, knowledge
   patch, and regression evaluation before it affects future answers.
5. **Enterprise code analysis:** CodeBuild creates repository-wide manifests;
   Step Functions and Lambda process shards and activate a verified version.

## Free-tier-first profile

The template must be useful for a newly created AWS account without creating
standing infrastructure by default.

```text
Local default: Docker PostgreSQL + OIDC mock + Ollama
AWS personal proof of concept: Lambda + S3 + DynamoDB + Cognito (when no other OIDC exists)
Enterprise upgrade: Aurora + S3 Vectors + Bedrock + CodeBuild
```

Free-tier eligibility, promotional credits, and regional availability change.
Treat this as a design policy rather than a price guarantee. In particular,
Amazon Bedrock inference and Aurora capacity must be budgeted as potentially
billable. Set AWS Budgets before enabling either service.

The optional Aurora stack is documented in [Aurora PostgreSQL with SST](./aurora-sst.md).

## Durable data and authorization

The `agent` PostgreSQL schema is the durable control plane. It contains
workspaces and memberships, conversations and messages, reviewed memory,
documents and chunks, message citations, feedback and investigations, and
index runs. Every tenant-owned query enters through a workspace membership
check. Vector IDs and object URIs are metadata only: a vector hit is never
shown until its chunk, document, and workspace are resolved in PostgreSQL.

`0003_agent-platform.sql` is additive and safe to apply to a local Docker
database before enabling Aurora. It deliberately does not create a vector
extension or an AWS resource.

The typed `agent.*` tRPC contract accepts workspace-scoped IDs, validates size,
hash, source URI, roles, and feedback kinds, and derives the actor from the
authenticated session. The adapter checks membership again before each write;
do not expose a repository directly to an HTTP handler.

## Workflows and provider boundaries

`apps/batch/config/step-defs/agent.ts` declares three Step Functions workflows:

- document ingestion: claim index run, extract/chunk, vector upsert, complete;
- feedback investigation: claim, collect evidence, evaluate, persist findings;
- weekly evaluation: snapshot reviewed cases, evaluate, publish metrics.

The first two schedules are disabled because requests should start them with an
opaque validated run ID. Weekly evaluation is scheduled only in production.
All workflows are deployment definitions, not a deployment action.

`DocumentSourcePort`, `VectorIndexPort`, and `AgentWorkflowPort` keep S3,
S3 Vectors, and Step Functions outside `@arlequins/agent-core`. A Bedrock
adapter implements the existing `ModelProviderPort`; a local model or test
double implements the same port. No AWS SDK is imported by the core package.

## Local Ollama quick start

The default local model is `qwen2.5:3b`, selected for a small first download,
predictable non-reasoning responses, and reasonable Apple Silicon performance.
Install it with:

```bash
ollama pull qwen2.5:3b
```

Copy `.env.example` to `.env`; it sets `OLLAMA_BASE_URL` to the loopback-only
address `http://127.0.0.1:11434` and `OLLAMA_MODEL=qwen2.5:3b`. The
`@arlequins/agent-ollama` adapter rejects non-loopback endpoints, preventing a
local configuration from silently sending conversation content to a remote
server. Omit `OLLAMA_BASE_URL` to disable completion entirely.

The signed-in starter UI has a workspace-scoped chat, a small text-document
registration panel, memory-candidate capture, and helpful/investigation
feedback actions. `POST /agent/stream` emits newline-delimited JSON (`delta`,
then `complete`) while `agent.complete` is the compatible typed, non-streaming
alternative. Both paths save the user question and assistant response through
the same application service. Retrieved document chunks are saved as durable
message citations before completion.

Text documents are chunked locally and searched with PostgreSQL case-insensitive
term matching when the embedding model is unavailable. With
`OLLAMA_EMBEDDING_MODEL=nomic-embed-text`, each new text or Markdown document is
embedded locally through Ollama and cosine-ranked inside the authorized
workspace. The vectors are stored alongside the relational chunk metadata, not
in an unscoped browser cache. Pull it once with `ollama pull nomic-embed-text`.
Memory starts as `candidate`; only an owner using `agent.reviewMemory` can mark
it `approved`, and only approved, unexpired memories enter model context.

## Document operations

The starter UI lists workspace documents with their ingestion state, most recent
index-request state, and a soft-delete action. Deletion sets `deletedAt`, so a
deleted document immediately leaves retrieval results while existing audit
records remain intact. `agent.startIndex` records a provider-neutral index run;
the local text ingestion path completes synchronously, while a host application
may route queued runs to the included Step Functions adapters. Assistant
messages expose their durable document citations, including the source filename
and a short chunk preview, only after the same workspace-membership check used
for the conversation.

Text, Markdown, and HTML pass through a server-side extraction port before
chunking. The built-in HTML extractor removes script and style content; PDF and
DOCX must be connected through a host parser plus malware-scanning adapter,
then follow the same queued index-run path. Do not extract binary office files
in the browser.

## Operations, retention, and roles

`workspace_member.role` is enforced on every query. Members can use their
workspace, while owners alone can add or change members, remove documents,
approve/reject/delete memories, purge expired memories, and read the audit log.
The UI exposes safe text/Markdown file selection (1MB maximum), document state,
citation previews, memory review, and workspace usage counts. Keep larger or
binary formats behind a server-side parser and malware scan rather than sending
them to the browser text reader.

Migration `0004_agent-local-rag-operations.sql` adds local chunk embeddings and
an append-only `audit_log`. `agent.usage` returns bounded operational counts and
`agent.auditLog` returns the most recent 100 non-content audit events. A host
may schedule `agent.purgeExpiredMemories`; it is intentionally not automatic in
this template so retention remains an explicit product decision.

The **색인 요청** action is a safe local retry: it creates an auditable index run,
re-embeds the document chunks, then records `completed` or a bounded `failed`
error. Cloud index runs remain queued for the host application's workflow port.

## Retrieval evaluation

Owners can register a reviewed question with one or more expected chunk IDs and
run a deterministic retrieval evaluation. Each result records citation recall
(`expected chunks retrieved / expected chunks`) and the retrieved chunk IDs;
it does not grade generated prose or silently alter knowledge. `evaluation_case`,
`evaluation_run`, and `evaluation_result` are durable, workspace-scoped records.
The weekly Step Functions definition can invoke this same boundary after a host
selects approved cases.

## Optional cloud adapters

`@arlequins/agent-bedrock` and `@arlequins/agent-s3-vectors` are SDK-free ports:
the deploying application injects its Bedrock Converse and S3 Vectors client.
They add no cloud credentials, infrastructure, or provider imports to the local
runtime. Wire them only after selecting a model, index, IAM role, budget, and
data residency policy; the local Ollama/PostgreSQL path stays the default.

Use a dedicated runtime role, never the CI deployment role. Start from
[`iam/agent-runtime-policy.json`](./iam/agent-runtime-policy.json), replace all
placeholders with one approved Bedrock model, source-object prefix, and vector
index, then validate the resulting actions against CloudTrail in a sandbox. The
policy intentionally contains no wildcard actions or resources. Do not attach
write access to the source-document bucket to a retrieval-only runtime.

Ollama values are not included in `LambdaEnvironment`, so this local default is
unavailable after an AWS deployment unless a separate provider adapter is
explicitly wired.
