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
 * True jika user boleh mengelola Template MR: admin, atau departemen setara
 * GA dengan role approver. Harus sama dengan RLS `mr_templates`.
 */
export const canManageMrTemplate = (
  profile?: { role?: string | null; department?: string | null } | null,
): boolean =>
  profile?.role === "admin" ||
  (profile?.role === "approver" && isGADepartment(profile?.department));
