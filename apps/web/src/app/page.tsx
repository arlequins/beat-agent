"use client";

import Link from "next/link";
import { useAuth } from "~/auth/provider";
import { AuthStatus } from "~/auth/status";
import { AgentChat } from "~/components/agent-chat";
import { PwaInstall } from "~/components/pwa-install";

export default function HomePage() {
  const { user } = useAuth();
  return (
    <main
      className={
        user
          ? "min-h-screen bg-background"
          : "min-h-screen bg-[radial-gradient(circle_at_top,#f5f7ff_0%,transparent_38%),var(--background)] dark:bg-[radial-gradient(circle_at_top,#171827_0%,transparent_38%),var(--background)]"
      }
    >
      <div className="mx-auto flex min-h-screen w-full max-w-[1680px] flex-col px-4 py-4 sm:px-6 sm:py-6 lg:px-8">
        <header className="flex flex-wrap items-center justify-between gap-4 border-b pb-4">
          <div className="flex items-center gap-3">
            <div className="bg-primary text-primary-foreground grid size-10 place-items-center rounded-2xl text-sm font-bold shadow-sm">
              B
            </div>
            <div>
              <p className="text-muted-foreground text-[11px] font-medium tracking-[0.16em] uppercase">
                Arlequin&apos;s private assistant
              </p>
              <h1 className="text-lg font-semibold tracking-tight">Beat</h1>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <PwaInstall />
            <AuthStatus />
          </div>
        </header>
        <div className="flex min-h-8 items-center justify-between gap-3">
          {user ? (
            <Link
              className="text-muted-foreground hover:text-foreground mt-3 inline-block text-xs underline-offset-4 hover:underline"
              href="/admin/"
            >
              관리자 보안 센터
            </Link>
          ) : (
            <span />
          )}
          <span className="text-muted-foreground hidden text-xs sm:inline">
            개인 기록은 로그인한 계정에 귀속됩니다.
          </span>
        </div>
        {user ? (
          <section className="mt-5 flex-1">
            <AgentChat />
          </section>
        ) : (
          <section className="mx-auto w-full max-w-5xl py-14 sm:py-20">
            <p className="text-muted-foreground text-sm font-semibold tracking-[0.16em] uppercase">
              Arlequin의 개인 비서
            </p>
            <h1 className="mt-4 max-w-3xl text-5xl font-semibold tracking-[-0.04em] sm:text-7xl">
              생각을 정리하고,
              <br />
              다음 행동을 함께 찾습니다.
            </h1>
            <p className="text-muted-foreground mt-7 max-w-2xl text-lg leading-8 sm:text-xl">
              맥과 모바일에서 대화하고, 기억하고, 문서를 근거로 답하는
              Arlequin의 개인 비서입니다. 민감한 주제에서는 진단 대신 안전한
              다음 단계를 함께 찾습니다.
            </p>
            <div className="mt-12 grid gap-4 sm:grid-cols-3">
              {[
                ["같은 Beat 인증", "기존 OIDC 장기 로그인으로 기기를 연결"],
                ["개인의 기억", "상담과 문서를 Arlequin의 기록으로 보존"],
                ["모바일 설치", "홈 화면에서 독립 앱처럼 바로 실행"],
              ].map(([title, description]) => (
                <article
                  className="bg-background/70 rounded-2xl border p-5 shadow-sm backdrop-blur"
                  key={title}
                >
                  <h2 className="font-semibold">{title}</h2>
                  <p className="text-muted-foreground mt-2 text-sm leading-6">
                    {description}
                  </p>
                </article>
              ))}
            </div>
          </section>
        )}
      </div>
    </main>
  );
}
