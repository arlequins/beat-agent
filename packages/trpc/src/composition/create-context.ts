import { createBedrockModelProvider } from "@arlequins/agent-bedrock";
import { createTextDocumentExtraction } from "@arlequins/agent-core";
import { createBeatMcpServer } from "@arlequins/agent-mcp";
import {
  createOllamaEmbeddingProvider,
  createOllamaModelProvider,
} from "@arlequins/agent-ollama";
import { authApi } from "@arlequins/auth";
import { serverEnv } from "@arlequins/env";
import { createS3AgentPlatformRepository } from "../adaptors/agent-platform-s3";
import {
  createS3KnowledgeSearch,
  createS3MemorySearch,
} from "../adaptors/agent-retrieval-s3";
import { createAwsBedrockConversePort } from "../adaptors/bedrock-converse";
import { deriveBeatSession } from "../adaptors/oidc-identity";
import { createS3JsonObjectStore } from "../adaptors/s3-json-store";
import type { CreateTRPCContextOptions, TRPCContext } from "../context";

function bootstrapAdministratorIdentities() {
  return new Set(
    (serverEnv.AUTH_BOOTSTRAP_ADMIN_IDENTITIES ?? "")
      .split(",")
      .map((identity) => identity.trim())
      .filter(Boolean),
  );
}

let repository: ReturnType<typeof createS3AgentPlatformRepository> | undefined;

function agentRepository() {
  if (repository) return repository;
  if (!serverEnv.S3_AGENT_BUCKET)
    throw new Error("S3_AGENT_BUCKET is required for Beat");
  repository = createS3AgentPlatformRepository(
    createS3JsonObjectStore({
      bucket: serverEnv.S3_AGENT_BUCKET,
      endpoint: serverEnv.S3_AGENT_ENDPOINT,
      forcePathStyle: serverEnv.S3_AGENT_FORCE_PATH_STYLE,
      prefix: serverEnv.S3_AGENT_PREFIX ?? serverEnv.SST_STAGE ?? "local",
    }),
  );
  return repository;
}

export async function createTRPCContext(
  options: CreateTRPCContextOptions,
): Promise<TRPCContext> {
  const tokenSession = await authApi.getSession({ headers: options.headers });
  const session = tokenSession
    ? deriveBeatSession(tokenSession, bootstrapAdministratorIdentities())
    : null;
  const agent = agentRepository();
  const embedding = serverEnv.OLLAMA_BASE_URL
    ? createOllamaEmbeddingProvider({
        baseUrl: serverEnv.OLLAMA_BASE_URL,
        model: serverEnv.OLLAMA_EMBEDDING_MODEL,
      })
    : undefined;
  const model = serverEnv.BEDROCK_MODEL_ID
    ? createBedrockModelProvider({
        client: createAwsBedrockConversePort(),
        modelId: serverEnv.BEDROCK_MODEL_ID,
      })
    : serverEnv.OLLAMA_BASE_URL
      ? createOllamaModelProvider({
          baseUrl: serverEnv.OLLAMA_BASE_URL,
          model: serverEnv.OLLAMA_MODEL,
        })
      : undefined;

  const knowledgeSearch = createS3KnowledgeSearch(agent, { embedding });
  const memorySearch = createS3MemorySearch(agent);
  const tools = session
    ? createBeatMcpServer({
        authorization: {
          async authorize({ subject, workspaceId }) {
            if (subject !== session.user.id && subject !== session.user.subject)
              throw new Error("MCP subject does not match the active session");
            return { userId: session.user.id, workspaceId };
          },
        },
        knowledgeSearch,
        memorySearch,
        repository: agent,
      }).toolRegistry
    : undefined;

  if (session)
    options.logger.info("auth.login.succeeded", {
      issuer: session.user.issuer,
      subject: session.user.subject,
      userId: session.user.id,
    });

  return {
    authApi,
    logger: options.logger,
    telemetry: options.telemetry,
    session,
    services: {
      agent,
      knowledgeSearch,
      memorySearch,
      model,
      modelId: serverEnv.BEDROCK_MODEL_ID ?? serverEnv.OLLAMA_MODEL,
      embedding,
      documentExtraction: createTextDocumentExtraction(),
      tools,
    },
  };
}
