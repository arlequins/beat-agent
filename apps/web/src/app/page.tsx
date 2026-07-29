"use client";

import { useAuth } from "~/auth/provider";
import { AuthStatus } from "~/auth/status";
import { AgentChat } from "~/components/agent-chat";
import Link from "next/link";

export default function HomePage() {
  const { user } = useAuth();
  return (
    <main className="container max-w-3xl py-16">
      <AuthStatus />
      {user ? (
        <Link
          className="text-muted-foreground mt-4 inline-block text-sm underline underline-offset-4"
          href="/admin/"
        >
          관리자 보안 센터
        </Link>
      ) : null}
      <p className="text-muted-foreground text-sm font-medium tracking-wide uppercase">
        Arlequin의 로컬 개인 비서
      </p>
      <h1 className="mt-3 text-4xl font-bold">Beat</h1>
      <p className="text-muted-foreground mt-4 max-w-2xl text-lg">
        맥에서 대화하고, 기억하고, 문서를 근거로 답하는 Arlequin의 개인
        비서입니다. 민감한 주제에서는 진단 대신 안전한 다음 단계를 함께
        찾습니다.
      </p>
      {!user ? (
        <section className="mt-10 grid gap-4 sm:grid-cols-3">
          {[
            ["내 맥에서", "PostgreSQL, OIDC Mock, Ollama로 동작"],
            ["근거와 기억", "문서 인용과 검토된 기억을 대화에 사용"],
            ["안전한 확장", "클라우드 모델과 데이터베이스는 명시적으로 선택"],
          ].map(([title, description]) => (
            <article className="rounded-lg border p-4" key={title}>
              <h2 className="font-semibold">{title}</h2>
              <p className="text-muted-foreground mt-2 text-sm">
                {description}
              </p>
            </article>
          ))}
        </section>
      ) : (
        <section className="mt-10">
          <AgentChat />
        </section>
      )}
    </main>
  );
}
