"use client";

import { useEffect } from "react";

import { sitePath } from "~/lib/site-path";

export function registerPwaServiceWorker() {
  if (!("serviceWorker" in navigator)) return;
  const scope = sitePath("/");
  return navigator.serviceWorker.register(sitePath("/sw.js"), { scope });
}

export function schedulePwaRegistration(
  environment = process.env.NODE_ENV,
): (() => void) | undefined {
  if (environment !== "production" || !("serviceWorker" in navigator)) {
    return;
  }

  const register = () => {
    void registerPwaServiceWorker();
  };

  if (document.readyState === "complete") {
    register();
    return;
  }

  window.addEventListener("load", register, { once: true });
  return () => window.removeEventListener("load", register);
}

export function PwaRegistration() {
  useEffect(() => schedulePwaRegistration(), []);

  return null;
}
