"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { cn } from "@/lib/utils";
import { MR_LEVELS } from "@/type/enum";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import { Input } from "@/components/ui/input";
import {
  ArrowRight,
  BookOpen,
  Check,
  ChevronRight,
  CircleCheckBig,
  Factory,
  FileCheck2,
  HandCoins,
  HelpCircle,
  PackageCheck,
  Search,
  ShoppingCart,
  Sparkles,
  Truck,
  Wallet,
  X,
} from "lucide-react";
import {
  FAQS,
  type FlowId,
  JOURNEY,
  PAYMENT_VARIANTS,
  PICKABLE_ROLES,
  PRIORITIES,
  ROLE_INFO,
  STATUS_GROUPS,
  type StatusEntry,
  TOC,
  VENDOR_ROUTES,
} from "./docs-data";
import {
  ROLE_META,
  RoleChip,
  type RoleId,
  StatusPill,
} from "./primitives";

type Jump = (target: { flow: FlowId; step: number } | string) => void;

export function Section({
  id,
  children,
  className,
}: {
  id: string;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <section
      id={id}
      className={cn(
        "scroll-mt-20 rounded-xl border bg-card p-4 text-card-foreground shadow-sm sm:p-6",
        className,
      )}
    >
      {children}
    </section>
  );
}

function SectionTitle({
  icon: Icon,
  title,
  subtitle,
}: {
  icon: React.ElementType;
  title: string;
  subtitle?: React.ReactNode;
}) {
  return (
    <div className="mb-5 flex items-start gap-3">
      <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
        <Icon className="h-5 w-5" />
      </span>
      <div>
        <h2 className="text-xl font-semibold tracking-tight sm:text-2xl">
          {title}
        </h2>
        {subtitle && (
          <p className="text-sm text-muted-foreground">{subtitle}</p>
        )}
      </div>
    </div>
  );
}

// ===========================================================================
// HERO + PILIH PERAN
// ===========================================================================

export function HeroSection({
  role,
  onRoleChange,
  onJump,
}: {
  role: RoleId | null;
  onRoleChange: (r: RoleId | null) => void;
  onJump: Jump;
}) {
  const info = role && role !== "system" ? ROLE_INFO[role] : null;

  return (
    <Section
      id="mulai"
      className="relative overflow-hidden bg-gradient-to-br from-primary/10 via-card to-card"
    >
      <div className="pointer-events-none absolute -right-16 -top-16 h-56 w-56 rounded-full bg-primary/10 blur-3xl" />
      <div className="relative space-y-6">
        <div className="space-y-2">
          <span className="inline-flex items-center gap-1.5 rounded-full border bg-background/70 px-2.5 py-1 text-xs font-medium">
            <BookOpen className="h-3.5 w-3.5" /> Panduan Pengguna
          </span>
          <h1 className="text-2xl font-bold tracking-tight sm:text-3xl">
            Cara pakai Garuda Procure
          </h1>
          <p className="max-w-2xl text-sm text-muted-foreground sm:text-base">
            Tidak perlu baca semuanya. Pilih peran Anda, lalu ikuti langkah
            yang ditandai. Setiap alur punya versi{" "}
            <span className="font-medium text-foreground">visual</span> dan{" "}
            <span className="font-medium text-foreground">panduan teks</span>.
          </p>
        </div>

        <div className="space-y-2">
          <p className="text-sm font-semibold">Saya adalah…</p>
          <div className="flex flex-wrap gap-2">
            {PICKABLE_ROLES.map((r) => {
              const meta = ROLE_META[r];
              const Icon = meta.icon;
              const active = role === r;
              return (
                <button
                  key={r}
                  type="button"
                  onClick={() => onRoleChange(active ? null : r)}
                  aria-pressed={active}
                  className={cn(
                    "inline-flex items-center gap-2 rounded-full border px-3 py-1.5 text-sm font-medium transition-all",
                    active
                      ? cn(meta.color, "scale-105 shadow-sm ring-2 ring-current/20")
                      : "bg-background hover:-translate-y-0.5 hover:shadow-sm",
                  )}
                >
                  <Icon className="h-4 w-4" />
                  {meta.label}
                  {active && <X className="h-3.5 w-3.5 opacity-60" />}
                </button>
              );
            })}
          </div>
        </div>

        {info && role ? (
          <div
            key={role}
            className="docs-fade-up rounded-xl border bg-background/80 p-4 backdrop-blur"
          >
            <div className="mb-3 flex flex-wrap items-center gap-2">
              <Sparkles className="h-4 w-4 text-primary" />
              <p className="font-semibold">Tugas Anda sebagai</p>
              <RoleChip role={role} />
            </div>
            <p className="mb-3 text-xs text-muted-foreground">{info.who}</p>
            <ul className="grid gap-2 sm:grid-cols-2">
              {info.tasks.map((t, i) => {
                const target = t.jump ?? t.anchor;
                const content = (
                  <>
                    <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-primary text-xs font-bold text-primary-foreground">
                      {i + 1}
                    </span>
                    <span className="flex-1 text-left">{t.text}</span>
                    {target && (
                      <ChevronRight className="h-4 w-4 shrink-0 text-muted-foreground transition-transform group-hover:translate-x-0.5" />
                    )}
                  </>
                );
                return (
                  <li
                    key={i}
                    className="docs-fade-up"
                    style={{ animationDelay: `${0.08 * i}s` }}
                  >
                    {target ? (
                      <button
                        type="button"
                        onClick={() => onJump(target)}
                        className="group flex w-full items-center gap-3 rounded-lg border p-2.5 text-sm transition-colors hover:border-primary/50 hover:bg-muted/50"
                      >
                        {content}
                      </button>
                    ) : (
                      <div className="flex items-center gap-3 rounded-lg border p-2.5 text-sm">
                        {content}
                      </div>
                    )}
                  </li>
                );
              })}
            </ul>
            <p className="mt-3 text-xs text-muted-foreground">
              Langkah milik Anda ditandai{" "}
              <span className="rounded-full bg-sky-500 px-1.5 py-0.5 text-[9px] font-bold text-white">
                Anda
              </span>{" "}
              di setiap alur di bawah.
            </p>
          </div>
        ) : (
          <p className="text-xs text-muted-foreground">
            👆 Pilih salah satu untuk melihat ringkasan tugas Anda.
          </p>
        )}
      </div>
    </Section>
  );
}

