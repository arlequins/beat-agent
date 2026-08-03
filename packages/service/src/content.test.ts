import { describe, expect, it, vi } from "vitest";

import type { ApplicationLogger } from "./application/ports/application-logger";
import type { ContentRepository } from "./application/ports/content-repository";
import { createContentService } from "./application/use-cases/content";

function createDependencies() {
  const repository: ContentRepository = {
    create: vi.fn(),
    delete: vi.fn(),
    findById: vi.fn(),
    list: vi
      .fn()
      .mockResolvedValue({ items: [], page: 1, pageSize: 10, total: 0 }),
    update: vi.fn(),
  };
  const logger: ApplicationLogger = { debug: vi.fn(), info: vi.fn() };
  return { logger, repository };
}

describe("createContentService", () => {
  it("normalizes list input before calling the repository port", async () => {
    const deps = createDependencies();
    await createContentService(deps).listContent({
      page: 0,
      pageSize: 100,
      query: "  term  ",
    });
    expect(deps.repository.list).toHaveBeenCalledWith({
      direction: "desc",
      page: 1,
      pageSize: 50,
      query: "term",
      sort: "createdAt",
    });
  });

  it("delegates mutations without exposing an infrastructure type", async () => {
    const deps = createDependencies();
    vi.mocked(deps.repository.update).mockResolvedValue({
      status: "updated",
      value: {
        content: "Body",
        createdAt: new Date(0),
        id: "content-1",
        title: "Title",
        updatedAt: new Date(1),
        version: 2,
      },
    });
    vi.mocked(deps.repository.delete).mockResolvedValue(true);
    const service = createContentService(deps);
    await service.updateContent("content-1", {
      content: "Body",
      title: "Title",
      version: 1,
    });
    await service.deleteContent("content-1");
    expect(deps.repository.update).toHaveBeenCalledWith(
      "content-1",
      { content: "Body", title: "Title" },
      1,
    );
    expect(deps.repository.delete).toHaveBeenCalledWith("content-1");
  });

  it("reports optimistic locking conflicts", async () => {
    const deps = createDependencies();
    vi.mocked(deps.repository.update).mockResolvedValue({ status: "conflict" });
    await expect(
      createContentService(deps).updateContent("content-1", {
        content: "Body",
        title: "Title",
        version: 1,
      }),
    ).rejects.toThrow("updated by another request");
  });

  it("reports missing resources through an application error", async () => {
    const deps = createDependencies();
    const service = createContentService(deps);
    await expect(service.getContentById("missing")).rejects.toThrow(
      "Content item not found",
    );
    await expect(service.deleteContent("missing")).rejects.toThrow(
      "Content item not found",
    );
  });
});
