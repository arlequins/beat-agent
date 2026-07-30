"use client";

import { useEffect } from "react";

export function registerPwaServiceWorker() {
  if (!("serviceWorker" in navigator)) return;
  return navigator.serviceWorker.register("/sw.js", { scope: "/" });
}

export function PwaRegistration() {
  useEffect(() => {
    if (
      process.env.NODE_ENV !== "production" ||
      !("serviceWorker" in navigator)
    ) {
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
  }, []);

  return null;
}