// ===========================================================================
// GAMBARAN BESAR
// ===========================================================================

export function JourneySection({
  role,
  onJump,
}: {
  role: RoleId | null;
  onJump: Jump;
}) {
  return (
    <Section id="gambaran">
      <SectionTitle
        icon={Factory}
        title="Gambaran besar: perjalanan satu barang"
        subtitle="Klik salah satu tahap untuk langsung ke penjelasannya."
      />

      {/* Desktop: horizontal */}
      <div className="relative hidden md:block">
        <div className="absolute left-[7%] right-[7%] top-6 h-1 rounded-full bg-gradient-to-r from-sky-200 via-violet-200 to-emerald-200 dark:from-sky-900 dark:via-violet-900 dark:to-emerald-900">
          <span
            className="docs-travel-x absolute top-1/2 h-3.5 w-3.5 -translate-x-1/2 -translate-y-1/2 rounded-full bg-primary shadow-[0_0_0_4px_hsl(var(--primary)/0.2)]"
            style={{ "--docs-duration": "7s" } as React.CSSProperties}
          />
        </div>
        <ol className="relative grid grid-cols-7 gap-1">
          {JOURNEY.map((j, i) => (
            <JourneyNode key={j.label} node={j} index={i} role={role} onJump={onJump} />
          ))}
        </ol>
      </div>

      {/* Mobile: vertikal */}
      <div className="relative md:hidden">
        <div className="absolute bottom-6 left-6 top-6 w-1 -translate-x-1/2 rounded-full bg-gradient-to-b from-sky-200 via-violet-200 to-emerald-200 dark:from-sky-900 dark:via-violet-900 dark:to-emerald-900">
          <span
            className="docs-travel-y absolute left-1/2 h-3.5 w-3.5 -translate-x-1/2 -translate-y-1/2 rounded-full bg-primary shadow-[0_0_0_4px_hsl(var(--primary)/0.2)]"
            style={{ "--docs-duration": "7s" } as React.CSSProperties}
          />
        </div>
        <ol className="relative space-y-3">
          {JOURNEY.map((j, i) => (
            <JourneyNode key={j.label} node={j} index={i} role={role} onJump={onJump} vertical />
          ))}
        </ol>
      </div>

      <div className="mt-6 grid gap-3 sm:grid-cols-2">
        <button
          type="button"
          onClick={() => onJump("pembayaran")}
          className="group flex items-center gap-3 rounded-lg border bg-muted/30 p-3 text-left text-sm transition-colors hover:border-primary/50"
        >
          <Wallet className="h-5 w-5 shrink-0 text-rose-500" />
          <span className="flex-1">
            <span className="font-medium">Bayar dulu atau terima dulu?</span>
            <span className="block text-xs text-muted-foreground">
              Tergantung metode bayar. Lihat 4 jalur pembayaran PO.
            </span>
          </span>
          <ChevronRight className="h-4 w-4 text-muted-foreground transition-transform group-hover:translate-x-0.5" />
        </button>
        <button
          type="button"
          onClick={() => onJump({ flow: "pc", step: 0 })}
          className="group flex items-center gap-3 rounded-lg border bg-muted/30 p-3 text-left text-sm transition-colors hover:border-primary/50"
        >
          <HandCoins className="h-5 w-5 shrink-0 text-emerald-500" />
          <span className="flex-1">
            <span className="font-medium">Butuh dana kecil tanpa PO?</span>
            <span className="block text-xs text-muted-foreground">
              Pakai alur Petty Cash (Kas Kecil).
            </span>
          </span>
          <ChevronRight className="h-4 w-4 text-muted-foreground transition-transform group-hover:translate-x-0.5" />
        </button>
      </div>
    </Section>
  );
}

