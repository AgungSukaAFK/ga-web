// src/app/(With Sidebar)/notifications/page.tsx
//
// Daftar notifikasi user. Filter (status, modul, kategori) & pencarian
// dijalankan di query Supabase - bukan di data yang sudah dimuat - supaya
// hasilnya tetap lengkap walau notifikasinya ribuan. Data dimuat per
// PAGE_SIZE ("Muat lebih banyak"). Tandai dibaca lewat NotificationProvider
// supaya badge sidebar ikut sinkron.

"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { isToday, isYesterday, differenceInCalendarDays } from "date-fns";
import {
  AlertOctagon,
  Bell,
  BellRing,
  CheckCheck,
  CheckCircle2,
  FilePlus2,
  Info,
  Loader2,
  MailOpen,
  Mail,
  MessageSquare,
  Search,
  X,
} from "lucide-react";
import { toast } from "sonner";
import { createClient } from "@/lib/supabase/client";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { UserAvatar } from "@/components/user-avatar";
import { useNotification } from "@/components/providers/NotificationProvider";
import { cn, formatRelativeTime } from "@/lib/utils";
import { Notification, NotificationType } from "@/type";

const PAGE_SIZE = 30;

// ---------------- Kategori & modul ----------------

type CategoryKey =
  "mention" | "baru" | "disetujui" | "ditolak" | "followup" | "info";

const CATEGORIES: Record<
  CategoryKey,
  {
    label: string;
    types: NotificationType[];
    icon: React.ElementType;
    // Warna badge ikon kecil di pojok avatar.
    badge: string;
  }
> = {
  mention: {
    label: "Mention",
    types: ["mention"],
    icon: MessageSquare,
    badge: "bg-orange-500",
  },
  baru: {
    label: "Pengajuan Baru",
    types: [
      "mr_submitted",
      "mr_validated",
      "po_submitted",
      "po_validated",
      "pc_submitted",
      "pc_routed",
      "approval_mr",
      "approval_po",
    ],
    icon: FilePlus2,
    badge: "bg-blue-500",
  },
  disetujui: {
    label: "Disetujui",
    types: [
      "mr_approved_step",
      "mr_fully_approved",
      "po_approved_step",
      "po_fully_approved",
      "pc_approved_step",
      "pc_fully_approved",
    ],
    icon: CheckCircle2,
    badge: "bg-green-500",
  },
  ditolak: {
    label: "Ditolak / Ditahan",
    types: ["mr_rejected", "po_rejected", "pc_rejected", "mr_held"],
    icon: AlertOctagon,
    badge: "bg-red-500",
  },
  followup: {
    label: "Follow-up",
    types: ["mr_followup_requested", "po_followup_requested"],
    icon: BellRing,
    badge: "bg-amber-500",
  },
  info: {
    label: "Info",
    types: ["info"],
    icon: Info,
    badge: "bg-slate-500",
  },
};

const CATEGORY_KEYS = Object.keys(CATEGORIES) as CategoryKey[];

function categoryOf(type: NotificationType): CategoryKey {
  return (
    CATEGORY_KEYS.find((k) => CATEGORIES[k].types.includes(type)) ?? "info"
  );
}

type ModuleKey = "mr" | "po" | "pc";

const MODULES: Record<
  ModuleKey,
  { label: string; short: string; resourceType: string; typePrefix: string }
> = {
  mr: {
    label: "Material Request",
    short: "MR",
    resourceType: "material_request",
    typePrefix: "mr_",
  },
  po: {
    label: "Purchase Order",
    short: "PO",
    resourceType: "purchase_order",
    typePrefix: "po_",
  },
  pc: {
    label: "Petty Cash",
    short: "PC",
    resourceType: "petty_cash",
    typePrefix: "pc_",
  },
};

const ALL_TYPES = CATEGORY_KEYS.flatMap((k) => CATEGORIES[k].types);

function moduleOf(n: Notification): ModuleKey | null {
  for (const key of Object.keys(MODULES) as ModuleKey[]) {
    const m = MODULES[key];
    if (n.resource_type === m.resourceType || n.type.startsWith(m.typePrefix))
      return key;
  }
  if (n.type === "approval_mr") return "mr";
  if (n.type === "approval_po") return "po";
  return null;
}

