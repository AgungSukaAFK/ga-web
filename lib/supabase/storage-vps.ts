import { createClient } from "@supabase/supabase-js";

// Server-only client — service_role key, jangan pernah diimpor dari client component.
export function createVpsStorageClient() {
  return createClient(
    process.env.VPS_SUPABASE_URL!,
    process.env.VPS_SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { persistSession: false } }
  );
}

export const VPS_STORAGE_BUCKET = process.env.VPS_SUPABASE_STORAGE_BUCKET!;

// Client browser-safe — anon key (publik, aman di-embed), dipakai HANYA untuk
// mengonsumsi signed upload URL (lib/uploadDirect.ts) langsung dari browser
// ke storage VPS, bypass limit body Server Action Vercel (4.5MB). JANGAN
// pernah pakai service_role key di sini - file ini boleh diimpor dari client
// component.
export function createVpsStorageBrowserClient() {
  return createClient(
    process.env.NEXT_PUBLIC_VPS_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_VPS_SUPABASE_ANON_KEY!,
    { auth: { persistSession: false } }
  );
}