function JourneyNode({
  node,
  index,
  role,
  onJump,
  vertical,
}: {
  node: (typeof JOURNEY)[number];
  index: number;
  role: RoleId | null;
  onJump: Jump;
  vertical?: boolean;
}) {
  const Icon = node.icon;
  const meta = ROLE_META[node.role];
  const mine = role === node.role;
  const dim = role && !mine;
  return (
    <li
      className="docs-fade-up"
      style={{ animationDelay: `${index * 0.08}s` }}
    >
      <button
        type="button"
        onClick={() => onJump(node.jump)}
        className={cn(
          "group w-full transition-opacity",
          vertical
            ? "flex items-center gap-3 text-left"
            : "flex flex-col items-center gap-2 text-center",
          dim && "opacity-60 hover:opacity-100",
        )}
      >
        <span
          className={cn(
            "relative flex h-12 w-12 shrink-0 items-center justify-center rounded-full border-2 bg-background shadow-sm transition-transform group-hover:-translate-y-0.5 group-hover:scale-105",
            mine ? "border-sky-500 docs-ring" : "border-border",
          )}
        >
          <Icon className="h-5 w-5" />
          <span
            className={cn(
              "absolute -bottom-0.5 -right-0.5 h-3.5 w-3.5 rounded-full ring-2 ring-background",
              meta.dot,
            )}
          />
        </span>
        <span className={cn(!vertical && "space-y-0.5")}>
          <span className="block text-xs font-semibold leading-tight">
            {node.label}
          </span>
          <span className="block text-[10px] text-muted-foreground">
            {meta.label}
          </span>
        </span>
      </button>
    </li>
  );
}

// ===========================================================================
// 4 JALUR PEMBAYARAN
// ===========================================================================

