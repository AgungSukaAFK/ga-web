// components/budget-history-dialog.tsx
//
// Dialog "Riwayat Budget" bersama untuk Cost Center (MR/PO,
// app/(With Sidebar)/cost-center-management/CostCenterClient.tsx) &
// Budgeting Petty Cash (app/(With Sidebar)/petty-cash/budgeting/
// PettyCashBudgetingClient.tsx). Tabel riwayatnya beda bentuk
// (cost_center_history vs petty_cash_budget_history), jadi tiap halaman
// memetakan barisnya dulu ke BudgetHistoryEntry lewat `load`, lalu dialog
// ini yang mengurus ringkasan, filter, urutan, paginasi, & export Excel -
// semuanya client-side di atas seluruh riwayat satu budget.

"use client";

import {
  type ReactNode,
  useDeferredValue,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import Link from "next/link";
import {
  ArrowDownLeft,
  ArrowUpRight,
  ChevronLeft,
  ChevronRight,
  Download,
  History,
  Loader2,
  Search,
} from "lucide-react";
import { toast } from "@/lib/toast";

import { cn, formatCurrency } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  ActiveFilter,
  FilterPanel,
  formatFilterDate,
  formatFilterRange,
} from "@/components/filter-panel";

export type BudgetHistoryKind =
  | "initial"
  | "topup"
  | "reduction"
  | "adjustment"
  | "deduction"
  | "correction"
  | "refund"
  | "pengembalian"
  | "status";

export const BUDGET_HISTORY_KINDS: Record<
  BudgetHistoryKind,
  { label: string; className: string }
> = {
  initial: {
    label: "Budget Awal",
    className: "border-blue-500/30 bg-blue-500/10 text-blue-700 dark:text-blue-300",
  },
  topup: {
    label: "Top-up",
    className:
      "border-emerald-500/30 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300",
  },
  reduction: {
    label: "Pengurangan",
    className:
      "border-amber-500/30 bg-amber-500/10 text-amber-700 dark:text-amber-300",
  },
  adjustment: {
    label: "Penyesuaian",
    className:
      "border-slate-500/30 bg-slate-500/10 text-slate-700 dark:text-slate-300",
  },
  deduction: {
    label: "Pemakaian",
    className: "border-rose-500/30 bg-rose-500/10 text-rose-700 dark:text-rose-300",
  },
  correction: {
    label: "Koreksi Pemakaian",
    className:
      "border-orange-500/30 bg-orange-500/10 text-orange-700 dark:text-orange-300",
  },
  refund: {
    label: "Refund",
    className: "border-teal-500/30 bg-teal-500/10 text-teal-700 dark:text-teal-300",
  },
  pengembalian: {
    label: "Pengembalian Dana",
    className: "border-cyan-500/30 bg-cyan-500/10 text-cyan-700 dark:text-cyan-300",
  },
  status: {
    label: "Status Aktif",
    className: "border-zinc-500/30 bg-zinc-500/10 text-zinc-700 dark:text-zinc-300",
  },
};

export interface BudgetHistoryEntry {
  id: number;
  createdAt: string | Date;
  kind: BudgetHistoryKind;
  description: string;
  /** null = dicatat sistem (tanpa user). */
  actor: { name: string; department?: string | null } | null;
  /** Keterangan peran pelaku di baris ini, mis. "Pembuat MR". */
  actorNote?: string;
  /** Dokumen terkait (MR / Sub-Voucher), tanpa `href` kalau sudah dihapus. */
  reference?: { label: string; href?: string; detail?: string } | null;
  change: number;
  before: number;
  after: number;
}

const PAGE_SIZE = 50;
const SYSTEM_ACTOR = "__system__";

type Direction = "all" | "in" | "out";
type SortKey = "newest" | "oldest" | "largest";

type Filters = {
  search: string;
  kind: BudgetHistoryKind | "all";
  direction: Direction;
  actor: string;
  from: string;
  to: string;
};

const EMPTY_FILTERS: Filters = {
  search: "",
  kind: "all",
  direction: "all",
  actor: "all",
  from: "",
  to: "",
};

const DIRECTION_LABELS: Record<Direction, string> = {
  all: "Semua",
  in: "Dana masuk (+)",
  out: "Dana keluar (−)",
};

