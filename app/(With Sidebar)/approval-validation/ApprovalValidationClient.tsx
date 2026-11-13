"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import {
  AlarmClock,
  ArrowRight,
  BellRing,
  ClipboardCheck,
  Hourglass,
  Inbox,
  Loader2,
  RefreshCw,
  SearchX,
  Settings2,
  Siren,
} from "lucide-react";
import { Content } from "@/components/content";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { TableBody, TableCell, TableHead, TableRow } from "@/components/ui/table";
import { StickyHeaderTable } from "@/components/sticky-header-table";
import { SortableTableHead } from "@/components/sortable-table-head";
import { ListSearchInput } from "@/components/list-search-input";
import {
  FilterField,
  FilterFields,
  FilterPanel,
  type ActiveFilter,
} from "@/components/filter-panel";
import {
  SearchableSelect,
  SearchableSelectContent,
  SearchableSelectItem,
  SearchableSelectTrigger,
  SearchableSelectValue,
} from "@/components/ui/searchable-select";
import { useListUrlParams } from "@/hooks/use-list-url-params";
import { useUrlSearchInput } from "@/hooks/use-url-search-input";
import { cn, formatCurrency } from "@/lib/utils";
import {
  KIND_META,
  KIND_ORDER,
  PRIORITIES,
  PRIORITY_LABELS,
  SEARCH_FIELDS,
  STALE_DAYS,
  URGENCY_FILTERS,
  filterQueue,
  isUrgent,
  sortQueue,
  waitingLabel,
  type QueueFilters,
  type QueueItem,
  type QueueKind,
  type UrgencyFilter,
} from "./_lib/queue";
import { useApprovalQueue, type LiveStatus } from "./_lib/use-approval-queue";
import {
  DueText,
  FlagIcons,
  FreshBadge,
  KindBadge,
  PriorityBadge,
} from "./_components/queue-badges";
import { QueueDetailDialog } from "./_components/QueueDetailDialog";

type TabValue = "all" | QueueKind;

// Teks relatif ("menunggu 3 jam", "diperbarui 10 detik lalu") ikut berjalan.
function useNow(intervalMs = 30_000) {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), intervalMs);
    return () => clearInterval(id);
  }, [intervalMs]);
  return now;
}

function LiveIndicator({
  live,
  lastUpdated,
  refreshing,
  onRefresh,
  now,
}: {
  live: LiveStatus;
  lastUpdated: number | null;
  refreshing: boolean;
  onRefresh: () => void;
  now: number;
}) {
  const ago = lastUpdated
    ? Math.max(0, Math.round((now - lastUpdated) / 1000))
    : null;
  const agoText =
    ago === null
      ? "Memuat…"
      : ago < 60
        ? "baru saja"
        : `${Math.floor(ago / 60)} mnt lalu`;
  const liveMeta = {
    live: {
      dot: "bg-emerald-500",
      ping: true,
      label: "Live",
      title: "Terhubung realtime - antrian otomatis diperbarui saat ada perubahan.",
    },
    connecting: {
      dot: "bg-amber-500",
      ping: false,
      label: "Menyambungkan",
      title: "Sedang menyambungkan pembaruan realtime…",
    },
    offline: {
      dot: "bg-muted-foreground",
      ping: false,
      label: "Auto-refresh",
      title:
        "Realtime tidak tersedia - antrian diperbarui berkala & setiap kali tab ini dibuka lagi.",
    },
  }[live];

  return (
    <div className="flex items-center gap-2">
      <span
        className="inline-flex items-center gap-1.5 rounded-full border bg-background px-2 py-0.5 text-xs font-medium"
        title={liveMeta.title}
      >
        <span className="relative flex size-2">
          {liveMeta.ping && (
            <span
              className={cn(
                "absolute inline-flex h-full w-full animate-ping rounded-full opacity-60 motion-reduce:animate-none",
                liveMeta.dot,
              )}
            />
          )}
          <span className={cn("relative inline-flex size-2 rounded-full", liveMeta.dot)} />
        </span>
        {liveMeta.label}
      </span>
      <span className="hidden text-xs text-muted-foreground sm:inline" aria-live="polite">
        Diperbarui {agoText}
      </span>
      <Button
        variant="ghost"
        size="icon"
        className="size-8"
        onClick={onRefresh}
        disabled={refreshing}
        aria-label="Muat ulang antrian"
        title="Muat ulang"
      >
        <RefreshCw className={cn("h-4 w-4", refreshing && "animate-spin")} />
      </Button>
    </div>
  );
}

