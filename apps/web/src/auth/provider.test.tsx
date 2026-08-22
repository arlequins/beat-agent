import { render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => {
  const events = {
    addAccessTokenExpired: vi.fn(),
    addSilentRenewError: vi.fn(),
    addUserLoaded: vi.fn(),
    addUserUnloaded: vi.fn(),
    removeAccessTokenExpired: vi.fn(),
    removeSilentRenewError: vi.fn(),
    removeUserLoaded: vi.fn(),
    removeUserUnloaded: vi.fn(),
  };
  const manager = {
    events,
    getUser: vi.fn(),
    signinSilent: vi.fn(),
  };
  return {
    events,
    manager,
    getUserManager: vi.fn(() => manager),
    startLogin: vi.fn(),
    startLogout: vi.fn(),
  };
});

vi.mock("~/lib/client-auth", () => ({
  getUserManager: mocks.getUserManager,
  startLogin: mocks.startLogin,
  startLogout: mocks.startLogout,
}));

import { OidcAuthProvider, useAuth } from "./provider";

function AuthState() {
  const { isLoading, user } = useAuth();
  if (isLoading) return <output>loading</output>;
  return (
    <output>{user ? String(user.profile.email ?? "") : "signed-out"}</output>
  );
}

describe("OIDC auth provider", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("restores an active persisted session without showing login", async () => {
    mocks.manager.getUser.mockResolvedValue({
      expired: false,
      profile: { email: "arlequin@example.com" },
    });

    render(
      <OidcAuthProvider>
        <AuthState />
      </OidcAuthProvider>,
    );

    await waitFor(() =>
      expect(screen.getByText("arlequin@example.com")).toBeTruthy(),
    );
    expect(mocks.manager.signinSilent).not.toHaveBeenCalled();
  });

  it("silently renews an expired persisted session before signing out", async () => {
    mocks.manager.getUser.mockResolvedValue({
      expired: true,
      profile: { email: "old@example.com" },
    });
    mocks.manager.signinSilent.mockResolvedValue({
      expired: false,
      profile: { email: "arlequin@example.com" },
    });

    render(
      <OidcAuthProvider>
        <AuthState />
      </OidcAuthProvider>,
    );

    await waitFor(() =>
      expect(screen.getByText("arlequin@example.com")).toBeTruthy(),
    );
    expect(mocks.manager.signinSilent).toHaveBeenCalledOnce();
  });

  it("keeps the user signed out when session renewal is rejected", async () => {
    mocks.manager.getUser.mockResolvedValue({ expired: true, profile: {} });
    mocks.manager.signinSilent.mockRejectedValue(new Error("session expired"));

    render(
      <OidcAuthProvider>
        <AuthState />
      </OidcAuthProvider>,
    );

    await waitFor(() => expect(screen.getByText("signed-out")).toBeTruthy());
  });

  it("renews again when the access token expires during a session", async () => {
    const activeUser = {
      expired: false,
      profile: { email: "arlequin@example.com" },
    };
    mocks.manager.getUser.mockResolvedValue(activeUser);
    mocks.manager.signinSilent.mockResolvedValue(activeUser);

    render(
      <OidcAuthProvider>
        <AuthState />
      </OidcAuthProvider>,
    );

    await waitFor(() =>
      expect(mocks.events.addAccessTokenExpired).toHaveBeenCalledOnce(),
    );
    const onAccessTokenExpired =
      mocks.events.addAccessTokenExpired.mock.calls.at(0)?.[0];
    expect(onAccessTokenExpired).toBeTypeOf("function");
    if (typeof onAccessTokenExpired === "function") onAccessTokenExpired();

    await waitFor(() =>
      expect(mocks.manager.signinSilent).toHaveBeenCalledOnce(),
    );
  });
});
