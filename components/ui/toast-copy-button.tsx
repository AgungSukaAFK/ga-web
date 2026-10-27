"use client";

import { useEffect, useRef, useState } from "react";
import { Check, Copy } from "lucide-react";

// Tombol "Salin" di tiap toast - disisipkan otomatis oleh lib/toast.tsx lewat
// slot `cancel` sonner. Teks diambil dari DOM toast-nya sendiri (judul +
// deskripsi), jadi tetap jalan walau title/description berupa ReactNode.
// Toast TIDAK ditutup setelah disalin (beda dari cancel/action bawaan).
export function ToastCopyButton() {
  const [copied, setCopied] = useState(false);
  const timer = useRef<ReturnType<typeof setTimeout>>(undefined);

  useEffect(() => () => clearTimeout(timer.current), []);

  const copy = async (e: React.MouseEvent<HTMLButtonElement>) => {
    const toastEl = e.currentTarget.closest("[data-sonner-toast]");
    const text = ["[data-title]", "[data-description]"]
      .map((sel) => toastEl?.querySelector(sel)?.textContent?.trim())
      .filter(Boolean)
      .join("\n");
    if (!text) return;

    try {
      await writeClipboard(text);
    } catch {
      return;
    }
    setCopied(true);
    clearTimeout(timer.current);
    timer.current = setTimeout(() => setCopied(false), 1500);
  };

  const Icon = copied ? Check : Copy;

  return (
    <button
      type="button"
      onClick={copy}
      aria-label={copied ? "Tersalin" : "Salin pesan"}
      title={copied ? "Tersalin" : "Salin pesan"}
      className="inline-flex size-6 shrink-0 cursor-pointer items-center justify-center rounded-md opacity-60 transition hover:bg-current/10 hover:opacity-100 focus-visible:opacity-100 focus-visible:outline-2 focus-visible:outline-current"
    >
      {/* pointer-events-none: supaya target pointerdown = <button>, kalau
          tidak sonner menganggapnya awal swipe toast */}
      <Icon className="pointer-events-none size-3.5" />
    </button>
  );
}

// navigator.clipboard cuma ada di secure context (https/localhost) - kalau
// app dibuka lewat IP LAN (http), jatuh ke execCommand("copy").
async function writeClipboard(text: string) {
  if (navigator.clipboard?.writeText) {
    await navigator.clipboard.writeText(text);
    return;
  }
  const textarea = document.createElement("textarea");
  textarea.value = text;
  textarea.setAttribute("readonly", "");
  textarea.style.position = "fixed";
  textarea.style.opacity = "0";
  document.body.appendChild(textarea);
  textarea.select();
  const ok = document.execCommand("copy");
  textarea.remove();
  if (!ok) throw new Error("copy failed");
}