export function PaymentSection({ role }: { role: RoleId | null }) {
  const [active, setActive] = useState(PAYMENT_VARIANTS[0].id);
  const v = PAYMENT_VARIANTS.find((x) => x.id === active)!;

  // Posisi slot node di track (0-4). Payment Validator & Receiver bertukar
  // posisi tergantung varian - transisi `left` yang bikin efek "tukar
  // tempat" kelihatan.
  const nodes = [
    { id: "mr", label: "MR Approved", icon: FileCheck2, slot: 0 },
    { id: "po", label: "PO Divalidasi", icon: ShoppingCart, slot: 1 },
    {
      id: "pay",
      label: "Payment Validator",
      icon: Wallet,
      slot: v.payFirst ? 2 : 3,
      role: "finance" as RoleId,
    },
    {
      id: "recv",
      label: "Receiver",
      icon: PackageCheck,
      slot: v.payFirst ? 3 : 2,
      role: "receiver" as RoleId,
    },
    { id: "done", label: "Final", icon: CircleCheckBig, slot: 4 },
  ];

  return (
    <Section id="pembayaran">
      <SectionTitle
        icon={Wallet}
        title="4 Jalur Pembayaran PO"
        subtitle={
          <>
            Bedanya hanya satu hal: <b className="text-foreground">bayar dulu</b>{" "}
            atau <b className="text-foreground">terima barang dulu</b>. Urutan
            ini ditentukan GA lewat Template Approval PO.
          </>
        }
      />

      <div className="mb-6 grid grid-cols-2 gap-2 lg:grid-cols-4">
        {PAYMENT_VARIANTS.map((p, i) => (
          <button
            key={p.id}
            type="button"
            onClick={() => setActive(p.id)}
            className={cn(
              "rounded-lg border p-3 text-left transition-all",
              active === p.id
                ? "border-primary bg-primary/5 shadow-sm ring-2 ring-primary/20"
                : "hover:border-primary/40",
            )}
          >
            <span className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
              Jalur {i + 1}
            </span>
            <span className="block text-sm font-semibold">{p.label}</span>
            <span className="block text-xs text-muted-foreground">{p.short}</span>
          </button>
        ))}
      </div>

      {/* Track beranimasi */}
      <div className="relative mx-auto h-36 max-w-3xl">
        <div className="absolute left-[10%] right-[10%] top-6 h-1 rounded-full bg-border">
          <span
            className="docs-travel-x absolute top-1/2 h-3 w-3 -translate-x-1/2 -translate-y-1/2 rounded-full bg-primary"
            style={{ "--docs-duration": "5s" } as React.CSSProperties}
          />
        </div>
        {nodes.map((n) => {
          const Icon = n.icon;
          const mine = n.role && role === n.role;
          return (
            <div
              key={n.id}
              className="absolute top-0 flex w-[20%] -translate-x-1/2 flex-col items-center gap-1.5 text-center transition-[left] duration-700 ease-in-out"
              style={{ left: `${10 + n.slot * 20}%` }}
            >
              <span
                className={cn(
                  "flex h-12 w-12 items-center justify-center rounded-full border-2 bg-background shadow-sm",
                  n.id === "pay" && "border-rose-400 text-rose-600 dark:text-rose-400",
                  n.id === "recv" && "border-emerald-400 text-emerald-600 dark:text-emerald-400",
                  n.id === "done" && "border-green-500 bg-green-500 text-white",
                  mine && "docs-ring",
                )}
              >
                <Icon className="h-5 w-5" />
              </span>
              <span className="text-[11px] font-semibold leading-tight">
                {n.label}
              </span>
              {n.id === "pay" && v.dpbp && (
                <span key={v.id} className="docs-pop flex gap-1 text-[9px] font-semibold">
                  <span className="rounded bg-rose-100 px-1 text-rose-700 dark:bg-rose-900/50 dark:text-rose-300">
                    DP
                  </span>
                  <span className="rounded bg-rose-100 px-1 text-rose-700 dark:bg-rose-900/50 dark:text-rose-300">
                    BP
                  </span>
                </span>
              )}
            </div>
          );
        })}
        {/* Status di antara dua step tengah */}
        <div
          key={v.id}
          className="docs-pop absolute bottom-0 left-1/2 flex -translate-x-1/2 flex-col items-center gap-1"
        >
          <span className="text-[10px] text-muted-foreground">status di tengah</span>
          <StatusPill status={v.between} />
        </div>
      </div>

      <div
        key={`desc-${v.id}`}
        className="docs-fade-up mt-4 rounded-lg border bg-muted/30 p-4 text-sm leading-relaxed text-muted-foreground"
      >
        {v.desc}
      </div>

      <p className="mt-3 text-xs text-muted-foreground">
        Di semua jalur, status akhir PO selalu{" "}
        <StatusPill status="Full Received" /> (qty sesuai) atau{" "}
        <StatusPill status="Partial Receive" /> (ada yang kurang).
      </p>
    </Section>
  );
}

// ===========================================================================
// PENERIMAAN / TIPE VENDOR
// ===========================================================================

