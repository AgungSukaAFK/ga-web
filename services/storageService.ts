"use server";

import { createClient } from "@/lib/supabase/server";
import { createVpsStorageClient, VPS_STORAGE_BUCKET } from "@/lib/supabase/storage-vps";

type SignedUploadResult =
  | { success: true; path: string; token: string; bucket: string; publicUrl: string }
  | { success: false; message: string };

// Path attachment sering dibangun dari data bebas-input user (part_number,
// nama vendor, dll) - karakter seperti `"` (mis. part number ukuran inch
// "10"") bikin object storage nolak dgn "Invalid key: ...". Nama file yang
// ditampilkan ke user diambil dari field `name` terpisah (bukan dari path
// storage ini), jadi aman disanitasi tanpa mempengaruhi tampilan.
function sanitizeStorageKey(path: string): string {
  return path.replace(/["'<>:\\|?*\x00-\x1F]/g, "-");
}

// Bikin signed upload URL - file-nya SENDIRI tidak lewat sini (cuma path
// string), lalu di-upload LANGSUNG dari browser ke storage VPS (lihat
// lib/uploadDirect.ts). Ini WAJIB dipakai untuk semua upload attachment
// (bukan kirim file lewat body Server Action) karena Vercel Serverless
// Functions punya hard limit body request 4.5MB yang TIDAK BISA dinaikkan
// lewat bodySizeLimit di next.config.ts - kalau file (mis. PDF 6MB) dikirim
// lewat body Server Action, Vercel nolak duluan sebelum request nyampe ke
// kode kita, munculnya sebagai error generik "unexpected response" di
// client. Signed URL upload route around limit itu sepenuhnya.
export async function createSignedUploadUrl(
  path: string
): Promise<SignedUploadResult> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { success: false, message: "Unauthorized" };

  const vps = createVpsStorageClient();
  const safePath = sanitizeStorageKey(path);
  const { data, error } = await vps.storage
    .from(VPS_STORAGE_BUCKET)
    .createSignedUploadUrl(safePath);
  if (error) return { success: false, message: error.message };

  const { data: pub } = vps.storage
    .from(VPS_STORAGE_BUCKET)
    .getPublicUrl(data.path);
  return {
    success: true,
    path: data.path,
    token: data.token,
    bucket: VPS_STORAGE_BUCKET,
    publicUrl: pub.publicUrl,
  };
}

// Sama seperti createSignedUploadUrl, TAPI tanpa gate auth.getUser() - dipakai
// khusus dari alur konfirmasi goods-receipt publik (scan QR, lihat
// services/goodsReceiptService.ts) yang jalan tanpa sesi Supabase browser
// (bisa anonim + kode global, bukan login). Otorisasinya sudah dicek di
// lapisan atas (verifyGoodsReceiptCode) sebelum fungsi ini dipanggil - JANGAN
// dipakai di alur lain yang butuh proteksi login.
export async function createSignedUploadUrlPublic(
  path: string
): Promise<SignedUploadResult> {
  const vps = createVpsStorageClient();
  const safePath = sanitizeStorageKey(path);
  const { data, error } = await vps.storage
    .from(VPS_STORAGE_BUCKET)
    .createSignedUploadUrl(safePath);
  if (error) return { success: false, message: error.message };

  const { data: pub } = vps.storage
    .from(VPS_STORAGE_BUCKET)
    .getPublicUrl(data.path);
  return {
    success: true,
    path: data.path,
    token: data.token,
    bucket: VPS_STORAGE_BUCKET,
    publicUrl: pub.publicUrl,
  };
}

// url = full public URL hasil upload (lihat lib/uploadDirect.ts). Best-effort,
// sama seperti perilaku hapus lampiran lama (tidak memblok UI kalau gagal).
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
