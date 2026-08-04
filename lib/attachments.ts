// Lampiran lama (sebelum migrasi ke storage VPS) disimpan sebagai path relatif
// terhadap bucket "mr" di project Supabase Cloud lama. Lampiran baru disimpan
// sebagai full public URL ke storage VPS. Helper ini menyatukan keduanya saat render.
const OLD_CLOUD_BUCKET_BASE =
  "https://xdkjqwpvmyqcggpwghyi.supabase.co/storage/v1/object/public/mr";

export function resolveAttachmentUrl(url: string): string {
  if (url.startsWith("http://") || url.startsWith("https://")) return url;
  return `${OLD_CLOUD_BUCKET_BASE}/${url}`;
}
