import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => {
  const manager = {
    getUser: vi.fn(),
    removeUser: vi.fn(),
    signinRedirect: vi.fn(),
    signinRedirectCallback: vi.fn(),
  };
  return {
    manager,
    userManager: vi.fn(function UserManagerDouble() {
      return manager;
    }),
    webStorageStateStore: vi.fn(),
  };
});

vi.mock("oidc-client-ts", () => ({
  UserManager: mocks.userManager,
  WebStorageStateStore: mocks.webStorageStateStore,
}));

vi.mock("~/env", () => ({
  env: {
    NEXT_PUBLIC_OIDC_AUTHORITY: "https://id.beat.test",
    NEXT_PUBLIC_OIDC_CLIENT_ID: "beat-web",
    NEXT_PUBLIC_OIDC_RESOURCE: "https://api.beat.test",
    NEXT_PUBLIC_OIDC_SCOPE: "openid profile offline_access",
    NEXT_PUBLIC_SITE_URL: "https://beat.test",
  },
}));

import {
  finishLogin,
  finishLogout,
  getOidcSessions,
  getUserManager,
  revokeOidcSessions,
  safeReturnPath,
  startLogin,
  startLogout,
} from "./client-auth";

describe("client OIDC", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("uses persistent browser storage and a single offline_access scope", () => {
    expect(getUserManager()).toBe(mocks.manager);
    expect(getUserManager()).toBe(mocks.manager);
    expect(mocks.userManager).toHaveBeenCalledOnce();
    expect(mocks.userManager).toHaveBeenCalledWith(
      expect.objectContaining({
        automaticSilentRenew: true,
        client_id: "beat-web",
        redirect_uri: "https://beat.test/auth/callback/",
        scope: "openid profile offline_access",
      }),
    );
    expect(mocks.webStorageStateStore).toHaveBeenCalledTimes(2);
  });

  it("preserves only same-origin relative return paths", () => {
    expect(safeReturnPath({ returnTo: "/admin?tab=sessions" })).toBe(
      "/admin?tab=sessions",
    );
    expect(safeReturnPath({ returnTo: "//malicious.test" })).toBe("/");
    expect(safeReturnPath({ returnTo: "https://malicious.test" })).toBe("/");
    expect(safeReturnPath(null)).toBe("/");
  });

  it("starts PKCE login with the intended return path", async () => {
    mocks.manager.signinRedirect.mockResolvedValue(undefined);

    await startLogin("/admin");

    expect(mocks.manager.signinRedirect).toHaveBeenCalledWith({
      state: { returnTo: "/admin" },
    });
  });

  it("finishes login and logout callbacks through the OIDC manager", async () => {
    const user = { access_token: "access-token" };
    mocks.manager.signinRedirectCallback.mockResolvedValue(user);
    mocks.manager.removeUser.mockResolvedValue(undefined);

    await expect(finishLogin()).resolves.toBe(user);
    await expect(finishLogout()).resolves.toBeUndefined();

    expect(mocks.manager.signinRedirectCallback).toHaveBeenCalledOnce();
    expect(mocks.manager.removeUser).toHaveBeenCalledOnce();
  });

  it("revokes a refresh token before removing the browser session", async () => {
    mocks.manager.getUser.mockResolvedValue({ refresh_token: "refresh-token" });
    mocks.manager.removeUser.mockResolvedValue(undefined);
    const fetchMock = vi
      .spyOn(globalThis, "fetch")
      .mockResolvedValue(new Response(null, { status: 200 }));
    const redirect = vi.fn();

    await startLogout(redirect);

    expect(fetchMock).toHaveBeenCalledWith(
      "https://id.beat.test/revoke",
      expect.objectContaining({
        body: new URLSearchParams({
          client_id: "beat-web",
          token: "refresh-token",
          token_type_hint: "refresh_token",
        }),
        method: "POST",
      }),
    );
    expect(mocks.manager.removeUser).toHaveBeenCalledOnce();
    expect(redirect).toHaveBeenCalledWith("https://beat.test/");
  });

  it("uses bearer authorization for session review and revocation", async () => {
    const fetchMock = vi
      .spyOn(globalThis, "fetch")
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({ activePersistentLogins: 1, sessions: [] }),
          { status: 200 },
        ),
      )
      .mockResolvedValueOnce(
        new Response(JSON.stringify({ revoked: true }), { status: 200 }),
      );

    await expect(getOidcSessions("access-token")).resolves.toMatchObject({
      activePersistentLogins: 1,
    });
    await expect(revokeOidcSessions("access-token")).resolves.toEqual({
      revoked: true,
    });
    expect(fetchMock).toHaveBeenNthCalledWith(
      1,
      "https://id.beat.test/sessions",
      expect.objectContaining({
        headers: { Authorization: "Bearer access-token" },
        method: "GET",
      }),
    );
    expect(fetchMock).toHaveBeenNthCalledWith(
      2,
      "https://id.beat.test/sessions/revoke",
      expect.objectContaining({ method: "POST" }),
    );
  });

  it("returns a user-safe error for failed administration requests", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response(null, { status: 403 }),
    );

    await expect(getOidcSessions("expired-token")).rejects.toThrow(
      "관리자 세션을 확인할 수 없습니다.",
    );
  });
});
