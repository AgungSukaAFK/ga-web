"use client";

/**
 * lib/pwa/use-install-prompt.ts
 *
 * Deteksi & trigger "Install App" (Add to Home Screen).
 *
 * - Android/Chrome/Edge/desktop Chrome: browser fire event
 *   `beforeinstallprompt` begitu kriteria installability terpenuhi (manifest
 *   + service worker + HTTPS) - kita tangkap eventnya lalu bisa panggil
 *   `.prompt()` kapan saja lewat tombol sendiri (native banner-nya di-
 *   preventDefault duluan).
 * - iOS/Safari: TIDAK ADA event/API buat trigger install programatis -
 *   satu-satunya cara memang manual lewat tombol Share > "Add to Home
 *   Screen". `isIOS` di sini dipakai buat nampilin instruksi itu, bukan
 *   tombol native.
 *
 * Kenapa ini penting utk Web Push (bukan cuma nice-to-have): di iOS, Push
 * API HANYA aktif kalau situs sudah berjalan sebagai installed home-screen
 * app (`display-mode: standalone`) - selama masih tab Safari biasa,
 * Notification.requestPermission() akan SELALU resolve "denied" diam-diam
 * tanpa munculin dialog sama sekali (lihat subscribeToPush,
 * lib/notifications/push.ts).
 */

import { useCallback, useEffect, useState } from "react";

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
}

export function useInstallPrompt() {
  const [deferredPrompt, setDeferredPrompt] =
    useState<BeforeInstallPromptEvent | null>(null);
  const [isStandalone, setIsStandalone] = useState(false);
  const [isIOS, setIsIOS] = useState(false);

  useEffect(() => {
    setIsStandalone(
      window.matchMedia("(display-mode: standalone)").matches ||
        (window.navigator as unknown as { standalone?: boolean }).standalone ===
          true,
    );
    setIsIOS(/iphone|ipad|ipod/i.test(window.navigator.userAgent));

    const handleBeforeInstall = (e: Event) => {
      e.preventDefault();
      setDeferredPrompt(e as BeforeInstallPromptEvent);
    };
    const handleInstalled = () => {
      setIsStandalone(true);
      setDeferredPrompt(null);
    };

    window.addEventListener("beforeinstallprompt", handleBeforeInstall);
    window.addEventListener("appinstalled", handleInstalled);
    return () => {
      window.removeEventListener("beforeinstallprompt", handleBeforeInstall);
      window.removeEventListener("appinstalled", handleInstalled);
    };
  }, []);

  const promptInstall = useCallback(async (): Promise<boolean> => {
    if (!deferredPrompt) return false;
    await deferredPrompt.prompt();
    const choice = await deferredPrompt.userChoice;
    setDeferredPrompt(null);
    return choice.outcome === "accepted";
  }, [deferredPrompt]);

  return {
    /** Bisa trigger dialog install native (Android/Chrome/Edge/desktop). */
    canInstall: !!deferredPrompt,
    /** Sudah berjalan sebagai installed app (home screen/desktop). */
    isStandalone,
    /** iOS - install cuma bisa manual lewat Share > Add to Home Screen. */
    isIOS,
    promptInstall,
  };
}
