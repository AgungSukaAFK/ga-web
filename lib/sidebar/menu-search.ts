"use client";

/**
 * lib/sidebar/menu-search.ts
 *
 * Pencarian menu sidebar yang "pintar": selain cocok ke judul menu, juga
 * cocok ke singkatan (mis. "mr" -> Material Request, "po" -> Purchase
 * Order), sinonim/kata kunci Bahasa Indonesia & Inggris (mis. "persetujuan"
 * -> semua menu approval), nama grup (mis. "pc" -> semua menu Petty Cash),
 * dan tahan typo ringan (mis. "aproval").
 *
 * Query disimpan di localStorage supaya tidak kereset saat pindah halaman /
 * reload - baru hilang kalau user sendiri yang menghapus (tombol clear / Esc).
 */

import { useCallback, useEffect, useState } from "react";

/** Kata kunci tambahan per URL menu (di luar judulnya sendiri). */
const MENU_KEYWORDS: Record<string, string[]> = {
  "/dashboard": ["beranda", "home", "ringkasan", "statistik", "overview", "utama"],
  "/notifications": ["notif", "pemberitahuan", "inbox", "pesan", "alert", "kabar"],
  "/material-request": ["mr", "permintaan material", "pengajuan", "request", "buat mr", "material"],
  "/mr-saya": ["mr", "mr ku", "my mr", "pengajuan saya", "request saya", "material request saya"],
  "/purchase-order": ["po", "pembelian", "pesanan", "order", "beli", "purchasing"],
  "/barang": ["item", "produk", "material", "katalog", "master barang", "part", "sparepart"],
  "/request-new-item": ["barang baru", "item baru", "tambah barang", "usulan barang", "request item"],
  "/item-requests": ["permintaan barang baru", "request item", "review barang", "usulan barang"],
  "/stok-ga": ["stock", "stok", "inventaris", "inventory", "gudang", "persediaan", "warehouse"],
  "/vendor": ["supplier", "pemasok", "toko", "rekanan", "penyedia"],
  "/approval-validation": ["approval", "persetujuan", "setuju", "validasi", "approve", "acc", "verifikasi", "review", "tanda tangan", "ttd"],
  "/approval-validation/templates": ["approval", "persetujuan", "alur persetujuan", "alur approval", "workflow", "flow", "template"],
  "/mr-template": ["mr", "template", "format mr", "contoh mr"],
  "/cost-center-management": ["cost center", "cc", "anggaran", "biaya", "budget", "departemen"],
  "/user-management": ["user", "pengguna", "akun", "karyawan", "pegawai", "role", "hak akses", "admin"],
  "/mr-management": ["mr", "kelola mr", "admin mr", "material request"],
  "/po-management": ["po", "kelola po", "admin po", "purchase order"],
  "/file-management": ["file", "dokumen", "berkas", "storage", "lampiran", "attachment"],
  "/goods-receipt-settings": ["gr", "goods receipt", "terima barang", "penerimaan barang", "kode", "pin"],
  "/petty-cash": ["pc", "kas kecil", "petty", "dashboard"],
  "/petty-cash/management": ["pc", "kas kecil", "kelola petty cash", "admin"],
  "/petty-cash/budgeting": ["pc", "budget", "anggaran", "plafon", "kas kecil"],
  "/petty-cash/barang": ["pc", "item", "produk", "kas kecil"],
  "/petty-cash/template-approval": ["pc", "approval", "persetujuan", "alur persetujuan", "workflow", "template"],
  "/petty-cash/approval": ["pc", "approval", "persetujuan", "setuju", "validasi", "approve", "acc"],
  "/petty-cash/pengajuan-saya": ["pc", "pengajuan", "request saya", "kas kecil"],
  "/petty-cash/deklarasi": ["pc", "deklarasi", "laporan", "realisasi", "reimburse", "pertanggungjawaban", "nota", "struk"],
  "/dokumentasi": ["docs", "panduan", "bantuan", "help", "manual", "tutorial", "cara"],
  "/update-web": ["changelog", "rilis", "release", "versi", "pengumuman", "berita", "info terbaru", "whats new"],
  "/feedback": ["saran", "kritik", "masukan", "lapor", "bug", "keluhan"],
  "/feedback-management": ["feedback", "saran", "kritik", "masukan", "laporan bug", "keluhan", "it"],
  "/tentang-app": ["about", "info", "versi", "aplikasi"],
};

/** Kata kunci per grup sidebar - berlaku utk semua menu di grup itu. */
const GROUP_KEYWORDS: Record<string, string[]> = {
  "Petty Cash": ["pc", "petty cash", "kas kecil"],
  Admin: ["admin", "management", "kelola"],
};

