// lib/constants/departments.ts

/**
 * Departemen yang memiliki hak akses & peran setara General Affair (GA):
 * validasi MR/PO, manajemen & validasi petty cash, akses cost center,
 * menu sidebar khusus GA, serta menjadi target notifikasi GA.
 *
 * Tambahkan departemen baru di sini agar otomatis memperoleh seluruh
 * privilege GA di seluruh aplikasi tanpa perlu mengubah banyak file.
 */
export const GA_DEPARTMENTS = ["General Affair", "HRGA-HSE"] as const;

/** True jika departemen memiliki hak akses setara General Affair. */
export const isGADepartment = (department?: string | null): boolean =>
  !!department && (GA_DEPARTMENTS as readonly string[]).includes(department);

/**
 * True jika user adalah admin departemen IT - dianggap setara superadmin:
 * selain fitur khusus IT (feedback user, inbox chat admin, reset password),
 * semua fitur yang dikunci ke role/departemen lain (validasi GA, menu
 * Approval & Validation, MR Saya, dst.) ikut terbuka. Pengecualian: approval
 * tetap hanya oleh orang yang ditunjuk di chain, dan scope company tetap
 * ikut profil. Harus sama dengan `public.is_it_admin()` di
 * supabase/migrations/0006_feedback.sql.
 */
export const isITAdmin = (
  profile?: { role?: string | null; department?: string | null } | null,
): boolean => profile?.role === "admin" && profile?.department === "IT";

/** Departemen Finance - nama persis di `profiles.department`. */
export const FINANCE_DEPARTMENT = "Finance";

export const isFinanceDepartment = (department?: string | null): boolean =>
  department === FINANCE_DEPARTMENT;

/**
 * Finance approver Petty Cash: memproses pembayaran tarikan, konfirmasi
 * pengembalian, & persetujuan pembatalan. Harus sama dengan cek di RPC
 * mark_petty_cash_sub_voucher_paid / approve_petty_cash_pembatalan dkk.
 */
export const isPcFinanceApprover = (
  profile?: { role?: string | null; department?: string | null } | null,
): boolean =>
  profile?.role === "admin" ||
  (profile?.role === "approver" && isFinanceDepartment(profile?.department));

/**
 * Boleh membuat Pengajuan Petty Cash Eskalasi (tanpa menunggu tarikan
 * sebelumnya dideklarasikan): departemen setara GA atau role admin. Harus
 * sama dengan trigger check_petty_cash_pengajuan_eskalasi
 * (supabase/migrations/0015_petty_cash_revisi.sql).
 */
export const canEscalatePettyCash = (
  profile?: { role?: string | null; department?: string | null } | null,
): boolean => profile?.role === "admin" || isGADepartment(profile?.department);

/**
 * Boleh membuka Management Petty Cash (monitoring lintas departemen +
 * Download Excel): admin, departemen setara GA, atau Finance. Aksi yang
 * mengubah data (hapus/edit paksa/override) tetap admin only.
 */
export const canMonitorPettyCash = (
  profile?: { role?: string | null; department?: string | null } | null,
): boolean =>
  profile?.role === "admin" ||
  isGADepartment(profile?.department) ||
  isFinanceDepartment(profile?.department);

/**
 * True jika user boleh mengelola Template MR: admin, atau departemen setara
 * GA dengan role approver. Harus sama dengan RLS `mr_templates`.
 */
export const canManageMrTemplate = (
  profile?: { role?: string | null; department?: string | null } | null,
): boolean =>
  profile?.role === "admin" ||
  (profile?.role === "approver" && isGADepartment(profile?.department));