function StatTile({
  icon: Icon,
  label,
  value,
  hint,
  tone,
  active,
  onClick,
}: {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  value: number;
  hint: string;
  tone: "primary" | "red" | "amber" | "orange";
  active: boolean;
  onClick: () => void;
}) {
  const toneClass = {
    primary: "bg-primary/10 text-primary",
    red: "bg-red-100 text-red-700 dark:bg-red-950/60 dark:text-red-300",
    amber: "bg-amber-100 text-amber-700 dark:bg-amber-950/60 dark:text-amber-300",
    orange: "bg-orange-100 text-orange-700 dark:bg-orange-950/60 dark:text-orange-300",
  }[tone];
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className={cn(
        "flex min-w-0 items-center gap-3 rounded-xl border bg-card p-3 text-left shadow-xs transition-colors hover:bg-muted/50 focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none",
        active && "border-primary ring-1 ring-primary",
      )}
    >
      <span className={cn("flex size-10 shrink-0 items-center justify-center rounded-lg", toneClass)}>
        <Icon className="h-5 w-5" />
      </span>
      <span className="min-w-0">
        <span className="block text-2xl leading-none font-bold tabular-nums">
          {value}
        </span>
        <span className="mt-1 block truncate text-xs font-medium">{label}</span>
        <span className="block truncate text-[11px] text-muted-foreground">
          {hint}
        </span>
      </span>
    </button>
  );
}

// Baris/kartu bisa diklik & dibuka pakai keyboard (Enter/Spasi).
function rowHandlers(onOpen: () => void) {
  return {
    tabIndex: 0,
    onClick: onOpen,
    onKeyDown: (e: React.KeyboardEvent) => {
      if (e.target !== e.currentTarget) return;
      if (e.key === "Enter" || e.key === " ") {
        e.preventDefault();
        onOpen();
      }
    },
  };
}

function ActionButton({ item, className }: { item: QueueItem; className?: string }) {
  const meta = KIND_META[item.kind];
  return (
    <Button
      asChild
      size="sm"
      variant={item.kind.endsWith("approval") ? "outline" : "default"}
      className={className}
    >
      <Link href={item.actionHref} onClick={(e) => e.stopPropagation()}>
        {meta.actionLabel}
        <ArrowRight className="ml-1 h-3.5 w-3.5" />
      </Link>
    </Button>
  );
}

function SubLine({ item, showKind }: { item: QueueItem; showKind: boolean }) {
  return (
    <div className="mt-1 flex flex-wrap items-center gap-1">
      {showKind && <KindBadge kind={item.kind} />}
      {item.refMr && (
        <span className="font-mono text-[11px] text-muted-foreground">
          ← {item.refMr.kode}
        </span>
      )}
      {item.docType === "MR" && item.kategori && (
        <span className="text-[11px] text-muted-foreground">{item.kategori}</span>
      )}
    </div>
  );
}