export function normalizeSearch(text: string): string {
  return text
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

/** "Material Request" -> "mr", "Approval & Validation" -> "av". */
function acronym(normalized: string): string {
  return normalized
    .split(" ")
    .filter(Boolean)
    .map((w) => w[0])
    .join("");
}

/** Jarak edit maksimal 1 (cukup utk typo ringan: kurang/lebih/salah 1 huruf). */
function withinOneEdit(a: string, b: string): boolean {
  if (a === b) return true;
  if (Math.abs(a.length - b.length) > 1) return false;
  let i = 0;
  let j = 0;
  let edits = 0;
  while (i < a.length && j < b.length) {
    if (a[i] === b[j]) {
      i++;
      j++;
      continue;
    }
    if (++edits > 1) return false;
    if (a.length > b.length) i++;
    else if (a.length < b.length) j++;
    else {
      i++;
      j++;
    }
  }
  return edits + (a.length - i) + (b.length - j) <= 1;
}

function isSubsequence(needle: string, haystack: string): boolean {
  let i = 0;
  for (const ch of haystack) {
    if (ch === needle[i]) i++;
    if (i === needle.length) return true;
  }
  return false;
}

type Index = { title: string; titleWords: string[]; acr: string; keywords: string[]; keywordWords: string[] };

function buildIndex(title: string, url: string, groupLabel?: string): Index {
  const t = normalizeSearch(title);
  const keywords = [
    ...(MENU_KEYWORDS[url] ?? []),
    ...((groupLabel && GROUP_KEYWORDS[groupLabel]) || []),
  ].map(normalizeSearch);
  return {
    title: t,
    titleWords: t.split(" ").filter(Boolean),
    acr: acronym(t),
    keywords,
    keywordWords: keywords.flatMap((k) => k.split(" ")),
  };
}

function scoreToken(token: string, idx: Index): number {
  if (idx.title === token) return 100;
  if (idx.acr === token) return 95;
  if (idx.title.startsWith(token)) return 90;
  if (idx.titleWords.some((w) => w === token)) return 85;
  if (idx.keywords.some((k) => k === token)) return 80;
  if (idx.titleWords.some((w) => w.startsWith(token))) return 75;
  if (token.length >= 2 && idx.acr.startsWith(token)) return 65;
  if (idx.keywordWords.some((w) => w.startsWith(token))) return 60;
  if (token.length >= 3 && idx.title.includes(token)) return 50;
  if (token.length >= 3 && idx.keywords.some((k) => k.includes(token))) return 40;
  if (
    token.length >= 5 &&
    [...idx.titleWords, ...idx.keywordWords].some(
      (w) => w.length >= 5 && withinOneEdit(token, w),
    )
  )
    return 30;
  if (token.length >= 3 && isSubsequence(token, idx.title.replace(/ /g, "")))
    return 15;
  return 0;
}

/**
 * Skor relevansi satu menu terhadap query (0 = tidak cocok). Semua kata di
 * query harus cocok ke sesuatu; frasa utuh yang cocok ke judul/kata kunci
 * dapat skor lebih tinggi.
 */
export function scoreMenuItem(
  query: string,
  item: { title: string; url: string },
  groupLabel?: string,
): number {
  const q = normalizeSearch(query);
  if (!q) return 0;
  const idx = buildIndex(item.title, item.url, groupLabel);

  let phrase = 0;
  if (q.includes(" ")) {
    if (idx.title.startsWith(q)) phrase = 120;
    else if (idx.title.includes(q)) phrase = 110;
    else if (idx.keywords.some((k) => k === q)) phrase = 105;
    else if (idx.keywords.some((k) => k.includes(q))) phrase = 70;
  }

  let total = 0;
  for (const token of q.split(" ")) {
    const s = scoreToken(token, idx);
    if (s === 0) return phrase;
    total += s;
  }
  return Math.max(phrase, total / q.split(" ").length);
}

/** Saring & urutkan menu berdasarkan query (paling relevan di atas). */
export function searchMenuItems<T extends { title: string; url: string }>(
  items: T[],
  query: string,
  groupLabel?: string,
): T[] {
  return items
    .map((item, i) => ({ item, i, score: scoreMenuItem(query, item, groupLabel) }))
    .filter((r) => r.score > 0)
    .sort((a, b) => b.score - a.score || a.i - b.i)
    .map((r) => r.item);
}

const STORAGE_KEY = "ga-sidebar-search";

/**
 * Query pencarian sidebar yang persisten (localStorage). Dibaca setelah
 * mount supaya tidak mismatch hidrasi.
 */
export function useSidebarSearch() {
  const [query, setQueryState] = useState("");

  useEffect(() => {
    try {
      setQueryState(localStorage.getItem(STORAGE_KEY) ?? "");
    } catch {
      // abaikan (localStorage diblokir)
    }
  }, []);

  const setQuery = useCallback((value: string) => {
    setQueryState(value);
    try {
      if (value) localStorage.setItem(STORAGE_KEY, value);
      else localStorage.removeItem(STORAGE_KEY);
    } catch {
      // abaikan
    }
  }, []);

  return { query, setQuery };
}
