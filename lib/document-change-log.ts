// lib/document-change-log.ts
//
// Rincian perubahan dokumen untuk Riwayat Aktivitas: dibandingkan antara data
// saat form dibuka dan saat disimpan, lalu disimpan di
// `activity_logs.metadata.changes` dan ditampilkan ActivityLogDialog.

import { extractPlainText } from "@/lib/rich-content";
import { formatCurrency, formatDateFriendly } from "@/lib/utils";

export type DocumentChange = {
  label: string;
  from?: string;
  to?: string;
};

type Doc = Record<string, any>;
type Field = { label: string; read: (doc: Doc) => string };

const EMPTY = "-";
const MAX_TEXT_LENGTH = 120;

const text = (value: unknown) => {
  const result = String(value ?? "").trim();
  return result.length > MAX_TEXT_LENGTH
    ? `${result.slice(0, MAX_TEXT_LENGTH)}...`
    : result || EMPTY;
};
const richText = (value: string | null | undefined) =>
  text(extractPlainText(value));
const currency = (value: unknown) => formatCurrency(Number(value) || 0);
const date = (value: unknown) =>
  value ? formatDateFriendly(value as string) : EMPTY;

const asList = (value: unknown): Doc[] => (Array.isArray(value) ? value : []);

const diffFields = (before: Doc, after: Doc, fields: Field[], prefix = "") => {
  const changes: DocumentChange[] = [];
  for (const { label, read } of fields) {
    const from = read(before);
    const to = read(after);
    if (from !== to) changes.push({ label: `${prefix}${label}`, from, to });
  }
  return changes;
};

const diffApprovals = (beforeValue: unknown, afterValue: unknown) => {
  const before = asList(beforeValue);
  const after = asList(afterValue);
  const changes: DocumentChange[] = [];
  for (let i = 0; i < Math.max(before.length, after.length); i++) {
    const from = before[i];
    const to = after[i];
    if (!from) {
      changes.push({ label: "Approver ditambah", to: text(to.nama) });
    } else if (!to) {
      changes.push({ label: "Approver dihapus", from: text(from.nama) });
    } else if (from.userid !== to.userid) {
      changes.push({
        label: `Approver tahap ${i + 1}`,
        from: text(from.nama),
        to: text(to.nama),
      });
    } else if (from.status !== to.status) {
      changes.push({
        label: `Approval ${text(to.nama)}`,
        from: text(from.status),
        to: text(to.status),
      });
    }
  }
  return changes;
};

const diffAttachments = (beforeValue: unknown, afterValue: unknown) => {
  const before = asList(beforeValue);
  const after = asList(afterValue);
  const beforeUrls = new Set(before.map((a) => a.url));
  const afterUrls = new Set(after.map((a) => a.url));
  return [
    ...after
      .filter((a) => !beforeUrls.has(a.url))
      .map((a) => ({ label: "Lampiran ditambah", to: text(a.name) })),
    ...before
      .filter((a) => !afterUrls.has(a.url))
      .map((a) => ({ label: "Lampiran dihapus", from: text(a.name) })),
  ];
};

const itemKey = (item: Doc) => item.part_number || item.name;
const itemName = (item: Doc) =>
  `${text(item.name)} (${item.part_number || EMPTY})`;

