"use client";

import type { User } from "oidc-client-ts";
import { createContext, useContext, useEffect, useMemo, useState } from "react";

import { getUserManager, startLogin, startLogout } from "~/lib/client-auth";

type AuthContextValue = {
  user: User | null;
  isLoading: boolean;
  login: () => Promise<void>;
  logout: () => Promise<void>;
};

const AuthContext = createContext<AuthContextValue | null>(null);

export function OidcAuthProvider(props: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const manager = getUserManager();
    const onUserLoaded = (nextUser: User) => setUser(nextUser);
    const onUserUnloaded = () => setUser(null);

    manager.events.addUserLoaded(onUserLoaded);
    manager.events.addUserUnloaded(onUserUnloaded);
    manager.events.addAccessTokenExpired(onUserUnloaded);
    manager.events.addSilentRenewError(onUserUnloaded);

    void manager
      .getUser()
      .then((storedUser) => setUser(storedUser?.expired ? null : storedUser))
      .finally(() => setIsLoading(false));

    return () => {
      manager.events.removeUserLoaded(onUserLoaded);
      manager.events.removeUserUnloaded(onUserUnloaded);
      manager.events.removeAccessTokenExpired(onUserUnloaded);
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
