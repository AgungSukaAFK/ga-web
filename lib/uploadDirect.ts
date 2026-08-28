// Upload attachment LANGSUNG dari browser ke storage VPS (bukan lewat body
// Server Action) - lihat komentar createSignedUploadUrl di
// services/storageService.ts untuk alasannya: Vercel Serverless Functions
// (termasuk Server Actions) punya hard limit request body 4.5MB yang TIDAK
// BISA dinaikkan lewat next.config.ts. File di atas ~4.5MB yang dikirim lewat
// body Server Action akan ditolak oleh Vercel SEBELUM sampai ke kode kita,
// munculnya sebagai error generik di client ("unexpected response").
//
// Alurnya: (1) minta signed upload URL ke server action (request kecil, cuma
// path string, aman dari limit) - (2) upload file-nya SENDIRI langsung dari
// browser ke storage VPS pakai token itu, TIDAK lewat Vercel sama sekali.
import {
  createSignedUploadUrl,
  createSignedUploadUrlPublic,
} from "@/services/storageService";
import { createVpsStorageBrowserClient } from "@/lib/supabase/storage-vps";

export type UploadResult =
  | { success: true; url: string }
  | { success: false; message: string };

let vpsBrowserClient: ReturnType<typeof createVpsStorageBrowserClient> | null =
  null;
function getVpsBrowserClient() {
  if (!vpsBrowserClient) vpsBrowserClient = createVpsStorageBrowserClient();
  return vpsBrowserClient;
}

async function uploadViaSignedUrl(
  signed: Awaited<ReturnType<typeof createSignedUploadUrl>>,
  file: File,
): Promise<UploadResult> {
  if (!signed.success) return signed;

  const { error } = await getVpsBrowserClient()
    .storage.from(signed.bucket)
    .uploadToSignedUrl(signed.path, signed.token, file);
  if (error) return { success: false, message: error.message };

  return { success: true, url: signed.publicUrl };
}

// Dipakai dari alur yang butuh sesi login (PO/MR/Petty Cash/dll) - lihat
// createSignedUploadUrl (gate auth.getUser() di server).
export async function uploadAttachmentDirect(
  file: File,
  path: string,
): Promise<UploadResult> {
  const signed = await createSignedUploadUrl(path);
  return uploadViaSignedUrl(signed, file);
}

// Dipakai khusus dari alur konfirmasi goods-receipt publik (scan QR, tanpa
// sesi Supabase browser) - lihat createSignedUploadUrlPublic.
export async function uploadAttachmentDirectPublic(
  file: File,
  path: string,
): Promise<UploadResult> {
  const signed = await createSignedUploadUrlPublic(path);
  return uploadViaSignedUrl(signed, file);
}
