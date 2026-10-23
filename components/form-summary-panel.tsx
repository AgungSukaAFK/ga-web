"use client";

import { ReactNode, useCallback, useEffect, useRef, useState } from "react";
import {
  AlertTriangle,
  CheckCircle2,
  ChevronRight,
  Circle,
  CircleDashed,
  Info,
  ListChecks,
  Loader2,
  PanelRightClose,
} from "lucide-react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { cn } from "@/lib/utils";

/**
 * - `done`: syarat terpenuhi.
 * - `todo`: wajib & belum terpenuhi - memblok tombol submit (klik submit akan
 *   scroll ke langkah ini).
 * - `suggested`: belum diisi & disarankan diisi, tapi TIDAK memblok (dipakai
 *   di halaman edit yang validasinya longgar). Dihitung belum lengkap.
 * - `warning`: terpenuhi tapi perlu perhatian (mis. Direct PO tanpa MR),
 *   tidak memblok. Dihitung lengkap.
 * - `optional`: opsional & belum diisi, tidak dihitung di progress.
 */
export type FormSummaryCheckStatus =
  | "done"
  | "todo"
  | "suggested"
  | "warning"
  | "optional";

export type FormSummaryCheck = {
  id: string;
  label: string;
  status: FormSummaryCheckStatus;
  /** Nilai saat ini, tampil di kanan (di-truncate). */
  value?: ReactNode;
  /** Keterangan kecil di bawah label, mis. apa yang kurang. */
  hint?: string;
  /** id elemen section/field yang di-scroll & di-highlight saat baris diklik. */
  targetId?: string;
};

export type FormSummaryProps = {
  title: string;
  /** Kode dokumen / subjudul kecil di bawah title. */
  subtitle?: ReactNode;
  checks: FormSummaryCheck[];
  /** Konten tambahan di bawah checklist (mis. rincian biaya). */
  children?: ReactNode;
  submitLabel: string;
  submittingLabel?: string;
  submitIcon?: ReactNode;
  onSubmit: () => void;
  submitting?: boolean;
  /** Disable karena proses lain (upload dsb) - BUKAN karena form belum lengkap. */
  disabled?: boolean;
  error?: string;
  /** Penjelasan "setelah diajukan ...". */
  nextSteps?: ReactNode;
  /** Ada perubahan yang belum disimpan (halaman edit). */
  dirty?: boolean;
  /** Aksi tambahan di bawah tombol submit (mis. cetak preview). */
  secondaryActions?: ReactNode;
};

// Preferensi buka/tutup panel dipakai bersama semua form (MR, PO, ...).
const STORAGE_KEY = "ga-web:form-summary-open";
const XL_QUERY = "(min-width: 1280px)";

const HIGHLIGHT_CLASSES = [
  "ring-2",
  "ring-primary",
  "ring-offset-2",
  "ring-offset-background",
];

export function scrollToFormSection(targetId: string) {
  const el = document.getElementById(targetId);
  if (!el) return;
  // Berhenti di bawah topbar sticky, bukan di belakangnya.
  const topbar = document.querySelector("[data-app-topbar]");
  const offset = (topbar?.getBoundingClientRect().bottom ?? 0) + 16;
  const top = el.getBoundingClientRect().top + window.scrollY - offset;
  window.scrollTo({ top, behavior: "smooth" });
  el.classList.add(...HIGHLIGHT_CLASSES, "transition-shadow");
  window.setTimeout(() => el.classList.remove(...HIGHLIGHT_CLASSES), 1600);
}

/**
 * Deteksi "ada perubahan belum disimpan" dengan membandingkan `value` ke
 * snapshot-nya. Snapshot diambil sebentar setelah `ready` (bukan tepat saat
 * data dimuat) supaya hasil effect kalkulasi awal (pajak, total, dsb) tidak
 * terhitung sebagai perubahan. Panggil `resetBaseline` setelah data disimpan
 * & dimuat ulang.
 */