export function VendorSection() {
  return (
    <Section id="penerimaan">
      <SectionTitle
        icon={Truck}
        title="Penerimaan Barang per Tipe Vendor"
        subtitle="Setiap vendor wajib punya Tipe Vendor (HO/Branch/Site). Tipe ini menentukan siapa yang menerima barang."
      />
      <div className="space-y-4">
        {VENDOR_ROUTES.map((r, idx) => (
          <div key={r.id} className="rounded-xl border p-4">
            <p className="mb-4 text-sm font-semibold">{r.label}</p>
            <div className="relative mb-4 flex items-start justify-between px-2 sm:px-6">
              <div className="absolute left-10 right-10 top-5 border-t-2 border-dashed sm:left-14 sm:right-14">
                <Truck
                  className="docs-travel-x absolute h-5 w-5 -translate-x-1/2 -translate-y-1/2 text-primary"
                  style={
                    {
                      "--docs-duration": `${4 + idx}s`,
                      top: "-1px",
                    } as React.CSSProperties
                  }
                />
              </div>
              {r.stops.map((s) => {
                const meta = s.role ? ROLE_META[s.role] : null;
                const Icon = meta?.icon ?? Factory;
                return (
                  <div
                    key={s.label}
                    className="relative z-10 flex w-24 flex-col items-center gap-1.5 text-center"
                  >
                    <span
                      className={cn(
                        "flex h-10 w-10 items-center justify-center rounded-full border-2 bg-background",
                        meta ? "border-primary/40" : "border-border",
                      )}
                    >
                      <Icon className="h-4 w-4" />
                    </span>
                    <span className="text-[11px] font-medium leading-tight">
                      {s.label}
                    </span>
                  </div>
                );
              })}
            </div>
            <p className="text-sm text-muted-foreground">{r.desc}</p>
          </div>
        ))}
      </div>
    </Section>
  );
}

// ===========================================================================
// PRIORITAS & LEVEL
// ===========================================================================

export function PrioritySection() {
  return (
    <Section id="prioritas">
      <SectionTitle
        icon={Sparkles}
        title="Prioritas MR & Level MR"
        subtitle="Prioritas dipilih Requester, dan Due Date otomatis mengikuti."
      />
      <div className="space-y-2.5">
        {PRIORITIES.map((p, i) => (
          <div key={p.code} className="grid grid-cols-[3rem_1fr] items-center gap-3 sm:grid-cols-[3rem_9rem_1fr]">
            <span
              className={cn(
                "flex h-8 items-center justify-center rounded-md text-sm font-bold text-white",
                p.color,
              )}
            >
              {p.code}
            </span>
            <span className="hidden text-sm font-medium sm:block">{p.name}</span>
            <div className="flex items-center gap-2">
              <div className="h-3 flex-1 overflow-hidden rounded-full bg-muted">
                <div
                  className={cn("docs-grow-x h-full rounded-full", p.color)}
                  style={{
                    width: `${(p.days / 30) * 100}%`,
                    animationDelay: `${i * 0.12}s`,
                  }}
                />
              </div>
              <span className="w-16 shrink-0 text-right text-xs font-semibold tabular-nums">
                {p.days} hari
              </span>
            </div>
          </div>
        ))}
      </div>
      <p className="mt-3 text-xs text-muted-foreground">
        Due Date = hari ini + batas hari tiap prioritas. Kalau prioritas belum
        dipilih, default-nya P4.
      </p>

      <div className="mt-8">
        <p className="mb-1 font-semibold">Level MR</p>
        <p className="mb-4 text-xs text-muted-foreground">
          Posisi fisik barang dari pengajuan sampai diterima di site.
        </p>
        <div className="grid gap-4 lg:grid-cols-2">
          {(["OPEN", "CLOSE"] as const).map((group) => (
            <div
              key={group}
              className={cn(
                "rounded-xl border p-4",
                group === "OPEN"
                  ? "border-amber-200 bg-amber-50/50 dark:border-amber-900 dark:bg-amber-950/20"
                  : "border-emerald-200 bg-emerald-50/50 dark:border-emerald-900 dark:bg-emerald-950/20",
              )}
            >
              <p className="mb-3 text-xs font-semibold uppercase tracking-wide">
                {group === "OPEN"
                  ? "OPEN · barang belum diterima site"
                  : "CLOSE · barang sudah diterima site"}
              </p>
              <ol className="space-y-2">
                {MR_LEVELS.filter((l) => l.group === group).map((l) => (
                  <li key={l.value} className="flex gap-2 text-sm">
                    <span
                      className={cn(
                        "h-fit shrink-0 rounded px-1.5 py-0.5 text-[10px] font-bold text-white",
                        group === "OPEN" ? "bg-amber-500" : "bg-emerald-600",
                      )}
                    >
                      {l.value}
                    </span>
                    <span className="text-muted-foreground">{l.description}</span>
                  </li>
                ))}
              </ol>
            </div>
          ))}
        </div>
      </div>
    </Section>
  );
}

