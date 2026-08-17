"use server";

import { unstable_cache, revalidateTag } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import {
  createAdminStorageClient,
  LEGACY_STORAGE_BUCKET,
} from "@/lib/supabase/storage-admin";
import {
  createVpsStorageClient,
  VPS_STORAGE_BUCKET,
} from "@/lib/supabase/storage-vps";
import { Attachment } from "@/type";
import {
  AttachmentDocType,
  AttachmentEntry,
  AttachmentFilters,
  AttachmentQueryResult,
  DeleteRequestItem,
  DeleteResultItem,
  StorageBucketSource,
} from "@/type/file-management";

const SNAPSHOT_TAG = "file-mgmt-snapshot";

async function requireAdmin() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error("Unauthorized");

  const { data: profile } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .single();

  if (!profile || profile.role !== "admin") {
    throw new Error("Akses ditolak: khusus admin.");
  }
}

// Sama seperti resolveAttachmentUrl (lib/attachments.ts) / removeAttachmentVps
// (services/storageService.ts) - url tanpa prefix http = path relatif di bucket
// lama "mr", url http(s) penuh = file di bucket VPS.
function resolveBucketAndPath(url: string): {
  bucket: StorageBucketSource;
  path: string;
} {
  if (url.startsWith("http://") || url.startsWith("https://")) {
    const marker = `/object/public/${VPS_STORAGE_BUCKET}/`;
    const idx = url.indexOf(marker);
    const path = idx === -1 ? url : url.slice(idx + marker.length);
    return { bucket: "vps", path };
  }
  return { bucket: "legacy", path: url };
}

function docHref(
  source: AttachmentDocType,
  id: string | number | null
): string | null {
  if (id === null) return null;
  switch (source) {
    case "material_request":
    case "material_request_bast":
      return `/material-request/${id}`;
    case "purchase_order":
      return `/purchase-order/${id}`;
    case "petty_cash":
    case "petty_cash_settlement":
      return `/petty-cash/${id}`;
    default:
      return null;
  }
}

interface StorageStat {
  size: number;
  createdAt: string;
}

async function fetchStorageStats(
  admin: ReturnType<typeof createAdminStorageClient>,
  bucket: StorageBucketSource
): Promise<Map<string, StorageStat>> {
  const map = new Map<string, StorageStat>();
  const client = bucket === "legacy" ? admin : createVpsStorageClient();
  const bucketId = bucket === "legacy" ? LEGACY_STORAGE_BUCKET : VPS_STORAGE_BUCKET;

  // PostgREST membatasi jumlah baris per response (default project "max rows"
  // = 1000) - tanpa paginasi, bucket dengan >1000 object akan terpotong diam-diam
  // (persis gejalanya: selalu mentok di 1000 file). Naikkan `from` sebesar jumlah
  // baris yang BENERAN kebalik (bukan asumsi page size), supaya tetap benar
  // walau limit project-nya beda dari PAGE_SIZE yang kita minta.
  const PAGE_SIZE = 1000;
  const MAX_PAGES = 500; // guard - cukup untuk ~500rb object, jangan sampai infinite loop
  let from = 0;

  for (let page = 0; page < MAX_PAGES; page++) {
    const { data, error } = await client
      .rpc("get_storage_object_stats", { p_bucket_id: bucketId })
      .range(from, from + PAGE_SIZE - 1);

    if (error) {
      // RPC belum di-setup (lihat supabase/file-management-storage-stats-rpc.sql)
      // atau bucket tidak ditemukan - jangan gagalkan seluruh snapshot, cukup
      // tampilkan tanpa size/tanggal asli (fallback ke tanggal dokumen).
      console.error(
        `Gagal ambil storage stats bucket "${bucket}" (offset ${from}):`,
        error.message
      );
      break;
    }

    const rows = (data ?? []) as { name: string; size: number; created_at: string }[];
    for (const row of rows) {
      map.set(row.name, { size: row.size, createdAt: row.created_at });
    }

    if (rows.length === 0) break;
    from += rows.length;
  }

  return map;
}

