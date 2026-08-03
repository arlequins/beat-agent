import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { PwaInstall } from "./pwa-install";

function setUserAgent(value: string) {
  Object.defineProperty(navigator, "userAgent", {
    configurable: true,
    value,
  });
}

describe("PwaInstall", () => {
  beforeEach(() => {
    setUserAgent("Mozilla/5.0 Chrome");
    Object.defineProperty(navigator, "standalone", {
      configurable: true,
      value: false,
    });
    Object.defineProperty(window, "matchMedia", {
      configurable: true,
      value: vi.fn().mockReturnValue({ matches: false }),
    });
  });

  it("offers the browser install prompt and hides after acceptance", async () => {
    const prompt = vi.fn().mockResolvedValue(undefined);
    const event = new Event("beforeinstallprompt", { cancelable: true });
    Object.defineProperties(event, {
      prompt: { value: prompt },
      userChoice: {
        value: Promise.resolve({ outcome: "accepted", platform: "web" }),
      },
    });

    render(<PwaInstall />);
    fireEvent(window, event);

    const install = await screen.findByRole("button", {
      name: "홈 화면에 설치",
    });
    await userEvent.click(install);

    expect(event.defaultPrevented).toBe(true);
    expect(prompt).toHaveBeenCalledOnce();
    await waitFor(() => expect(document.body.contains(install)).toBe(false));
  });

  it("shows iOS home-screen instructions without a native prompt", async () => {
    setUserAgent("Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X)");

    render(<PwaInstall />);
    await userEvent.click(
      await screen.findByRole("button", { name: "홈 화면에 설치" }),
    );

    expect(screen.getByRole("status").textContent).toContain("홈 화면에 추가");
  });

  it("does not offer installation when already running standalone", () => {
    Object.defineProperty(window, "matchMedia", {
      configurable: true,
      value: vi.fn().mockReturnValue({ matches: true }),
    });

    render(<PwaInstall />);

    expect(screen.queryByRole("button", { name: "홈 화면에 설치" })).toBeNull();
  });
});
