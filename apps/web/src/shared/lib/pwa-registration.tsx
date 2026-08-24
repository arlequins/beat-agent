"use client";

import { useEffect, useState } from "react";

import { sitePath } from "~/lib/site-path";

export function registerPwaServiceWorker() {
  if (!("serviceWorker" in navigator)) return;
  const scope = sitePath("/");
  return navigator.serviceWorker
    .register(sitePath("/sw.js"), { scope })
    .then((registration) => {
      if (registration.waiting) notifyUpdateReady(registration);
      registration.addEventListener?.("updatefound", () => {
        const worker = registration.installing;
        if (!worker) return;
        worker.addEventListener?.("statechange", () => {
          if (
            worker.state === "installed" &&
            navigator.serviceWorker.controller
          )
            notifyUpdateReady(registration);
        });
      });
      return registration;
    });
}

export type PwaRegistrationEvent = {
  registration: ServiceWorkerRegistration;
  type: "update-ready";
};

function notifyUpdateReady(registration: ServiceWorkerRegistration) {
  window.dispatchEvent(
    new CustomEvent<PwaRegistrationEvent>("beat:pwa", {
      detail: { registration, type: "update-ready" },
    }),
  );
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

export function PwaUpdateNotice() {
  const [registration, setRegistration] = useState<ServiceWorkerRegistration>();

  useEffect(() => {
    const onUpdate = (event: Event) => {
      const detail = (event as CustomEvent<PwaRegistrationEvent>).detail;
      setRegistration(detail.registration);
    };
    window.addEventListener("beat:pwa", onUpdate);
    return () => window.removeEventListener("beat:pwa", onUpdate);
  }, []);

  if (!registration) return null;
  return (
    <div className="fixed inset-x-4 bottom-4 z-50 mx-auto flex max-w-md items-center justify-between gap-3 rounded-2xl border bg-background p-4 text-sm shadow-xl">
      <span>새로운 Beat 버전이 준비되었습니다.</span>
      <button
        className="rounded-full bg-primary px-3 py-1.5 text-primary-foreground"
        onClick={() => {
          const reload = () => window.location.reload();
          navigator.serviceWorker.addEventListener("controllerchange", reload, {
            once: true,
          });
          registration.waiting?.postMessage({ type: "SKIP_WAITING" });
        }}
        type="button"
      >
        새로고침
      </button>
    </div>
  );
}
