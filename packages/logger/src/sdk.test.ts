import { describe, expect, it } from "vitest";

import { parseOtlpHeaders } from "./sdk";

describe("parseOtlpHeaders", () => {
  it("parses and decodes standard OTLP headers", () => {
    expect(
      parseOtlpHeaders("authorization=Bearer%20token,x-tenant=acme"),
    ).toEqual({
      authorization: "Bearer token",
      "x-tenant": "acme",
    });
  });

  it("rejects malformed entries", () => {
    expect(() => parseOtlpHeaders("authorization")).toThrow(
      "Invalid OTLP header",
    );
  });
});