// Snapshot dibangun pakai service-role client (bukan cookie-based server
// client) supaya bisa dibungkus unstable_cache - Next.js melarang pemakaian
// cookies()/headers() di dalam fungsi yang di-cache.
async function buildSnapshotUncached(): Promise<AttachmentEntry[]> {
  const admin = createAdminStorageClient();

  const [mrRes, poRes, pcRes, legacyStats, vpsStats] = await Promise.all([
    admin.from("material_requests").select("id, kode_mr, created_at, attachments, orders"),
    admin.from("purchase_orders").select("id, kode_po, created_at, attachments"),
    admin
      .from("petty_cash")
      .select("id, kode_pc, created_at, attachments, settlement_attachments"),
    fetchStorageStats(admin, "legacy"),
    fetchStorageStats(admin, "vps"),
  ]);

  const entries: AttachmentEntry[] = [];
  const usedPaths = { legacy: new Set<string>(), vps: new Set<string>() };
  const vpsClient = createVpsStorageClient();

  function publicUrlFor(bucket: StorageBucketSource, path: string): string {
    const client = bucket === "legacy" ? admin : vpsClient;
    const bucketId = bucket === "legacy" ? LEGACY_STORAGE_BUCKET : VPS_STORAGE_BUCKET;
    return client.storage.from(bucketId).getPublicUrl(path).data.publicUrl;
  }

  function pushAttachment(
    source: AttachmentDocType,
    documentId: string | number,
    documentCode: string,
    documentCreatedAt: string,
    att: Attachment
  ) {
    if (!att?.url) return;
    const { bucket, path } = resolveBucketAndPath(att.url);
    const statMap = bucket === "legacy" ? legacyStats : vpsStats;
    const stat = statMap.get(path);
    if (stat) usedPaths[bucket].add(path);

    entries.push({
      id: `${source}:${documentId}:${path}`,
      source,
      bucket,
      path,
      url: att.url,
      viewUrl: publicUrlFor(bucket, path),
      fileName: att.name || path.split("/").pop() || path,
      size: stat ? stat.size : null,
      missing: !stat,
      uploadedAt: stat ? stat.createdAt : documentCreatedAt,
      documentId,
      documentCode,
      documentHref: docHref(source, documentId),
    });
  }

  for (const mr of mrRes.data ?? []) {
    const attachments = Array.isArray(mr.attachments) ? mr.attachments : [];
    for (const att of attachments as Attachment[]) {
      pushAttachment("material_request", mr.id, mr.kode_mr, mr.created_at, att);
    }
    const orders = Array.isArray(mr.orders) ? mr.orders : [];
    for (const order of orders as { bast_attachments?: Attachment[] }[]) {
      const bastAttachments = Array.isArray(order?.bast_attachments)
        ? order.bast_attachments
        : [];
      for (const att of bastAttachments) {
        pushAttachment("material_request_bast", mr.id, mr.kode_mr, mr.created_at, att);
      }
    }
  }

  for (const po of poRes.data ?? []) {
    const attachments = Array.isArray(po.attachments) ? po.attachments : [];
    for (const att of attachments as Attachment[]) {
      pushAttachment("purchase_order", po.id, po.kode_po, po.created_at, att);
    }
  }

  for (const pc of pcRes.data ?? []) {
    const attachments = Array.isArray(pc.attachments) ? pc.attachments : [];
    for (const att of attachments as Attachment[]) {
      pushAttachment("petty_cash", pc.id, pc.kode_pc, pc.created_at, att);
    }
    const settlementAttachments = Array.isArray(pc.settlement_attachments)
      ? pc.settlement_attachments
      : [];
    for (const att of settlementAttachments as Attachment[]) {
      pushAttachment("petty_cash_settlement", pc.id, pc.kode_pc, pc.created_at, att);
    }
  }

  // Orphan: file ada di storage tapi tidak direferensikan attachment manapun -
  // kandidat paling aman untuk dihapus duluan.
  const orphanSources: [StorageBucketSource, Map<string, StorageStat>][] = [
    ["legacy", legacyStats],
    ["vps", vpsStats],
  ];
  for (const [bucket, statMap] of orphanSources) {
    for (const [path, stat] of statMap) {
      if (usedPaths[bucket].has(path)) continue;
      entries.push({
        id: `orphan:${bucket}:${path}`,
        source: "orphan",
        bucket,
        path,
        url: path,
        viewUrl: publicUrlFor(bucket, path),
        fileName: path.split("/").pop() || path,
        size: stat.size,
        missing: false,
        uploadedAt: stat.createdAt,
        documentId: null,
        documentCode: null,
        documentHref: null,
      });
    }
  }

  return entries;
}

