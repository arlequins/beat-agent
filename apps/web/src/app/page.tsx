"use client";

import { useAuth } from "~/auth/provider";
import { AuthStatus } from "~/auth/status";
import { AgentChat } from "~/components/agent-chat";
import { PwaInstall } from "~/components/pwa-install";
import Link from "next/link";

export default function HomePage() {
  const { user } = useAuth();
  return (
    <main className="container max-w-3xl py-8 sm:py-16">
      <header className="flex flex-wrap items-center justify-between gap-3">
        <AuthStatus />
        <PwaInstall />
      </header>
      <div className="min-h-8">
        {user ? (
          <Link
            className="text-muted-foreground mt-4 inline-block text-sm underline underline-offset-4"
            href="/admin/"
          >
            관리자 보안 센터
          </Link>
        ) : null}
      </div>
      <p className="text-muted-foreground text-sm font-medium tracking-wide uppercase">
        Arlequin의 개인 비서
      </p>
      <h1 className="mt-3 text-4xl font-bold">Beat</h1>
      <p className="text-muted-foreground mt-4 max-w-2xl text-lg">
        맥과 모바일에서 대화하고, 기억하고, 문서를 근거로 답하는 Arlequin의 개인
        비서입니다. 민감한 주제에서는 진단 대신 안전한 다음 단계를 함께
        찾습니다.
      </p>
      {!user ? (
        <section className="mt-10 grid gap-4 sm:grid-cols-3">
          {[
            ["같은 Beat 인증", "기존 OIDC 장기 로그인으로 기기를 연결"],
            ["개인의 기억", "상담과 문서를 Arlequin의 기록으로 보존"],
            ["모바일 설치", "홈 화면에서 독립 앱처럼 바로 실행"],
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
