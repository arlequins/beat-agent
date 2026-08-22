"use client";

import type { User, UserManager } from "oidc-client-ts";
import { createContext, useContext, useEffect, useMemo, useState } from "react";

import { getUserManager, startLogin, startLogout } from "~/lib/client-auth";

type AuthContextValue = {
  user: User | null;
  isLoading: boolean;
  login: () => Promise<void>;
  logout: () => Promise<void>;
};

const AuthContext = createContext<AuthContextValue | null>(null);

async function restoreStoredUser(manager: UserManager): Promise<User | null> {
  const storedUser = await manager.getUser();
  if (!storedUser) return null;
  if (!storedUser.expired) return storedUser;

  // A persisted user can outlive its access token. Let oidc-client-ts use the
  // refresh token (or the provider session) before treating the browser as
  // signed out, so reopening the app does not unnecessarily show the login
  // screen.
  try {
    const renewedUser = await manager.signinSilent();
    return renewedUser?.expired ? null : renewedUser;
  } catch {
    return null;
  }
}

export function OidcAuthProvider(props: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const manager = getUserManager();
    let disposed = false;
    const onUserLoaded = (nextUser: User) => setUser(nextUser);
    const onUserUnloaded = () => setUser(null);
    const renewUser = () => {
      void manager
        .signinSilent()
        .then((renewedUser) => {
          if (!disposed) setUser(renewedUser?.expired ? null : renewedUser);
        })
        .catch(() => {
          if (!disposed) setUser(null);
        });
    };

    manager.events.addUserLoaded(onUserLoaded);
    manager.events.addUserUnloaded(onUserUnloaded);
    manager.events.addAccessTokenExpired(renewUser);
    manager.events.addSilentRenewError(onUserUnloaded);

    void restoreStoredUser(manager)
      .then((storedUser) => {
        if (!disposed) setUser(storedUser);
      })
      .finally(() => {
        if (!disposed) setIsLoading(false);
      });

    return () => {
      disposed = true;
      manager.events.removeUserLoaded(onUserLoaded);
      manager.events.removeUserUnloaded(onUserUnloaded);
      manager.events.removeAccessTokenExpired(renewUser);
      manager.events.removeSilentRenewError(onUserUnloaded);
    };
  }, []);

  const value = useMemo<AuthContextValue>(
    () => ({
      user,
      isLoading,
      login: () => startLogin(),
      logout: startLogout,
    }),
    [isLoading, user],
  );

  return (
    <AuthContext.Provider value={value}>{props.children}</AuthContext.Provider>
  );
}

export function useAuth(): AuthContextValue {
  const value = useContext(AuthContext);
  if (!value) {
    throw new Error("useAuth must be used within OidcAuthProvider");
  }
  return value;
}
