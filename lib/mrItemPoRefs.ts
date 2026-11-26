import { Order } from "@/type";

// Semua kode PO yang terhubung ke satu item MR, untuk ditampilkan sebagai
// badge/kolom "No. PO": `po_refs` (dicatat otomatis saat PO dibuat) digabung
// dengan `manual_po_links` (link manual dari halaman detail MR/PO, untuk barang
// yang disubstitusi saat pembelian). Urutan: po_refs dulu, tanpa duplikat.
export const getItemPoRefs = (
  item: Pick<Order, "po_refs" | "manual_po_links">,
): string[] => {
  const refs = new Set<string>(Array.isArray(item.po_refs) ? item.po_refs : []);
  for (const link of Array.isArray(item.manual_po_links)
    ? item.manual_po_links
    : []) {
    if (link?.kode_po) refs.add(link.kode_po);
  }
  return Array.from(refs);
};
