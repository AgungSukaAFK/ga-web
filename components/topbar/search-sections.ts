// Penyusun daftar hasil global search (./topbar-search.tsx) - fungsi murni
// (tanpa state) supaya hasil yang sama bisa dihitung ulang saat Enter
// ditekan sebelum hasil server datang.
//
// Query kosong: Menunggu approval Anda -> Terakhir dibuka -> Pencarian
// terakhir -> Aksi cepat.
// Ada query: Paling cocok (kode/part number persis) -> grup data & menu/aksi.
// Query yang mirip kode (ada angka atau "/") menaruh dokumen di atas menu;
// selain itu menu & aksi duluan, lalu barang/vendor/user, lalu dokumen.

import {
  ArrowRight,
  BaggageClaim,
  Boxes,
  Briefcase,
  ClipboardList,
  FileBox,
  FilePlus2,
  FileText,
  HandCoins,
  History,
  LogOut,
  type LucideIcon,
  PackagePlus,
  SquareUserRound,
  Ticket,
  Tickets,
  UserRound,
} from "lucide-react";
import { THEME_OPTIONS } from "@/components/theme-switcher";
import { scoreMenuItem } from "@/lib/sidebar/menu-search";
import type { NavGroup, NavProfile } from "@/lib/sidebar/nav-config";
import { formatCurrency } from "@/lib/utils";
import {
  type GlobalSearchKind,
  type GlobalSearchRow,
  normalizeQuery,
  type PendingRow,
  type RecentDoc,
  SEARCH_PER_GROUP,
} from "./use-global-search";

export type SearchAction =
  | { type: "theme"; value: string }
  | { type: "logout" };

export type SearchItem = {
  key: string;
  icon: LucideIcon;
  title: string;
  subtitle?: string | null;
  status?: string | null;
  /** Teks kecil di kanan (nama grup menu / nominal). */
  hint?: string | null;
  href?: string;
  action?: SearchAction;
  /** Riwayat pencarian: isi ulang kotak search (tidak pindah halaman). */
  fillQuery?: string;
  /** Disimpan ke "Terakhir dibuka" saat dibuka. */
  recent?: RecentDoc;
  /** Tautan "Lihat semua" - tampil lebih redup. */
  more?: boolean;
};

export type SearchSection = {
  id: string;
  label: string;
  items: SearchItem[];
  /** Grup riwayat: tampilkan tombol "Hapus". */
  clearable?: boolean;
};

const KIND_META: Record<
  GlobalSearchKind,
  {
    label: string;
    icon: LucideIcon;
    href: (row: { id: string; title: string; ref?: string | null }) => string;
  }
> = {
  mr: {
    label: "Material Request",
    icon: FileBox,
    href: (r) => `/material-request/${r.id}`,
  },
  po: {
    label: "Purchase Order",
    icon: BaggageClaim,
    href: (r) => `/purchase-order/${r.id}`,
  },
  pc_pengajuan: {
    label: "Pengajuan PC",
    icon: ClipboardList,
    href: (r) => `/petty-cash/pengajuan/${r.id}`,
  },
  pc_voucher: {
    label: "Voucher PC",
    icon: Ticket,
    href: (r) => `/petty-cash/voucher/${r.id}`,
  },
  pc_sub_voucher: {
    label: "Sub-Voucher PC",
    icon: Tickets,
    href: (r) => `/petty-cash/sub-voucher/${r.id}`,
  },
  pc_deklarasi: {
    label: "Deklarasi PC",
    icon: FileText,
    href: (r) => `/petty-cash/deklarasi/${r.id}`,
  },
  // Halaman Barang membuka detail dari ?id= (barang/BarangClient.tsx).
  barang: { label: "Barang", icon: Boxes, href: (r) => `/barang?id=${r.id}` },
  vendor: {
    label: "Vendor",
    icon: Briefcase,
    // Pakai kode (bukan nama): koma/kurung di nama merusak filter halaman Vendor.
    href: (r) => `/vendor?search=${encodeURIComponent(r.ref ?? r.title)}`,
  },
  user: {
    label: "User",
    icon: UserRound,
    href: (r) => `/user-management/${r.id}`,
  },
};

