"use client";

import { useEffect, useRef, useState } from "react";
import { usePathname } from "next/navigation";
import { setPendingNavUrl, usePendingNavUrl } from "@/lib/sidebar/nav-pending";

/**
 * Progress bar tipis di atas layar selama perpindahan halaman dari sidebar.
 * Jalan pelan menuju ~85% selama halaman dimuat, lalu langsung penuh &
 * memudar begitu pathname berubah.
 */
export function NavigationProgress() {
  const pathname = usePathname();
  const pendingUrl = usePendingNavUrl();
  const [width, setWidth] = useState(0);
  const [visible, setVisible] = useState(false);
  const [finishing, setFinishing] = useState(false);
  const timers = useRef<number[]>([]);

  const clearTimers = () => {
    timers.current.forEach((t) => window.clearTimeout(t));
    timers.current = [];
  };

  // Halaman tujuan sudah aktif -> selesai.
  useEffect(() => {
    setPendingNavUrl(null);
  }, [pathname]);

  useEffect(() => {
    clearTimers();
    if (pendingUrl) {
      setFinishing(false);
      setVisible(true);
      setWidth(8);
      // Mulai animasi di frame berikutnya supaya transisi CSS jalan.
      timers.current.push(window.setTimeout(() => setWidth(85), 30));
      // Jaga-jaga kalau navigasi batal / gagal: jangan nyangkut selamanya.
      timers.current.push(
        window.setTimeout(() => setPendingNavUrl(null), 20000),
      );
    } else if (visible) {
      setFinishing(true);
      setWidth(100);
      timers.current.push(
        window.setTimeout(() => {
          setVisible(false);
          setFinishing(false);
          setWidth(0);
        }, 350),
      );
    }
    return clearTimers;
  }, [pendingUrl]);

  if (!visible) return null;

  return (
    <div
      aria-hidden
      className="no-print pointer-events-none fixed inset-x-0 top-0 z-[100] h-0.5"
    >
      <div
        className="h-full bg-primary shadow-[0_0_8px_var(--color-primary)]"
        style={{
          width: `${width}%`,
          opacity: finishing && width === 100 ? 0 : 1,
          transition: finishing
            ? "width 200ms ease-out, opacity 250ms ease 100ms"
            : "width 8s cubic-bezier(0.1, 0.7, 0.3, 1)",
        }}
      />
    </div>
  );
}