const getCachedSnapshot = unstable_cache(buildSnapshotUncached, ["file-mgmt-snapshot"], {
  tags: [SNAPSHOT_TAG],
  revalidate: 300,
});

export async function queryFileManagementAttachments(
  filters: AttachmentFilters
): Promise<AttachmentQueryResult> {
  await requireAdmin();
  const all = await getCachedSnapshot();

  const stats = {
    legacyBucketTotalBytes: 0,
    legacyBucketTotalCount: 0,
    vpsBucketTotalBytes: 0,
    vpsBucketTotalCount: 0,
    orphanTotalBytes: 0,
    orphanTotalCount: 0,
  };
  for (const e of all) {
    if (e.size === null) continue;
    if (e.bucket === "legacy") {
      stats.legacyBucketTotalBytes += e.size;
      stats.legacyBucketTotalCount += 1;
    } else {
      stats.vpsBucketTotalBytes += e.size;
      stats.vpsBucketTotalCount += 1;
    }
    if (e.source === "orphan") {
      stats.orphanTotalBytes += e.size;
      stats.orphanTotalCount += 1;
    }
  }

  let filtered = all;
  if (filters.docType !== "all") {
    filtered = filtered.filter((e) => e.source === filters.docType);
  }
  if (filters.bucket !== "all") {
    filtered = filtered.filter((e) => e.bucket === filters.bucket);
  }
  if (filters.search) {
    const q = filters.search.toLowerCase();
    filtered = filtered.filter(
      (e) =>
        e.fileName.toLowerCase().includes(q) ||
        (e.documentCode ?? "").toLowerCase().includes(q)
    );
  }
  if (filters.startDate) {
    const start = new Date(filters.startDate).getTime();
    filtered = filtered.filter(
      (e) => e.uploadedAt && new Date(e.uploadedAt).getTime() >= start
    );
  }
  if (filters.endDate) {
    const end = new Date(`${filters.endDate}T23:59:59.999Z`).getTime();
    filtered = filtered.filter(
      (e) => e.uploadedAt && new Date(e.uploadedAt).getTime() <= end
    );
  }

  const dir = filters.sortDir === "asc" ? 1 : -1;
  filtered = [...filtered].sort((a, b) => {
    if (filters.sortBy === "size") {
      return ((a.size ?? 0) - (b.size ?? 0)) * dir;
    }
    if (filters.sortBy === "name") {
      return a.fileName.localeCompare(b.fileName) * dir;
    }
    const aTime = a.uploadedAt ? new Date(a.uploadedAt).getTime() : 0;
    const bTime = b.uploadedAt ? new Date(b.uploadedAt).getTime() : 0;
    return (aTime - bTime) * dir;
  });

  const total = filtered.length;
  const from = (filters.page - 1) * filters.limit;
  const rows = filtered.slice(from, from + filters.limit);

  return { rows, total, stats };
}

export async function refreshFileManagementSnapshot() {
  await requireAdmin();
  revalidateTag(SNAPSHOT_TAG);
}