const PC_KINDS: GlobalSearchKind[] = [
  "pc_pengajuan",
  "pc_voucher",
  "pc_sub_voucher",
  "pc_deklarasi",
];

// `listHref` = halaman list yang membaca ?search= (untuk "Lihat semua").
const DATA_GROUPS: {
  id: string;
  label: string;
  kinds: GlobalSearchKind[];
  listHref?: (q: string) => string;
}[] = [
  {
    id: "mr",
    label: "Material Request",
    kinds: ["mr"],
    listHref: (q) => `/material-request?search=${encodeURIComponent(q)}`,
  },
  {
    id: "po",
    label: "Purchase Order",
    kinds: ["po"],
    listHref: (q) => `/purchase-order?search=${encodeURIComponent(q)}`,
  },
  { id: "pc", label: "Petty Cash", kinds: PC_KINDS },
  {
    id: "barang",
    label: "Barang",
    kinds: ["barang"],
    listHref: (q) => `/barang?search=${encodeURIComponent(q)}`,
  },
  {
    id: "vendor",
    label: "Vendor",
    kinds: ["vendor"],
    listHref: (q) => `/vendor?search=${encodeURIComponent(q)}`,
  },
  {
    id: "user",
    label: "User",
    kinds: ["user"],
    listHref: (q) => `/user-management?search=${encodeURIComponent(q)}`,
  },
];

type QuickAction = {
  id: string;
  title: string;
  icon: LucideIcon;
  keywords: string[];
  href?: string;
  action?: SearchAction;
  /** Ditampilkan juga saat query masih kosong. */
  featured?: boolean;
  visible?: (profile: NavProfile) => boolean;
};

const THEME_KEYWORDS: Record<string, string[]> = {
  light: ["terang", "light mode", "siang"],
  "soft-light": ["terang", "soft", "lembut"],
  dark: ["gelap", "dark mode", "malam"],
  "soft-dark": ["gelap", "soft", "lembut", "malam"],
  system: ["sistem", "otomatis", "auto", "default"],
};

const QUICK_ACTIONS: QuickAction[] = [
  {
    id: "buat-mr",
    title: "Buat Material Request",
    icon: FilePlus2,
    href: "/material-request/buat",
    keywords: ["buat mr", "mr baru", "tambah mr", "ajukan mr", "new mr", "create", "baru"],
    featured: true,
    // Sama dengan tombol "Buat Material Request" (MaterialRequestClient.tsx).
    visible: (p) => p?.role === "requester" || p?.role === "admin",
  },
  {
    id: "buat-po",
    title: "Buat Purchase Order",
    icon: PackagePlus,
    href: "/purchase-order/create",
    keywords: ["buat po", "po baru", "tambah po", "new po", "create", "baru"],
    featured: true,
    // Sama dengan canCreatePO (purchase-order/page.tsx).
    visible: (p) =>
      (p?.role === "approver" && p?.department === "Purchasing") ||
      p?.role === "admin",
  },
  {
    id: "ajukan-pc",
    title: "Ajukan Petty Cash",
    icon: HandCoins,
    href: "/petty-cash/input-pengajuan",
    keywords: ["pc", "kas kecil", "pengajuan pc", "pc baru", "buat pengajuan", "petty cash baru", "create", "baru"],
    featured: true,
  },
  {
    id: "profil",
    title: "Profil Saya",
    icon: SquareUserRound,
    href: "/profile",
    keywords: ["profil", "profile", "akun saya", "avatar", "foto profil"],
  },
  ...THEME_OPTIONS.map(
    (o): QuickAction => ({
      id: `tema-${o.value}`,
      title: `Tema: ${o.label}`,
      icon: o.icon,
      action: { type: "theme", value: o.value },
      keywords: ["tema", "theme", "mode", "tampilan", ...(THEME_KEYWORDS[o.value] ?? [])],
    }),
  ),
  {
    id: "logout",
    title: "Keluar (Logout)",
    icon: LogOut,
    action: { type: "logout" },
    keywords: ["logout", "log out", "sign out", "keluar", "keluar akun"],
  },
];

