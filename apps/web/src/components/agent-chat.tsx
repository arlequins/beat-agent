"use client";

import { Button } from "@arlequins/ui/button";
import { Input } from "@arlequins/ui/input";
import { Textarea } from "@arlequins/ui/textarea";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { type FormEvent, useEffect, useState } from "react";

import { useAuth } from "~/auth/provider";
import { env } from "~/env";
import { useTRPC } from "~/trpc/react";
import { streamErrorMessage } from "./agent-chat-error";

function messageError(error: unknown): string {
  return error instanceof Error ? error.message : "요청을 처리하지 못했습니다.";
}

const feedbackLabels = {
  helpful: "도움됨",
  incorrect: "부정확함",
  missing: "누락",
  "needs-investigation": "조사 요청",
} as const;

type FeedbackKind = keyof typeof feedbackLabels;

function MessageCitations({
  messageId,
  workspaceId,
}: {
  messageId: string;
  workspaceId: string;
}) {
  const trpc = useTRPC();
  const citations = useQuery(
    trpc.agent.messageCitations.queryOptions({ messageId, workspaceId }),
  );
  if (!citations.data?.length) return null;
  return (
    <details className="mt-4 border-t pt-3 text-xs">
      <summary className="text-muted-foreground cursor-pointer font-medium transition-colors hover:text-foreground">
        답변 근거 · 인용 {citations.data.length}개
      </summary>
      <ul className="text-muted-foreground mt-3 space-y-2 leading-5">
        {citations.data.map((citation) => (
          <li
            className="rounded-lg bg-background/70 px-3 py-2"
            key={`${citation.documentId}-${citation.ordinal}`}
          >
            <p className="text-foreground font-medium">
              {citation.filename}
              {citation.locator ? ` · ${citation.locator}` : ""}
            </p>
            {citation.content ? (
              <p className="mt-1">{citation.content.slice(0, 160)}</p>
            ) : null}
          </li>
        ))}
      </ul>
    </details>
  );
}

