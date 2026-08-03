import { describe, expect, it } from "vitest";

import { createS3VectorsIndex } from "./index";

describe("createS3VectorsIndex", () => {
  it("uses injected operations and returns stable record ids", async () => {
    const records: Array<{ key: string; text: string }> = [];
    const index = createS3VectorsIndex({
      client: {
        delete: async () => undefined,
        upsert: async ({ records: received }) => {
          records.push(...received);
        },
      },
      indexName: "knowledge",
    });
    await expect(
      index.upsert({
        chunks: [{ content: "source", recordId: "chunk-1" }],
        workspaceId: "workspace-1",
      }),
    ).resolves.toEqual({ recordIds: ["chunk-1"] });
    expect(records).toEqual([{ key: "chunk-1", text: "source" }]);
  });
});