export function useUnsavedChanges(value: unknown, ready: boolean) {
  const [baseline, setBaseline] = useState<string | null>(null);
  const [epoch, setEpoch] = useState(0);
  const latest = useRef(value);

  useEffect(() => {
    latest.current = value;
  });

  useEffect(() => {
    setBaseline(null);
    if (!ready) return;
    const timer = window.setTimeout(
      () => setBaseline(JSON.stringify(latest.current)),
      400,
    );
    return () => window.clearTimeout(timer);
  }, [ready, epoch]);

  const resetBaseline = useCallback(() => setEpoch((e) => e + 1), []);
  const dirty = baseline !== null && JSON.stringify(value) !== baseline;
  return { dirty, resetBaseline };
}

const STATUS_ICON: Record<FormSummaryCheckStatus, ReactNode> = {
  done: <CheckCircle2 className="h-4 w-4 text-emerald-600 dark:text-emerald-400" />,
  todo: <Circle className="h-4 w-4 text-muted-foreground" />,
  suggested: <Circle className="h-4 w-4 text-amber-500 dark:text-amber-400" />,
  warning: (
    <AlertTriangle className="h-4 w-4 text-amber-600 dark:text-amber-400" />
  ),
  optional: <CircleDashed className="h-4 w-4 text-muted-foreground/70" />,
};

function getProgress(checks: FormSummaryCheck[]) {
  const required = checks.filter((c) => c.status !== "optional");
  const done = required.filter(
    (c) => c.status === "done" || c.status === "warning",
  ).length;
  const pending = checks.filter((c) => c.status === "todo");
  const suggested = checks.filter((c) => c.status === "suggested");
  return {
    done,
    total: required.length,
    pending,
    suggested,
    /** Tidak ada yang memblok submit. */
    canSubmit: pending.length === 0,
    /** Semua yang dihitung sudah lengkap. */
    complete: pending.length === 0 && suggested.length === 0,
    percent: required.length ? Math.round((done / required.length) * 100) : 100,
  };
}

function ProgressBadge({
  done,
  total,
  complete,
  className,
}: {
  done: number;
  total: number;
  complete: boolean;
  className?: string;
}) {
  return (
    <span
      className={cn(
        "shrink-0 rounded-full px-2 py-0.5 text-xs font-medium tabular-nums",
        complete
          ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300"
          : "bg-muted text-muted-foreground",
        className,
      )}
    >
      {done}/{total}
    </span>
  );
}

function DirtyBadge() {
  return (
    <span className="inline-flex items-center gap-1.5 rounded-full bg-amber-100 px-2 py-0.5 text-[11px] font-medium text-amber-800 dark:bg-amber-900/40 dark:text-amber-300">
      <span className="h-1.5 w-1.5 rounded-full bg-amber-500" />
      Belum disimpan
    </span>
  );
}

function ProgressHint({
  progress,
}: {
  progress: ReturnType<typeof getProgress>;
}) {
  if (progress.pending.length > 0) {
    return (
      <>
        Lengkapi {progress.pending.length} langkah wajib bertanda{" "}
        <Circle className="-mt-0.5 inline h-3 w-3" /> dulu.
      </>
    );
  }
  if (progress.suggested.length > 0) {
    return (
      <>
        {progress.suggested.length} data belum lengkap{" "}
        <Circle className="-mt-0.5 inline h-3 w-3 text-amber-500" />, tetap
        bisa disimpan.
      </>
    );
  }
  return null;
}

function SubmitButton({
  props,
  onClick,
}: {
  props: FormSummaryProps;
  onClick: () => void;
}) {
  const { submitting, disabled, submittingLabel = "Mengajukan..." } = props;
  return (
    <Button
      className="w-full"
      size="lg"
      onClick={onClick}
      disabled={submitting || disabled}
    >
      {submitting ? (
        <>
          <Loader2 className="mr-2 h-4 w-4 animate-spin" />
          {submittingLabel}
        </>
      ) : (
        <>
          {props.submitIcon}
          {props.submitLabel}
        </>
      )}
    </Button>
  );
}

