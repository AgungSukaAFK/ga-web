// Data "Lacak MR/PO" untuk modal ringkasan di tabel list.
//
// Baris tabel sudah membawa sebagian besar field, jadi di sini cuma diambil
// sisanya, untuk satu dokumen, saat modalnya dibuka. Kolom berat seperti
// discussions dan orders MR sengaja tidak ditambahkan ke query tabel.
import { createClient } from "@/lib/supabase/client";
import type { TrackingPo } from "@/lib/mrTracking";
import type { TrackingLog } from "@/lib/tracking";
import { fetchActivityLogs } from "@/services/logService";
import { fetchTrackingPosForMr, normalizeMrOrders } from "@/services/mrService";
import type {
  MaterialRequest,
  MaterialRequestListItem,
  PurchaseOrderDetail,
  PurchaseOrderListItem,
} from "@/type";

export interface MrQuickTracking {
  mr: MaterialRequest;
  pos: TrackingPo[];
  logs: TrackingLog[];
}

export interface PoQuickTracking {
  po: PurchaseOrderDetail;
  logs: TrackingLog[];
}

const MR_EXTRA_COLUMNS = "userid, discussions, cancel_reason, cancelled_at";

const PO_EXTRA_COLUMNS = `
  receive_record, closed_remainder, goods_receipt, notes, cancel_reason, cancelled_at,
  material_requests!mr_id (
    id, kode_mr, userid, orders, due_date, full_received_at,
    users_with_profiles!userid (nama)
  )
`;

// Kuncinya objek baris, bukan id: tabel yang dimuat ulang menghasilkan objek
// baru, jadi cache-nya tidak pernah lebih basi daripada baris yang ditampilkan.
const mrCache = new WeakMap<MaterialRequestListItem, Promise<MrQuickTracking>>();
const poCache = new WeakMap<PurchaseOrderListItem, Promise<PoQuickTracking>>();

const remember = <Row extends object, Data>(
  cache: WeakMap<Row, Promise<Data>>,
  row: Row,
  load: () => Promise<Data>,
) => {
  const cached = cache.get(row);
  if (cached) return cached;
  const pending = load();
  cache.set(row, pending);
  pending.catch(() => cache.delete(row));
  return pending;
};

const firstOf = <T>(value: T | T[] | null): T | null =>
  Array.isArray(value) ? (value[0] ?? null) : value;

export const fetchMrQuickTracking = (row: MaterialRequestListItem) =>
  remember(mrCache, row, async () => {
    const client = createClient();
    const [{ data: extra, error }, pos, logs] = await Promise.all([
      client
        .from("material_requests")
        .select(MR_EXTRA_COLUMNS)
        .eq("id", row.id)
        .single(),
      fetchTrackingPosForMr(Number(row.id), client),
      fetchActivityLogs("material_request", String(row.id)),
    ]);
    if (error) throw error;

    return {
      mr: { ...row, ...extra } as unknown as MaterialRequest,
      pos,
      logs: logs as TrackingLog[],
    };
  });

export const fetchPoQuickTracking = (row: PurchaseOrderListItem) =>
  remember(poCache, row, async () => {
    const [{ data, error }, logs] = await Promise.all([
      createClient()
        .from("purchase_orders")
        .select(PO_EXTRA_COLUMNS)
        .eq("id", row.id)
        .single(),
      fetchActivityLogs("purchase_order", String(row.id)),
    ]);
    if (error) throw error;

    const { material_requests, ...extra } = data as any;
    const mr = firstOf<any>(material_requests);

    return {
      po: {
        ...row,
        ...extra,
        material_requests: mr && {
          ...mr,
          orders: normalizeMrOrders(Array.isArray(mr.orders) ? mr.orders : []),
          users_with_profiles: firstOf(mr.users_with_profiles),
        },
      } as unknown as PurchaseOrderDetail,
      logs: logs as TrackingLog[],
    };
  });
