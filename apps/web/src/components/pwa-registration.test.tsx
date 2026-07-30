import { describe, expect, it, vi } from "vitest";

import {
  registerPwaServiceWorker,
  schedulePwaRegistration,
} from "./pwa-registration";

describe("registerPwaServiceWorker", () => {
  it("registers the root-scoped worker", async () => {
    const register = vi.fn().mockResolvedValue({ scope: "/" });
    Object.defineProperty(navigator, "serviceWorker", {
      configurable: true,
      value: { register },
    });

    await expect(registerPwaServiceWorker()).resolves.toEqual({ scope: "/" });
    expect(register).toHaveBeenCalledWith("/sw.js", { scope: "/" });
  });

  it("does nothing when service workers are unavailable", () => {
    Reflect.deleteProperty(navigator, "serviceWorker");

    expect(registerPwaServiceWorker()).toBeUndefined();
    expect(schedulePwaRegistration("production")).toBeUndefined();
  });

  it("registers immediately when production has already loaded", () => {
    const register = vi.fn().mockResolvedValue({ scope: "/" });
    Object.defineProperty(navigator, "serviceWorker", {
      configurable: true,
      value: { register },
    });
    Object.defineProperty(document, "readyState", {
      configurable: true,
      value: "complete",
    });

    expect(schedulePwaRegistration("production")).toBeUndefined();
    expect(register).toHaveBeenCalledOnce();
  });

  it("waits for load and returns a cleanup function", () => {
    const register = vi.fn().mockResolvedValue({ scope: "/" });
    Object.defineProperty(navigator, "serviceWorker", {
      configurable: true,
      value: { register },
    });
    Object.defineProperty(document, "readyState", {
      configurable: true,
      value: "loading",
    });
    const addEventListener = vi.spyOn(window, "addEventListener");
    const removeEventListener = vi.spyOn(window, "removeEventListener");

    const cleanup = schedulePwaRegistration("production");
    expect(addEventListener).toHaveBeenCalledWith(
      "load",
      expect.any(Function),
      { once: true },
    );

    window.dispatchEvent(new Event("load"));
    expect(register).toHaveBeenCalledOnce();
    cleanup?.();
    expect(removeEventListener).toHaveBeenCalledWith(
      "load",
      expect.any(Function),
    );
  });

  it("does not register outside production", () => {
    const register = vi.fn();
    Object.defineProperty(navigator, "serviceWorker", {
      configurable: true,
      value: { register },
    });

    expect(schedulePwaRegistration("development")).toBeUndefined();
    expect(register).not.toHaveBeenCalled();
  });
});
