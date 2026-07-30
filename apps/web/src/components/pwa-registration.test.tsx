import { describe, expect, it, vi } from "vitest";

import { registerPwaServiceWorker } from "./pwa-registration";

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
  });
});
