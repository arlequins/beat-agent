import type {
  AgentToolPort,
  DocumentExtractionPort,
  DocumentSecurityPort,
  DocumentSourcePort,
  EmbeddingProviderPort,
  KnowledgeSearchPort,
  MemorySearchPort,
  ModelProviderPort,
} from "@arlequins/agent-core";
import type { AuthSession, TRPCAuth } from "@arlequins/auth";
import type { Logger, Telemetry } from "@arlequins/logger";
import type { JobQueuePort } from "@arlequins/service";
import type { S3AgentPlatformRepository } from "./adaptors/agent-platform-s3";
import type { ModelProvider } from "./model-errors";

export type TRPCServices = {
  agent: S3AgentPlatformRepository;
  model?: ModelProviderPort;
  modelId?: string;
  modelProvider: ModelProvider;
  tools?: AgentToolPort;
  embedding?: EmbeddingProviderPort;
  documentExtraction: DocumentExtractionPort;
  documentSecurity: DocumentSecurityPort;
  documentSource?: DocumentSourcePort & {
    createUploadTarget(input: {
      contentHash: string;
      contentType: string;
      filename: string;
      sizeBytes: number;
      userId: string;
      workspaceId: string;
    }): Promise<{
      expiresAt: Date;
      headers: Record<string, string>;
      sourceUri: string;
      url: string;
    }>;
    verifyUpload(input: {
      contentHash: string;
      contentType: string;
      sizeBytes: number;
      sourceUri: string;
      workspaceId: string;
    }): Promise<void>;
  };
  knowledgeSearch: KnowledgeSearchPort;
  memorySearch: MemorySearchPort;
  jobQueue?: JobQueuePort;
  quota: {
    maxCompletionTokens: number;
    maxDocuments: number;
    maxMemories: number;
    maxMessages: number;
    maxMonthlyModelTokens: number;
    maxStorageBytes: number;
  };
};

export type TRPCContext = {
  authApi: TRPCAuth;
  logger: Logger;
  telemetry: Telemetry;
  session: AuthSession | null;
  services: TRPCServices;
};

export type CreateTRPCContextOptions = {
  headers: Headers;
  jobQueue?: JobQueuePort;
  logger: Logger;
  telemetry: Telemetry;
};
