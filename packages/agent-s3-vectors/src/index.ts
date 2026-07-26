import type {
  IndexDocumentRequest,
  VectorIndexPort,
} from "@arlequins/agent-core";

/** SDK-free S3 Vectors boundary. The AWS host supplies the concrete client and index name. */
export type S3VectorsClientPort = {
  delete(input: { indexName: string; keys: string[] }): Promise<void>;
  upsert(input: {
    indexName: string;
    records: Array<{ key: string; text: string }>;
  }): Promise<void>;
};

export function createS3VectorsIndex(input: {
  client: S3VectorsClientPort;
  indexName: string;
}): VectorIndexPort {
  return {
    delete: ({ recordIds }) =>
      input.client.delete({ indexName: input.indexName, keys: recordIds }),
    async upsert(request: IndexDocumentRequest) {
      await input.client.upsert({
        indexName: input.indexName,
        records: request.chunks.map((chunk) => ({
          key: chunk.recordId,
          text: chunk.content,
        })),
      });
      return { recordIds: request.chunks.map((chunk) => chunk.recordId) };
    },
  };
}