const diffItems = (beforeValue: unknown, afterValue: unknown, fields: Field[]) => {
  const after = asList(afterValue);
  const unmatched = [...asList(beforeValue)];
  const take = (keys: string[]) => {
    const index = unmatched.findIndex((item) => keys.includes(itemKey(item)));
    return index < 0 ? undefined : unmatched.splice(index, 1)[0];
  };

  // Cocokkan yang identik dulu supaya item hasil konversi tidak mengambil
  // pasangan item lain yang barangnya masih sama.
  const pairs = after.map((item) => ({ item, match: take([itemKey(item)]) }));
  for (const pair of pairs) {
    if (pair.match) continue;
    pair.match = take(
      asList(pair.item.conversion_history).map(
        (h: Doc) => h.from_part_number || h.from_name,
      ),
    );
  }

  const changes: DocumentChange[] = [];
  for (const { item, match } of pairs) {
    if (!match) {
      changes.push({
        label: "Item ditambah",
        to: `${itemName(item)} x ${item.qty} ${item.uom}`,
      });
      continue;
    }
    if (itemKey(match) !== itemKey(item)) {
      changes.push({
        label: "Barang dikonversi",
        from: itemName(match),
        to: itemName(item),
      });
    }
    changes.push(...diffFields(match, item, fields, `${text(item.name)} - `));
  }
  for (const item of unmatched) {
    changes.push({
      label: "Item dihapus",
      from: `${itemName(item)} x ${item.qty} ${item.uom}`,
    });
  }
  return changes;
};

const MR_ITEM_FIELDS: Field[] = [
  { label: "Qty", read: (i) => text(i.qty) },
  { label: "UoM", read: (i) => text(i.uom) },
  { label: "Estimasi Harga", read: (i) => currency(i.estimasi_harga) },
  { label: "Catatan", read: (i) => text(i.note) },
  { label: "Link", read: (i) => text(i.url) },
];

export function diffMrChanges(
  before: Doc,
  after: Doc,
  costCenterName: (id: number | null | undefined) => string,
) {
  return [
    ...diffFields(before, after, [
      { label: "Status", read: (d) => text(d.status) },
      { label: "Kategori", read: (d) => text(d.kategori) },
      { label: "Departemen", read: (d) => text(d.department) },
      { label: "Tujuan Site", read: (d) => text(d.tujuan_site) },
      { label: "Cost Center", read: (d) => text(costCenterName(d.cost_center_id)) },
      { label: "Prioritas", read: (d) => text(d.prioritas) },
      { label: "Level", read: (d) => text(d.level) },
      { label: "Due Date", read: (d) => date(d.due_date) },
      { label: "Total Estimasi", read: (d) => currency(d.cost_estimation) },
      { label: "Remarks", read: (d) => richText(d.remarks) },
    ]),
    ...diffItems(before.orders, after.orders, MR_ITEM_FIELDS),
    ...diffApprovals(before.approvals, after.approvals),
    ...diffAttachments(before.attachments, after.attachments),
  ];
}

const PO_ITEM_FIELDS: Field[] = [
  { label: "Qty", read: (i) => text(i.qty) },
  { label: "UoM", read: (i) => text(i.uom) },
  { label: "Harga", read: (i) => currency(i.price) },
  { label: "Vendor", read: (i) => text(i.vendor_name) },
  { label: "Deskripsi", read: (i) => text(i.description) },
  { label: "Link", read: (i) => text(i.link) },
];

export function diffPoChanges(before: Doc, after: Doc) {
  return [
    ...diffFields(before, after, [
      { label: "Status", read: (d) => text(d.status) },
      { label: "Vendor", read: (d) => text(d.vendor_details?.nama_vendor) },
      { label: "Termin Pembayaran", read: (d) => text(d.payment_term) },
      { label: "Mata Uang", read: (d) => text(d.currency) },
      { label: "Diskon", read: (d) => currency(d.discount) },
      { label: "PPN", read: (d) => currency(d.tax) },
      { label: "PPh", read: (d) => currency(d.pph_amount) },
      { label: "Ongkir", read: (d) => currency(d.postage) },
      { label: "Total Harga", read: (d) => currency(d.total_price) },
      { label: "Alamat Pengiriman", read: (d) => text(d.shipping_address) },
      { label: "Catatan", read: (d) => richText(d.notes) },
    ]),
    ...diffItems(before.items, after.items, PO_ITEM_FIELDS),
    ...diffApprovals(before.approvals, after.approvals),
    ...diffAttachments(before.attachments, after.attachments),
  ];
}
