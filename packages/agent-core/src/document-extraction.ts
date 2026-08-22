import { strFromU8, unzipSync } from "fflate";
import { extractText, getDocumentProxy } from "unpdf";

import type { DocumentExtractionPort, DocumentSecurityPort } from "./ports";

const MAX_EXTRACTED_CHARACTERS = 1_000_000;

function htmlToText(value: string) {
  return value
    .replace(/<script\b[^>]*>[\s\S]*?<\/script\b[^>]*>/gi, " ")
    .replace(/<style\b[^>]*>[\s\S]*?<\/style\b[^>]*>/gi, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/gi, " ")
    .replace(/&amp;/gi, "&")
    .replace(/\s+/g, " ")
    .trim();
}

const OFFICE_TYPES = new Set([
  "application/vnd.openxmlformats-officedocument.presentationml.presentation",
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
]);

function xmlToText(value: string) {
  return value
    .replace(/<(?:w:p|a:p|row)\b[^>]*>/g, "\n")
    .replace(/<[^>]+>/g, " ")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    .replace(/&amp;/g, "&")
    .replace(/[ \t]+/g, " ")
    .replace(/ *\n */g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

function officeText(bytes: Uint8Array, contentType: string) {
  const files = unzipSync(bytes);
  const entries = Object.entries(files);
  if (entries.length > 1_000)
    throw new Error("Office archive contains too many files");
  const uncompressedBytes = entries.reduce(
    (total, [, value]) => total + value.byteLength,
    0,
  );
  if (uncompressedBytes > 20_000_000)
    throw new Error("Office archive expands beyond the safety limit");
  const selected = entries
    .filter(([name]) => {
      if (contentType.includes("wordprocessingml"))
        return /^word\/(?:document|footnotes|endnotes|header\d+|footer\d+)\.xml$/.test(
          name,
        );
      if (contentType.includes("presentationml"))
        return /^ppt\/(?:slides\/slide\d+|notesSlides\/notesSlide\d+)\.xml$/.test(
          name,
        );
      return /^xl\/(?:sharedStrings|worksheets\/sheet\d+)\.xml$/.test(name);
    })
    .sort(([left], [right]) => left.localeCompare(right));
  return selected
    .map(([, value]) => xmlToText(strFromU8(value)))
    .filter(Boolean)
    .join("\n\n");
}

export function createDocumentSecurityScanner(): DocumentSecurityPort {
  return {
    async scan({ bytes, contentType, filename }) {
      if (bytes.byteLength > 10_000_000)
        throw new Error("Document exceeds the 10MB security limit");
      const sample = new TextDecoder("latin1").decode(bytes);
      if (sample.includes("EICAR-STANDARD-ANTIVIRUS-TEST-FILE"))
        throw new Error("Document failed the malware signature scan");
      if (contentType === "application/pdf") {
        if (!sample.startsWith("%PDF-"))
          throw new Error("PDF file signature does not match its content type");
        if (/\/(?:JavaScript|JS|Launch|EmbeddedFile)\b/.test(sample))
          throw new Error("PDF active content is not allowed");
        return { warnings: [] };
      }
      if (!OFFICE_TYPES.has(contentType))
        throw new Error(`Unsupported binary document type: ${contentType}`);
      if (bytes[0] !== 0x50 || bytes[1] !== 0x4b)
        throw new Error(
          "Office file signature does not match its content type",
        );
      const entries = Object.keys(unzipSync(bytes));
      if (
        entries.some((name) =>
          /(?:vbaProject\.bin|embeddings\/|oleObject)/i.test(name),
        ) ||
        /\.(?:docm|pptm|xlsm)$/i.test(filename)
      )
        throw new Error("Office macros and embedded objects are not allowed");
      return { warnings: [] };
    },
  };
}

export function createRichDocumentExtraction(): DocumentExtractionPort {
  const textExtraction = createTextDocumentExtraction();
  return {
    async extract(input) {
      if (
        ["text/plain", "text/markdown", "text/html"].includes(input.contentType)
      )
        return textExtraction.extract(input);
      let text: string;
      const warnings: string[] = [];
      if (input.contentType === "application/pdf") {
        const document = await getDocumentProxy(input.bytes);
        const extracted = await extractText(document, { mergePages: true });
        text = extracted.text;
        warnings.push(
          `${extracted.totalPages}개 PDF 페이지에서 텍스트를 추출했습니다.`,
        );
      } else if (OFFICE_TYPES.has(input.contentType)) {
        text = officeText(input.bytes, input.contentType);
        warnings.push("Office 서식과 이미지는 제외하고 텍스트만 추출했습니다.");
      } else {
        throw new Error(
          `Unsupported server-side document type: ${input.contentType}`,
        );
      }
      text = text.trim();
      if (!text) throw new Error("Extracted document has no text");
      if (text.length > MAX_EXTRACTED_CHARACTERS)
        throw new Error("Extracted document exceeds the 1MB text limit");
      return { text, warnings };
    },
  };
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
