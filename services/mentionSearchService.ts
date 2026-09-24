// src/services/mentionSearchService.ts
//
// Sumber data buat 4 jenis mention di rich editor (lihat
// components/rich-mention-editor.tsx & components/tiptap/mention-extensions.tsx):
// user (@), barang (#), vendor ($), dokumen (/). Tiga yang pertama cuma
// nge-wrap service pencarian yang sudah ada; pencarian dokumen dibuat baru di
// sini karena belum ada tempat lain yang butuh "cari MR/PO/PC by kode".

import { createClient } from "@/lib/supabase/client";
import { searchUsersForMention } from "./userService";
import { searchBarang } from "./purchaseOrderService";
import { searchVendors } from "./vendorService";

export interface MentionListItem {
  id: string;
  label: string;
  sublabel?: string;
  href?: string;
}

export async function searchUserMentions(
  query: string,
): Promise<MentionListItem[]> {
  const users = await searchUsersForMention(query);
  return users.map((u) => ({
    id: u.id,
    label: u.nama || u.email || "User",
    sublabel: u.role || undefined,
  }));
}

export async function searchBarangMentions(
  query: string,
): Promise<MentionListItem[]> {
  const items = await searchBarang(query);
  return items.map((b) => ({
    id: String(b.id),
    label: b.part_name || b.part_number,
    sublabel: b.part_number || undefined,
  }));
}

export async function searchVendorMentions(
  query: string,
): Promise<MentionListItem[]> {
  const vendors = await searchVendors(query);
  return vendors.map((v) => ({
    id: String(v.id),
    label: v.nama_vendor,
    sublabel: v.kode_vendor || undefined,
  }));
}

// Cari dokumen (MR/PO/Petty Cash) by kode buat di-tag di diskusi/catatan.
// Query paralel ke tiap tabel (masing-masing kecil, limit 4) lalu digabung -
// belum ada satu tabel/RPC gabungan buat search lintas dokumen.
export async function searchDocumentMentions(
  query: string,
): Promise<MentionListItem[]> {
  if (!query) return [];
  const supabase = createClient();
  const q = query.trim().replace(/[,()"%]/g, "");
  if (!q) return [];

  const [mr, po, pcLegacy, pengajuan, voucher, deklarasi] = await Promise.all([
    supabase
      .from("material_requests")
      .select("id, kode_mr")
      .ilike("kode_mr", `%${q}%`)
      .limit(4),
    supabase
      .from("purchase_orders")
      .select("id, kode_po")
      .ilike("kode_po", `%${q}%`)
      .limit(4),
    supabase
      .from("petty_cash_requests")
      .select("id, kode_pc")
      .ilike("kode_pc", `%${q}%`)
      .limit(3),
    supabase
      .from("petty_cash_pengajuan")
      .select("id, kode_pengajuan")
      .ilike("kode_pengajuan", `%${q}%`)
      .limit(3),
    supabase
      .from("petty_cash_voucher")
      .select("id, kode_voucher")
      .ilike("kode_voucher", `%${q}%`)
      .limit(3),
    supabase
      .from("petty_cash_deklarasi")
      .select("id, kode_deklarasi")
      .ilike("kode_deklarasi", `%${q}%`)
      .limit(3),
  ]);

  const results: MentionListItem[] = [
    ...(mr.data || []).map((r: { id: string | number; kode_mr: string }) => ({
      id: `mr:${r.id}`,
      label: r.kode_mr,
      sublabel: "Material Request",
      href: `/material-request/${r.id}`,
    })),
    ...(po.data || []).map((r: { id: string | number; kode_po: string }) => ({
      id: `po:${r.id}`,
      label: r.kode_po,
      sublabel: "Purchase Order",
      href: `/purchase-order/${r.id}`,
    })),
    ...(pcLegacy.data || []).map(
      (r: { id: string | number; kode_pc: string }) => ({
        id: `pc:${r.id}`,
        label: r.kode_pc,
        sublabel: "Petty Cash",
        href: `/petty-cash/${r.id}`,
      }),
    ),
    ...(pengajuan.data || []).map(
      (r: { id: string | number; kode_pengajuan: string }) => ({
        id: `pcp:${r.id}`,
        label: r.kode_pengajuan,
        sublabel: "PC Pengajuan",
        href: `/petty-cash/pengajuan/${r.id}`,
      }),
    ),
    ...(voucher.data || []).map(
      (r: { id: string | number; kode_voucher: string }) => ({
        id: `pcv:${r.id}`,
        label: r.kode_voucher,
        sublabel: "PC Voucher",
        href: `/petty-cash/voucher/${r.id}`,
      }),
    ),
    ...(deklarasi.data || []).map(
      (r: { id: string | number; kode_deklarasi: string }) => ({
        id: `pcd:${r.id}`,
        label: r.kode_deklarasi,
        sublabel: "PC Deklarasi",
        href: `/petty-cash/deklarasi/${r.id}`,
      }),
    ),
  ];

  return results.slice(0, 8);
}
