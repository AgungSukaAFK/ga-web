import { clsx, type ClassValue } from "clsx";
import { isValid, parse } from "date-fns";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

// This check can be removed, it is just for tutorial purposes
export const hasEnvVars =
  process.env.NEXT_PUBLIC_SUPABASE_URL &&
  process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_OR_ANON_KEY;

export function formatTanggal(timestamp: number | string): string {
  const hari = ["Minggu", "Senin", "Selasa", "Rabu", "Kamis", "Jumat", "Sabtu"];
  const bulan = [
    "Januari",
    "Februari",
    "Maret",
    "April",
    "Mei",
    "Juni",
    "Juli",
    "Agustus",
    "September",
    "Oktober",
    "November",
    "Desember",
  ];

  let date: Date | null = null;

  if (typeof timestamp === "number") {
    date = new Date(timestamp);
  } else if (typeof timestamp === "string") {
    // Coba parse ISOString terlebih dahulu
    const isoDate = new Date(timestamp);
    if (isValid(isoDate)) {
      date = isoDate;
    } else {
      // Jika bukan ISOString, parse dengan format d/M/yyyy
      const parsed = parse(timestamp, "d/M/yyyy", new Date());
      if (isValid(parsed)) {
        date = parsed;
      }
    }
  }

  if (date && isValid(date)) {
    const hariNama = hari[date.getDay()];
    const tanggal = date.getDate();
    const bulanNama = bulan[date.getMonth()];
    const tahun = date.getFullYear();
    return `${hariNama}, ${tanggal} ${bulanNama} ${tahun}`;
  }

  return "Tanggal tidak valid";
}