const SORT_LABELS: Record<SortKey, string> = {
  newest: "Terbaru dulu",
  oldest: "Terlama dulu",
  largest: "Nominal terbesar",
};

// Semua tanggal dibaca di zona WIB (sama dengan formatDateWithTime,
// lib/utils.ts) supaya filter tanggal & tampilan tidak geser hari.
const TIME_ZONE = "Asia/Jakarta";
const dayKeyFormat = new Intl.DateTimeFormat("en-CA", {
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
  timeZone: TIME_ZONE,
});
const dateFormat = new Intl.DateTimeFormat("id-ID", {
  day: "2-digit",
  month: "short",
  year: "numeric",
  timeZone: TIME_ZONE,
});
const timeFormat = new Intl.DateTimeFormat("id-ID", {
  hour: "2-digit",
  minute: "2-digit",
  timeZone: TIME_ZONE,
});

/** "2026-10-23" (WIB) - bisa dibandingkan langsung sebagai string. */
const toDayKey = (date: string | Date) => dayKeyFormat.format(new Date(date));

const actorKey = (e: BudgetHistoryEntry) => e.actor?.name || SYSTEM_ACTOR;

const formatSigned = (value: number) => {
  if (value === 0) return formatCurrency(0);
  return `${value > 0 ? "+" : "−"}${formatCurrency(Math.abs(value))}`;
};

const DATE_PRESETS: { label: string; range: () => [string, string] }[] = [
  {
    label: "7 hari",
    range: () => [
      toDayKey(new Date(Date.now() - 6 * 86_400_000)),
      toDayKey(new Date()),
    ],
  },
  {
    label: "30 hari",
    range: () => [
      toDayKey(new Date(Date.now() - 29 * 86_400_000)),
      toDayKey(new Date()),
    ],
  },
  {
    label: "Bulan ini",
    range: () => {
      const today = toDayKey(new Date());
      return [`${today.slice(0, 8)}01`, today];
    },
  },
  {
    label: "Tahun ini",
    range: () => {
      const today = toDayKey(new Date());
      return [`${today.slice(0, 5)}01-01`, today];
    },
  },
];

function KindBadge({ kind }: { kind: BudgetHistoryKind }) {
  const meta = BUDGET_HISTORY_KINDS[kind];
  return (
    <Badge
      variant="outline"
      className={cn("whitespace-nowrap font-medium shadow-none", meta.className)}
    >
      {meta.label}
    </Badge>
  );
}

function ChangeAmount({ value, className }: { value: number; className?: string }) {
  return (
    <span
      className={cn(
        "font-semibold tabular-nums",
        value > 0 && "text-green-600 dark:text-green-400",
        value < 0 && "text-red-600 dark:text-red-400",
        value === 0 && "text-muted-foreground font-normal",
        className,
      )}
    >
      {value === 0 ? "—" : formatSigned(value)}
    </span>
  );
}

function ActorCell({ entry }: { entry: BudgetHistoryEntry }) {
  if (!entry.actor) {
    return <span className="text-muted-foreground italic">Sistem</span>;
  }
  const sub = [entry.actor.department, entry.actorNote]
    .filter(Boolean)
    .join(" · ");
  return (
    <div className="min-w-0">
      <div className="font-medium leading-tight">{entry.actor.name}</div>
      {sub && (
        <div className="text-xs text-muted-foreground leading-tight mt-0.5">
          {sub}
        </div>
      )}
    </div>
  );
}

function ReferenceCell({ entry }: { entry: BudgetHistoryEntry }) {
  const ref = entry.reference;
  if (!ref) return <span className="text-muted-foreground">-</span>;
  return (
    <div className="min-w-0">
      {ref.href ? (
        <Link
          href={ref.href}
          target="_blank"
          className="font-medium text-primary underline-offset-4 hover:underline"
        >
          {ref.label}
        </Link>
      ) : (
        <span className="font-medium">{ref.label}</span>
      )}
      {ref.detail && (
        <div className="text-xs text-muted-foreground leading-tight mt-0.5">
          {ref.detail}
        </div>
      )}
    </div>
  );
}

