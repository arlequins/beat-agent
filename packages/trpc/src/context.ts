import type {
  DocumentExtractionPort,
  EmbeddingProviderPort,
  KnowledgeSearchPort,
  MemorySearchPort,
  ModelProviderPort,
} from "@arlequins/agent-core";
import type { AuthSession, TRPCAuth } from "@arlequins/auth";
import type { Logger, Telemetry } from "@arlequins/logger";
import type { ContentService, FileUploadService } from "@arlequins/service";
import type { createAgentPlatformRepository } from "./adaptors/agent-platform";

export type TRPCServices = {
  content: ContentService;
  fileUpload?: FileUploadService;
  agent: ReturnType<typeof createAgentPlatformRepository>;
  model?: ModelProviderPort;
  embedding?: EmbeddingProviderPort;
  documentExtraction: DocumentExtractionPort;
  knowledgeSearch: KnowledgeSearchPort;
  memorySearch: MemorySearchPort;
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
  logger: Logger;
  telemetry: Telemetry;
};
