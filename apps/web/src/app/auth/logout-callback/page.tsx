"use client";

import { useEffect, useState } from "react";

import { finishLogout } from "~/lib/client-auth";
import { sitePath } from "~/lib/site-path";

export default function OidcLogoutCallbackPage() {
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    void finishLogout()
      .then(() => window.location.replace(sitePath("/")))
      .catch((cause: unknown) => {
        console.error("OIDC logout callback failed", cause);
        setError("Sign-out could not be completed. Please return home.");
      });
  }, []);

  return (
    <main className="flex min-h-screen items-center justify-center p-6">
      <p role={error ? "alert" : undefined}>
        {error ?? "Completing sign-out..."}
      </p>
    </main>
  );
}