function StatTile({
  label,
  value,
  hint,
  tone,
  icon,
  children,
  className,
}: {
  label: string;
  value: string;
  hint?: string;
  tone?: "positive" | "negative";
  icon?: ReactNode;
  children?: ReactNode;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "min-w-0 rounded-lg border bg-muted/40 px-3 py-2.5 dark:bg-muted/10",
        className,
      )}
    >
      <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
        {icon}
        {label}
      </div>
      <div
        className={cn(
          "mt-0.5 truncate text-base font-semibold tabular-nums sm:text-lg",
          tone === "positive" && "text-green-600 dark:text-green-400",
          tone === "negative" && "text-red-600 dark:text-red-400",
        )}
        title={value}
      >
        {value}
      </div>
      {hint && (
        <div className="truncate text-xs text-muted-foreground" title={hint}>
          {hint}
        </div>
      )}
      {children}
    </div>
  );
}

export function BudgetHistoryDialog({
  open,
  onOpenChange,
  name,
  sourceKey,
  load,
  meta = [],
  isActive,
  initialBudget,
  currentBudget,
  exportFileName,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  name?: string;
  /** Id budget/cost center - riwayat dimuat ulang tiap dialog dibuka. */
  sourceKey: number | null;
  load: () => Promise<BudgetHistoryEntry[]>;
  /** Info singkat di bawah judul, mis. Kode / Departemen / Perusahaan. */
  meta?: { label: string; value?: string | null }[];
  isActive?: boolean;
  initialBudget?: number;
  currentBudget?: number;
  /** Tanpa ekstensi - tanggal & ".xlsx" ditambahkan otomatis. */
  exportFileName: string;
}) {
  const [entries, setEntries] = useState<BudgetHistoryEntry[]>([]);
  const [loading, setLoading] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [filters, setFilters] = useState<Filters>(EMPTY_FILTERS);
  const [sort, setSort] = useState<SortKey>("newest");
  const [page, setPage] = useState(1);
  const deferredSearch = useDeferredValue(filters.search);

  // `load` biasanya closure baru tiap render parent - simpan di ref supaya
  // riwayat cuma dimuat saat dialog dibuka / budget-nya ganti.
  const loadRef = useRef(load);
  useEffect(() => {
    loadRef.current = load;
  });

  useEffect(() => {
    if (!open || sourceKey == null) return;
    let cancelled = false;
    setLoading(true);
    setEntries([]);
    setFilters(EMPTY_FILTERS);
    setSort("newest");
    setPage(1);
    loadRef
      .current()
      .then((rows) => {
        if (!cancelled) setEntries(rows);
      })
      .catch((err) => {
        if (!cancelled)
          toast.error("Gagal memuat riwayat", { description: err.message });
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [open, sourceKey]);

  const updateFilter = <K extends keyof Filters>(key: K, value: Filters[K]) => {
    setFilters((prev) => ({ ...prev, [key]: value }));
    setPage(1);
  };

  // Teks pencarian & kunci hari dihitung sekali per baris, bukan per ketikan.
  const indexed = useMemo(
    () =>
      entries.map((e) => ({
        entry: e,
        day: toDayKey(e.createdAt),
        time: new Date(e.createdAt).getTime(),
        text: [
          e.description,
          e.reference?.label,
          e.reference?.detail,
          e.actor?.name ?? "Sistem",
          e.actor?.department,
          BUDGET_HISTORY_KINDS[e.kind].label,
        ]
          .filter(Boolean)
          .join(" ")
          .toLowerCase(),
      })),
    [entries],
  );

  const kindOptions = useMemo(
    () =>
      (Object.keys(BUDGET_HISTORY_KINDS) as BudgetHistoryKind[]).filter((k) =>
        entries.some((e) => e.kind === k),
      ),
    [entries],
  );

  const actorOptions = useMemo(() => {
    const counts = new Map<string, number>();
    entries.forEach((e) => {
      const key = actorKey(e);
      counts.set(key, (counts.get(key) ?? 0) + 1);
    });
    return [...counts.entries()]
      .map(([key, count]) => ({
        key,
        label: key === SYSTEM_ACTOR ? "Sistem" : key,
        count,
      }))
      .sort((a, b) => a.label.localeCompare(b.label, "id"));
  }, [entries]);

  const filtered = useMemo(() => {
    const q = deferredSearch.trim().toLowerCase();
    const rows = indexed.filter(({ entry: e, day, text }) => {
      if (filters.kind !== "all" && e.kind !== filters.kind) return false;
      if (filters.direction === "in" && !(e.change > 0)) return false;
      if (filters.direction === "out" && !(e.change < 0)) return false;
      if (filters.actor !== "all" && actorKey(e) !== filters.actor) return false;
      if (filters.from && day < filters.from) return false;
      if (filters.to && day > filters.to) return false;
      if (q && !text.includes(q)) return false;
      return true;
    });
    rows.sort((a, b) => {
      if (sort === "largest") {
        const diff = Math.abs(b.entry.change) - Math.abs(a.entry.change);
        if (diff !== 0) return diff;
      }
      const byTime =
        sort === "oldest" ? a.time - b.time : b.time - a.time;
      if (byTime !== 0) return byTime;
      return sort === "oldest"
        ? a.entry.id - b.entry.id
        : b.entry.id - a.entry.id;
    });
    return rows.map((r) => r.entry);
  }, [indexed, filters, deferredSearch, sort]);

  const stats = useMemo(() => {
    let inSum = 0;
    let outSum = 0;
    let inCount = 0;
    let outCount = 0;
    filtered.forEach((e) => {
      if (e.change > 0) {
        inSum += e.change;
        inCount++;
      } else if (e.change < 0) {
        outSum -= e.change;
        outCount++;
      }
    });
    return { inSum, outSum, inCount, outCount, net: inSum - outSum };
  }, [filtered]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const safePage = Math.min(page, totalPages);
  const pageRows = filtered.slice(
    (safePage - 1) * PAGE_SIZE,
    safePage * PAGE_SIZE,
  );

  const activeFilters: ActiveFilter[] = [];
  if (filters.search.trim())
    activeFilters.push({
      key: "search",
      label: "Cari",
      value: filters.search.trim(),
      onRemove: () => updateFilter("search", ""),
    });
  if (filters.kind !== "all")
    activeFilters.push({
      key: "kind",
      label: "Jenis",
      value: BUDGET_HISTORY_KINDS[filters.kind].label,
      onRemove: () => updateFilter("kind", "all"),
    });
  if (filters.direction !== "all")
    activeFilters.push({
      key: "direction",
      label: "Arah",
      value: DIRECTION_LABELS[filters.direction],
      onRemove: () => updateFilter("direction", "all"),
    });
  if (filters.actor !== "all")
    activeFilters.push({
      key: "actor",
      label: "Oleh",
      value: filters.actor === SYSTEM_ACTOR ? "Sistem" : filters.actor,
      onRemove: () => updateFilter("actor", "all"),
    });
  if (filters.from || filters.to)
    activeFilters.push({
      key: "date",
      label: "Tanggal",
      value: formatFilterRange(filters.from, filters.to, formatFilterDate),
      onRemove: () => {
        setFilters((prev) => ({ ...prev, from: "", to: "" }));
        setPage(1);
      },
    });
  const isFiltered = activeFilters.length > 0;

  const resetFilters = () => {
    setFilters(EMPTY_FILTERS);
    setPage(1);
  };

  const remainingPct =
    initialBudget && initialBudget > 0 && currentBudget !== undefined
      ? Math.round((currentBudget / initialBudget) * 100)
      : null;

  const handleExport = async () => {
    if (filtered.length === 0) return;
    setExporting(true);
    try {
      const { exportStyledExcel } = await import("@/lib/excel-export");
      await exportStyledExcel(
        filtered.map((e) => ({
          Tanggal: toDayKey(e.createdAt),
          Jam: timeFormat.format(new Date(e.createdAt)),
          Jenis: BUDGET_HISTORY_KINDS[e.kind].label,
          Deskripsi: e.description,
          Referensi: e.reference?.label ?? "",
          "Detail Referensi": e.reference?.detail ?? "",
          Oleh: e.actor?.name ?? "Sistem",
          "Departemen Pelaku": e.actor?.department ?? "",
          Keterangan: e.actorNote ?? "",
          "Budget Sebelum": e.before,
          Perubahan: e.change,
          "Budget Sesudah": e.after,
        })),
        `${exportFileName}_${toDayKey(new Date())}.xlsx`,
        "Riwayat Budget",
      );
      toast.success("Riwayat budget berhasil diunduh");
    } catch (err: any) {
      toast.error("Gagal mengunduh riwayat", { description: err.message });
    } finally {
      setExporting(false);
    }
  };

  const metaItems = meta.filter((m) => m.value);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      {/* Tinggi tetap di desktop supaya dialog tidak "loncat" saat filter
          diganti; tabel mengisi sisa ruang (min 360px - kalau layar pendek &
          panel filter terbuka, dialognya sendiri yang scroll). */}
      <DialogContent className="flex flex-col gap-4 sm:max-w-[min(1440px,96vw)] lg:h-[min(92dvh,980px)]">
        <DialogHeader className="shrink-0 pr-8">
          <DialogTitle className="flex flex-wrap items-center gap-2">
            <History className="h-5 w-5 text-muted-foreground" />
            <span>Riwayat Budget: {name}</span>
            {isActive !== undefined && (
              <Badge
                variant={isActive ? "default" : "secondary"}
                className="shadow-none"
              >
                {isActive ? "Aktif" : "Nonaktif"}
              </Badge>
            )}
          </DialogTitle>
          {metaItems.length > 0 && (
            <DialogDescription asChild>
              <div className="flex flex-wrap gap-x-4 gap-y-1 text-sm">
                {metaItems.map((m) => (
                  <span key={m.label}>
                    {m.label}:{" "}
                    <span className="font-medium text-foreground">{m.value}</span>
                  </span>
                ))}
              </div>
            </DialogDescription>
          )}
        </DialogHeader>

        {/* Ringkasan - Sisa Budget = kondisi sekarang, sisanya ikut filter */}
        <div className="grid shrink-0 grid-cols-2 gap-2 lg:grid-cols-5">
          <StatTile
            label="Sisa Budget Saat Ini"
            value={formatCurrency(currentBudget ?? 0)}
            hint={
              remainingPct !== null
                ? `${remainingPct}% dari budget awal ${formatCurrency(initialBudget)}`
                : undefined
            }
          >
            {remainingPct !== null && (
              <div className="mt-1.5 h-1.5 overflow-hidden rounded-full bg-muted">
                <div
                  className={cn(
                    "h-full rounded-full",
                    remainingPct <= 20
                      ? "bg-destructive"
                      : remainingPct <= 50
                        ? "bg-amber-500"
                        : "bg-green-600",
                  )}
                  style={{
                    width: `${Math.min(Math.max(remainingPct, 0), 100)}%`,
                  }}
                />
              </div>
            )}
          </StatTile>
          <StatTile
            label="Jumlah Transaksi"
            value={filtered.length.toLocaleString("id-ID")}
            hint={
              isFiltered
                ? `dari ${entries.length.toLocaleString("id-ID")} total riwayat`
                : "seluruh riwayat"
            }
          />
          <StatTile
            label="Dana Masuk"
            tone="positive"
            icon={<ArrowDownLeft className="h-3.5 w-3.5" />}
            value={formatCurrency(stats.inSum)}
            hint={`${stats.inCount} transaksi`}
          />
          <StatTile
            label="Dana Keluar"
            tone="negative"
            icon={<ArrowUpRight className="h-3.5 w-3.5" />}
            value={formatCurrency(stats.outSum)}
            hint={`${stats.outCount} transaksi`}
          />
          <StatTile
            label="Selisih Bersih"
            className="col-span-2 lg:col-span-1"
            tone={
              stats.net > 0 ? "positive" : stats.net < 0 ? "negative" : undefined
            }
            value={formatSigned(stats.net)}
            hint={isFiltered ? "sesuai filter" : "masuk − keluar"}
          />
        </div>

        <FilterPanel
          activeFilters={activeFilters}
          onReset={resetFilters}
          className="shrink-0"
        >
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <div className="flex flex-col gap-1.5 sm:col-span-2 lg:col-span-1">
              <Label className="text-xs">Cari</Label>
              <div className="relative">
                <Search className="absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  value={filters.search}
                  onChange={(e) => updateFilter("search", e.target.value)}
                  placeholder="Deskripsi, kode dokumen, nama..."
                  className="bg-background pl-8"
                />
              </div>
            </div>
            <div className="flex flex-col gap-1.5">
              <Label className="text-xs">Jenis Transaksi</Label>
              <Select
                value={filters.kind}
                onValueChange={(v) =>
                  updateFilter("kind", v as Filters["kind"])
                }
              >
                <SelectTrigger className="bg-background">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Semua jenis</SelectItem>
                  {kindOptions.map((k) => (
                    <SelectItem key={k} value={k}>
                      {BUDGET_HISTORY_KINDS[k].label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="flex flex-col gap-1.5">
              <Label className="text-xs">Arah Dana</Label>
              <Select
                value={filters.direction}
                onValueChange={(v) => updateFilter("direction", v as Direction)}
              >
                <SelectTrigger className="bg-background">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {(Object.keys(DIRECTION_LABELS) as Direction[]).map((d) => (
                    <SelectItem key={d} value={d}>
                      {DIRECTION_LABELS[d]}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="flex flex-col gap-1.5">
              <Label className="text-xs">Dilakukan Oleh</Label>
              <Select
                value={filters.actor}
                onValueChange={(v) => updateFilter("actor", v)}
              >
                <SelectTrigger className="bg-background">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Semua user</SelectItem>
                  {actorOptions.map((a) => (
                    <SelectItem key={a.key} value={a.key}>
                      {a.label}{" "}
                      <span className="text-muted-foreground">({a.count})</span>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <div className="flex flex-col gap-1.5">
              <Label className="text-xs">Dari Tanggal</Label>
              <Input
                type="date"
                value={filters.from}
                max={filters.to || undefined}
                onChange={(e) => updateFilter("from", e.target.value)}
                className="bg-background"
              />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label className="text-xs">Sampai Tanggal</Label>
              <Input
                type="date"
                value={filters.to}
                min={filters.from || undefined}
                onChange={(e) => updateFilter("to", e.target.value)}
                className="bg-background"
              />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label className="text-xs">Periode Cepat</Label>
              <div className="flex flex-wrap gap-1.5">
                {DATE_PRESETS.map((p) => {
                  const [from, to] = p.range();
                  const active = filters.from === from && filters.to === to;
                  return (
                    <Button
                      key={p.label}
                      type="button"
                      size="sm"
                      variant={active ? "default" : "outline"}
                      className="h-9 px-2.5"
                      onClick={() => {
                        setFilters((prev) => ({ ...prev, from, to }));
                        setPage(1);
                      }}
                    >
                      {p.label}
                    </Button>
                  );
                })}
              </div>
            </div>
            <div className="flex flex-col gap-1.5">
              <Label className="text-xs">Urutkan</Label>
              <Select
                value={sort}
                onValueChange={(v) => {
                  setSort(v as SortKey);
                  setPage(1);
                }}
              >
                <SelectTrigger className="bg-background">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {(Object.keys(SORT_LABELS) as SortKey[]).map((s) => (
                    <SelectItem key={s} value={s}>
                      {SORT_LABELS[s]}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
        </FilterPanel>

        {loading ? (
          <div className="flex min-h-40 flex-1 items-center justify-center rounded-md border">
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
          </div>
        ) : filtered.length === 0 ? (
          <div className="flex min-h-40 flex-1 flex-col items-center justify-center gap-2 rounded-md border text-sm text-muted-foreground">
            {entries.length === 0
              ? "Tidak ada riwayat."
              : "Tidak ada riwayat yang cocok dengan filter."}
            {isFiltered && (
              <Button variant="outline" size="sm" onClick={resetFilters}>
                Reset filter
              </Button>
            )}
          </div>
        ) : (
          <>
            {/* Desktop: tabel dengan header lengket & scroll di dalam dialog */}
            <div className="hidden min-h-[360px] flex-1 rounded-md border lg:block [&>[data-slot=table-container]]:h-full [&>[data-slot=table-container]]:overflow-auto">
              <Table>
                <TableHeader className="sticky top-0 z-10 bg-muted shadow-[0_1px_0_var(--color-border)] [&_th]:text-xs [&_th]:uppercase [&_th]:tracking-wide [&_th]:text-muted-foreground">
                  <TableRow className="hover:bg-transparent">
                    <TableHead className="w-28 pl-3">Waktu</TableHead>
                    <TableHead className="w-36">Jenis</TableHead>
                    <TableHead>Deskripsi</TableHead>
                    <TableHead className="w-48">Referensi</TableHead>
                    <TableHead className="w-48">Dilakukan Oleh</TableHead>
                    <TableHead className="w-36 text-right">Perubahan</TableHead>
                    <TableHead className="w-40 pr-3 text-right">
                      Sisa Budget
                    </TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {pageRows.map((e) => (
                    <TableRow key={e.id} className="align-top">
                      <TableCell className="pl-3 align-top">
                        <div className="font-medium">
                          {dateFormat.format(new Date(e.createdAt))}
                        </div>
                        <div className="text-xs text-muted-foreground">
                          {timeFormat.format(new Date(e.createdAt))} WIB
                        </div>
                      </TableCell>
                      <TableCell className="align-top">
                        <KindBadge kind={e.kind} />
                      </TableCell>
                      <TableCell className="min-w-56 whitespace-normal break-words align-top">
                        {e.description}
                      </TableCell>
                      <TableCell className="whitespace-normal align-top">
                        <ReferenceCell entry={e} />
                      </TableCell>
                      <TableCell className="whitespace-normal align-top">
                        <ActorCell entry={e} />
                      </TableCell>
                      <TableCell className="text-right align-top">
                        <ChangeAmount value={e.change} />
                      </TableCell>
                      <TableCell className="pr-3 text-right align-top">
                        <div className="font-bold tabular-nums">
                          {formatCurrency(e.after)}
                        </div>
                        <div className="text-xs text-muted-foreground tabular-nums">
                          sebelumnya {formatCurrency(e.before)}
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>

            {/* Mobile/tablet: kartu, tanpa scroll horizontal */}
            <ul className="space-y-2 lg:hidden">
              {pageRows.map((e) => (
                <li key={e.id} className="rounded-lg border p-3 text-sm">
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex min-w-0 flex-col items-start gap-1">
                      <KindBadge kind={e.kind} />
                      <span className="text-xs text-muted-foreground">
                        {dateFormat.format(new Date(e.createdAt))},{" "}
                        {timeFormat.format(new Date(e.createdAt))} WIB
                      </span>
                    </div>
                    <div className="shrink-0 text-right">
                      <ChangeAmount value={e.change} />
                      <div className="text-xs text-muted-foreground tabular-nums">
                        sisa {formatCurrency(e.after)}
                      </div>
                    </div>
                  </div>
                  <p className="mt-2 break-words">{e.description}</p>
                  <div className="mt-2 grid grid-cols-2 gap-3 border-t pt-2">
                    <div className="min-w-0">
                      <div className="text-[11px] uppercase tracking-wide text-muted-foreground">
                        Oleh
                      </div>
                      <ActorCell entry={e} />
                    </div>
                    <div className="min-w-0">
                      <div className="text-[11px] uppercase tracking-wide text-muted-foreground">
                        Referensi
                      </div>
                      <ReferenceCell entry={e} />
                    </div>
                  </div>
                </li>
              ))}
            </ul>
          </>
        )}

        <div className="flex shrink-0 flex-wrap items-center justify-between gap-2">
          <span className="text-sm text-muted-foreground">
            {filtered.length > 0
              ? `Menampilkan ${((safePage - 1) * PAGE_SIZE + 1).toLocaleString("id-ID")}–${Math.min(
                  safePage * PAGE_SIZE,
                  filtered.length,
                ).toLocaleString("id-ID")} dari ${filtered.length.toLocaleString("id-ID")} transaksi`
              : "0 transaksi"}
          </span>
          <div className="flex flex-wrap items-center gap-2">
            {totalPages > 1 && (
              <div className="flex items-center gap-1">
                <Button
                  variant="outline"
                  size="icon"
                  className="h-8 w-8"
                  disabled={safePage <= 1}
                  onClick={() => setPage(safePage - 1)}
                  aria-label="Halaman sebelumnya"
                >
                  <ChevronLeft className="h-4 w-4" />
                </Button>
                <span className="px-2 text-sm tabular-nums">
                  {safePage} / {totalPages}
                </span>
                <Button
                  variant="outline"
                  size="icon"
                  className="h-8 w-8"
                  disabled={safePage >= totalPages}
                  onClick={() => setPage(safePage + 1)}
                  aria-label="Halaman berikutnya"
                >
                  <ChevronRight className="h-4 w-4" />
                </Button>
              </div>
            )}
            <Button
              variant="outline"
              size="sm"
              onClick={handleExport}
              disabled={exporting || loading || filtered.length === 0}
            >
              {exporting ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : (
                <Download className="mr-2 h-4 w-4" />
              )}
              Export Excel{isFiltered ? " (sesuai filter)" : ""}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
