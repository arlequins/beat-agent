import { describe, expect, it, vi } from "vitest";

import { createBeatMcpHttpHandler, createBeatMcpServer } from "./index";

function createServer() {
  const authorization = {
    authorize: vi.fn(
      async ({
        subject,
        workspaceId,
      }: {
        subject: string;
        workspaceId: string;
      }) => ({
        userId: subject,
        workspaceId,
      }),
    ),
  };
  const repository = {
    activeRelease: vi.fn().mockResolvedValue({ releaseId: "release-1" }),
    listConversations: vi.fn().mockResolvedValue([
      {
        id: "conversation-1",
        title: "프로젝트",
        updatedAt: new Date("2026-08-14"),
      },
    ]),
    listDocuments: vi.fn().mockResolvedValue([
      {
        createdAt: new Date("2026-08-14"),
        filename: "notes.md",
        id: "document-1",
        sizeBytes: 10,
        status: "completed",
      },
    ]),
    listMessages: vi.fn().mockResolvedValue([
      {
        content: "MCP 서버를 설계한다",
        createdAt: new Date("2026-08-14"),
        id: "message-1",
        role: "user",
      },
    ]),
    submitFeedback: vi.fn().mockResolvedValue({ id: "feedback-1" }),
  };
  const dependencies = {
    authorization,
    knowledgeSearch: {
      search: vi.fn().mockResolvedValue([
        {
          citation: {
            chunkId: "chunk-1",
            documentId: "document-1",
            label: "notes.md",
          },
          content: "MCP는 도구 경계다.",
          score: 0.9,
        },
      ]),
    },
    memorySearch: {
      search: vi
        .fn()
        .mockResolvedValue([
          { content: "짧은 답변을 선호", id: "memory-1", importance: 90 },
        ]),
    },
    repository,
  };
  const server = createBeatMcpServer(dependencies);
  return { authorization, dependencies, repository, server };
}

const context = {
  subject: "user-1",
  workspaceId: "workspace-1",
};

describe("Beat MCP server", () => {
  it("exposes only workspace-scoped tools and pins search to the active release", async () => {
    const { repository, server } = createServer();
    const tools = server.listTools();
    expect(tools.map((tool) => tool.name)).toEqual([
      "conversation.search",
      "document.search",
      "memory.search",
      "document.list",
      "feedback.submit",
    ]);
    const response = await server.callTool(
      "document.search",
      { query: "MCP" },
      context,
    );
    expect(response.structuredContent).toMatchObject({
      releaseId: "release-1",
    });
    expect(repository.activeRelease).toHaveBeenCalledWith("workspace-1");
  });

  it("requires a separate confirmation for the feedback write tool", async () => {
    const { repository, server } = createServer();
    const pending = await server.callTool(
      "feedback.submit",
      { kind: "helpful", messageId: "message-1" },
      context,
      "call-1",
    );
    expect(pending.structuredContent).toMatchObject({
      confirmationRequired: true,
      toolCallId: "call-1",
    });
    expect(repository.submitFeedback).not.toHaveBeenCalled();
    await server.callTool(
      "feedback.submit",
      { kind: "helpful", messageId: "message-1" },
      { ...context, confirmedToolCallIds: new Set(["call-1"]) },
      "call-1",
    );
    expect(repository.submitFeedback).toHaveBeenCalledWith(
      { userId: "user-1", workspaceId: "workspace-1" },
      { kind: "helpful", messageId: "message-1" },
    );
  });

  it("handles the minimal MCP JSON-RPC handshake and tool calls", async () => {
    const { server } = createServer();
    await expect(
      server.handleRequest(
        { id: 1, jsonrpc: "2.0", method: "initialize" },
        context,
      ),
    ).resolves.toMatchObject({ result: { capabilities: { tools: {} } } });
    await expect(
      server.handleRequest(
        { id: 2, jsonrpc: "2.0", method: "tools/list" },
        context,
      ),
    ).resolves.toMatchObject({ result: { tools: expect.any(Array) } });
  });

  it("serves the official SDK over a stateless web-standard handler", async () => {
    const { dependencies } = createServer();
    const handler = createBeatMcpHttpHandler({
      context,
      dependencies,
    });
    try {
      const response = await handler.fetch(
        new Request("http://localhost/mcp", {
          body: JSON.stringify({
            id: 1,
            jsonrpc: "2.0",
            method: "initialize",
            params: {
              capabilities: {},
              clientInfo: { name: "test-client", version: "1.0.0" },
              protocolVersion: "2025-06-18",
            },
          }),
          headers: {
            Accept: "application/json, text/event-stream",
            "Content-Type": "application/json",
          },
          method: "POST",
        }),
      );
      expect(response.status).toBe(200);
      expect(response.headers.get("content-type")).toContain(
        "text/event-stream",
      );
      await expect(response.text()).resolves.toContain('"capabilities"');
    } finally {
      await handler.close();
    }
  });

  it("routes official SDK tool calls through the release-pinned registry", async () => {
    const { dependencies } = createServer();
    const handler = createBeatMcpHttpHandler({
      context,
      dependencies,
    });
    try {
      const response = await handler.fetch(
        new Request("http://localhost/mcp", {
          body: JSON.stringify({
            id: 2,
            jsonrpc: "2.0",
            method: "tools/call",
            params: {
              arguments: { query: "MCP" },
              name: "document.search",
            },
          }),
          headers: {
            Accept: "application/json, text/event-stream",
            "Content-Type": "application/json",
          },
          method: "POST",
        }),
      );
      expect(response.status).toBe(200);
      await expect(response.text()).resolves.toContain(
        '"releaseId":"release-1"',
      );
    } finally {
      await handler.close();
    }
  });
});