function actionToItem(a: QuickAction): SearchItem {
  return {
    key: `action:${a.id}`,
    icon: a.icon,
    title: a.title,
    href: a.href,
    action: a.action,
  };
}

function rowToItem(row: GlobalSearchRow | PendingRow): SearchItem {
  const meta = KIND_META[row.kind];
  const href = meta.href(row);
  const isPc = PC_KINDS.includes(row.kind);
  // Petty Cash campur 4 jenis dalam 1 grup -> sebutkan jenisnya.
  const subtitle = [isPc ? meta.label : null, row.subtitle]
    .filter(Boolean)
    .join(" · ");
  return {
    key: `${row.kind}:${row.id}`,
    icon: meta.icon,
    title: row.title,
    subtitle: subtitle || null,
    status: row.status,
    hint: row.amount != null ? formatCurrency(row.amount) : null,
    href,
    recent: {
      kind: row.kind,
      id: row.id,
      title: row.title,
      subtitle: subtitle || null,
      href,
    },
  };
}

function recentToItem(doc: RecentDoc): SearchItem {
  const meta = KIND_META[doc.kind];
  return {
    key: `recent:${doc.kind}:${doc.id}`,
    icon: meta?.icon ?? History,
    title: doc.title,
    subtitle: doc.subtitle,
    href: doc.href,
    recent: doc,
  };
}

// Skor scoreMenuItem: 15 = cuma cocok sebagai subsequence ("atk" ->
// "Tema: Soft Dark"). Di sidebar itu membantu, tapi di sini menyodok ke atas
// hasil data yang jauh lebih relevan - menu/aksi wajib cocok lebih kuat
// (salah ketik 1 huruf masih lolos, skornya 30).
const MIN_LOCAL_SCORE = 20;

function searchMenus(navGroups: NavGroup[], q: string, limit: number) {
  const seen = new Set<string>();
  return navGroups
    .flatMap((g) =>
      g.items.map((item) => ({
        item,
        group: g.label,
        score: scoreMenuItem(q, item, g.label),
      })),
    )
    .filter((r) => r.score >= MIN_LOCAL_SCORE)
    .sort((a, b) => b.score - a.score)
    .filter((r) => !seen.has(r.item.url) && !!seen.add(r.item.url))
    .slice(0, limit)
    .map(
      ({ item, group }): SearchItem => ({
        key: `menu:${item.url}`,
        icon: item.icon,
        title: item.title,
        hint: group,
        href: item.url,
      }),
    );
}

function visibleActions(profile: NavProfile, theme: string | undefined) {
  return QUICK_ACTIONS.filter(
    (a) =>
      (!a.visible || a.visible(profile)) &&
      // Tema yang sedang dipakai tidak perlu ditawarkan.
      !(a.action?.type === "theme" && a.action.value === theme),
  );
}

function searchActions(
  profile: NavProfile,
  theme: string | undefined,
  q: string,
  limit: number,
) {
  return visibleActions(profile, theme)
    .map((a) => ({
      a,
      score: scoreMenuItem(q, { title: a.title, url: `action:${a.id}`, keywords: a.keywords }),
    }))
    .filter((r) => r.score >= MIN_LOCAL_SCORE)
    .sort((x, y) => y.score - x.score)
    .slice(0, limit)
    .map((r) => actionToItem(r.a));
}

export function looksLikeCode(q: string) {
  return /\d/.test(q) || q.includes("/");
}

