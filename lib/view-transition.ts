// Animasi pergantian tampilan (tema, aksen, font) memakai View Transitions
// API: browser memotret halaman sebelum & sesudah `update`, lalu
// menganimasikan peralihannya (style pendukungnya di globals.css, bagian
// "View transitions").
//
// - Tanpa `origin`: cross-fade halus seluruh halaman.
// - Dengan `origin` (titik klik): tampilan baru "menyebar" melingkar dari
//   titik itu - dipakai utk ganti mode terang/gelap.
//
// Browser yg belum mendukung, atau user yg mengaktifkan "kurangi gerakan"
// di sistem, langsung menjalankan `update` tanpa animasi.

import { flushSync } from "react-dom";

const REVEAL_DURATION = 500;
const REVEAL_EASING = "cubic-bezier(0.4, 0, 0.2, 1)";

export function runViewTransition(
  update: () => void,
  options: { origin?: { x: number; y: number } } = {},
) {
  if (
    typeof document === "undefined" ||
    !("startViewTransition" in document) ||
    window.matchMedia("(prefers-reduced-motion: reduce)").matches
  ) {
    update();
    return;
  }

  const root = document.documentElement;
  const { origin } = options;
  if (origin) root.dataset.vt = "reveal";

  // flushSync: perubahan state React (beserta efek yg memasang class/
  // atribut di <html>) harus sudah masuk DOM sebelum callback ini selesai,
  // supaya potret "sesudah" benar.
  const transition = document.startViewTransition(() => flushSync(update));

  transition.ready
    .then(() => {
      if (!origin) return;
      // Radius = jarak ke sudut layar terjauh, supaya lingkaran menutup penuh.
      const radius = Math.hypot(
        Math.max(origin.x, window.innerWidth - origin.x),
        Math.max(origin.y, window.innerHeight - origin.y),
      );
      const at = `at ${origin.x}px ${origin.y}px`;
      root.animate(
        { clipPath: [`circle(0px ${at})`, `circle(${radius}px ${at})`] },
        {
          duration: REVEAL_DURATION,
          easing: REVEAL_EASING,
          pseudoElement: "::view-transition-new(root)",
        },
      );
    })
    // Transisi bisa dibatalkan browser (mis. tab disembunyikan) - perubahan
    // tetap diterapkan, cuma tanpa animasi.
    .catch(() => {});

  transition.finished
    .catch(() => {})
    .finally(() => {
      delete root.dataset.vt;
    });
}

// Titik tengah elemen yg diklik - origin animasi "menyebar".
export function originFromEvent(e: { currentTarget: Element }) {
  const rect = e.currentTarget.getBoundingClientRect();
  return { x: rect.left + rect.width / 2, y: rect.top + rect.height / 2 };
}
