"use client";

import { Button } from "@arlequins/ui/button";
import { useQuery } from "@tanstack/react-query";

import { useTRPC } from "~/trpc/react";
import { useAuth } from "./provider";

export function AuthStatus(props: { compact?: boolean }) {
  const { isLoading, login, logout, user } = useAuth();
  const trpc = useTRPC();
  const session = useQuery(
    trpc.auth.me.queryOptions(undefined, { enabled: Boolean(user) }),
  );

  if (isLoading) {
    return <Button disabled>세션 확인 중</Button>;
  }

  if (!user) {
    return <Button onClick={() => void login()}>Beat 시작하기</Button>;
  }

  const displayName =
    typeof user.profile.name === "string"
      ? user.profile.name
      : user.profile.preferred_username;

  return (
    <div className="flex items-center gap-3">
      <span
        className={props.compact ? "hidden" : "text-muted-foreground text-sm"}
      >
        {displayName ?? user.profile.sub}
      </span>
      {session.data && (
        <span
          className={
            props.compact ? "sr-only" : "text-muted-foreground text-sm"
          }
          data-testid="api-session"
        >
          연결됨: {session.data.name ?? session.data.id}
        </span>
      )}
      <Button
        size={props.compact ? "sm" : "default"}
        variant="outline"
        onClick={() => void logout()}
      >
        로그아웃
      </Button>
    </div>
  );
}
