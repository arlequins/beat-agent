import { ApplicationInputError } from "../errors";
import type { FileStoragePort, UploadRequest } from "../ports/file-storage";

const DEFAULT_MAX_BYTES = 10 * 1024 * 1024;

export function createFileUploadService(deps: {
  allowedContentTypes?: ReadonlySet<string>;
  maxBytes?: number;
  storage: FileStoragePort;
}) {
  const allowed =
    deps.allowedContentTypes ??
    new Set(["application/pdf", "image/jpeg", "image/png", "text/plain"]);
  const maxBytes = deps.maxBytes ?? DEFAULT_MAX_BYTES;

  return {
    requestUpload(input: UploadRequest) {
      if (!allowed.has(input.contentType))
        throw new ApplicationInputError("Unsupported upload content type");
      if (
        !Number.isInteger(input.size) ||
        input.size < 1 ||
        input.size > maxBytes
      )
        throw new ApplicationInputError(
          `Upload size must be between 1 and ${maxBytes} bytes`,
        );
      if (!input.fileName.trim() || input.fileName.length > 255)
        throw new ApplicationInputError("Upload file name is invalid");
      return deps.storage.createUploadTarget(input);
    },
  };
}

export type FileUploadService = ReturnType<typeof createFileUploadService>;
