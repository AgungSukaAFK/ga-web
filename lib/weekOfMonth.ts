// src/lib/weekOfMonth.ts
//
// "Minggu ke berapa di bulan ini" - dipakai field week_of_month Input
// Pengajuan Petty Cash (lihat InputPengajuanClient.tsx). Minggu dihitung
// sederhana per-blok-7-hari dari tanggal 1 (bukan ISO week yang bisa
// menyeberang bulan), supaya "Minggu ke-1" selalu tanggal 1-7 bulan itu,
// dst - definisi paling gampang dipahami requester (bukan definisi
// kalender ISO 8601 yang lebih rumit & bisa membingungkan lintas bulan).

/** Minggu ke berapa (1-based) sebuah tanggal jatuh di bulannya sendiri. */
export const getWeekOfMonth = (date: Date): number =>
  Math.ceil(date.getDate() / 7);

/** Total jumlah minggu di bulan tempat `date` berada. */
export const getWeeksInMonth = (date: Date): number => {
  const lastDay = new Date(
    date.getFullYear(),
    date.getMonth() + 1,
    0,
  ).getDate();
  return Math.ceil(lastDay / 7);
};

/**
 * Daftar minggu yang boleh dipilih di bulan BERJALAN (bulan tanggal hari
 * ini) - minggu yang sudah lewat sengaja tidak disertakan, cuma minggu ini
 * sampai minggu terakhir bulan ini yang boleh dipilih (lihat requirement
 * "tidak bisa menggunakan week sebelumnya, hanya bisa week ini dan week ke
 * depan").
 */
export const getSelectableWeeksOfCurrentMonth = (): number[] => {
  const today = new Date();
  const currentWeek = getWeekOfMonth(today);
  const totalWeeks = getWeeksInMonth(today);
  const weeks: number[] = [];
  for (let w = currentWeek; w <= totalWeeks; w++) weeks.push(w);
  return weeks;
};