/** Isi panel: header & tombol submit menempel, checklist di tengah bisa di-scroll. */
function SummaryPanelBody({
  props,
  onClose,
  onNavigate,
  onSubmit,
}: {
  props: FormSummaryProps;
  onClose: () => void;
  onNavigate: (targetId: string) => void;
  onSubmit: () => void;
}) {
  const progress = getProgress(props.checks);
  const { done, total, complete, percent } = progress;

  return (
    <Card className="flex h-full flex-col gap-0 overflow-hidden rounded-none border-0 border-l py-0 shadow-none">
      <div className="shrink-0 space-y-3 border-b px-5 pt-4 pb-4">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <h2 className="font-semibold leading-tight [overflow-wrap:anywhere]">{props.title}</h2>
            {props.subtitle && (
              <div className="mt-1.5 truncate text-xs text-muted-foreground">
                {props.subtitle}
              </div>
            )}
          </div>
          <div className="flex shrink-0 items-center gap-1">
            <ProgressBadge done={done} total={total} complete={complete} />
            <Button
              type="button"
              variant="ghost"
              size="icon"
              className="h-8 w-8 -mr-2"
              onClick={onClose}
              title="Sembunyikan ringkasan"
              aria-label="Sembunyikan ringkasan"
            >
              <PanelRightClose className="h-4 w-4" />
            </Button>
          </div>
        </div>
        <div
          className="h-1.5 w-full overflow-hidden rounded-full bg-muted"
          role="progressbar"
          aria-valuenow={percent}
          aria-valuemin={0}
          aria-valuemax={100}
          aria-label="Kelengkapan form"
        >
          <div
            className={cn(
              "h-full rounded-full transition-all duration-500",
              complete ? "bg-emerald-500" : "bg-primary",
            )}
            style={{ width: `${percent}%` }}
          />
        </div>
        {props.dirty && <DirtyBadge />}
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain">
        <ul className="px-2 py-2">
          {props.checks.map((check) => {
            const clickable = !!check.targetId;
            const Row = clickable ? "button" : "div";
            return (
              <li key={check.id}>
                <Row
                  {...(clickable
                    ? {
                        type: "button" as const,
                        onClick: () => onNavigate(check.targetId!),
                      }
                    : {})}
                  className={cn(
                    "group flex w-full items-start gap-2.5 rounded-md px-3 py-2 text-left text-sm",
                    clickable && "transition-colors hover:bg-muted/60",
                  )}
                >
                  <span className="mt-0.5 shrink-0">
                    {STATUS_ICON[check.status]}
                  </span>
                  <span className="min-w-0 flex-1">
                    <span
                      className={cn(
                        "block [overflow-wrap:anywhere]",
                        check.status === "todo" || check.status === "suggested"
                          ? "font-medium"
                          : "text-muted-foreground",
                        check.status === "done" &&
                          "line-through decoration-muted-foreground/50",
                      )}
                    >
                      {check.label}
                      {check.status === "optional" && (
                        <span className="ml-1 text-[11px] text-muted-foreground/70">
                          (opsional)
                        </span>
                      )}
                    </span>
                    {check.hint && (
                      <span
                        className={cn(
                          "mt-0.5 block text-xs [overflow-wrap:anywhere]",
                          check.status === "warning" ||
                            check.status === "suggested"
                            ? "text-amber-700 dark:text-amber-400"
                            : "text-muted-foreground",
                        )}
                      >
                        {check.hint}
                      </span>
                    )}
                  </span>
                  {check.value !== undefined && check.value !== null && (
                    <span className="max-w-[50%] truncate text-right font-medium">
                      {check.value}
                    </span>
                  )}
                  {clickable && (
                    <ChevronRight className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground/0 transition-colors group-hover:text-muted-foreground" />
                  )}
                </Row>
              </li>
            );
          })}
        </ul>

        {props.children && (
          <div className="border-t px-5 py-4">{props.children}</div>
        )}
      </div>

      <div className="shrink-0 space-y-3 border-t bg-muted/30 px-5 py-4">
        {props.error && (
          <Alert variant="destructive">
            <AlertTitle>Perhatian!</AlertTitle>
            <AlertDescription>{props.error}</AlertDescription>
          </Alert>
        )}
        <SubmitButton props={props} onClick={onSubmit} />
        {props.secondaryActions}
        {!complete && (
          <p className="text-center text-xs text-muted-foreground">
            <ProgressHint progress={progress} />
          </p>
        )}
        {props.nextSteps && (
          <div className="flex gap-2 text-xs text-muted-foreground">
            <Info className="mt-0.5 h-3.5 w-3.5 shrink-0" />
            <div>{props.nextSteps}</div>
          </div>
        )}
      </div>
    </Card>
  );
}

