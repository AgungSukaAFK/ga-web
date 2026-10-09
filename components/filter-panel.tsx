"use client";

import * as React from "react";
import { ChevronDown, SlidersHorizontal, X } from "lucide-react";

import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";

export type ActiveFilter = {
  /** Kunci unik, mis. "status". */
  key: string;
  /** Nama filter, mis. "Status". */
  label: string;
  /** Nilai yang sedang aktif, dalam bentuk yang mudah dibaca. */
  value: string;
  /** Hapus filter ini saja. Tanpa ini, chip tidak punya tombol ✕. */
  onRemove?: () => void;
};

const OPEN_STORAGE_KEY = "filter-panel-open";

function readStoredOpen(): boolean | null {
  try {
    const v = window.localStorage.getItem(OPEN_STORAGE_KEY);
    return v === null ? null : v === "1";
  } catch {
    return null;
  }
}

function writeStoredOpen(open: boolean) {
  try {
    window.localStorage.setItem(OPEN_STORAGE_KEY, open ? "1" : "0");
  } catch {
    // Storage tidak tersedia (mis. private mode) - cukup berlaku di sesi ini.
  }
}

/**
 * Container filter yang bisa dilipat, untuk filter di atas tabel list.
 *
 * - Pertama kali tertutup. Pilihan buka/tutup terakhir user diingat
 *   (localStorage, berlaku di semua halaman), jadi tetap terbuka setelah
 *   refresh / pindah halaman. Buka/tutup panel tidak mengubah filter.
 * - Filter yang sedang aktif selalu tampil sebagai chip (walau panel
 *   tertutup) dan bisa dihapus satu per satu, atau semua lewat Reset.
 * - Isi panel aman di mobile: field grid boleh menyusut, dropdown dan
 *   input dipaksa selebar kolomnya, teks panjang di chip dipotong "…".
 */
export function FilterPanel({
  activeFilters,
  onReset,
  children,
  className,
  defaultOpen = false,
}: {
  activeFilters: ActiveFilter[];
  onReset?: () => void;
  children: React.ReactNode;
  className?: string;
  defaultOpen?: boolean;
}) {
  const [open, setOpen] = React.useState(defaultOpen);

  // Dibaca setelah mount supaya render server & client tetap sama.
  React.useEffect(() => {
    const stored = readStoredOpen();
    if (stored !== null) setOpen(stored);
  }, []);

  const toggleOpen = () => {
    const next = !open;
    setOpen(next);
    writeStoredOpen(next);
  };
  const panelId = React.useId();
  const count = activeFilters.length;

  return (
    <div
      className={cn(
        "min-w-0 max-w-full rounded-lg border bg-muted/50 dark:bg-muted/10",
        className,
      )}
    >
      <div className="flex flex-wrap items-center gap-2 p-2 sm:px-3">
        <Button
          type="button"
          variant="ghost"
          size="sm"
          aria-expanded={open}
          aria-controls={panelId}
          onClick={toggleOpen}
          className="gap-2 px-2 font-medium"
        >
          <SlidersHorizontal className="h-4 w-4" />
          Filter
          {count > 0 && (
            <span className="inline-flex h-5 min-w-5 items-center justify-center rounded-full bg-primary px-1.5 text-[11px] font-semibold text-primary-foreground">
              {count}
            </span>
          )}
          <ChevronDown
            className={cn(
              "h-4 w-4 text-muted-foreground transition-transform",
              open && "rotate-180",
            )}
          />
        </Button>

        {count === 0 && !open && (
          <span className="text-xs text-muted-foreground">
            Tidak ada filter aktif
          </span>
        )}

        {count > 0 && onReset && (
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={onReset}
            className="ml-auto gap-1 px-2 text-muted-foreground"
          >
            <X className="h-3.5 w-3.5" />
            Reset
          </Button>
        )}

        {count > 0 && (
          <ul
            aria-label="Filter aktif"
            className="flex w-full min-w-0 flex-wrap gap-1.5"
          >
            {activeFilters.map((f) => (
              <li
                key={f.key}
                title={`${f.label}: ${f.value}`}
                className="inline-flex h-7 max-w-full min-w-0 items-center gap-1 rounded-full border bg-background pr-1 pl-2.5 text-xs shadow-xs"
              >
                <span className="shrink-0 text-muted-foreground">
                  {f.label}:
                </span>
                <span className="min-w-0 truncate font-medium">{f.value}</span>
                {f.onRemove ? (
                  <button
                    type="button"
                    onClick={f.onRemove}
                    aria-label={`Hapus filter ${f.label}`}
                    className="ml-0.5 inline-flex size-5 shrink-0 items-center justify-center rounded-full text-muted-foreground hover:bg-muted hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"
                  >
                    <X className="h-3 w-3" />
                  </button>
                ) : (
                  <span className="w-1.5 shrink-0" />
                )}
              </li>
            ))}
          </ul>
        )}
      </div>

      <div
        id={panelId}
        hidden={!open}
        className="min-w-0 border-t p-3 sm:p-4 [&_.grid>*]:min-w-0 [&_[data-slot=select-trigger]]:w-full [&_input]:min-w-0 [&_label]:break-words"
      >
        {children}
      </div>
    </div>
  );
}

// --- Helper untuk menyusun teks chip ---

/** "2026-10-09" -> "09 Okt 2026". */
export function formatFilterDate(value: string) {
  const date = new Date(`${value}T00:00:00`);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleDateString("id-ID", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
}

/** "150000" -> "Rp 150.000". */
export function formatFilterRupiah(value: string) {
  const num = Number(value);
  if (!Number.isFinite(num)) return value;
  return `Rp ${num.toLocaleString("id-ID")}`;
}

/** Rentang dua nilai: "A – B", "≥ A", atau "≤ B". */
export function formatFilterRange(
  from: string,
  to: string,
  format: (value: string) => string = (v) => v,
) {
  if (from && to) return `${format(from)} – ${format(to)}`;
  if (from) return `≥ ${format(from)}`;
  return `≤ ${format(to)}`;
}

/** Label dari daftar opsi {value, label}; fallback ke value-nya. */
export function filterOptionLabel(
  options: readonly { value: string; label: string }[],
  value: string,
) {
  return options.find((o) => o.value === value)?.label ?? value;
}
