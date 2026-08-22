import type { DocumentSourcePort } from "@arlequins/agent-core";
import {
  GetObjectCommand,
  HeadObjectCommand,
  PutObjectCommand,
  S3Client,
} from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";

function safeFilename(value: string) {
  return value.replace(/[^a-zA-Z0-9._-]+/g, "-").slice(-128) || "document";
}

export function createS3DocumentSource(input: {
  bucket: string;
  client?: S3Client;
  endpoint?: string;
  forcePathStyle?: boolean;
  prefix?: string;
}) {
  const client =
    input.client ??
    new S3Client({
      ...(input.endpoint ? { endpoint: input.endpoint } : {}),
      forcePathStyle: input.forcePathStyle,
    });
  const prefix = input.prefix?.replace(/^\/+|\/+$/g, "") ?? "";
  const fullKey = (key: string) => (prefix ? `${prefix}/${key}` : key);

  function parseSource(sourceUri: string, workspaceId: string) {
    const url = new URL(sourceUri);
    if (url.protocol !== "s3:" || url.hostname !== input.bucket)
      throw new Error("Document source must use the configured S3 bucket");
    const key = url.pathname.replace(/^\//, "");
    const requiredPrefix = fullKey(`workspaces/${workspaceId}/uploads/`);
    if (!key.startsWith(requiredPrefix))
      throw new Error("Document source is outside the workspace upload prefix");
    return key;
  }

  return {
    async createUploadTarget(request: {
      contentHash: string;
      contentType: string;
      filename: string;
      sizeBytes: number;
      userId: string;
      workspaceId: string;
    }) {
      const key = fullKey(
        `workspaces/${request.workspaceId}/uploads/${request.contentHash}/${safeFilename(request.filename)}`,
      );
      const command = new PutObjectCommand({
        Body: undefined,
        Bucket: input.bucket,
        ContentLength: request.sizeBytes,
        ContentType: request.contentType,
        IfNoneMatch: "*",
        Key: key,
        Metadata: {
          sha256: request.contentHash,
          uploadedBy: request.userId,
        },
      });
      return {
        expiresAt: new Date(Date.now() + 5 * 60_000),
        headers: {
          "content-type": request.contentType,
          "if-none-match": "*",
          "x-amz-meta-sha256": request.contentHash,
          "x-amz-meta-uploadedby": request.userId,
        },
        sourceUri: `s3://${input.bucket}/${key}`,
        url: await getSignedUrl(client, command, { expiresIn: 300 }),
      };
    },
    async read(request: { sourceUri: string; workspaceId: string }) {
      const response = await client.send(
        new GetObjectCommand({
          Bucket: input.bucket,
          Key: parseSource(request.sourceUri, request.workspaceId),
        }),
      );
      if (!response.Body) throw new Error("Uploaded document has no content");
      return response.Body.transformToByteArray();
    },
    async verifyUpload(request: {
      contentHash: string;
      contentType: string;
      sizeBytes: number;
      sourceUri: string;
      workspaceId: string;
    }) {
      const response = await client.send(
        new HeadObjectCommand({
          Bucket: input.bucket,
          Key: parseSource(request.sourceUri, request.workspaceId),
        }),
      );
      if (
        response.ContentLength !== request.sizeBytes ||
        response.ContentType !== request.contentType ||
        response.Metadata?.sha256 !== request.contentHash
      )
        throw new Error("Uploaded document metadata did not match the request");
    },
  } satisfies DocumentSourcePort & Record<string, unknown>;
}

export type S3DocumentSource = ReturnType<typeof createS3DocumentSource>;
