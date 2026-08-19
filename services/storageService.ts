"use server";

import { createClient } from "@/lib/supabase/server";
import { createVpsStorageClient, VPS_STORAGE_BUCKET } from "@/lib/supabase/storage-vps";

type UploadResult =
  | { success: true; url: string }
  | { success: false; message: string };

// Path attachment sering dibangun dari data bebas-input user (part_number,
// nama vendor, dll) - karakter seperti `"` (mis. part number ukuran inch
// "10"") bikin object storage nolak dgn "Invalid key: ...". Nama file yang
// ditampilkan ke user diambil dari field `name` terpisah (bukan dari path
// storage ini), jadi aman disanitasi tanpa mempengaruhi tampilan.
function sanitizeStorageKey(path: string): string {
  return path.replace(/["'<>:\\|?*\x00-\x1F]/g, "-");
}

// Semua lampiran BARU disimpan di storage VPS (project lama sudah penuh kapasitasnya).
// Auth tetap diverifikasi lewat project Supabase Cloud yang lama.
export async function uploadAttachmentVps(
  formData: FormData,
  path: string
): Promise<UploadResult> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { success: false, message: "Unauthorized" };

  const file = formData.get("file") as File | null;
  if (!file) return { success: false, message: "File tidak ditemukan" };

  const vps = createVpsStorageClient();
  const { data, error } = await vps.storage
    .from(VPS_STORAGE_BUCKET)
    .upload(sanitizeStorageKey(path), file);
  if (error) return { success: false, message: error.message };

  const { data: pub } = vps.storage
    .from(VPS_STORAGE_BUCKET)
    .getPublicUrl(data.path);
  return { success: true, url: pub.publicUrl };
}

// url = full public URL hasil uploadAttachmentVps. Best-effort, sama seperti
// perilaku hapus lampiran lama (tidak memblok UI kalau gagal).
export async function removeAttachmentVps(
  url: string
): Promise<{ success: boolean; message?: string }> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { success: false, message: "Unauthorized" };

  const marker = `/object/public/${VPS_STORAGE_BUCKET}/`;
  const idx = url.indexOf(marker);
  if (idx === -1) return { success: false, message: "Bukan URL attachment VPS" };
  const path = url.slice(idx + marker.length);

  const vps = createVpsStorageClient();
  const { error } = await vps.storage.from(VPS_STORAGE_BUCKET).remove([path]);
  if (error) return { success: false, message: error.message };
  return { success: true };
}