export type BuildSectionsInput = {
  query: string;
  navGroups: NavGroup[];
  profile: NavProfile;
  rows: GlobalSearchRow[];
  pending: PendingRow[];
  history: { docs: RecentDoc[]; queries: string[] };
  theme?: string;
};

export function buildSections(input: BuildSectionsInput): SearchSection[] {
  const { navGroups, profile, rows, pending, history, theme } = input;
  const q = normalizeQuery(input.query);

  if (!q) {
    const sections: SearchSection[] = [];
    if (pending.length > 0) {
      const menuUrls = new Set(
        navGroups.flatMap((g) => g.items.map((i) => i.url)),
      );
      const shownMrPo = pending.filter((r) => r.kind === "mr" || r.kind === "po").length;
      const shownPc = pending.length - shownMrPo;
      const items = pending.map(rowToItem);
      const moreMrPo = (pending[0].total_mr_po ?? 0) - shownMrPo;
      const morePc = (pending[0].total_pc ?? 0) - shownPc;
      if (moreMrPo > 0 && menuUrls.has("/approval-validation")) {
        items.push({
          key: "more:approval-validation",
          icon: ArrowRight,
          title: `Lihat ${moreMrPo} approval MR/PO lainnya`,
          href: "/approval-validation",
          more: true,
        });
      }
      if (morePc > 0 && menuUrls.has("/petty-cash/approval")) {
        items.push({
          key: "more:petty-cash-approval",
          icon: ArrowRight,
          title: `Lihat ${morePc} approval Petty Cash lainnya`,
          href: "/petty-cash/approval",
          more: true,
        });
      }
      sections.push({ id: "pending", label: "Menunggu approval Anda", items });
    }
    if (history.docs.length > 0) {
      sections.push({
        id: "recent-docs",
        label: "Terakhir dibuka",
        items: history.docs.map(recentToItem),
        clearable: true,
      });
    }
    if (history.queries.length > 0) {
      sections.push({
        id: "recent-queries",
        label: "Pencarian terakhir",
        items: history.queries.map((text) => ({
          key: `query:${text}`,
          icon: History,
          title: text,
          fillQuery: text,
        })),
        clearable: history.docs.length === 0,
      });
    }
    const featured = visibleActions(profile, theme).filter((a) => a.featured);
    if (featured.length > 0) {
      sections.push({
        id: "actions",
        label: "Aksi cepat",
        items: featured.map(actionToItem),
      });
    }
    return sections;
  }

  const exact = rows.filter((r) => r.exact);
  const exactSection: SearchSection[] =
    exact.length > 0
      ? [{ id: "exact", label: "Paling cocok", items: exact.map(rowToItem) }]
      : [];

  const dataSections = DATA_GROUPS.map((g): SearchSection => {
    const groupRows = rows.filter((r) => g.kinds.includes(r.kind));
    const items = groupRows.filter((r) => !r.exact).map(rowToItem);
    // Hasil penuh = kemungkinan masih ada lagi -> tawarkan halaman list.
    if (g.listHref && groupRows.length >= SEARCH_PER_GROUP) {
      items.push({
        key: `more:${g.id}`,
        icon: ArrowRight,
        title: `Lihat semua hasil ${g.label}`,
        href: g.listHref(q),
        more: true,
      });
    }
    return { id: g.id, label: g.label, items };
  });

  const menuSection: SearchSection = {
    id: "menu",
    label: "Menu",
    items: searchMenus(navGroups, q, 5),
  };
  const actionSection: SearchSection = {
    id: "actions",
    label: "Aksi",
    items: searchActions(profile, theme, q, 3),
  };

  const byId = (id: string) => dataSections.find((s) => s.id === id)!;
  const ordered = looksLikeCode(q)
    ? [...dataSections, menuSection, actionSection]
    : [
        menuSection,
        actionSection,
        byId("barang"),
        byId("vendor"),
        byId("user"),
        byId("mr"),
        byId("po"),
        byId("pc"),
      ];

  return [...exactSection, ...ordered].filter((s) => s.items.length > 0);
}
