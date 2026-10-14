// src/lib/debounce-async.ts
//
// Debounce untuk fungsi async yang hasilnya ditunggu pemanggil (mis. `items`
// di suggestion Tiptap, yang dipanggil di SETIAP ketikan setelah karakter
// pemicu). Beda dengan debounce biasa: panggilan yang "ditelan" tidak
// dibiarkan menggantung - semua pemanggil dalam satu jendela debounce dapat
// hasil dari panggilan TERAKHIR. Hasil per argumen juga di-cache sebentar,
// supaya hapus-ketik ulang (backspace) tidak menembak Supabase lagi.

export function debounceAsync<T>(
  fn: (query: string) => Promise<T>,
  delay = 250,
  cacheTtlMs = 30_000,
) {
  let timer: ReturnType<typeof setTimeout> | null = null;
  let waiters: { resolve: (v: T) => void; reject: (e: unknown) => void }[] =
    [];
  const cache = new Map<string, { value: T; at: number }>();

  return (query: string): Promise<T> => {
    const hit = cache.get(query);
    if (hit && Date.now() - hit.at < cacheTtlMs) {
      return Promise.resolve(hit.value);
    }

    if (timer) clearTimeout(timer);
    return new Promise<T>((resolve, reject) => {
      waiters.push({ resolve, reject });
      timer = setTimeout(async () => {
        timer = null;
        const pending = waiters;
        waiters = [];
        try {
          const value = await fn(query);
          if (cache.size > 100) cache.clear();
          cache.set(query, { value, at: Date.now() });
          pending.forEach((w) => w.resolve(value));
        } catch (err) {
          pending.forEach((w) => w.reject(err));
        }
      }, delay);
    });
  };
}