// ===========================================================================
// KAMUS STATUS
// ===========================================================================

export function StatusSection() {
  const [group, setGroup] = useState(STATUS_GROUPS[0].id);
  const [query, setQuery] = useState("");
  const q = query.trim().toLowerCase();

  const searchResults = useMemo(() => {
    if (!q) return null;
    return STATUS_GROUPS.flatMap((g) =>
      g.entries
        .filter((e) =>
          [e.status, e.label ?? "", e.desc].some((s) =>
            s.toLowerCase().includes(q),
          ),
        )
        .map((e) => ({ ...e, group: g.label })),
    );
  }, [q]);

  const current = STATUS_GROUPS.find((g) => g.id === group)!;
  const main = current.entries.filter((e) => e.main);

  return (
    <Section id="status">
      <SectionTitle
        icon={Search}
        title="Kamus Status"
        subtitle="Bingung arti sebuah status? Cari di sini."
      />

      <div className="relative mb-4">
        <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder='Cari status, mis. "Partial" atau "Selesai"'
          className="pl-9"
        />
      </div>

      {searchResults ? (
        searchResults.length === 0 ? (
          <p className="py-6 text-center text-sm text-muted-foreground">
            Tidak ada status yang cocok dengan &quot;{query}&quot;.
          </p>
        ) : (
          <div className="grid gap-2 sm:grid-cols-2">
            {searchResults.map((e) => (
              <StatusCard key={`${e.group}-${e.status}`} entry={e} group={e.group} />
            ))}
          </div>
        )
      ) : (
        <>
          <div className="mb-4 flex flex-wrap gap-1.5">
            {STATUS_GROUPS.map((g) => (
              <button
                key={g.id}
                type="button"
                onClick={() => setGroup(g.id)}
                className={cn(
                  "rounded-full border px-3 py-1 text-xs font-medium transition-colors",
                  group === g.id
                    ? "border-primary bg-primary text-primary-foreground"
                    : "hover:bg-muted",
                )}
              >
                {g.label}
              </button>
            ))}
          </div>

          <p className="mb-3 text-xs text-muted-foreground">{current.hint}</p>

          {/* Rantai jalur utama */}
          <div
            key={`chain-${group}`}
            className="mb-5 flex flex-wrap items-center gap-1.5 rounded-lg border bg-muted/30 p-3"
          >
            {main.map((e, i) => (
              <span
                key={e.status}
                className="docs-fade-up flex items-center gap-1.5"
                style={{ animationDelay: `${i * 0.08}s` }}
              >
                <StatusPill status={e.status} label={e.label} domain={e.domain} />
                {i < main.length - 1 && (
                  <ArrowRight className="h-3.5 w-3.5 text-muted-foreground" />
                )}
              </span>
            ))}
          </div>

          <div key={`list-${group}`} className="grid gap-2 sm:grid-cols-2">
            {current.entries.map((e) => (
              <StatusCard key={e.status} entry={e} />
            ))}
          </div>
        </>
      )}
    </Section>
  );
}

function StatusCard({ entry, group }: { entry: StatusEntry; group?: string }) {
  return (
    <div className="docs-fade-up rounded-lg border p-3">
      <div className="mb-1 flex flex-wrap items-center gap-2">
        <StatusPill status={entry.status} label={entry.label} domain={entry.domain} />
        {group && (
          <span className="text-[10px] text-muted-foreground">{group}</span>
        )}
        {!entry.main && !group && (
          <span className="text-[10px] text-muted-foreground">di luar jalur utama</span>
        )}
      </div>
      <p className="text-xs text-muted-foreground">{entry.desc}</p>
    </div>
  );
}

// ===========================================================================
// FAQ
// ===========================================================================

