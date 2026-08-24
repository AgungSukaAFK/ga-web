import { createClient } from "@supabase/supabase-js";

// Server-only client — service_role key untuk project Supabase Cloud utama,
// dipakai buat operasi yang perlu bypass RLS dari konteks tanpa sesi user
// (mis. halaman publik /goods-receipt/[token] - scan QR tanpa login).
// Jangan pernah diimpor dari client component.
export function createAdminClient() {
  return createClient(
    process.env.SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { persistSession: false } },
  );
}
