import { describe, expect, it } from "vitest";

import manifest from "./manifest";

describe("PWA manifest", () => {
  it("is installable, Korean-first, and includes maskable artwork", () => {
    const value = manifest();

    expect(value).toMatchObject({
      display: "standalone",
      id: "/",
      lang: "ko",
      scope: "/",
      start_url: "/",
    });
    expect(value.icons).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ sizes: "192x192" }),
        expect.objectContaining({ sizes: "512x512" }),
        expect.objectContaining({ purpose: "maskable" }),
      ]),
    );
  });
});
