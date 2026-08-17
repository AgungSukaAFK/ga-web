// Lampiran lama (sebelum migrasi ke storage VPS) disimpan sebagai path relatif
// terhadap bucket "mr" di project Supabase Cloud lama. Lampiran baru disimpan
// sebagai full public URL ke storage VPS. Helper ini menyatukan keduanya saat render.
const OLD_CLOUD_BUCKET_BASE =
  "https://xdkjqwpvmyqcggpwghyi.supabase.co/storage/v1/object/public/mr";

export function resolveAttachmentUrl(url: string): string {
  if (url.startsWith("http://") || url.startsWith("https://")) return url;
  return `${OLD_CLOUD_BUCKET_BASE}/${url}`;
}

// Batas ukuran lampiran (PO/MR/BAST/dll). Harus <= bodySizeLimit Server Action
// di next.config.ts, dengan margin untuk overhead multipart.
export const MAX_ATTACHMENT_SIZE_BYTES = 15 * 1024 * 1024; // 15MB

export function formatFileSize(bytes: number): string {
  if (bytes >= 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  return `${Math.max(1, Math.ceil(bytes / 1024))} KB`;
}

// Validasi ukuran file sebelum upload. Mengembalikan pesan error yang informatif,
// atau null bila ukurannya valid.
export function getAttachmentSizeError(file: File): string | null {
  if (file.size <= MAX_ATTACHMENT_SIZE_BYTES) return null;
  return `File "${file.name}" berukuran ${formatFileSize(
    file.size
  )}, melebihi batas maksimal ${formatFileSize(
    MAX_ATTACHMENT_SIZE_BYTES
  )}. Silakan kompres file atau pilih file lain.`;
}

// Pesan error upload yang lebih informatif untuk kasus umum (timeout, limit
// ukuran server, koneksi putus) yang tidak selalu punya message yang jelas.
export function getUploadErrorMessage(err: unknown): string {
  if (err instanceof Error && err.message) {
    if (/fetch|network|failed to fetch/i.test(err.message)) {
      return "Koneksi terputus atau file terlalu besar untuk diunggah. Periksa koneksi internet Anda dan coba lagi.";
    }
    return err.message;
  }
  return "Gagal mengunggah file. Periksa koneksi internet Anda dan coba lagi.";
}
