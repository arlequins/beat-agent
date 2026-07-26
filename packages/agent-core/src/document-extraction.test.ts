import { describe, expect, it } from "vitest";

import { createTextDocumentExtraction } from "./document-extraction";

describe("createTextDocumentExtraction", () => {
  it("removes active HTML content before indexing", async () => {
    const result = await createTextDocumentExtraction().extract({
      bytes: new TextEncoder().encode(
        "<h1>Hello</h1><script>secret()</script><p>world</p>",
      ),
      contentType: "text/html",
      filename: "notes.html",
    });
    expect(result.text).toBe("Hello world");
  });
});
