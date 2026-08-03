import { describe, expect, it, vi } from "vitest";
import { createFileUploadService } from "./application/use-cases/request-file-upload";

describe("createFileUploadService", () => {
  it("validates policy before delegating to storage", async () => {
    const createUploadTarget = vi.fn().mockResolvedValue({
      expiresAt: new Date(),
      key: "files/1",
      method: "PUT",
      url: "https://upload.test",
    });
    const service = createFileUploadService({
      storage: { createUploadTarget },
    });
    await service.requestUpload({
      contentType: "image/png",
      fileName: "image.png",
      size: 100,
    });
    expect(createUploadTarget).toHaveBeenCalledOnce();
    expect(() =>
      service.requestUpload({
        contentType: "application/executable",
        fileName: "bad",
        size: 100,
      }),
    ).toThrow("Unsupported");
  });
});