export function AgentChat() {
  const trpc = useTRPC();
  const queryClient = useQueryClient();
  const [workspaceId, setWorkspaceId] = useState<string>();
  const [conversationId, setConversationId] = useState<string>();
  const [workspaceName, setWorkspaceName] = useState("");
  const [documentContent, setDocumentContent] = useState("");
  const [documentContentType, setDocumentContentType] = useState<
    "text/html" | "text/markdown" | "text/plain"
  >("text/plain");
  const [documentFileError, setDocumentFileError] = useState<string>();
  const [documentFilename, setDocumentFilename] = useState("notes.txt");
  const [memoryContent, setMemoryContent] = useState("");
  const [memberUserId, setMemberUserId] = useState("");
  const [question, setQuestion] = useState("");
  const [streamedText, setStreamedText] = useState("");
  const [streamError, setStreamError] = useState<string>();
  const [feedbackNotice, setFeedbackNotice] = useState<string>();
  const [isStreaming, setIsStreaming] = useState(false);
  const { user } = useAuth();
  const workspaces = useQuery(trpc.agent.workspaces.queryOptions());
  const conversations = useQuery({
    ...trpc.agent.conversations.queryOptions({
      workspaceId: workspaceId ?? "",
    }),
    enabled: Boolean(workspaceId),
  });
  const messages = useQuery({
    ...trpc.agent.messages.queryOptions({
      conversationId: conversationId ?? "",
      workspaceId: workspaceId ?? "",
    }),
    enabled: Boolean(workspaceId && conversationId),
  });
  const documents = useQuery({
    ...trpc.agent.documents.queryOptions({ workspaceId: workspaceId ?? "" }),
    enabled: Boolean(workspaceId),
  });
  const indexRuns = useQuery({
    ...trpc.agent.indexRuns.queryOptions({ workspaceId: workspaceId ?? "" }),
    enabled: Boolean(workspaceId),
  });
  const memories = useQuery({
    ...trpc.agent.memories.queryOptions({ workspaceId: workspaceId ?? "" }),
    enabled: Boolean(workspaceId),
  });
  const usage = useQuery({
    ...trpc.agent.usage.queryOptions({ workspaceId: workspaceId ?? "" }),
    enabled: Boolean(workspaceId),
  });
  const isOwner =
    workspaces.data?.find((workspace) => workspace.id === workspaceId)?.role ===
    "owner";
  const auditLog = useQuery({
    ...trpc.agent.auditLog.queryOptions({ workspaceId: workspaceId ?? "" }),
    enabled: Boolean(workspaceId && isOwner),
  });

  useEffect(() => {
    if (!workspaceId && workspaces.data?.[0])
      setWorkspaceId(workspaces.data[0].id);
  }, [workspaceId, workspaces.data]);

  useEffect(() => {
    if (!conversationId && conversations.data?.[0]) {
      setConversationId(conversations.data[0].id);
    }
  }, [conversationId, conversations.data]);

  const createWorkspace = useMutation(
    trpc.agent.createWorkspace.mutationOptions({
      onSuccess: async (workspace) => {
        setWorkspaceId(workspace.id);
        setConversationId(undefined);
        setWorkspaceName("");
        await queryClient.invalidateQueries({
          queryKey: trpc.agent.workspaces.queryKey(),
        });
      },
    }),
  );
  const createConversation = useMutation(
    trpc.agent.createConversation.mutationOptions({
      onSuccess: async (conversation) => {
        setConversationId(conversation?.id);
        await queryClient.invalidateQueries({
          queryKey: trpc.agent.conversations.queryKey({
            workspaceId: workspaceId ?? "",
          }),
        });
      },
    }),
  );
  const ingestTextDocument = useMutation(
    trpc.agent.ingestTextDocument.mutationOptions({
      onSuccess: async () => {
        setDocumentContent("");
        await queryClient.invalidateQueries({
          queryKey: trpc.agent.documents.queryKey({
            workspaceId: workspaceId ?? "",
          }),
        });
      },
    }),
  );
  const deleteDocument = useMutation(
    trpc.agent.deleteDocument.mutationOptions({
      onSuccess: async () => {
        await queryClient.invalidateQueries({
          queryKey: trpc.agent.documents.queryKey({
            workspaceId: workspaceId ?? "",
          }),
        });
      },
    }),
  );
  const startIndex = useMutation(
    trpc.agent.startIndex.mutationOptions({
      onSuccess: async () => {
        await queryClient.invalidateQueries({
          queryKey: trpc.agent.indexRuns.queryKey({
            workspaceId: workspaceId ?? "",
          }),
        });
      },
    }),
  );
  const createMemory = useMutation(
    trpc.agent.createMemory.mutationOptions({
      onSuccess: async () => {
        setMemoryContent("");
        await queryClient.invalidateQueries({
          queryKey: trpc.agent.memories.queryKey({
            workspaceId: workspaceId ?? "",
          }),
        });
      },
    }),
  );
  const reviewMemory = useMutation(
    trpc.agent.reviewMemory.mutationOptions({
      onSuccess: async () => {
        await queryClient.invalidateQueries({
          queryKey: trpc.agent.memories.queryKey({
            workspaceId: workspaceId ?? "",
          }),
        });
      },
    }),
  );
  const deleteMemory = useMutation(
    trpc.agent.deleteMemory.mutationOptions({
      onSuccess: async () => {
        await queryClient.invalidateQueries({
          queryKey: trpc.agent.memories.queryKey({
            workspaceId: workspaceId ?? "",
          }),
        });
      },
    }),
  );
  const addWorkspaceMember = useMutation(
    trpc.agent.addWorkspaceMember.mutationOptions({
      onSuccess: () => setMemberUserId(""),
    }),
  );
  const submitFeedback = useMutation(
    trpc.agent.submitFeedback.mutationOptions({
      onSuccess: (_result, input) =>
        setFeedbackNotice(
          `${feedbackLabels[input.kind]} 피드백을 기록했습니다.`,
        ),
    }),
  );
  function submitWorkspace(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const name = workspaceName.trim();
    if (!name) return;
    const slug = `${
      name
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, "-")
        .replace(/^-|-$/g, "") || "workspace"
    }-${Date.now()}`;
    createWorkspace.mutate({ name, slug });
  }

  function submitDocument(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!workspaceId || !documentContent.trim() || !documentFilename.trim())
      return;
    ingestTextDocument.mutate({
      content: documentContent,
      contentType: documentContentType,
      filename: documentFilename.trim(),
      workspaceId,
    });
  }

  async function selectDocumentFile(file?: File) {
    setDocumentFileError(undefined);
    if (!file) return;
    if (
      !/\.(html?|md|txt)$/i.test(file.name) &&
      !["text/html", "text/markdown", "text/plain"].includes(file.type)
    ) {
      setDocumentFileError(
        "현재는 안전하게 텍스트, Markdown, HTML 파일만 지원합니다.",
      );
      return;
    }
    if (file.size > 1_000_000) {
      setDocumentFileError("문서는 1MB 이하여야 합니다.");
      return;
    }
    setDocumentFilename(file.name);
    setDocumentContentType(
      file.type === "text/html" || /\.html?$/i.test(file.name)
        ? "text/html"
        : /\.md$/i.test(file.name)
          ? "text/markdown"
          : "text/plain",
    );
    setDocumentContent(await file.text());
  }

  function submitMemory(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!workspaceId || !memoryContent.trim()) return;
    createMemory.mutate({
      content: memoryContent,
      sourceConversationId: conversationId,
      workspaceId,
    });
  }

  async function submitQuestion(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!workspaceId || !conversationId || !question.trim()) return;
    setIsStreaming(true);
    setStreamedText("");
    setStreamError(undefined);
    try {
      const response = await fetch(
        `${env.NEXT_PUBLIC_API_URL.replace(/\/$/, "")}/agent/stream`,
        {
          method: "POST",
          headers: {
            ...(user?.access_token && !user.expired
              ? { Authorization: `Bearer ${user.access_token}` }
              : {}),
            "Content-Type": "application/json",
          },
          body: JSON.stringify({ conversationId, question, workspaceId }),
        },
      );
      if (!response.ok || !response.body) {
        const failure = (await response.json().catch(() => undefined)) as
          | { message?: string }
          | undefined;
        throw new Error(
          failure?.message ?? "응답 스트림을 시작하지 못했습니다.",
        );
      }
      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let buffered = "";
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buffered += decoder.decode(value, { stream: true });
        const lines = buffered.split("\n");
        buffered = lines.pop() ?? "";
        for (const line of lines) {
          if (!line) continue;
          const value = JSON.parse(line) as {
            code?: string;
            message?: string;
            provider?: "bedrock" | "ollama" | "test" | "none";
            requestId?: string;
            text?: string;
            type: "complete" | "delta" | "error";
          };
          if (value.type === "delta") {
            setStreamedText((text) => text + (value.text ?? ""));
          }
          if (value.type === "error") {
            const failure = new Error(value.message);
            Object.assign(failure, {
              code: value.code,
              provider: value.provider,
              requestId: value.requestId,
            });
            throw failure;
          }
        }
      }
      setQuestion("");
      await queryClient.invalidateQueries({
        queryKey: trpc.agent.messages.queryKey({ conversationId, workspaceId }),
      });
    } catch (error) {
      setStreamError(streamErrorMessage(error));
    } finally {
      setIsStreaming(false);
      setStreamedText("");
    }
  }

  if (workspaces.isLoading)
    return (
      <p className="text-muted-foreground">워크스페이스를 불러오는 중입니다.</p>
    );
  if (workspaces.isError)
    return <p className="text-destructive">{messageError(workspaces.error)}</p>;

  if (!workspaceId) {
    return (
      <form className="rounded-xl border p-6" onSubmit={submitWorkspace}>
        <h2 className="text-lg font-semibold">첫 워크스페이스 만들기</h2>
        <p className="text-muted-foreground mt-1 text-sm">
          대화와 문서는 이 워크스페이스 안에서만 공유됩니다.
        </p>
        <div className="mt-4 flex gap-2">
          <Input
            aria-label="워크스페이스 이름"
            onChange={(event) => setWorkspaceName(event.target.value)}
            placeholder="예: 개인 연구"
            value={workspaceName}
          />
          <Button disabled={createWorkspace.isPending} type="submit">
            만들기
          </Button>
        </div>
        {createWorkspace.isError && (
          <p className="text-destructive mt-3 text-sm">
            {messageError(createWorkspace.error)}
          </p>
        )}
      </form>
    );
  }

  return (
    <section className="grid min-h-[calc(100vh-10rem)] gap-5 lg:grid-cols-[18rem_minmax(0,1fr)]">
      <aside className="bg-background/80 h-fit rounded-2xl border p-4 shadow-sm backdrop-blur lg:sticky lg:top-4 lg:max-h-[calc(100vh-2rem)] lg:overflow-y-auto">
        <div className="flex items-center justify-between gap-3 px-1">
          <div>
            <p className="text-muted-foreground text-[11px] font-semibold tracking-[0.16em] uppercase">
              개인 공간
            </p>
            <p className="mt-1 text-sm font-semibold">워크스페이스</p>
          </div>
          <span className="bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 rounded-full px-2 py-1 text-[10px] font-semibold">
            연결됨
          </span>
        </div>
        <select
          className="mt-4 h-10 w-full rounded-xl border bg-background px-3 text-sm shadow-xs outline-none transition focus:ring-2 focus:ring-ring"
          onChange={(event) => {
            setWorkspaceId(event.target.value);
            setConversationId(undefined);
          }}
          value={workspaceId}
        >
          {workspaces.data?.map((workspace) => (
            <option key={workspace.id} value={workspace.id}>
              {workspace.name}
            </option>
          ))}
        </select>
        <Button
          className="mt-3 h-10 w-full rounded-xl"
          disabled={createConversation.isPending}
          onClick={() =>
            createConversation.mutate({ title: "새 대화", workspaceId })
          }
          variant="outline"
        >
          새 대화
        </Button>
        <div className="mt-5 space-y-1">
          <p className="text-muted-foreground px-2 pb-2 text-[11px] font-semibold tracking-[0.14em] uppercase">
            대화
          </p>
          {conversations.data?.map((conversation) => (
            <button
              className={`w-full rounded-xl px-3 py-2.5 text-left text-sm transition-colors ${conversationId === conversation.id ? "bg-primary/10 text-primary font-medium" : "text-muted-foreground hover:bg-accent/60 hover:text-foreground"}`}
              key={conversation.id}
              onClick={() => setConversationId(conversation.id)}
              type="button"
            >
              {conversation.title}
            </button>
          ))}
        </div>
        <details className="mt-6 border-t pt-4">
          <summary className="text-muted-foreground cursor-pointer text-sm font-medium transition-colors hover:text-foreground">
            로컬 지식 추가
          </summary>
          <form className="mt-3 space-y-2" onSubmit={submitDocument}>
            <Input
              accept=".html,.htm,.md,.txt,text/html,text/markdown,text/plain"
              aria-label="문서 파일 선택"
              onChange={(event) => selectDocumentFile(event.target.files?.[0])}
              type="file"
            />
            <Input
              aria-label="문서 이름"
              onChange={(event) => setDocumentFilename(event.target.value)}
              value={documentFilename}
            />
            <Textarea
              aria-label="문서 내용"
              onChange={(event) => setDocumentContent(event.target.value)}
              placeholder="텍스트를 붙여 넣으면 이 워크스페이스에서 검색합니다."
              value={documentContent}
            />
            <Button
              className="w-full"
              disabled={!documentContent.trim() || ingestTextDocument.isPending}
              type="submit"
              variant="outline"
            >
              {ingestTextDocument.isPending ? "등록 중…" : "문서 등록"}
            </Button>
            {ingestTextDocument.isError && (
              <p className="text-destructive text-xs">
                {messageError(ingestTextDocument.error)}
              </p>
            )}
            {documentFileError && (
              <p className="text-destructive text-xs" role="alert">
                {documentFileError}
              </p>
            )}
          </form>
          <div className="mt-4 space-y-2 border-t pt-4">
            <p className="text-sm font-medium">문서</p>
            {documents.data?.length === 0 && (
              <p className="text-muted-foreground text-xs">
                등록된 문서가 없습니다.
              </p>
            )}
            {documents.data?.map((document) => {
              const latestRun = indexRuns.data?.find(
                (run) => run.documentId === document.id,
              );
              return (
                <div
                  className="rounded-xl border bg-background/60 p-3 text-xs"
                  key={document.id}
                >
                  <p className="truncate font-medium">{document.filename}</p>
                  <p className="text-muted-foreground mt-1">
                    {document.status} · {Math.ceil(document.sizeBytes / 1024)}{" "}
                    KB
                    {latestRun ? ` · 색인 ${latestRun.status}` : ""}
                  </p>
                  <div className="mt-2 flex gap-2">
                    <button
                      className="text-muted-foreground hover:underline"
                      disabled={startIndex.isPending}
                      onClick={() =>
                        workspaceId &&
                        startIndex.mutate({
                          documentId: document.id,
                          provider: "local",
                          workspaceId,
                        })
                      }
                      type="button"
                    >
                      색인 요청
                    </button>
                    <button
                      className="text-destructive hover:underline"
                      disabled={deleteDocument.isPending}
                      onClick={() =>
                        workspaceId &&
                        deleteDocument.mutate({
                          documentId: document.id,
                          workspaceId,
                        })
                      }
                      type="button"
                    >
                      삭제
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        </details>
        <details className="mt-6 border-t pt-4">
          <summary className="text-muted-foreground cursor-pointer text-sm font-medium transition-colors hover:text-foreground">
            운영 현황
          </summary>
          <p className="text-muted-foreground mt-2 text-xs">
            문서 {usage.data?.documents ?? 0} · 메시지{" "}
            {usage.data?.messages ?? 0} · 기억 {usage.data?.memories ?? 0}
          </p>
          <p className="text-muted-foreground mt-2 text-xs">
            소유자만 문서 삭제와 기억 검토를 수행할 수 있습니다.
          </p>
          {isOwner && workspaceId && (
            <form
              className="mt-3 flex gap-2"
              onSubmit={(event) => {
                event.preventDefault();
                if (!memberUserId.trim()) return;
                addWorkspaceMember.mutate({
                  role: "member",
                  userId: memberUserId.trim(),
                  workspaceId,
                });
              }}
            >
              <Input
                aria-label="멤버 사용자 ID"
                onChange={(event) => setMemberUserId(event.target.value)}
                placeholder="멤버 사용자 UUID"
                value={memberUserId}
              />
              <Button size="sm" type="submit" variant="outline">
                추가
              </Button>
            </form>
          )}
          {isOwner && auditLog.data?.length ? (
            <ul className="mt-3 space-y-1 text-xs">
              {auditLog.data.slice(0, 5).map((entry) => (
                <li className="text-muted-foreground" key={entry.id}>
                  {entry.action} · {new Date(entry.createdAt).toLocaleString()}
                </li>
              ))}
            </ul>
          ) : null}
        </details>
      </aside>
      <div className="bg-background/80 flex min-h-[38rem] flex-col overflow-hidden rounded-2xl border shadow-sm backdrop-blur lg:h-[calc(100vh-10rem)]">
        <div className="flex items-center justify-between gap-4 border-b px-5 py-4 sm:px-7">
          <div className="flex min-w-0 items-center gap-3">
            <div className="bg-primary/10 text-primary grid size-10 shrink-0 place-items-center rounded-2xl text-sm font-bold">
              B
            </div>
            <div className="min-w-0">
              <p className="text-muted-foreground text-[11px] font-semibold tracking-[0.14em] uppercase">
                Beat · private conversation
              </p>
              <h2 className="truncate text-base font-semibold">
                {conversations.data?.find(
                  (conversation) => conversation.id === conversationId,
                )?.title ?? "대화를 선택하세요"}
              </h2>
            </div>
          </div>
          <div className="text-muted-foreground hidden items-center gap-2 text-xs sm:flex">
            <span className="size-2 rounded-full bg-emerald-500" />
            기록 및 기억 연결됨
          </div>
        </div>
        <div className="flex-1 overflow-y-auto px-4 py-6 sm:px-8 sm:py-8 lg:px-12">
          <div className="mx-auto flex w-full max-w-4xl flex-col gap-6">
            {messages.data?.map((message) => (
              <article
                className={`flex w-full items-start gap-3 ${message.role === "user" ? "flex-row-reverse" : ""}`}
                key={message.id}
              >
                <div
                  className={`grid size-8 shrink-0 place-items-center rounded-xl text-xs font-bold ${message.role === "user" ? "bg-foreground text-background" : "bg-primary/10 text-primary"}`}
                >
                  {message.role === "user" ? "나" : "B"}
                </div>
                <div
                  className={`min-w-0 max-w-[min(52rem,88%)] rounded-2xl px-4 py-3 shadow-sm sm:px-5 ${message.role === "user" ? "bg-primary text-primary-foreground rounded-tr-md" : "bg-muted/70 rounded-tl-md border"}`}
                >
                  <p
                    className={`mb-1 text-[11px] font-semibold ${message.role === "user" ? "text-primary-foreground/70 text-right" : "text-muted-foreground"}`}
                  >
                    {message.role === "user" ? "Arlequin" : "Beat"}
                  </p>
                  <p className="whitespace-pre-wrap text-[15px] leading-7">
                    {message.content}
                  </p>
                  {message.role === "assistant" && (
                    <div className="mt-4 flex flex-wrap gap-x-3 gap-y-1 border-t pt-3">
                      {(
                        Object.entries(feedbackLabels) as [
                          FeedbackKind,
                          string,
                        ][]
                      ).map(([kind, label]) => (
                        <button
                          className="text-muted-foreground text-xs transition-colors hover:text-foreground"
                          disabled={submitFeedback.isPending}
                          key={kind}
                          onClick={() =>
                            submitFeedback.mutate({
                              kind,
                              messageId: message.id,
                              workspaceId,
                            })
                          }
                          type="button"
                        >
                          {label}
                        </button>
                      ))}
                    </div>
                  )}
                  {message.role === "assistant" && workspaceId && (
                    <MessageCitations
                      messageId={message.id}
                      workspaceId={workspaceId}
                    />
                  )}
                </div>
              </article>
            ))}
            {isStreaming && (
              <article className="flex w-full items-start gap-3">
                <div className="bg-primary/10 text-primary grid size-8 shrink-0 place-items-center rounded-xl text-xs font-bold">
                  B
                </div>
                <div className="bg-muted/70 max-w-[min(52rem,88%)] rounded-2xl rounded-tl-md border px-4 py-3 shadow-sm sm:px-5">
                  <p className="text-muted-foreground mb-1 text-[11px] font-semibold">
                    Beat
                  </p>
                  <p className="whitespace-pre-wrap text-[15px] leading-7">
                    {streamedText || "생성 중…"}
                  </p>
                </div>
              </article>
            )}
            {conversationId && messages.data?.length === 0 && !isStreaming && (
              <div className="border-muted-foreground/20 bg-muted/20 rounded-2xl border border-dashed px-6 py-12 text-center">
                <div className="bg-primary/10 text-primary mx-auto grid size-12 place-items-center rounded-2xl text-lg font-bold">
                  B
                </div>
                <p className="mt-4 font-semibold">
                  무엇부터 함께 정리해볼까요?
                </p>
                <p className="text-muted-foreground mx-auto mt-2 max-w-md text-sm leading-6">
                  코드, 일정, 문서, 고민을 편하게 적어주세요. 필요한 경우 저장된
                  기억과 문서를 근거로 답합니다.
                </p>
              </div>
            )}
            {!conversationId && (
              <p className="text-muted-foreground rounded-xl border border-dashed p-4 text-sm">
                왼쪽에서 새 대화를 만들어 시작하세요.
              </p>
            )}
          </div>
        </div>
        <form
          className="bg-muted/20 border-t p-4 sm:p-5"
          onSubmit={submitQuestion}
        >
          <div className="bg-background mx-auto max-w-4xl rounded-2xl border p-2 shadow-sm">
            <Textarea
              aria-label="질문"
              className="min-h-20 resize-none border-0 bg-transparent px-3 py-2 shadow-none focus-visible:ring-0"
              disabled={!conversationId || isStreaming}
              onChange={(event) => setQuestion(event.target.value)}
              placeholder="무엇을 도와드릴까요?"
              value={question}
            />
            <div className="flex items-center justify-between gap-3 px-2 pb-1 pt-2">
              <p className="text-muted-foreground hidden text-xs sm:block">
                답변은 현재 구성된 Beat 모델에서 생성됩니다.
              </p>
              <Button
                className="ml-auto rounded-xl px-5"
                disabled={!question.trim() || !conversationId || isStreaming}
                type="submit"
              >
                {isStreaming ? "생성 중…" : "보내기"}
              </Button>
            </div>
          </div>
          {streamError && (
            <p
              className="text-destructive mx-auto mt-3 max-w-4xl text-sm"
              role="alert"
            >
              {streamError}
            </p>
          )}
          {feedbackNotice && (
            <p
              className="text-muted-foreground mx-auto mt-3 max-w-4xl text-xs"
              role="status"
            >
              {feedbackNotice}
            </p>
          )}
        </form>
        <details className="border-t px-5 py-4 sm:px-7">
          <summary className="text-muted-foreground cursor-pointer text-sm font-medium transition-colors hover:text-foreground">
            기억 후보 추가
          </summary>
          <div className="mx-auto max-w-4xl">
            <form
              className="mt-3 flex flex-col gap-2 sm:flex-row"
              onSubmit={submitMemory}
            >
              <Input
                aria-label="기억 내용"
                onChange={(event) => setMemoryContent(event.target.value)}
                placeholder="예: 사용자는 한국어로 답변받기를 선호한다"
                value={memoryContent}
              />
              <Button
                className="sm:shrink-0"
                disabled={!memoryContent.trim() || createMemory.isPending}
                type="submit"
                variant="outline"
              >
                저장
              </Button>
            </form>
            <p className="text-muted-foreground mt-2 text-xs">
              후보 기억은 승인 API를 거친 뒤에만 답변 문맥으로 사용됩니다.
            </p>
            {memories.data?.length ? (
              <ul className="mt-3 grid gap-2 text-xs sm:grid-cols-2">
                {memories.data.map((memory) => (
                  <li
                    className="rounded-xl border bg-background/60 p-3"
                    key={memory.id}
                  >
                    <p>{memory.content}</p>
                    <p className="text-muted-foreground mt-1">
                      {memory.status} · 중요도 {memory.importance}
                    </p>
                    {isOwner &&
                      memory.status === "candidate" &&
                      workspaceId && (
                        <div className="mt-2 flex gap-2">
                          <button
                            className="text-muted-foreground hover:underline"
                            onClick={() =>
                              reviewMemory.mutate({
                                memoryId: memory.id,
                                status: "approved",
                                workspaceId,
                              })
                            }
                            type="button"
                          >
                            승인
                          </button>
                          <button
                            className="text-muted-foreground hover:underline"
                            onClick={() =>
                              reviewMemory.mutate({
                                memoryId: memory.id,
                                status: "rejected",
                                workspaceId,
                              })
                            }
                            type="button"
                          >
                            거절
                          </button>
                          <button
                            className="text-destructive hover:underline"
                            onClick={() =>
                              deleteMemory.mutate({
                                memoryId: memory.id,
                                workspaceId,
                              })
                            }
                            type="button"
                          >
                            삭제
                          </button>
                        </div>
                      )}
                  </li>
                ))}
              </ul>
            ) : null}
          </div>
        </details>
      </div>
    </section>
  );
}