/**
 * Layout form + panel ringkasan di kanan yang bisa di-show/hide.
 *
 * - Panel `fixed` setinggi layar (desktop: di bawah topbar) & geser
 *   masuk/keluar dari kanan; isinya scroll sendiri, header & tombol submit
 *   tetap menempel.
 * - Desktop (xl): saat terbuka, form ikut menyempit (tidak tertutup panel).
 *   Layar kecil: panel jadi overlay dengan backdrop, selalu mulai tertutup.
 * - Default tertutup; pilihan show/hide user diingat (localStorage, dipakai
 *   bersama semua form) dan diterapkan lagi di desktop.
 * - Selalu ada bar submit di akhir form (disembunyikan di desktop saat panel
 *   terbuka), jadi form tetap bisa diajukan walau panel tertutup.
 * - Area form berupa grid 12 kolom (sama dengan layout halaman) sekaligus
 *   container `@container/form`, jadi children bisa pakai `col-span-*` biasa
 *   atau `@3xl/form:col-span-*` kalau perlu ikut lebar form (bukan layar).
 * - `enabled={false}`: panel, tab & bar submit disembunyikan, children tetap
 *   dirender di struktur yang sama (tidak remount saat di-toggle).
 *
 * Tombol submit sengaja tidak di-disable saat form belum lengkap: kalau
 * masih ada langkah `todo`, klik submit scroll ke langkah pertama yang kurang
 * (validasi asli halaman tetap jadi pengaman terakhir di `onSubmit`).
 */
