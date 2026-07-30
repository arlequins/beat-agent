import { describe, expect, it, vi } from "vitest";

import { notifyPipelineFailureAlert } from "./index";

describe("notifyPipelineFailureAlert", () => {
  it("emits batch and failure context for later alert integration", () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});

    notifyPipelineFailureAlert({
      batchId: "batch-1",
      errorEvent: { error: "failed" },
    });

    expect(warn).toHaveBeenCalledWith(
      "[PipelineFailure]",
      JSON.stringify({
        batchId: "batch-1",
        errorEvent: { error: "failed" },
      }),
    );
  });
});
