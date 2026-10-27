// app/not-found.tsx
//
// Halaman 404 global - dipakai untuk semua URL yang tidak cocok dengan route
// mana pun (menggantikan halaman 404 bawaan Next.js). Profil user diambil di
// server supaya saran menu ("Mungkin yang Anda cari") langsung sesuai hak
// akses tanpa kedip; pencocokan dengan alamat yang dibuka jalan di client
// karena not-found tidak menerima pathname - lihat NotFoundClient.

import type { Metadata } from "next";
import { createClient } from "@/lib/supabase/server";
import type { NavProfile } from "@/lib/sidebar/nav-config";
import { NotFoundClient } from "./NotFoundClient";

export const metadata: Metadata = {
  title: "Halaman Tidak Ditemukan · Garuda Procure",
};

export default async function NotFound() {
  const supabase = await createClient();
  const { data } = await supabase.auth.getClaims();
  const userId = data?.claims?.sub;

  let profile: NavProfile = null;
  if (userId) {
    const { data: p } = await supabase
      .from("profiles")
      .select("role, department")
      .eq("id", userId)
      .single();
    profile = p;
  }

  return <NotFoundClient isLoggedIn={!!userId} profile={profile} />;
}