export function ApprovalValidationClient() {
  const now = useNow();
  const {
    access,
    items,
    countsByKind,
    loading,
    refreshing,
    error,
    lastUpdated,
    live,
    freshKeys,
    refresh,
  } = useApprovalQueue();
  const { searchParams, sort, setParams } = useListUrlParams();

  // ---- State di URL -------------------------------------------------------
  const allowedKinds = useMemo(
    () =>
      KIND_ORDER.filter((k) =>
        k.endsWith("validation")
          ? access.canValidate
          : k === "po-receive"
            ? access.canReceive
            : true,
      ),
    [access.canValidate, access.canReceive],
  );
  const tabParam = searchParams.get("tab") as TabValue | null;
  const tab: TabValue =
    tabParam && (tabParam === "all" || allowedKinds.includes(tabParam))
      ? tabParam
      : "all";

  const filters: QueueFilters = {
    search: searchParams.get("search") || "",
    priority: searchParams.get("prioritas") || "",
    department: searchParams.get("dept") || "",
    company: searchParams.get("company") || "",
    urgency: (searchParams.get("urgensi") as UrgencyFilter) || "",
  };

  const [searchInput, setSearchInput, resetSearchInput] = useUrlSearchInput(
    filters.search,
    (value) => setParams({ search: value }),
  );

  // ---- Turunan data -------------------------------------------------------
  const filtered = useMemo(
    () => filterQueue(items, filters),
    [items, filters.search, filters.priority, filters.department, filters.company, filters.urgency],
  );
  const visible = useMemo(
    () => sortQueue(tab === "all" ? filtered : filtered.filter((i) => i.kind === tab), sort),
    [filtered, tab, sort],
  );
  const filteredCountByKind = useMemo(() => {
    const acc: Partial<Record<QueueKind, number>> = {};
    filtered.forEach((i) => (acc[i.kind] = (acc[i.kind] || 0) + 1));
    return acc;
  }, [filtered]);
  const urgentByKind = useMemo(() => {
    const acc: Partial<Record<QueueKind, number>> = {};
    filtered.forEach((i) => {
      if (isUrgent(i)) acc[i.kind] = (acc[i.kind] || 0) + 1;
    });
    return acc;
  }, [filtered]);

  const departments = useMemo(
    () => [...new Set(items.map((i) => i.department).filter(Boolean) as string[])].sort(),
    [items],
  );
  const companies = useMemo(
    () => [...new Set(items.map((i) => i.company).filter(Boolean) as string[])].sort(),
    [items],
  );

  const stats = useMemo(
    () => ({
      total: items.length,
      urgent: items.filter(isUrgent).length,
      overdue: items.filter((i) => i.flags.overdue).length,
      followup: items.filter((i) => i.flags.followups > 0).length,
      stale: items.filter((i) => i.flags.stale).length,
      poValue: items
        .filter((i) => i.kind === "po-approval" || i.kind === "po-validation")
        .reduce((s, i) => s + i.amount, 0),
    }),
    [items],
  );

  // ---- Dialog detail ------------------------------------------------------
  // Snapshot item disimpan supaya dialog tetap terbuka walau dokumennya
  // keluar dari antrian karena diproses di tempat lain.
  const [selected, setSelected] = useState<QueueItem | null>(null);
  const [dialogOpen, setDialogOpen] = useState(false);
  const liveSelected = selected
    ? items.find((i) => i.key === selected.key) ?? null
    : null;
  const openDetail = (item: QueueItem) => {
    setSelected(item);
    setDialogOpen(true);
  };

  // ---- Filter UI ----------------------------------------------------------
  const setFilter = (updates: Record<string, string>) => setParams(updates);
  const toggleUrgency = (value: UrgencyFilter | "") =>
    setFilter({ urgensi: filters.urgency === value ? "" : value });
  const clearFilters = () => {
    resetSearchInput("");
    setParams({ search: "", prioritas: "", dept: "", company: "", urgensi: "" });
  };

  const activeFilters: ActiveFilter[] = [];
  if (filters.priority)
    activeFilters.push({
      key: "prioritas",
      label: "Prioritas",
      value:
        filters.priority === "none"
          ? "Tanpa prioritas"
          : PRIORITY_LABELS[filters.priority as keyof typeof PRIORITY_LABELS] ?? filters.priority,
      onRemove: () => setFilter({ prioritas: "" }),
    });
  if (filters.urgency)
    activeFilters.push({
      key: "urgensi",
      label: "Kondisi",
      value: URGENCY_FILTERS.find((u) => u.value === filters.urgency)?.label ?? filters.urgency,
      onRemove: () => setFilter({ urgensi: "" }),
    });
  if (filters.department)
    activeFilters.push({
      key: "dept",
      label: "Departemen",
      value: filters.department,
      onRemove: () => setFilter({ dept: "" }),
    });
  if (filters.company)
    activeFilters.push({
      key: "company",
      label: "Perusahaan",
      value: filters.company,
      onRemove: () => setFilter({ company: "" }),
    });

  const hasQuery = activeFilters.length > 0 || !!filters.search;
  const showKind = tab === "all";
  const tabs: { value: TabValue; label: string }[] = [
    { value: "all", label: "Semua" },
    ...allowedKinds.map((k) => ({ value: k as TabValue, label: KIND_META[k].label })),
  ];
  const tabCount = (t: TabValue) =>
    t === "all" ? filtered.length : filteredCountByKind[t] || 0;
  const tabUrgent = (t: TabValue) =>
    t === "all"
      ? Object.values(urgentByKind).reduce((s, n) => s + (n || 0), 0)
      : urgentByKind[t] || 0;

  // ---- Render -------------------------------------------------------------
  if (loading) {
    return (
      <>
        <div className="col-span-12 grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-5">
          {Array.from({ length: 5 }).map((_, i) => (
            <Skeleton key={i} className="h-[74px] rounded-xl" />
          ))}
        </div>
        <Content className="col-span-12">
          <div className="space-y-3">
            <Skeleton className="h-9 w-full max-w-xl" />
            <Skeleton className="h-10 w-full" />
            {Array.from({ length: 6 }).map((_, i) => (
              <Skeleton key={i} className="h-12 w-full" />
            ))}
          </div>
        </Content>
      </>
    );
  }

  const header = (
    <TableRow>
      <TableHead className="w-10">No</TableHead>
      <SortableTableHead sortKey="kode" currentSort={sort} onSortChange={(v) => setParams({ sort: v })}>
        Dokumen
      </SortableTableHead>
      <SortableTableHead sortKey="prioritas" currentSort={sort} onSortChange={(v) => setParams({ sort: v })}>
        Prioritas
      </SortableTableHead>
      <SortableTableHead sortKey="due" currentSort={sort} onSortChange={(v) => setParams({ sort: v })}>
        Jatuh Tempo
      </SortableTableHead>
      <TableHead>Requester / Pembuat</TableHead>
      <TableHead>Vendor / Cost Center</TableHead>
      <SortableTableHead
        sortKey="nilai"
        defaultDirection="desc"
        currentSort={sort}
        onSortChange={(v) => setParams({ sort: v })}
        className="text-right"
      >
        Nilai
      </SortableTableHead>
      <SortableTableHead sortKey="menunggu" currentSort={sort} onSortChange={(v) => setParams({ sort: v })}>
        Menunggu
      </SortableTableHead>
      <TableHead className="text-right">Aksi</TableHead>
    </TableRow>
  );

  const emptyState = (
    <div className="flex flex-col items-center justify-center gap-2 py-10 text-center">
      {hasQuery ? (
        <>
          <SearchX className="h-8 w-8 text-muted-foreground" />
          <p className="text-sm text-muted-foreground">
            Tidak ada dokumen yang cocok dengan pencarian / filter.
          </p>
          <Button variant="link" size="sm" onClick={clearFilters}>
            Reset filter
          </Button>
        </>
      ) : (
        <>
          <ClipboardCheck className="h-8 w-8 text-emerald-500" />
          <p className="text-sm font-medium">Semua beres!</p>
          <p className="text-sm text-muted-foreground">
            {tab === "all"
              ? "Tidak ada dokumen yang menunggu tindakan Anda saat ini."
              : `Tidak ada dokumen di antrian ${KIND_META[tab].label}.`}
          </p>
        </>
      )}
    </div>
  );

  return (
    <>
      {/* Ringkasan - tiap kartu bisa diklik utk memfilter */}
      <div className="col-span-12 grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-5">
        <StatTile
          icon={Inbox}
          label="Total perlu aksi"
          value={stats.total}
          hint={stats.poValue ? `PO senilai ${formatCurrency(stats.poValue)}` : "Semua antrian"}
          tone="primary"
          active={!hasQuery && tab === "all"}
          onClick={() => {
            resetSearchInput("");
            setParams({ tab: "", search: "", prioritas: "", dept: "", company: "", urgensi: "" });
          }}
        />
        <StatTile
          icon={Siren}
          label="Mendesak"
          value={stats.urgent}
          hint="P0/P1 atau lewat tempo"
          tone="red"
          active={filters.urgency === "urgent"}
          onClick={() => toggleUrgency("urgent")}
        />
        <StatTile
          icon={AlarmClock}
          label="Lewat jatuh tempo"
          value={stats.overdue}
          hint="Due date sudah lewat"
          tone="orange"
          active={filters.urgency === "overdue"}
          onClick={() => toggleUrgency("overdue")}
        />
        <StatTile
          icon={BellRing}
          label="Sudah di-follow-up"
          value={stats.followup}
          hint="Requester menagih"
          tone="amber"
          active={filters.urgency === "followup"}
          onClick={() => toggleUrgency("followup")}
        />
        <StatTile
          icon={Hourglass}
          label={`Menunggu > ${STALE_DAYS} hari`}
          value={stats.stale}
          hint="Antrian tertahan"
          tone="amber"
          active={filters.urgency === "stale"}
          onClick={() => toggleUrgency("stale")}
        />
      </div>

      <Content
        title="Approval & Validation"
        description="Semua dokumen yang menunggu tindakan Anda. Klik baris untuk melihat ringkasan & bahan pertimbangan sebelum memutuskan."
        className="col-span-12"
        cardAction={
          <div className="flex flex-wrap items-center gap-2">
            <LiveIndicator
              live={live}
              lastUpdated={lastUpdated}
              refreshing={refreshing}
              onRefresh={() => void refresh()}
              now={now}
            />
            {access.canValidate && (
              <Button asChild variant="outline" size="sm">
                <Link href="/approval-validation/templates">
                  <Settings2 className="mr-1.5 h-4 w-4" /> Kelola Template
                </Link>
              </Button>
            )}
          </div>
        }
      >
        <div className="space-y-4">
          {error && (
            <div
              role="alert"
              className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-destructive/40 bg-destructive/5 p-3 text-sm text-destructive"
            >
              <span>Gagal memuat data terbaru: {error}</span>
              <Button size="sm" variant="outline" onClick={() => void refresh()}>
                Coba lagi
              </Button>
            </div>
          )}

          {/* Tab antrian - scroll horizontal di layar sempit */}
          <div
            role="tablist"
            aria-label="Jenis antrian"
            className="-mx-1 flex gap-1 overflow-x-auto px-1 pb-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
          >
            {tabs.map((t) => {
              const active = tab === t.value;
              const count = tabCount(t.value);
              const urgent = tabUrgent(t.value);
              return (
                <button
                  key={t.value}
                  type="button"
                  role="tab"
                  aria-selected={active}
                  onClick={() => setParams({ tab: t.value === "all" ? "" : t.value })}
                  className={cn(
                    "inline-flex shrink-0 items-center gap-2 rounded-lg border px-3 py-1.5 text-sm font-medium whitespace-nowrap transition-colors focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none",
                    active
                      ? "border-primary bg-primary text-primary-foreground"
                      : "bg-background text-muted-foreground hover:bg-muted hover:text-foreground",
                  )}
                >
                  {t.label}
                  <span
                    className={cn(
                      "inline-flex h-5 min-w-5 items-center justify-center rounded-full px-1.5 text-[11px] font-semibold tabular-nums",
                      active
                        ? "bg-primary-foreground/20 text-primary-foreground"
                        : count
                          ? "bg-muted text-foreground"
                          : "bg-muted/60 text-muted-foreground",
                    )}
                  >
                    {count}
                    {hasQuery && t.value !== "all" && (countsByKind[t.value] || 0) !== count && (
                      <span className="font-normal opacity-70">
                        /{countsByKind[t.value] || 0}
                      </span>
                    )}
                  </span>
                  {urgent > 0 && (
                    <span
                      className="size-2 rounded-full bg-red-500"
                      title={`${urgent} mendesak`}
                      aria-label={`${urgent} mendesak`}
                    />
                  )}
                </button>
              );
            })}
          </div>

          {tab !== "all" && (
            <p className="text-sm text-muted-foreground">{KIND_META[tab].hint}</p>
          )}

          {/* Cari + filter */}
          <ListSearchInput
            placeholder="Cari kode, requester, vendor, barang..."
            value={searchInput}
            onChange={setSearchInput}
            searchableFields={SEARCH_FIELDS}
          />

          <FilterPanel activeFilters={activeFilters} onReset={clearFilters}>
            <FilterFields>
              <FilterField label="Prioritas">
                <SearchableSelect
                  value={filters.priority || "all"}
                  onValueChange={(v) => setFilter({ prioritas: v === "all" ? "" : v })}
                >
                  <SearchableSelectTrigger className="bg-background">
                    <SearchableSelectValue placeholder="Prioritas" />
                  </SearchableSelectTrigger>
                  <SearchableSelectContent>
                    <SearchableSelectItem value="all">Semua Prioritas</SearchableSelectItem>
                    {PRIORITIES.map((p) => (
                      <SearchableSelectItem key={p} value={p}>
                        {PRIORITY_LABELS[p]}
                      </SearchableSelectItem>
                    ))}
                    <SearchableSelectItem value="none">Tanpa prioritas</SearchableSelectItem>
                  </SearchableSelectContent>
                </SearchableSelect>
              </FilterField>
              <FilterField label="Kondisi">
                <SearchableSelect
                  value={filters.urgency || "all"}
                  onValueChange={(v) => setFilter({ urgensi: v === "all" ? "" : v })}
                >
                  <SearchableSelectTrigger className="bg-background">
                    <SearchableSelectValue placeholder="Kondisi" />
                  </SearchableSelectTrigger>
                  <SearchableSelectContent>
                    <SearchableSelectItem value="all">Semua Kondisi</SearchableSelectItem>
                    {URGENCY_FILTERS.map((u) => (
                      <SearchableSelectItem key={u.value} value={u.value}>
                        {u.label}
                      </SearchableSelectItem>
                    ))}
                  </SearchableSelectContent>
                </SearchableSelect>
              </FilterField>
              <FilterField label="Departemen">
                <SearchableSelect
                  value={filters.department || "all"}
                  onValueChange={(v) => setFilter({ dept: v === "all" ? "" : v })}
                >
                  <SearchableSelectTrigger className="bg-background">
                    <SearchableSelectValue placeholder="Departemen" />
                  </SearchableSelectTrigger>
                  <SearchableSelectContent>
                    <SearchableSelectItem value="all">Semua Departemen</SearchableSelectItem>
                    {departments.map((d) => (
                      <SearchableSelectItem key={d} value={d}>
                        {d}
                      </SearchableSelectItem>
                    ))}
                  </SearchableSelectContent>
                </SearchableSelect>
              </FilterField>
              <FilterField label="Perusahaan">
                <SearchableSelect
                  value={filters.company || "all"}
                  onValueChange={(v) => setFilter({ company: v === "all" ? "" : v })}
                >
                  <SearchableSelectTrigger className="bg-background">
                    <SearchableSelectValue placeholder="Perusahaan" />
                  </SearchableSelectTrigger>
                  <SearchableSelectContent>
                    <SearchableSelectItem value="all">Semua Perusahaan</SearchableSelectItem>
                    {companies.map((c) => (
                      <SearchableSelectItem key={c} value={c}>
                        {c}
                      </SearchableSelectItem>
                    ))}
                  </SearchableSelectContent>
                </SearchableSelect>
              </FilterField>
            </FilterFields>
          </FilterPanel>

          <div className="flex items-center justify-between gap-2 text-xs text-muted-foreground">
            <span>
              Menampilkan <b className="text-foreground tabular-nums">{visible.length}</b> dokumen
              {!sort && " · diurutkan dari yang paling mendesak"}
            </span>
            {refreshing && (
              <span className="inline-flex items-center gap-1">
                <Loader2 className="h-3 w-3 animate-spin" /> Memperbarui…
              </span>
            )}
          </div>

          {/* Desktop / tablet: tabel */}
          <div className="hidden md:block">
            <StickyHeaderTable header={header} className="min-w-[960px]">
              <TableBody>
                {visible.length ? (
                  visible.map((item, idx) => (
                    <TableRow
                      key={item.key}
                      {...rowHandlers(() => openDetail(item))}
                      aria-label={`Lihat ringkasan ${item.kode}`}
                      className={cn(
                        "cursor-pointer transition-colors hover:bg-muted/50 focus-visible:bg-muted/50 focus-visible:outline-none",
                        freshKeys.has(item.key) && "bg-primary/5",
                        item.flags.overdue && "shadow-[inset_3px_0_0_0_var(--color-red-500)]",
                      )}
                    >
                      <TableCell className="text-muted-foreground tabular-nums">
                        {idx + 1}
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-1.5">
                          <span className="font-mono text-xs font-semibold">{item.kode}</span>
                          {freshKeys.has(item.key) && <FreshBadge />}
                        </div>
                        <SubLine item={item} showKind={showKind} />
                      </TableCell>
                      <TableCell>
                        <PriorityBadge priority={item.priority} />
                      </TableCell>
                      <TableCell>
                        <DueText item={item} />
                        {item.dueDate && (
                          <span className="block text-[11px] text-muted-foreground">
                            {new Date(item.dueDate).toLocaleDateString("id-ID", {
                              day: "2-digit",
                              month: "short",
                              year: "2-digit",
                            })}
                          </span>
                        )}
                      </TableCell>
                      <TableCell className="max-w-[200px]">
                        <p className="truncate text-sm font-medium">{item.requester}</p>
                        <p className="truncate text-xs text-muted-foreground">
                          {[item.department, item.company].filter(Boolean).join(" · ") || "-"}
                        </p>
                      </TableCell>
                      <TableCell className="max-w-[200px]">
                        <p className="truncate text-sm">
                          {item.docType === "PO"
                            ? item.vendor || "-"
                            : item.costCenter?.code || item.costCenter?.name || "-"}
                        </p>
                        {item.docType === "MR" && item.costCenter && (
                          <p
                            className={cn(
                              "truncate text-xs",
                              item.flags.overBudget
                                ? "font-medium text-red-600 dark:text-red-400"
                                : "text-muted-foreground",
                            )}
                          >
                            {item.flags.overBudget ? "Melebihi budget · " : "Sisa "}
                            {formatCurrency(item.costCenter.budget)}
                          </p>
                        )}
                        {item.docType === "PO" && item.paymentTerm && (
                          <p className="truncate text-xs text-muted-foreground">
                            {item.paymentTerm}
                          </p>
                        )}
                      </TableCell>
                      <TableCell className="text-right">
                        <p className="font-medium whitespace-nowrap tabular-nums">
                          {formatCurrency(item.amount)}
                        </p>
                        <p className="text-xs text-muted-foreground">{item.items.length} item</p>
                      </TableCell>
                      <TableCell>
                        <p
                          className={cn(
                            "text-sm whitespace-nowrap tabular-nums",
                            item.flags.stale && "font-medium text-amber-700 dark:text-amber-400",
                          )}
                          title={new Date(item.waitingSince).toLocaleString("id-ID")}
                        >
                          {waitingLabel(item.waitingSince, now)}
                        </p>
                        <FlagIcons item={item} />
                      </TableCell>
                      <TableCell className="text-right">
                        <ActionButton item={item} />
                      </TableCell>
                    </TableRow>
                  ))
                ) : (
                  <TableRow>
                    <TableCell colSpan={9}>{emptyState}</TableCell>
                  </TableRow>
                )}
              </TableBody>
            </StickyHeaderTable>
          </div>

          {/* Mobile: kartu */}
          <div className="space-y-2 md:hidden">
            {visible.length ? (
              visible.map((item) => (
                <div
                  key={item.key}
                  role="button"
                  {...rowHandlers(() => openDetail(item))}
                  aria-label={`Lihat ringkasan ${item.kode}`}
                  className={cn(
                    "cursor-pointer rounded-lg border bg-card p-3 transition-colors active:bg-muted/60 focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none",
                    freshKeys.has(item.key) && "border-primary/50 bg-primary/5",
                    item.flags.overdue && "border-l-4 border-l-red-500",
                  )}
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-1.5">
                        <span className="font-mono text-sm font-semibold break-all">
                          {item.kode}
                        </span>
                        {freshKeys.has(item.key) && <FreshBadge />}
                      </div>
                      <SubLine item={item} showKind={showKind} />
                    </div>
                    <PriorityBadge priority={item.priority} />
                  </div>

                  <div className="mt-2 grid grid-cols-2 gap-x-3 gap-y-1.5 text-xs">
                    <div className="min-w-0">
                      <p className="text-muted-foreground">
                        {item.docType === "MR" ? "Requester" : "Pembuat"}
                      </p>
                      <p className="truncate font-medium">{item.requester}</p>
                      <p className="truncate text-muted-foreground">
                        {item.department || item.company || "-"}
                      </p>
                    </div>
                    <div className="min-w-0 text-right">
                      <p className="text-muted-foreground">Nilai</p>
                      <p className="font-semibold tabular-nums">{formatCurrency(item.amount)}</p>
                      <p className="text-muted-foreground">{item.items.length} item</p>
                    </div>
                    {(item.vendor || item.costCenter) && (
                      <div className="col-span-2 min-w-0">
                        <p className="truncate text-muted-foreground">
                          {item.docType === "PO" ? "Vendor: " : "Cost center: "}
                          <span
                            className={cn(
                              "text-foreground",
                              item.flags.overBudget && "text-red-600 dark:text-red-400",
                            )}
                          >
                            {item.docType === "PO"
                              ? item.vendor
                              : `${item.costCenter?.code || item.costCenter?.name}${
                                  item.flags.overBudget ? " (melebihi budget)" : ""
                                }`}
                          </span>
                        </p>
                      </div>
                    )}
                  </div>

                  <div className="mt-2 flex items-center justify-between gap-2 border-t pt-2">
                    <div className="flex min-w-0 flex-wrap items-center gap-x-3 gap-y-1 text-xs">
                      <span
                        className={cn(
                          "inline-flex items-center gap-1 text-muted-foreground",
                          item.flags.stale && "font-medium text-amber-700 dark:text-amber-400",
                        )}
                      >
                        <Hourglass className="h-3 w-3" />
                        {waitingLabel(item.waitingSince, now)}
                      </span>
                      {item.daysToDue !== null && <DueText item={item} />}
                      <FlagIcons item={item} />
                    </div>
                    <ActionButton item={item} className="shrink-0" />
                  </div>
                </div>
              ))
            ) : (
              <div className="rounded-lg border">{emptyState}</div>
            )}
          </div>
        </div>
      </Content>

      <QueueDetailDialog
        item={liveSelected ?? selected}
        gone={!!selected && !liveSelected && !loading}
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        now={now}
      />
    </>
  );
}
