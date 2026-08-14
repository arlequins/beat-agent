import type { User } from "oidc-client-ts";
import { UserManager, WebStorageStateStore } from "oidc-client-ts";

import { env } from "~/env";
import { sitePath as pathFromSiteUrl } from "~/lib/site-path";

let userManager: UserManager | undefined;

function oidcScope() {
  const scopes = new Set(env.NEXT_PUBLIC_OIDC_SCOPE.split(/\s+/));
  scopes.add("offline_access");
  return [...scopes].join(" ");
}

function siteUrl(path: string): string {
  return new URL(
    pathFromSiteUrl(path, env.NEXT_PUBLIC_SITE_URL),
    env.NEXT_PUBLIC_SITE_URL,
  ).href;
}

export function getUserManager(): UserManager {
  if (typeof window === "undefined") {
    throw new Error("OIDC UserManager is only available in the browser");
  }

  userManager ??= new UserManager({
    authority: env.NEXT_PUBLIC_OIDC_AUTHORITY,
    client_id: env.NEXT_PUBLIC_OIDC_CLIENT_ID,
    redirect_uri: siteUrl("auth/callback/"),
    post_logout_redirect_uri: siteUrl("auth/logout-callback/"),
    response_type: "code",
    scope: oidcScope(),
    resource: env.NEXT_PUBLIC_OIDC_RESOURCE,
    automaticSilentRenew: true,
    monitorSession: false,
    stateStore: new WebStorageStateStore({ store: window.localStorage }),
    userStore: new WebStorageStateStore({ store: window.localStorage }),
  });
  return userManager;
}

export function startLogin(returnTo = window.location.pathname): Promise<void> {
  return getUserManager().signinRedirect({
    nonce: crypto.randomUUID(),
    state: { returnTo },
  });
}

export function finishLogin(): Promise<User> {
  return getUserManager().signinRedirectCallback();
}

export async function startLogout(): Promise<void> {
  const manager = getUserManager();
  const user = await manager.getUser();
  if (user?.refresh_token) {
    await fetch(`${env.NEXT_PUBLIC_OIDC_AUTHORITY}/revoke`, {
      body: new URLSearchParams({
        client_id: env.NEXT_PUBLIC_OIDC_CLIENT_ID,
        token: user.refresh_token,
        token_type_hint: "refresh_token",
      }),
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      method: "POST",
    });
  }
  await manager.signoutRedirect();
}

export async function finishLogout(): Promise<void> {
  await getUserManager().signoutRedirectCallback();
}

type PersistentLogin = { createdAt: string; expiresAt: string };

export type OidcSessionSummary = {
  activePersistentLogins: number;
  sessions: PersistentLogin[];
};

async function oidcAuthorizedRequest<T>(
  path: string,
  accessToken: string,
  method = "GET",
): Promise<T> {
  const response = await fetch(`${env.NEXT_PUBLIC_OIDC_AUTHORITY}${path}`, {
    headers: { Authorization: `Bearer ${accessToken}` },
    method,
  });
  if (!response.ok) throw new Error("관리자 세션을 확인할 수 없습니다.");
  return (await response.json()) as T;
}

export function getOidcSessions(accessToken: string) {
  return oidcAuthorizedRequest<OidcSessionSummary>("/sessions", accessToken);
}

export function revokeOidcSessions(accessToken: string) {
  return oidcAuthorizedRequest<{ revoked: true }>(
    "/sessions/revoke",
    accessToken,
    "POST",
  );
}

export function safeReturnPath(state: unknown): string {
  if (!state || typeof state !== "object") return pathFromSiteUrl("/");
  const returnTo = Reflect.get(state, "returnTo");
  return typeof returnTo === "string" &&
    returnTo.startsWith("/") &&
    !returnTo.startsWith("//")
    ? returnTo
    : pathFromSiteUrl("/");
}
