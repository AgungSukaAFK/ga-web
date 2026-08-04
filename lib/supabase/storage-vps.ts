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
