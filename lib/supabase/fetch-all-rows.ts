// lib/supabase/fetch-all-rows.ts

// Supabase/PostgREST membatasi max 1000 baris per request,
// jadi data export diambil bertahap per halaman.
const FETCH_PAGE_SIZE = 1000;

/**
 * Ambil SEMUA baris hasil query (tanpa terpotong limit 1000 Supabase).
 * `buildQuery` harus membuat query baru tiap dipanggil (sudah termasuk filter
 * & order); range per halaman ditambahkan di sini.
 */
export async function fetchAllRows<T = any>(
  buildQuery: () => any,
  pageSize = FETCH_PAGE_SIZE,
): Promise<T[]> {
  const rows: T[] = [];
  for (let from = 0; ; from += pageSize) {
    const { data, error } = await buildQuery().range(
      from,
      from + pageSize - 1,
    );
    if (error) throw error;
    rows.push(...((data as T[]) || []));
    if (!data || data.length < pageSize) break;
  }
  return rows;
}
