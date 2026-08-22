"use client";

import { Button } from "@arlequins/ui/button";
import { useEffect, useState } from "react";

type InstallChoice = {
  outcome: "accepted" | "dismissed";
  platform: string;
};

type BeforeInstallPromptEvent = Event & {
  prompt(): Promise<void>;
  userChoice: Promise<InstallChoice>;
};

function isStandalone() {
  const iosNavigator = navigator as Navigator & { standalone?: boolean };
  return (
    window.matchMedia("(display-mode: standalone)").matches ||
    iosNavigator.standalone === true
  );
}

export function PwaInstall() {
  const [installPrompt, setInstallPrompt] =
    useState<BeforeInstallPromptEvent>();
  const [isIos, setIsIos] = useState(false);
  const [installed, setInstalled] = useState(false);
  const [showIosHelp, setShowIosHelp] = useState(false);

  useEffect(() => {
    setInstalled(isStandalone());
    setIsIos(/iPad|iPhone|iPod/.test(navigator.userAgent));

    const onBeforeInstallPrompt = (event: Event) => {
      event.preventDefault();
      setInstallPrompt(event as BeforeInstallPromptEvent);
    };
    const onInstalled = () => {
      setInstalled(true);
      setInstallPrompt(undefined);
      setShowIosHelp(false);
    };

    window.addEventListener("beforeinstallprompt", onBeforeInstallPrompt);
    window.addEventListener("appinstalled", onInstalled);
    return () => {
      window.removeEventListener("beforeinstallprompt", onBeforeInstallPrompt);
      window.removeEventListener("appinstalled", onInstalled);
    };
  }, []);

  if (installed || (!installPrompt && !isIos)) return null;

  async function install() {
    if (!installPrompt) {
      setShowIosHelp((visible) => !visible);
      return;
    }
    await installPrompt.prompt();
    const choice = await installPrompt.userChoice;
    if (choice.outcome === "accepted") setInstalled(true);
    setInstallPrompt(undefined);
  }

  return (
    <div className="relative">
      <Button onClick={() => void install()} size="sm" variant="outline">
        홈 화면에 설치
      </Button>
      {showIosHelp ? (
        <p
          className="bg-popover text-popover-foreground absolute top-11 right-0 z-20 w-64 rounded-lg border p-3 text-sm shadow-lg"
          role="status"
        >
          브라우저의 공유 버튼을 누른 뒤 <strong>홈 화면에 추가</strong>를
          선택하세요. 설치된 Beat에서 처음 한 번 로그인하면 장기 세션이
          유지됩니다.
        </p>
      ) : null}
    </div>
  );
}
