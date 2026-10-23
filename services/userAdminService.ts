"use server";

import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { isITAdmin } from "@/lib/constants/departments";

export type CreateUserInput = {
  email: string;
  password: string;
  nama: string;
  nrp: string | null;
  role: string;
  lokasi: string | null;
  department: string | null;
  company: string | null;
};

const ALLOWED_ROLES = ["admin", "approver", "requester", "user"];

async function requireAdmin() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error("Unauthorized");

  const { data: profile } = await supabase
    .from("profiles")
    .select("role, company")
    .eq("id", user.id)
    .single();

  if (!profile || profile.role !== "admin") {
    throw new Error("Akses ditolak: khusus admin.");
  }
  return profile as { role: string; company: string | null };
}

/**
 * Admin membuat akun baru langsung (tanpa sign-up & konfirmasi email).
 * Pakai service-role karena auth.admin.createUser butuh hak penuh. Row
 * profiles dibuat otomatis oleh trigger handle_new_user, lalu diisi di sini.
 */
export async function createUserByAdmin(
  input: CreateUserInput,
): Promise<{ id: string }> {
  const adminProfile = await requireAdmin();

  const email = input.email.trim().toLowerCase();
  const nama = input.nama.trim();
  const nrp = input.nrp?.trim() || null;

  if (!email || !email.includes("@")) throw new Error("Email tidak valid.");
  if (!nama) throw new Error("Nama wajib diisi.");
  if (!input.password || input.password.length < 6) {
    throw new Error("Password minimal 6 karakter.");
  }
  if (!ALLOWED_ROLES.includes(input.role)) throw new Error("Role tidak valid.");

  // Admin non-LOURDES hanya boleh membuat user untuk company-nya sendiri
  // (konsisten dengan filter di halaman Manajemen User).
  const company =
    adminProfile.company && adminProfile.company !== "LOURDES"
      ? adminProfile.company
      : input.company || null;

  const admin = createAdminClient();

  // NRP dipakai untuk login (lihat signInWithEmailOrNrp), jadi harus unik.
  if (nrp) {
    const { data: existing } = await admin
      .from("profiles")
      .select("id")
      .eq("nrp", nrp)
      .maybeSingle();
    if (existing) throw new Error(`NRP ${nrp} sudah dipakai user lain.`);
  }

  const { data, error } = await admin.auth.admin.createUser({
    email,
    password: input.password,
    email_confirm: true,
  });

  if (error || !data.user) {
    if (error?.message.toLowerCase().includes("already")) {
      throw new Error("Email ini sudah terdaftar.");
    }
    throw new Error("Gagal membuat akun: " + (error?.message ?? "unknown"));
  }

  const userId = data.user.id;

  // upsert (bukan update) supaya tetap jalan walau trigger belum membuat row.
  const { error: profileError } = await admin.from("profiles").upsert({
    id: userId,
    email,
    nama,
    nrp,
    role: input.role,
    lokasi: input.lokasi || null,
    department: input.department || null,
    company,
    is_active: true,
  });

  if (profileError) {
    // Rollback supaya tidak ada akun auth "yatim" tanpa profil lengkap.
    await admin.auth.admin.deleteUser(userId);
    throw new Error("Gagal menyimpan profil: " + profileError.message);
  }

  return { id: userId };
}

/**
 * Admin departemen IT (isITAdmin) mengganti password user lain - untuk user
 * yang lupa password (reset mandiri lewat email tidak tersedia, lihat dialog
 * "Lupa password" di /auth/login). Password sendiri tetap diganti lewat
 * /profile yang wajib verifikasi password lama.
 */
export async function resetUserPasswordByITAdmin(
  userId: string,
  newPassword: string,
): Promise<void> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error("Unauthorized");

  const { data: adminProfile } = await supabase
    .from("profiles")
    .select("role, department, company")
    .eq("id", user.id)
    .single();

  if (!isITAdmin(adminProfile)) {
    throw new Error("Akses ditolak: khusus admin departemen IT.");
  }
  if (userId === user.id) {
    throw new Error("Ganti password akun sendiri lewat halaman Profil.");
  }
  if (!newPassword || newPassword.length < 6) {
    throw new Error("Password minimal 6 karakter.");
  }

  const admin = createAdminClient();

  const { data: target } = await admin
    .from("profiles")
    .select("company")
    .eq("id", userId)
    .maybeSingle();
  if (!target) throw new Error("User tidak ditemukan.");

  // Admin non-LOURDES hanya boleh mengelola user company-nya sendiri
  // (konsisten dengan filter di halaman Manajemen User).
  if (
    adminProfile!.company &&
    adminProfile!.company !== "LOURDES" &&
    target.company !== adminProfile!.company
  ) {
    throw new Error("Akses ditolak: user dari perusahaan lain.");
  }

  const { error } = await admin.auth.admin.updateUserById(userId, {
    password: newPassword,
  });
  if (error) throw new Error("Gagal mereset password: " + error.message);
}