export function FormSummaryLayout({
  summary,
  children,
  enabled = true,
  className,
}: {
  summary: FormSummaryProps;
  children: ReactNode;
  enabled?: boolean;
  /** Mis. "no-print" supaya seluruh form & panel tidak ikut tercetak. */
  className?: string;
}) {
  const [storedOpen, setStoredOpen] = useState(false);
  const [isXl, setIsXl] = useState(false);
  // Transisi baru diaktifkan setelah preferensi tersimpan diterapkan, supaya
  // panel tidak "geser masuk" sendiri tiap halaman dibuka.
  const [animate, setAnimate] = useState(false);
  const open = enabled && storedOpen;

  useEffect(() => {
    const mql = window.matchMedia(XL_QUERY);
    setIsXl(mql.matches);
    if (mql.matches) {
      try {
        setStoredOpen(window.localStorage.getItem(STORAGE_KEY) === "true");
      } catch {
        // localStorage tidak tersedia (private mode dsb) - pakai default.
      }
    }
    const frame = requestAnimationFrame(() => setAnimate(true));
    const onChange = (e: MediaQueryListEvent) => {
      setIsXl(e.matches);
      // Turun ke layar kecil: jangan biarkan overlay menutupi form.
      if (!e.matches) setStoredOpen(false);
    };
    mql.addEventListener("change", onChange);
    return () => {
      cancelAnimationFrame(frame);
      mql.removeEventListener("change", onChange);
    };
  }, []);

  const setOpenAndRemember = useCallback((value: boolean) => {
    setStoredOpen(value);
    try {
      window.localStorage.setItem(STORAGE_KEY, String(value));
    } catch {
      // abaikan
    }
  }, []);

  // Esc menutup overlay di layar kecil.
  useEffect(() => {
    if (!open || isXl) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setStoredOpen(false);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, isXl]);

  // Di layar kecil overlay ditutup dulu (tanpa mengubah preferensi) supaya
  // section tujuan kelihatan.
  const navigate = (targetId: string) => {
    if (!isXl) setStoredOpen(false);
    scrollToFormSection(targetId);
  };

  const progress = getProgress(summary.checks);
  const handleSubmit = () => {
    const firstPending = progress.pending[0];
    if (firstPending) {
      if (firstPending.targetId) navigate(firstPending.targetId);
      return;
    }
    summary.onSubmit();
  };

  const transition = animate ? "duration-300 ease-out" : "duration-0";

  return (
    <div className={cn("col-span-12 flex", className)}>
      <div className="@container/form grid min-w-0 flex-1 grid-cols-12 content-start items-start gap-4 md:gap-6 [&>*]:min-w-0">
        {children}

        {/* Bar submit di akhir form */}
        {enabled && (
          <Card
            className={cn("col-span-12 gap-0 py-0", open && "xl:hidden")}
            aria-hidden={open && isXl}
          >
            {summary.error && (
              <div className="px-5 pt-4">
                <Alert variant="destructive">
                  <AlertTitle>Perhatian!</AlertTitle>
                  <AlertDescription>{summary.error}</AlertDescription>
                </Alert>
              </div>
            )}
            <div className="flex flex-col gap-3 px-5 py-4 sm:flex-row sm:items-center sm:justify-between">
              <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-sm">
                <ProgressBadge
                  done={progress.done}
                  total={progress.total}
                  complete={progress.complete}
                />
                <span className="text-muted-foreground">
                  {progress.complete ? (
                    "Semua data lengkap."
                  ) : (
                    <ProgressHint progress={progress} />
                  )}
                </span>
                {summary.dirty && <DirtyBadge />}
                <Button
                  type="button"
                  variant="link"
                  size="sm"
                  className="h-auto px-0"
                  onClick={() => setOpenAndRemember(true)}
                >
                  Lihat ringkasan
                </Button>
              </div>
              <div className="flex flex-col gap-2 sm:w-64 sm:shrink-0">
                <SubmitButton props={summary} onClick={handleSubmit} />
                {summary.secondaryActions}
              </div>
            </div>
          </Card>
        )}
      </div>

      {enabled && (
        <>
          {/* Spacer: menyempitkan form di desktop selebar panel saat terbuka */}
          <div
            aria-hidden
            className={cn(
              "hidden shrink-0 transition-[width] xl:block",
              transition,
              open ? "w-[384px]" : "w-0",
            )}
          />

          {/* Backdrop overlay (layar kecil saja) */}
          <div
            aria-hidden
            onClick={() => setStoredOpen(false)}
            className={cn(
              "fixed inset-0 z-40 bg-black/40 transition-opacity xl:hidden",
              transition,
              open ? "opacity-100" : "pointer-events-none opacity-0",
            )}
          />
        </>
      )}

      {/* Panel - tetap dirender saat disabled supaya animasi keluar jalan */}
      <aside
        aria-label={summary.title}
        aria-hidden={!open}
        inert={!open}
        className={cn(
          // Desktop: mulai di bawah topbar sticky (z-40) - tinggi topbar
          // ikut layout: h-16, h-12 saat sidebar diciutkan ke ikon.
          "fixed inset-y-0 right-0 z-50 w-[min(360px,calc(100vw-3rem))] bg-card shadow-xl transition-transform xl:top-16 xl:z-30 xl:shadow-none xl:group-has-data-[collapsible=icon]/sidebar-wrapper:top-12",
          transition,
          open ? "translate-x-0" : "translate-x-full",
        )}
      >
        <SummaryPanelBody
          props={summary}
          onClose={() =>
            isXl ? setOpenAndRemember(false) : setStoredOpen(false)
          }
          onNavigate={navigate}
          onSubmit={handleSubmit}
        />
      </aside>

      {/* Tab pembuka di tepi kanan layar */}
      <button
        type="button"
        onClick={() => setOpenAndRemember(true)}
        aria-label="Tampilkan ringkasan"
        title="Tampilkan ringkasan"
        className={cn(
          "fixed right-0 top-1/2 z-30 flex -translate-y-1/2 flex-col items-center gap-1.5 rounded-l-md border border-r-0 bg-primary px-1 py-2 text-primary-foreground shadow-md transition-transform hover:px-1.5",
          transition,
          enabled && !open ? "translate-x-0" : "translate-x-full",
        )}
        tabIndex={enabled && !open ? 0 : -1}
        aria-hidden={!enabled || open}
      >
        {summary.dirty && (
          <span className="absolute -left-1 -top-1 h-2.5 w-2.5 rounded-full border-2 border-background bg-amber-500" />
        )}
        <ListChecks className="h-3.5 w-3.5" />
        <span className="rotate-180 text-[10px] font-medium leading-none [writing-mode:vertical-rl]">
          Ringkasan
        </span>
        <span
          className={cn(
            "rounded-full px-1 py-px text-[9px] font-semibold tabular-nums",
            progress.complete
              ? "bg-emerald-500 text-white"
              : "bg-primary-foreground/20",
          )}
        >
          {progress.done}/{progress.total}
        </span>
      </button>
    </div>
  );
}