// Kondisi PostgREST utk 1 modul: resource_type cocok ATAU tipe ber-prefix
// modul (notifikasi lama kadang resource_type-nya kosong).
function moduleCondition(key: ModuleKey) {
  const m = MODULES[key];
  const types = ALL_TYPES.filter(
    (t) =>
      t.startsWith(m.typePrefix) ||
      (key === "mr" && t === "approval_mr") ||
      (key === "po" && t === "approval_po"),
  );
  return `resource_type.eq.${m.resourceType},type.in.(${types.join(",")})`;
}

// Nilai pencarian dikutip utk sintaks filter PostgREST; karakter yang bisa
// merusak sintaks / jadi wildcard dibuang.
function searchCondition(q: string) {
  const clean = q.replace(/["\\%*()]/g, " ").trim();
  if (!clean) return null;
  return `title.ilike."%${clean}%",message.ilike."%${clean}%"`;
}

// ---------------- Pengelompokan tanggal ----------------

function dateGroupLabel(date: Date) {
  if (isToday(date)) return "Hari ini";
  if (isYesterday(date)) return "Kemarin";
  const diff = differenceInCalendarDays(new Date(), date);
  if (diff < 7) return "7 hari terakhir";
  if (diff < 30) return "30 hari terakhir";
  return "Lebih lama";
}

const formatFullDate = (d: string) =>
  new Intl.DateTimeFormat("id-ID", {
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(d));

// ---------------- Komponen ----------------

type StatusFilter = "all" | "unread";

export default function NotificationsPage() {
  const router = useRouter();
  const supabase = useMemo(() => createClient(), []);
  const {
    notifications: liveNotifications,
    markAsRead,
    markAllRead,
    refreshNotifications,
  } = useNotification();

  const [userId, setUserId] = useState<string | null>(null);
  const [items, setItems] = useState<Notification[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [hasMore, setHasMore] = useState(false);
  const [unreadTotal, setUnreadTotal] = useState(0);

  const [status, setStatus] = useState<StatusFilter>("all");
  const [moduleFilter, setModuleFilter] = useState<ModuleKey | "all">("all");
  const [category, setCategory] = useState<CategoryKey | "all">("all");
  const [searchInput, setSearchInput] = useState("");
  const [search, setSearch] = useState("");

  // Abaikan respons query lama kalau filter sudah berubah lagi.
  const requestId = useRef(0);

  useEffect(() => {
    supabase.auth
      .getUser()
      .then(({ data }) => setUserId(data.user?.id ?? null));
  }, [supabase]);

  // Debounce pencarian.
  useEffect(() => {
    const t = setTimeout(() => setSearch(searchInput.trim()), 300);
    return () => clearTimeout(t);
  }, [searchInput]);

  const fetchUnreadTotal = useCallback(async () => {
    if (!userId) return;
    const { count } = await supabase
      .from("notifications")
      .select("id", { count: "exact", head: true })
      .eq("user_id", userId)
      .eq("is_read", false);
    setUnreadTotal(count ?? 0);
  }, [supabase, userId]);

  const fetchPage = useCallback(
    async (offset: number) => {
      if (!userId) return;
      const id = ++requestId.current;
      if (offset === 0) setLoading(true);
      else setLoadingMore(true);

      let query = supabase
        .from("notifications")
        .select("*, actor:profiles!actor_id(nama, avatar_url)")
        .eq("user_id", userId)
        .order("created_at", { ascending: false })
        .range(offset, offset + PAGE_SIZE); // +1 baris utk cek hasMore

      if (status === "unread") query = query.eq("is_read", false);
      if (category !== "all")
        query = query.in("type", CATEGORIES[category].types);

      // Modul & pencarian sama-sama OR-group; digabung dlm satu `or` berisi
      // `and(...)` supaya keduanya tetap AND satu sama lain.
      const groups = [
        moduleFilter !== "all" ? moduleCondition(moduleFilter) : null,
        search ? searchCondition(search) : null,
      ].filter(Boolean) as string[];
      if (groups.length === 1) query = query.or(groups[0]);
      if (groups.length === 2)
        query = query.or(`and(or(${groups[0]}),or(${groups[1]}))`);

      const { data, error } = await query;
      if (id !== requestId.current) return;

      if (error) {
        toast.error("Gagal memuat notifikasi", { description: error.message });
      } else {
        const rows = (data ?? []).map((item: any) => ({
          ...item,
          actor_name: item.actor?.nama || null,
          actor_avatar: item.actor?.avatar_url || null,
        })) as Notification[];
        setHasMore(rows.length > PAGE_SIZE);
        const page = rows.slice(0, PAGE_SIZE);
        setItems((prev) => (offset === 0 ? page : [...prev, ...page]));
      }
      setLoading(false);
      setLoadingMore(false);
    },
    [supabase, userId, status, category, moduleFilter, search],
  );

  useEffect(() => {
    fetchPage(0);
  }, [fetchPage]);

  useEffect(() => {
    fetchUnreadTotal();
  }, [fetchUnreadTotal]);

  // Notifikasi baru masuk (realtime lewat provider) -> muat ulang halaman
  // pertama supaya langsung muncul di atas.
  const latestLiveId = liveNotifications[0]?.id;
  const seenLiveId = useRef<string | undefined>(undefined);
  useEffect(() => {
    if (!latestLiveId) return;
    if (seenLiveId.current && seenLiveId.current !== latestLiveId) {
      fetchPage(0);
      fetchUnreadTotal();
    }
    seenLiveId.current = latestLiveId;
  }, [latestLiveId, fetchPage, fetchUnreadTotal]);

  const setReadLocal = (id: string, isRead: boolean) => {
    setItems((prev) =>
      prev.map((n) => (n.id === id ? { ...n, is_read: isRead } : n)),
    );
    setUnreadTotal((c) => Math.max(0, c + (isRead ? -1 : 1)));
  };

  const handleOpen = (notif: Notification) => {
    if (!notif.is_read) {
      setReadLocal(notif.id, true);
      markAsRead(notif.id);
    }
    if (notif.link) router.push(notif.link);
  };

  const handleToggleRead = async (notif: Notification) => {
    const next = !notif.is_read;
    setReadLocal(notif.id, next);
    if (next) {
      await markAsRead(notif.id);
    } else {
      const { error } = await supabase
        .from("notifications")
        .update({ is_read: false })
        .eq("id", notif.id);
      if (error) {
        setReadLocal(notif.id, true);
        toast.error("Gagal menandai belum dibaca");
        return;
      }
      refreshNotifications();
    }
  };

  const handleMarkAllRead = async () => {
    setItems((prev) => prev.map((n) => ({ ...n, is_read: true })));
    setUnreadTotal(0);
    try {
      await markAllRead();
      toast.success("Semua notifikasi ditandai sudah dibaca");
      if (status === "unread") fetchPage(0);
    } catch {
      toast.error("Gagal memproses permintaan");
      fetchPage(0);
      fetchUnreadTotal();
    }
  };

  const hasActiveFilter =
    status !== "all" ||
    moduleFilter !== "all" ||
    category !== "all" ||
    search !== "";

  const resetFilters = () => {
    setStatus("all");
    setModuleFilter("all");
    setCategory("all");
    setSearchInput("");
    setSearch("");
  };

  // Kelompokkan per rentang tanggal (list sudah urut terbaru dulu).
  const groups = useMemo(() => {
    const result: { label: string; items: Notification[] }[] = [];
    for (const n of items) {
      const label = dateGroupLabel(new Date(n.created_at));
      const last = result[result.length - 1];
      if (last?.label === label) last.items.push(n);
      else result.push({ label, items: [n] });
    }
    return result;
  }, [items]);

  return (
    <Card className="col-span-12 gap-0 overflow-clip py-0 xl:col-span-10 xl:col-start-2">
      {/* Header + toolbar */}
      <div className="space-y-3 border-b p-4 sm:p-5">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <h1 className="text-xl font-bold tracking-tight sm:text-2xl">
              Notifikasi
            </h1>
            {unreadTotal > 0 && (
              <span className="rounded-full bg-primary px-2 py-0.5 text-xs font-semibold text-primary-foreground">
                {unreadTotal} baru
              </span>
            )}
          </div>
          {unreadTotal > 0 && (
            <Button variant="outline" size="sm" onClick={handleMarkAllRead}>
              <CheckCheck className="h-4 w-4" />
              <span className="hidden sm:inline">Tandai semua dibaca</span>
              <span className="sm:hidden">Baca semua</span>
            </Button>
          )}
        </div>

        <div className="flex flex-col gap-2 sm:flex-row">
          <div className="relative flex-1">
            <Search className="pointer-events-none absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={searchInput}
              onChange={(e) => setSearchInput(e.target.value)}
              placeholder="Cari judul atau isi notifikasi, mis. kode MR/PO..."
              className="pl-8 pr-8"
              aria-label="Cari notifikasi"
            />
            {searchInput && (
              <button
                type="button"
                onClick={() => setSearchInput("")}
                className="absolute right-2 top-1/2 -translate-y-1/2 rounded p-0.5 text-muted-foreground hover:text-foreground"
                aria-label="Hapus pencarian"
              >
                <X className="h-4 w-4" />
              </button>
            )}
          </div>
          <div className="flex gap-2">
            <div
              role="radiogroup"
              aria-label="Status baca"
              className="flex shrink-0 rounded-md border p-0.5"
            >
              {(
                [
                  ["all", "Semua"],
                  ["unread", "Belum dibaca"],
                ] as const
              ).map(([key, label]) => (
                <button
                  key={key}
                  type="button"
                  role="radio"
                  aria-checked={status === key}
                  onClick={() => setStatus(key)}
                  className={cn(
                    "rounded px-2.5 py-1 text-xs font-medium transition-colors sm:text-sm",
                    status === key
                      ? "bg-primary text-primary-foreground shadow-sm"
                      : "text-muted-foreground hover:text-foreground",
                  )}
                >
                  {label}
                </button>
              ))}
            </div>
            <Select
              value={moduleFilter}
              onValueChange={(v) => setModuleFilter(v as ModuleKey | "all")}
            >
              <SelectTrigger
                className="min-w-0 flex-1 sm:w-44 sm:flex-none"
                aria-label="Filter modul"
              >
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Semua modul</SelectItem>
                {(Object.keys(MODULES) as ModuleKey[]).map((key) => (
                  <SelectItem key={key} value={key}>
                    {MODULES[key].label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>

        {/* Chip kategori - scroll horizontal di HP */}
        <div className="-mx-4 flex gap-1.5 overflow-x-auto px-4 pb-0.5 [scrollbar-width:none] sm:-mx-5 sm:px-5">
          <CategoryChip
            active={category === "all"}
            onClick={() => setCategory("all")}
          >
            Semua
          </CategoryChip>
          {CATEGORY_KEYS.map((key) => {
            const { label, icon: Icon, badge } = CATEGORIES[key];
            return (
              <CategoryChip
                key={key}
                active={category === key}
                onClick={() => setCategory(key)}
              >
                <span
                  className={cn(
                    "flex h-4 w-4 items-center justify-center rounded-full text-white",
                    badge,
                  )}
                >
                  <Icon className="h-2.5 w-2.5" />
                </span>
                {label}
              </CategoryChip>
            );
          })}
        </div>
      </div>

      {/* Daftar */}
      {loading ? (
        <div className="divide-y">
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="flex gap-3 px-4 py-3 sm:px-5">
              <Skeleton className="h-9 w-9 shrink-0 rounded-full" />
              <div className="flex-1 space-y-2">
                <Skeleton className="h-4 w-2/3" />
                <Skeleton className="h-3 w-full" />
              </div>
            </div>
          ))}
        </div>
      ) : items.length === 0 ? (
        <div className="flex flex-col items-center justify-center px-4 py-16 text-center text-muted-foreground">
          <Bell className="mb-3 h-10 w-10 opacity-20" />
          {hasActiveFilter ? (
            <>
              <p className="font-medium">Tidak ada notifikasi yang cocok.</p>
              <Button
                variant="link"
                size="sm"
                onClick={resetFilters}
                className="mt-1"
              >
                Reset filter
              </Button>
            </>
          ) : (
            <>
              <p className="font-medium">Tidak ada notifikasi.</p>
              <p className="mt-1 text-sm">
                Anda akan mendapat notifikasi saat ada aktivitas baru.
              </p>
            </>
          )}
        </div>
      ) : (
        <div>
          {groups.map((group) => (
            <section key={group.label}>
              <h2 className="sticky top-0 z-10 border-b bg-muted/80 px-4 py-1.5 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground backdrop-blur sm:px-5">
                {group.label}
              </h2>
              <ul className="divide-y">
                {group.items.map((notif) => (
                  <NotificationRow
                    key={notif.id}
                    notif={notif}
                    onOpen={() => handleOpen(notif)}
                    onToggleRead={() => handleToggleRead(notif)}
                  />
                ))}
              </ul>
            </section>
          ))}
          {hasMore && (
            <div className="border-t p-3 text-center">
              <Button
                variant="ghost"
                size="sm"
                onClick={() => fetchPage(items.length)}
                disabled={loadingMore}
              >
                {loadingMore && <Loader2 className="h-4 w-4 animate-spin" />}
                Muat lebih banyak
              </Button>
            </div>
          )}
        </div>
      )}
    </Card>
  );
}

function CategoryChip({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className={cn(
        "flex shrink-0 items-center gap-1.5 whitespace-nowrap rounded-full border px-3 py-1 text-xs font-medium transition-colors",
        active
          ? "border-primary bg-primary/10 text-primary"
          : "text-muted-foreground hover:bg-muted hover:text-foreground",
      )}
    >
      {children}
    </button>
  );
}

function NotificationRow({
  notif,
  onOpen,
  onToggleRead,
}: {
  notif: Notification;
  onOpen: () => void;
  onToggleRead: () => void;
}) {
  const cat = CATEGORIES[categoryOf(notif.type)];
  const CatIcon = cat.icon;
  const mod = moduleOf(notif);
  const unread = !notif.is_read;

  return (
    <li
      className={cn(
        "group relative flex items-start gap-3 px-4 py-3 transition-colors hover:bg-muted/50 sm:px-5",
        unread && "bg-primary/[0.04]",
      )}
    >
      {/* Penanda belum dibaca */}
      {unread && (
        <span className="absolute inset-y-0 left-0 w-0.5 bg-primary" />
      )}

      {/* Avatar pelaku + ikon kategori. Notifikasi sistem -> ikon saja. */}
      <div className="relative mt-0.5 shrink-0">
        {notif.actor_id && notif.actor_name ? (
          <UserAvatar
            userId={notif.actor_id}
            name={notif.actor_name}
            src={notif.actor_avatar ?? null}
            className="h-9 w-9"
            fallbackClassName="text-xs"
          />
        ) : (
          <div
            className={cn(
              "flex h-9 w-9 items-center justify-center rounded-full text-white",
              cat.badge,
            )}
          >
            <CatIcon className="h-4 w-4" />
          </div>
        )}
        {notif.actor_id && notif.actor_name && (
          <span
            className={cn(
              "absolute -bottom-0.5 -right-0.5 flex h-4 w-4 items-center justify-center rounded-full text-white ring-2 ring-card",
              cat.badge,
            )}
            title={cat.label}
          >
            <CatIcon className="h-2.5 w-2.5" />
          </span>
        )}
      </div>

      {/* Isi - seluruh area bisa diklik utk membuka link */}
      <button
        type="button"
        onClick={onOpen}
        className="min-w-0 flex-1 text-left outline-none after:absolute after:inset-0 focus-visible:after:ring-2 focus-visible:after:ring-inset focus-visible:after:ring-ring"
      >
        <div className="flex items-baseline gap-2">
          <p
            className={cn(
              "min-w-0 flex-1 truncate text-sm",
              unread ? "font-semibold" : "font-medium text-foreground/90",
            )}
          >
            {notif.title}
          </p>
          <time
            dateTime={notif.created_at}
            title={formatFullDate(notif.created_at)}
            className={cn(
              "shrink-0 text-[11px]",
              unread ? "font-medium text-primary" : "text-muted-foreground",
            )}
          >
            {formatRelativeTime(notif.created_at)}
          </time>
        </div>
        <p className="mt-0.5 line-clamp-2 text-xs leading-relaxed text-muted-foreground sm:line-clamp-1 sm:text-[13px]">
          {notif.message}
        </p>
        <div className="mt-1 flex flex-wrap items-center gap-x-1.5 gap-y-0.5 text-[11px] text-muted-foreground">
          {notif.actor_name && (
            <span className="font-medium text-foreground/80">
              {notif.actor_name}
            </span>
          )}
          {notif.actor_name && <span aria-hidden>·</span>}
          <span>{cat.label}</span>
          {mod && (
            <span className="rounded border px-1 py-px text-[10px] font-semibold leading-none">
              {MODULES[mod].short}
            </span>
          )}
        </div>
      </button>

      {/* Aksi cepat - di atas overlay klik baris */}
      <button
        type="button"
        onClick={onToggleRead}
        title={unread ? "Tandai sudah dibaca" : "Tandai belum dibaca"}
        aria-label={unread ? "Tandai sudah dibaca" : "Tandai belum dibaca"}
        className="relative z-[1] -mr-1 mt-0.5 shrink-0 rounded-md p-1.5 text-muted-foreground transition-opacity hover:bg-muted hover:text-foreground focus-visible:opacity-100 sm:opacity-0 sm:group-hover:opacity-100"
      >
        {unread ? (
          <MailOpen className="h-4 w-4" />
        ) : (
          <Mail className="h-4 w-4" />
        )}
      </button>
    </li>
  );
}
