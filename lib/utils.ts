import { clsx, type ClassValue } from "clsx";
import { differenceInCalendarDays, isValid, parse } from "date-fns";
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

export function parseCSV(csv: string): string[][] {
  return csv
    .trim()
    .split("\n")
    .map(
      (line) =>
        line.split(",").map((cell) => cell.replace(/^"|"$/g, "").trim()), // buang tanda kutip
    );
}

export function validateCSV(csv: string) {
  const rows = parseCSV(csv);
  const [header, ...data] = rows;

  const expected = ["part_number", "part_name", "category", "uom", "vendor"];
  if (header.join(",") !== expected.join(",")) {
    return { valid: false, errors: ["Header CSV tidak sesuai"], rows: [] };
  }

  const seen = new Set<string>();
  const uniqueRows: string[][] = [];
  const errors: string[] = [];

  data.forEach((cols, i) => {
    const partNumber = cols[0];
    if (!partNumber) {
      errors.push(`Baris ${i + 2}: part_number kosong`);
      return;
    }
    if (seen.has(partNumber)) {
      errors.push(`Duplikat di CSV pada baris ${i + 2}: ${partNumber}`);
      return;
    }
    seen.add(partNumber);
    uniqueRows.push(cols);
  });

  return { valid: errors.length === 0, errors, rows: uniqueRows };
}

/**
 * Memformat tanggal menjadi format lengkap bahasa Indonesia.
 * @param dateString Tanggal dalam format string atau Date
 * @returns String tanggal yang diformat, cth: "Minggu, 12 Oktober 2025"
 */
export const formatDate = (dateString?: string | Date): string => {
  if (!dateString) return "N/A";
  return new Date(dateString).toLocaleDateString("id-ID", {
    weekday: "long",
    year: "numeric",
    month: "long",
    day: "numeric",
  });
};

/**
 * Memformat angka atau string angka menjadi format mata uang Rupiah.
 * @param value Angka atau string yang akan diformat
 * @returns String mata uang yang diformat, cth: "Rp 1.500.000"
 */
export const formatCurrency = (value?: string | number): string => {
  const numericValue = Number(value);
  if (value === null || value === undefined || isNaN(numericValue))
    return "Rp 0";

  return new Intl.NumberFormat("id-ID", {
    style: "currency",
    currency: "IDR",
    minimumFractionDigits: 0,
  }).format(numericValue);
};

export const formatDateFriendly = (date?: Date | string): string => {
  if (!date) return "N/A";

  const dateObj = new Date(date);
  // Cek apakah tanggal valid
  if (isNaN(dateObj.getTime())) {
    return "N/A";
  }

  return dateObj.toLocaleDateString("id-ID", {
    weekday: "long",
    year: "numeric",
    month: "long",
    day: "numeric",
  });
};

// --- TAMBAHKAN FUNGSI BARU DI BAWAH INI ---
export const formatDateWithTime = (date?: Date | string | null): string => {
  if (!date) return "";
  return (
    new Date(date).toLocaleString("id-ID", {
      year: "numeric",
      month: "long",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
      timeZone: "Asia/Jakarta", // Pastikan zona waktu WIB
    }) + " WIB"
  );
};

export const calculatePriority = (
  dueDate: Date | string | undefined | null,
  startDate?: Date | string | undefined | null,
): string => {
  // 1. Jika due date kosong, kembalikan default P4 (paling rendah)
  if (!dueDate) return "P4";

  // 2. Tentukan Start Date (Hari ini atau Created At)
  const start = startDate ? new Date(startDate) : new Date();
  start.setHours(0, 0, 0, 0); // Reset jam ke 00:00

  // 3. Tentukan Due Date
  const due = new Date(dueDate);
  due.setHours(0, 0, 0, 0); // Reset jam ke 00:00

  // Validasi tanggal
  if (isNaN(due.getTime()) || isNaN(start.getTime())) return "P4";

  // 4. Hitung Selisih (dalam milidetik)
  const diffTime = due.getTime() - start.getTime();
  // Konversi ke hari (pembulatan ke atas)
  const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

  // <= 2 Hari -> P0
  if (diffDays <= 2) return "P0";

  // 3 sampai 10 Hari -> P1
  if (diffDays <= 10) return "P1";

  // 11 sampai 15 Hari -> P2
  if (diffDays <= 15) return "P2";

  // 16 sampai 25 Hari -> P3
  if (diffDays <= 25) return "P3";

  // > 25 Hari -> P4
  return "P4";
};

// Helper untuk mendapatkan warna badge berdasarkan prioritas (Opsional)
export const getPriorityColor = (priority: string) => {
  switch (priority) {
    case "P0":
      return "destructive"; // Merah
    case "P1":
      return "orange-500"; // Orange (custom class)
    case "P2":
      return "yellow-500"; // Kuning
    case "P3":
      return "blue-500"; // Biru
    default:
      return "secondary"; // Abu-abu
  }
};
