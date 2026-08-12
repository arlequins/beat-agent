import { describe, expect, it } from "vitest";

import { sitePath } from "./site-path";

describe("sitePath", () => {
  it("keeps the project Pages prefix for nested deployments", () => {
    expect(
      sitePath("/auth/callback/", "https://arlequins.github.io/beat-agent"),
    ).toBe("/beat-agent/auth/callback/");
    expect(sitePath("/", "https://arlequins.github.io/beat-agent")).toBe(
      "/beat-agent/",
    );
  });

  it("leaves root-hosted static sites at the origin root", () => {
    expect(sitePath("/sw.js", "https://agent.example")).toBe("/sw.js");
  });
});
