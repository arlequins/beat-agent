import type { DocumentExtractionPort } from "./ports";

const MAX_EXTRACTED_CHARACTERS = 1_000_000;

function htmlToText(value: string) {
  return value
    .replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi, " ")
    .replace(/<style\b[^>]*>[\s\S]*?<\/style>/gi, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/gi, " ")
    .replace(/&amp;/gi, "&")
    .replace(/\s+/g, " ")
    .trim();
}

/** Safe local extractor for textual formats; binary formats must be supplied by a host parser adapter. */
export function createTextDocumentExtraction(): DocumentExtractionPort {
  return {
    async extract({ bytes, contentType }) {
      if (!["text/plain", "text/markdown", "text/html"].includes(contentType))
        throw new Error(
          `Unsupported server-side document type: ${contentType}`,
        );
      const decoded = new TextDecoder("utf-8", { fatal: true }).decode(bytes);
      const text =
        contentType === "text/html" ? htmlToText(decoded) : decoded.trim();
      if (!text) throw new Error("Extracted document has no text");
      if (text.length > MAX_EXTRACTED_CHARACTERS)
        throw new Error("Extracted document exceeds the 1MB text limit");
      return { text, warnings: [] };
    },
  };
}