async function removeAttachmentRefs(
  admin: ReturnType<typeof createAdminStorageClient>,
  source: DeleteRequestItem["source"],
  documentId: string | number,
  urls: Set<string>
) {
  switch (source) {
    case "material_request": {
      const { data } = await admin
        .from("material_requests")
        .select("attachments")
        .eq("id", documentId)
        .single();
      const attachments = (
        Array.isArray(data?.attachments) ? data.attachments : []
      ) as Attachment[];
      const filtered = attachments.filter((a) => !urls.has(a.url));
      await admin
        .from("material_requests")
        .update({ attachments: filtered })
        .eq("id", documentId);
      break;
    }
    case "material_request_bast": {
      const { data } = await admin
        .from("material_requests")
        .select("orders")
        .eq("id", documentId)
        .single();
      const orders = Array.isArray(data?.orders) ? data.orders : [];
      const updatedOrders = orders.map((order: { bast_attachments?: Attachment[] }) => {
        if (!Array.isArray(order?.bast_attachments)) return order;
        return {
          ...order,
          bast_attachments: order.bast_attachments.filter((a) => !urls.has(a.url)),
        };
      });
      await admin
        .from("material_requests")
        .update({ orders: updatedOrders })
        .eq("id", documentId);
      break;
    }
    case "purchase_order": {
      const { data } = await admin
        .from("purchase_orders")
        .select("attachments")
        .eq("id", documentId)
        .single();
      const attachments = (
        Array.isArray(data?.attachments) ? data.attachments : []
      ) as Attachment[];
      const filtered = attachments.filter((a) => !urls.has(a.url));
      await admin
        .from("purchase_orders")
        .update({ attachments: filtered })
        .eq("id", documentId);
      break;
    }
    case "petty_cash": {
      const { data } = await admin
        .from("petty_cash")
        .select("attachments")
        .eq("id", documentId)
        .single();
      const attachments = (
        Array.isArray(data?.attachments) ? data.attachments : []
      ) as Attachment[];
      const filtered = attachments.filter((a) => !urls.has(a.url));
      await admin
        .from("petty_cash")
        .update({ attachments: filtered })
        .eq("id", documentId);
      break;
    }
    case "petty_cash_settlement": {
      const { data } = await admin
        .from("petty_cash")
        .select("settlement_attachments")
        .eq("id", documentId)
        .single();
      const attachments = (
        Array.isArray(data?.settlement_attachments) ? data.settlement_attachments : []
      ) as Attachment[];
      const filtered = attachments.filter((a) => !urls.has(a.url));
      await admin
        .from("petty_cash")
        .update({ settlement_attachments: filtered })
        .eq("id", documentId);
      break;
    }
    case "orphan":
      break;
  }
}

export async function bulkDeleteAttachments(
  items: DeleteRequestItem[]
): Promise<DeleteResultItem[]> {
  await requireAdmin();
  if (items.length === 0) return [];

  const admin = createAdminStorageClient();
  const vps = createVpsStorageClient();
  const results = new Map<string, DeleteResultItem>();

  const byBucket: Record<StorageBucketSource, DeleteRequestItem[]> = {
    legacy: [],
    vps: [],
  };
  for (const item of items) byBucket[item.bucket].push(item);

  for (const bucket of ["legacy", "vps"] as const) {
    const list = byBucket[bucket];
    if (list.length === 0) continue;
    const client = bucket === "legacy" ? admin : vps;
    const bucketId = bucket === "legacy" ? LEGACY_STORAGE_BUCKET : VPS_STORAGE_BUCKET;

    for (let i = 0; i < list.length; i += 100) {
      const chunk = list.slice(i, i + 100);
      const { error } = await client.storage
        .from(bucketId)
        .remove(chunk.map((it) => it.path));
      for (const it of chunk) {
        results.set(
          it.id,
          error
            ? { id: it.id, success: false, message: error.message }
            : { id: it.id, success: true }
        );
      }
    }
  }

  // Bersihkan referensi DB untuk item yang berhasil dihapus dari storage &
  // punya dokumen induk (bukan orphan). Dikelompokkan per dokumen supaya
  // beberapa attachment dari dokumen yang sama tidak saling menimpa update.
  const successfulWithDoc = items.filter(
    (it) => results.get(it.id)?.success && it.documentId !== null
  );
  const groups = new Map<
    string,
    { source: DeleteRequestItem["source"]; documentId: string | number; urls: Set<string>; ids: string[] }
  >();
  for (const it of successfulWithDoc) {
    const key = `${it.source}:${it.documentId}`;
    if (!groups.has(key)) {
      groups.set(key, {
        source: it.source,
        documentId: it.documentId as string | number,
        urls: new Set(),
        ids: [],
      });
    }
    const group = groups.get(key)!;
    group.urls.add(it.url);
    group.ids.push(it.id);
  }

  for (const group of groups.values()) {
    try {
      await removeAttachmentRefs(admin, group.source, group.documentId, group.urls);
    } catch (e) {
      const message = e instanceof Error ? e.message : "Gagal update referensi dokumen";
      for (const id of group.ids) {
        results.set(id, {
          id,
          success: true,
          message: `File terhapus dari storage, tapi gagal update referensi dokumen: ${message}`,
        });
      }
    }
  }

  revalidateTag(SNAPSHOT_TAG);

  return items.map(
    (it) => results.get(it.id) ?? { id: it.id, success: false, message: "Tidak diproses" }
  );
}
