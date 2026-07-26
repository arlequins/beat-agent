import { describe, expect, it, vi } from "vitest";
import { createProcessMain } from ".";

function dependencies() {
  const info = vi.fn();
  const listContent = vi.fn().mockResolvedValue({ total: 3 });
  return {
    deps: {
      content: { listContent },
      logger: { child: vi.fn(() => ({ info })) },
    },
    info,
    listContent,
  };
}

describe("createProcessMain", () => {
  it("does not access persistence for a raw input", async () => {
    const { deps, listContent } = dependencies();
    await createProcessMain(deps)({
      batchId: "batch-1",
      input: { type: "raw" },
      stateName: "Process",
    });
    expect(listContent).not.toHaveBeenCalled();
  });

  it("reads content through the injected port for a database input", async () => {
    const { deps, info, listContent } = dependencies();
    await createProcessMain(deps)({
      batchId: "batch-2",
      input: { type: "db-query" },
      stateName: "Process",
    });
    expect(listContent).toHaveBeenCalledOnce();
    expect(info).toHaveBeenLastCalledWith("batch.process.completed", {
      inputType: "db",
      resultCount: 3,
    });
  });
});
