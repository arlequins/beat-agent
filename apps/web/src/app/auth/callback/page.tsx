"use client";

import { useEffect, useState } from "react";

import { finishLogin, safeReturnPath } from "~/lib/client-auth";

export default function OidcCallbackPage() {
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    void finishLogin()
      .then((user) => {
        window.location.replace(safeReturnPath(user.state));
      })
      .catch((cause: unknown) => {
        console.error("OIDC callback failed", cause);
        setError("Sign-in could not be completed. Please try again.");
      });
  }, []);

  return (
    <main className="flex min-h-screen items-center justify-center p-6">
      <p role={error ? "alert" : undefined}>
        {error ?? "Completing sign-in..."}
      </p>
    </main>
  );
}
