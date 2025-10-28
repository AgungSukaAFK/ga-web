// src/services/userService.ts

import { createClient } from "@/lib/supabase/client";
import {
  SignInWithPasswordCredentials,
  SignUpWithPasswordCredentials,
} from "@supabase/supabase-js";

const supabase = createClient();

/**
 * Fungsi utama untuk login.
 * Menerima email ATAU NRP sebagai identifier.
 */
export const signInWithEmailOrNrp = async (
  identifier: string,
  password: string
) => {
  let emailToUse = identifier;

  // Cek apakah identifier BUKAN format email
  if (!identifier.includes("@") && identifier.trim() !== "") {
    const nrp = identifier.trim();
    console.log(
      `Identifier looks like NRP: ${nrp}. Looking up associated email...`
    );

    // Cari email berdasarkan NRP di tabel profiles
    const { data: profile, error: profileError } = await supabase
      .from("profiles")
      .select("email") // Hanya butuh email
      .eq("nrp", nrp)
      .maybeSingle(); // Gunakan maybeSingle() untuk handle jika NRP tidak ditemukan

    if (profileError) {
      console.error("Error fetching profile by NRP:", profileError.message);
      throw new Error("Terjadi kesalahan saat mencari data user.");
    }

    if (!profile || !profile.email) {
      console.log(`NRP ${nrp} not found or has no associated email.`);
      throw new Error("NRP atau password salah."); // Pesan error generik
    }

    emailToUse = profile.email;
    console.log(`Email found for NRP ${nrp}: ${emailToUse}`);
  } else {
    console.log(`Identifier looks like Email: ${identifier}`);
  }

  // Lanjutkan login menggunakan email (baik asli atau hasil lookup NRP)
  console.log(`Attempting sign in with email: ${emailToUse}`);
  const { data, error: signInError } = await supabase.auth.signInWithPassword({
    email: emailToUse,
    password,
  });

  if (signInError) {
    console.error("Supabase sign-in error:", signInError.message);
    // Berikan pesan error yang lebih umum untuk keamanan
    if (signInError.message.includes("Invalid login credentials")) {
      throw new Error("Email/NRP atau password salah.");
    }
    throw new Error("Gagal melakukan login."); // Pesan fallback
  }

  console.log("Sign in successful for:", emailToUse);
  return data;
};

/**
 * Fungsi untuk pendaftaran user baru.
 * Hanya menerima email dan password.
 */
export const signUpUser = async (
  credentials: SignUpWithPasswordCredentials
) => {
  // Opsi bisa dikosongkan jika tidak perlu email konfirmasi bawaan Supabase
  const { data, error } = await supabase.auth.signUp(credentials);

  if (error) {
    console.error("Supabase sign-up error:", error.message);
    // Berikan pesan yang lebih user-friendly jika memungkinkan
    if (error.message.includes("User already registered")) {
      throw new Error(
        "Email ini sudah terdaftar. Silakan login atau gunakan email lain."
      );
    }
    throw new Error("Gagal melakukan pendaftaran.");
  }

  // Kembalikan data user (meskipun belum ada session), berguna untuk menampilkan pesan
  return { user: data.user };
};
