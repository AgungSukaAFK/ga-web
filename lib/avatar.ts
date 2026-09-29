// Event window yang di-dispatch halaman /profile setelah foto profil diganti
// / dihapus (detail = URL baru atau null), supaya sidebar ikut update tanpa
// reload.
export const AVATAR_UPDATED_EVENT = "profile:avatar-updated";

// "Budi Santoso" -> "BS", "admin@x.com" -> "AD".
export function getInitials(name?: string | null): string {
  const clean = (name || "").split("@")[0].trim();
  if (!clean) return "?";
  const words = clean.split(/\s+/).filter(Boolean);
  const initials =
    words.length > 1
      ? words[0][0] + words[words.length - 1][0]
      : clean.slice(0, 2);
  return initials.toUpperCase();
}
