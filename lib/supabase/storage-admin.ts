import { createClient } from "@supabase/supabase-js";

// Server-only client — service_role key untuk project Supabase Cloud utama,
// dipakai buat operasi admin (mis. hapus/list storage bucket "mr" lama) yang
// perlu bypass RLS. Jangan pernah diimpor dari client component.
export function createAdminStorageClient() {
  return createClient(
    process.env.SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { persistSession: false } }
  );
}

export const LEGACY_STORAGE_BUCKET = "mr";
