// src/app/(With Sidebar)/petty-cash/page.tsx
//
// Dashboard Petty Cash - bagian dari revisi "Rombak Petty Cash" yang
// menyederhanakan menu sidebar Petty Cash. Halaman lama (daftar "Pengajuan
// Saya" berbasis tabel petty_cash_pengajuan) sudah dipindah ke
// /petty-cash/pengajuan-saya; implementasinya masih ada di riwayat git.
//
// Isi Dashboard-nya sendiri ada di PcDashboardClient.tsx (sengaja dipisah
// dari page.tsx ini, pola yang sama dgn halaman Petty Cash lain di folder
// ini) - lihat komentar di file itu & planning-pc.md Bagian 2 utk rancangan
// lengkapnya (status turunan, panel "Perlu Tindakan Anda", dst).

import PcDashboardClient from "./PcDashboardClient";

export default function PettyCashDashboardPage() {
  return <PcDashboardClient />;
}
