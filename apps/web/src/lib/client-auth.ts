import type { User } from "oidc-client-ts";
import { UserManager, WebStorageStateStore } from "oidc-client-ts";

import { env } from "~/env";

let userManager: UserManager | undefined;

function siteUrl(path: string): string {
  return new URL(path, `${env.NEXT_PUBLIC_SITE_URL.replace(/\/$/, "")}/`).href;
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
    scope: env.NEXT_PUBLIC_OIDC_SCOPE,
    resource: env.NEXT_PUBLIC_OIDC_RESOURCE,
    automaticSilentRenew: false,
    monitorSession: true,
    stateStore: new WebStorageStateStore({ store: window.sessionStorage }),
    userStore: new WebStorageStateStore({ store: window.sessionStorage }),
  });
  return userManager;
}

export function startLogin(returnTo = window.location.pathname): Promise<void> {
  return getUserManager().signinRedirect({
    state: { returnTo },
  });
}

export function finishLogin(): Promise<User> {
  return getUserManager().signinRedirectCallback();
}

export async function startLogout(): Promise<void> {
  const manager = getUserManager();
  const user = await manager.getUser();
  if (!user) {
    window.location.assign(siteUrl(""));
    return;
  }
  await manager.signoutRedirect({ id_token_hint: user.id_token });
}

export async function finishLogout(): Promise<void> {
  const manager = getUserManager();
  await manager.signoutRedirectCallback();
  await manager.removeUser();
}

export function safeReturnPath(state: unknown): string {
  if (!state || typeof state !== "object") return "/";
  const returnTo = Reflect.get(state, "returnTo");
  return typeof returnTo === "string" &&
    returnTo.startsWith("/") &&
    !returnTo.startsWith("//")
    ? returnTo
    : "/";
}
