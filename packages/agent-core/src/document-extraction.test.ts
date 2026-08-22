import { strToU8, zipSync } from "fflate";
import { describe, expect, it } from "vitest";

import {
  createDocumentSecurityScanner,
  createRichDocumentExtraction,
  createTextDocumentExtraction,
} from "./document-extraction";

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

describe("binary document ingestion", () => {
  const docxType =
    "application/vnd.openxmlformats-officedocument.wordprocessingml.document";

  it("scans and extracts server-side Office text", async () => {
    const bytes = zipSync({
      "[Content_Types].xml": strToU8("<Types />"),
      "word/document.xml": strToU8(
        "<w:document><w:body><w:p><w:t>첫 문단</w:t></w:p><w:p><w:t>둘째 문단</w:t></w:p></w:body></w:document>",
      ),
    });
    await expect(
      createDocumentSecurityScanner().scan({
        bytes,
        contentType: docxType,
        filename: "notes.docx",
      }),
    ).resolves.toEqual({ warnings: [] });
    await expect(
      createRichDocumentExtraction().extract({
        bytes,
        contentType: docxType,
        filename: "notes.docx",
      }),
    ).resolves.toMatchObject({ text: "첫 문단\n둘째 문단" });
  });

  it("rejects known malware signatures and active binary content", async () => {
    const scanner = createDocumentSecurityScanner();
    await expect(
      scanner.scan({
        bytes: strToU8("EICAR-STANDARD-ANTIVIRUS-TEST-FILE"),
        contentType: "application/pdf",
        filename: "test.pdf",
      }),
    ).rejects.toThrow("malware signature");
    await expect(
      scanner.scan({
        bytes: strToU8("%PDF-1.7 /JavaScript"),
        contentType: "application/pdf",
        filename: "active.pdf",
      }),
    ).rejects.toThrow("active content");
    await expect(
      scanner.scan({
        bytes: zipSync({
          "word/document.xml": strToU8("<w:document />"),
          "word/vbaProject.bin": strToU8("macro"),
        }),
        contentType: docxType,
        filename: "macro.docx",
      }),
    ).rejects.toThrow("macros");
  });

  it("rejects mismatched, unsupported, oversized, and macro-enabled binaries", async () => {
    const scanner = createDocumentSecurityScanner();
    await expect(
      scanner.scan({
        bytes: strToU8("not a pdf"),
        contentType: "application/pdf",
        filename: "bad.pdf",
      }),
    ).rejects.toThrow("PDF file signature");
    await expect(
      scanner.scan({
        bytes: strToU8("binary"),
        contentType: "application/octet-stream",
        filename: "bad.bin",
      }),
    ).rejects.toThrow("Unsupported binary");
    await expect(
      scanner.scan({
        bytes: strToU8("not a zip"),
        contentType: docxType,
        filename: "bad.docx",
      }),
    ).rejects.toThrow("Office file signature");
    await expect(
      scanner.scan({
        bytes: zipSync({ "word/document.xml": strToU8("<w:t>text</w:t>") }),
        contentType: docxType,
        filename: "macro.docm",
      }),
    ).rejects.toThrow("macros");
    await expect(
      scanner.scan({
        bytes: new Uint8Array(10_000_001),
        contentType: "application/pdf",
        filename: "huge.pdf",
      }),
    ).rejects.toThrow("10MB");
  });

  it("extracts presentation and spreadsheet XML and rejects empty formats", async () => {
    const extraction = createRichDocumentExtraction();
    await expect(
      extraction.extract({
        bytes: zipSync({
          "ppt/slides/slide1.xml": strToU8("<a:p><a:t>첫 슬라이드</a:t></a:p>"),
        }),
        contentType:
          "application/vnd.openxmlformats-officedocument.presentationml.presentation",
        filename: "deck.pptx",
      }),
    ).resolves.toMatchObject({ text: "첫 슬라이드" });
    await expect(
      extraction.extract({
        bytes: zipSync({
          "xl/sharedStrings.xml": strToU8("<row><t>셀 값</t></row>"),
        }),
        contentType:
          "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        filename: "sheet.xlsx",
      }),
    ).resolves.toMatchObject({ text: "셀 값" });
    await expect(
      extraction.extract({
        bytes: new Uint8Array(),
        contentType: "application/octet-stream",
        filename: "bad.bin",
      }),
    ).rejects.toThrow("Unsupported server-side");
    await expect(
      extraction.extract({
        bytes: zipSync({ "word/document.xml": strToU8("<w:p />") }),
        contentType: docxType,
        filename: "empty.docx",
      }),
    ).rejects.toThrow("no text");
  });
});
