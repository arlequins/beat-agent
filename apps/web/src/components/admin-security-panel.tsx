"use client";

import { Button } from "@arlequins/ui/button";
import { useEffect, useState } from "react";

import { useAuth } from "~/auth/provider";
import {
  getOidcSessions,
  type OidcSessionSummary,
  revokeOidcSessions,
} from "~/lib/client-auth";

export function AdminSecurityPanel() {
  const { isLoading, logout, user } = useAuth();
  const [summary, setSummary] = useState<OidcSessionSummary>();
  const [error, setError] = useState<string>();
  const [isRevoking, setIsRevoking] = useState(false);

  useEffect(() => {
    if (!user?.access_token || user.expired) return;
    void getOidcSessions(user.access_token)
      .then(setSummary)
      .catch((cause: unknown) =>
        setError(
          cause instanceof Error ? cause.message : "세션을 불러올 수 없습니다.",
        ),
      );
  }, [user]);

  if (isLoading) return <p className="text-muted-foreground">세션 확인 중…</p>;
  if (!user) {
    return (
      <p className="text-muted-foreground">
        관리자 로그인 후 보안 설정을 관리할 수 있습니다.
      </p>
    );
  }

  async function revokeAllPersistentLogins() {
    const accessToken = user?.access_token;
    if (
      !accessToken ||
      !window.confirm("모든 기기의 지속 로그인을 해제할까요?")
    )
      return;
    setIsRevoking(true);
    setError(undefined);
    try {
      await revokeOidcSessions(accessToken);
      await logout();
    } catch (cause) {
      setError(
        cause instanceof Error
          ? cause.message
          : "지속 로그인을 해제하지 못했습니다.",
      );
    } finally {
      setIsRevoking(false);
    }
  }

  return (
    <section className="space-y-5 rounded-xl border bg-card p-6 shadow-sm">
      <div>
        <h2 className="text-xl font-semibold">로그인 보안</h2>
        <p className="text-muted-foreground mt-1 text-sm">
          이 브라우저의 로그인은 localStorage에 암호화되지 않은 토큰 형태로
          보관되므로, 공용 기기에서는 작업 후 로그아웃하세요.
        </p>
      </div>
      <dl className="grid gap-4 sm:grid-cols-2">
        <div className="rounded-lg border p-4">
          <dt className="text-muted-foreground text-sm">계정</dt>
          <dd className="mt-1 font-medium">
            {user.profile.email ?? user.profile.sub}
          </dd>
        </div>
        <div className="rounded-lg border p-4">
          <dt className="text-muted-foreground text-sm">활성 지속 로그인</dt>
          <dd className="mt-1 font-medium">
            {summary?.activePersistentLogins ?? "확인 중"}개
          </dd>
        </div>
      </dl>
      {summary?.sessions.length ? (
        <p className="text-muted-foreground text-sm">
          가장 최근 토큰 발급:{" "}
          {new Date(summary.sessions.at(-1)?.createdAt ?? "").toLocaleString(
            "ko-KR",
          )}
        </p>
      ) : null}
      {error ? (
        <p className="text-destructive text-sm" role="alert">
          {error}
        </p>
      ) : null}
      <div className="flex flex-wrap gap-3">
        <Button
          disabled={isRevoking}
          onClick={() => void revokeAllPersistentLogins()}
          variant="destructive"
        >
          {isRevoking ? "해제 중…" : "모든 기기에서 로그아웃"}
        </Button>
        <Button onClick={() => void logout()} variant="outline">
          이 기기에서 로그아웃
        </Button>
      </div>
    </section>
  );
}
