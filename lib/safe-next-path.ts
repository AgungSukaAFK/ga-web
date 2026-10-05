// src/lib/safe-next-path.ts
//
// Tujuan setelah login (?next=) - dipakai middleware (redirect ke login
// membawa halaman asal, mis. hasil scan QR /approval-pc-*/[id]) & halaman
// login (balik ke sana setelah berhasil masuk). Cuma path internal yang
// diterima: diawali "/" tapi bukan "//" atau "/\" (browser menganggapnya
// URL protocol-relative ke domain lain), supaya tidak jadi open redirect.

export function getSafeNextPath(next: string | null | undefined) {
  if (!next || !next.startsWith("/") || next.startsWith("//")) return null;
  if (next.startsWith("/\\") || next.startsWith("/auth")) return null;
  return next;
}
