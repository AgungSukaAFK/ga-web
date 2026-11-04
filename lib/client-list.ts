// lib/client-list.ts
//
// Sort & paginasi untuk list yang datanya sudah lengkap di client, mis.
// dokumen milik sendiri yang disusun dari satu query rantai dokumen.

type SortValue = string | number | null | undefined;

/** `sort` = param `<key>.<asc|desc>`. Key di luar `accessors` diabaikan. */
export function sortRows<T>(
  rows: readonly T[],
  sort: string,
  accessors: Record<string, (row: T) => SortValue>,
): T[] {
  const [key, direction] = sort.split(".");
  const accessor = accessors[key];
  if (!accessor || (direction !== "asc" && direction !== "desc")) {
    return [...rows];
  }

  const sign = direction === "asc" ? 1 : -1;
  return [...rows].sort((a, b) => {
    const left = accessor(a);
    const right = accessor(b);
    // Nilai kosong selalu di akhir, apa pun arahnya.
    if (left === null || left === undefined || left === "") return 1;
    if (right === null || right === undefined || right === "") return -1;
    if (typeof left === "number" && typeof right === "number") {
      return (left - right) * sign;
    }
    return String(left).localeCompare(String(right), "id") * sign;
  });
}

/** Halaman di luar rentang dibawa ke halaman terakhir yang valid. */
export function paginateRows<T>(rows: readonly T[], page: number, limit: number) {
  const lastPage = Math.max(1, Math.ceil(rows.length / limit));
  const currentPage = Math.min(page, lastPage);
  const offset = (currentPage - 1) * limit;
  return {
    rows: rows.slice(offset, offset + limit),
    currentPage,
    offset,
  };
}
