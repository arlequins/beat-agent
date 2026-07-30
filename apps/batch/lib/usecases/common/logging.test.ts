import { describe, expect, it, vi } from "vitest";

import { logStepPayload } from "./logging";

describe("logStepPayload", () => {
  it("writes one structured step log", () => {
    const log = vi.spyOn(console, "log").mockImplementation(() => {});

    logStepPayload("index", { documentId: "document-1" });

    expect(log).toHaveBeenCalledWith(
      "[index]",
      JSON.stringify({ event: { documentId: "document-1" } }),
    );
  });
});
