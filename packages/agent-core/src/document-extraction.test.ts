import { describe, expect, it } from "vitest";

import { createTextDocumentExtraction } from "./document-extraction";

describe("createTextDocumentExtraction", () => {
  it("removes active HTML content before indexing", async () => {
    const result = await createTextDocumentExtraction().extract({
      bytes: new TextEncoder().encode(
        "<h1>Hello</h1><script>secret()</script\t\n bar><style>hidden {}</style extra><p>world</p>",
      ),
      contentType: "text/html",
      filename: "notes.html",
    });
    expect(result.text).toBe("Hello world");
  });

  it("trims supported plain-text formats", async () => {
    await expect(
      createTextDocumentExtraction().extract({
        bytes: new TextEncoder().encode("  # Notes\n"),
        contentType: "text/markdown",
        filename: "notes.md",
      }),
    ).resolves.toEqual({ text: "# Notes", warnings: [] });
  });

  it("rejects unsupported, empty, invalid UTF-8, and oversized documents", async () => {
    const extraction = createTextDocumentExtraction();
    await expect(
      extraction.extract({
        bytes: new Uint8Array(),
        contentType: "application/pdf",
        filename: "notes.pdf",
      }),
    ).rejects.toThrow("Unsupported server-side document type");
    await expect(
      extraction.extract({
        bytes: new TextEncoder().encode("  "),
        contentType: "text/plain",
        filename: "empty.txt",
      }),
    ).rejects.toThrow("no text");
    await expect(
      extraction.extract({
        bytes: new Uint8Array([0xff]),
        contentType: "text/plain",
        filename: "invalid.txt",
      }),
    ).rejects.toThrow();
    await expect(
      extraction.extract({
        bytes: new TextEncoder().encode("x".repeat(1_000_001)),
        contentType: "text/plain",
        filename: "large.txt",
      }),
    ).rejects.toThrow("1MB text limit");
  });
});