export function FaqSection({ role }: { role: RoleId | null }) {
  const [query, setQuery] = useState("");
  const [onlyMine, setOnlyMine] = useState(false);
  const q = query.trim().toLowerCase();

  const list = FAQS.filter(
    (f) =>
      (!q || f.q.toLowerCase().includes(q)) &&
      (!onlyMine || !role || f.tags.includes(role)),
  );

  return (
    <Section id="faq">
      <SectionTitle icon={HelpCircle} title="Pertanyaan yang sering muncul" />
      <div className="mb-3 flex flex-col gap-2 sm:flex-row sm:items-center">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Cari pertanyaan…"
            className="pl-9"
          />
        </div>
        {role && role !== "system" && (
          <button
            type="button"
            onClick={() => setOnlyMine((v) => !v)}
            className={cn(
              "inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs font-medium transition-colors",
              onlyMine ? "border-primary bg-primary text-primary-foreground" : "hover:bg-muted",
            )}
          >
            {onlyMine && <Check className="h-3.5 w-3.5" />}
            Hanya untuk {ROLE_META[role].label}
          </button>
        )}
      </div>
      {list.length === 0 ? (
        <p className="py-6 text-center text-sm text-muted-foreground">
          Tidak ada pertanyaan yang cocok.
        </p>
      ) : (
        <Accordion type="single" collapsible>
          {list.map((f) => (
            <AccordionItem key={f.q} value={f.q}>
              <AccordionTrigger className="text-left text-sm font-medium">
                {f.q}
              </AccordionTrigger>
              <AccordionContent className="space-y-2 text-sm text-muted-foreground">
                <p>{f.a}</p>
                <div className="flex flex-wrap gap-1">
                  {f.tags.map((t) => (
                    <RoleChip key={t} role={t} className="text-[10px]" />
                  ))}
                </div>
              </AccordionContent>
            </AccordionItem>
          ))}
        </Accordion>
      )}
    </Section>
  );
}

// ===========================================================================
// DAFTAR ISI
// ===========================================================================

export function useActiveSection() {
  const [active, setActive] = useState(TOC[0].id);
  useEffect(() => {
    const els = TOC.map((t) => document.getElementById(t.id)).filter(
      (e): e is HTMLElement => !!e,
    );
    const obs = new IntersectionObserver(
      (entries) => {
        const visible = entries
          .filter((e) => e.isIntersecting)
          .sort((a, b) => a.boundingClientRect.top - b.boundingClientRect.top);
        if (visible[0]) setActive(visible[0].target.id);
      },
      { rootMargin: "-15% 0px -70% 0px" },
    );
    els.forEach((e) => obs.observe(e));
    return () => obs.disconnect();
  }, []);
  return active;
}

export function TocDesktop({
  active,
  onNavigate,
}: {
  active: string;
  onNavigate: (id: string) => void;
}) {
  return (
    <nav className="sticky top-4 hidden lg:block">
      <p className="mb-2 px-3 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
        Daftar isi
      </p>
      <ul className="space-y-0.5 border-l">
        {TOC.map((t) => (
          <li key={t.id}>
            <button
              type="button"
              onClick={() => onNavigate(t.id)}
              className={cn(
                "-ml-px w-full border-l-2 px-3 py-1.5 text-left text-sm transition-colors",
                active === t.id
                  ? "border-primary font-medium text-foreground"
                  : "border-transparent text-muted-foreground hover:text-foreground",
              )}
            >
              {t.label}
            </button>
          </li>
        ))}
      </ul>
    </nav>
  );
}

export function TocMobile({
  active,
  onNavigate,
}: {
  active: string;
  onNavigate: (id: string) => void;
}) {
  const listRef = useRef<HTMLUListElement>(null);

  // Geser chip aktif ke tengah - scroll container-nya langsung (bukan
  // scrollIntoView) supaya tidak memotong smooth-scroll halaman.
  useEffect(() => {
    const list = listRef.current;
    const chip = document.getElementById(`toc-chip-${active}`);
    if (!list || !chip) return;
    list.scrollTo({
      left: chip.offsetLeft - list.clientWidth / 2 + chip.clientWidth / 2,
      behavior: "smooth",
    });
  }, [active]);

  return (
    <nav className="sticky top-0 z-20 -mx-4 border-b bg-background/90 px-4 py-2 backdrop-blur lg:hidden">
      <ul
        ref={listRef}
        className="relative flex gap-1.5 overflow-x-auto [scrollbar-width:none]"
      >
        {TOC.map((t) => (
          <li key={t.id} className="shrink-0">
            <button
              id={`toc-chip-${t.id}`}
              type="button"
              onClick={() => onNavigate(t.id)}
              className={cn(
                "rounded-full border px-3 py-1 text-xs font-medium transition-colors",
                active === t.id
                  ? "border-primary bg-primary text-primary-foreground"
                  : "bg-background text-muted-foreground",
              )}
            >
              {t.label}
            </button>
          </li>
        ))}
      </ul>
    </nav>
  );
}
