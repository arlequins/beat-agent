import { describe, expect, it } from "vitest";

import { parseAgentStreamLine, splitAgentStreamChunk } from "./agent-stream";

describe("agent stream parser", () => {
  it("ignores blank lines and parses CRLF NDJSON", () => {
    expect(parseAgentStreamLine("  \r\n")).toBeUndefined();
    expect(parseAgentStreamLine('{"type":"delta","text":"안녕"}\r')).toEqual({
      type: "delta",
      text: "안녕",
    });
  });

  it("retains the final partial line until the next chunk", () => {
    expect(splitAgentStreamChunk('{"type":"delta"}\n{"type":"del')).toEqual({
      lines: ['{"type":"delta"}'],
      remainder: '{"type":"del',
    });
  });

  it("parses the final event when the stream has no trailing newline", () => {
    const chunk = splitAgentStreamChunk('{"type":"complete"}');
    expect(chunk.lines).toEqual([]);
    expect(parseAgentStreamLine(chunk.remainder)).toEqual({
      type: "complete",
    });
  });
});
