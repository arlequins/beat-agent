import { randomUUID } from "node:crypto";
import type { FileStoragePort } from "@arlequins/service";
import { PutObjectCommand, S3Client } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";

function safeExtension(fileName: string) {
  const extension = fileName.split(".").pop()?.toLowerCase();
  return extension && /^[a-z0-9]{1,10}$/.test(extension) ? `.${extension}` : "";
}

export function createS3FileUploadAdapter(options: {
  bucket: string;
  client?: S3Client;
  prefix?: string;
}): FileStoragePort {
  const client = options.client ?? new S3Client({});
  const prefix = options.prefix?.replace(/^\/+|\/+$/g, "") ?? "uploads";
  return {
    async createUploadTarget(input) {
      const key = `${prefix}/${randomUUID()}${safeExtension(input.fileName)}`;
      const expiresIn = 300;
      const url = await getSignedUrl(
        client,
        new PutObjectCommand({
          Bucket: options.bucket,
          ContentLength: input.size,
          ContentType: input.contentType,
          Key: key,
          Metadata: { "original-name": encodeURIComponent(input.fileName) },
        }),
        { expiresIn },
      );
      return {
        expiresAt: new Date(Date.now() + expiresIn * 1_000),
        key,
        method: "PUT",
        url,
      };
    },
  };
}
