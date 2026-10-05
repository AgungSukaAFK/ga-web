// src/app/approval-pc-sub-voucher/[id]/page.tsx
//
// Halaman verifikasi publik utk kode QR di dokumen cetak Sub-Voucher (Tarik
// Dana) Petty Cash - mirror app/approval-pc-pengajuan/[id]/page.tsx (lihat
// komentar di sana). BEDA-nya Sub-Voucher tidak punya jalur approval sendiri
// (lihat komentar PettyCashSubVoucher, type/index.ts) - "Riwayat Persetujuan"
// diganti "Status Pembayaran" (siapa & kapan dibayar Finance). Tetap butuh
// login (RLS petty_cash_sub_voucher_select scoped `to authenticated`, sama
// batasannya dengan approval-pc-pengajuan/[id]).

"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { PettyCashSubVoucherItem } from "@/type";
import { formatCurrency, formatDateFriendly, formatDateWithTime } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Skeleton } from "@/components/ui/skeleton";
import { PcCoaBadge } from "@/components/petty-cash/PcCoaBadge";
import { Check, Clock } from "lucide-react";
import {
  usePcVerifyAccess,
  PcVerifyLoading,
  PcVerifyDenied,
  PcVerifyDetailButton,
} from "@/components/petty-cash/usePcVerifyAccess";

type SubVoucherApprovalDetail = {
  user_id: string;
  paid_by: string | null;
  kode_sub_voucher: string;
  amount: number;
  status: string;
  items: PettyCashSubVoucherItem[];
  created_at: string;
  paid_at: string | null;
  users_with_profiles: { nama: string } | null;
  paid_by_profile: { nama: string } | null;
  petty_cash_voucher: {
    kode_voucher: string;
    department: string;
    site: string | null;
    approvals: { userid: string }[] | null;
    petty_cash_pengajuan: { kode_pengajuan: string } | null;
  } | null;
};

export default function ApprovalPcSubVoucherPage() {
  const params = useParams();
  const id = params.id as string;
  const [doc, setDoc] = useState<SubVoucherApprovalDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!id) return;
    const fetchData = async () => {
      setLoading(true);
      const supabase = createClient();

      const { data, error } = await supabase
        .from("petty_cash_sub_voucher")
        .select(
          `
            user_id, paid_by, kode_sub_voucher, amount, status, items, created_at, paid_at,
            users_with_profiles:profiles!user_id (nama),
            paid_by_profile:profiles!paid_by (nama),
            petty_cash_voucher (kode_voucher, department, site, approvals,
              petty_cash_pengajuan (kode_pengajuan))
          `,
        )
        .eq("id", id)
        .maybeSingle();

      if (error) {
        setError(error.message);
      } else if (data) {
        const normalizeOne = <T,>(v: T | T[] | null): T | null =>
          Array.isArray(v) ? v[0] || null : v;
        const raw = data as any;
        const normalized: SubVoucherApprovalDetail = {
          ...raw,
          users_with_profiles: normalizeOne(raw.users_with_profiles),
          paid_by_profile: normalizeOne(raw.paid_by_profile),
          petty_cash_voucher: normalizeOne(raw.petty_cash_voucher),
        };
        setDoc(normalized);
      } else {
        setError("Sub-Voucher Petty Cash tidak ditemukan.");
      }
      setLoading(false);
    };
    fetchData();
  }, [id]);

  // Sub-Voucher tidak punya jalur approval sendiri - yang "terlibat" adalah
  // penarik dana, Finance pembayar, & approver Voucher induknya. Finance
  // approver yang memindai saat dana belum dibayar langsung dibawa ke
  // halaman detail (form penyelesaian pembayaran ada di sana).
  const access = usePcVerifyAccess({
    doc: doc && {
      user_id: doc.user_id,
      relatedUserIds: [
        doc.paid_by,
        ...(doc.petty_cash_voucher?.approvals ?? []).map((a) => a.userid),
      ],
    },
    detailHref: `/petty-cash/sub-voucher/${id}`,
    needsActionFrom: (viewer) =>
      doc?.status === "Menunggu Pembayaran" &&
      viewer.role === "approver" &&
      viewer.department === "Finance",
  });

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center p-4">
        <div className="w-full max-w-2xl space-y-4">
          <Skeleton className="h-10 w-1/2" />
          <Skeleton className="h-40 w-full" />
          <Skeleton className="h-64 w-full" />
        </div>
      </div>
    );
  }

  if (error || !doc) {
    return (
      <div className="flex min-h-screen items-center justify-center p-4">
        <div className="rounded-lg border p-8 text-center shadow-md">
          <h1 className="text-2xl font-bold text-destructive">
            Gagal Memuat Data
          </h1>
          <p className="mt-2 text-muted-foreground">
            {error || "Sub-Voucher Petty Cash tidak ditemukan."}
          </p>
        </div>
      </div>
    );
  }

  if (access.state === "loading") return <PcVerifyLoading />;
  if (access.state === "redirecting") {
    return <PcVerifyLoading message="Mengarahkan ke halaman pembayaran..." />;
  }
  if (access.state === "denied") {
    return <PcVerifyDenied docLabel="sub-voucher petty cash" />;
  }

  return (
    <div className="min-h-screen p-4 md:p-8">
      <div className="mx-auto max-w-3xl rounded-lg border shadow-lg">
        <div className="border-b p-6">
          <h1 className="text-3xl font-bold">
            Verifikasi Petty Cash - Sub-Voucher (Tarik Dana)
          </h1>
          <p className="text-lg">{doc.kode_sub_voucher}</p>
          {access.canOpenDetail && (
            <PcVerifyDetailButton
              href={`/petty-cash/sub-voucher/${id}`}
              label="Lihat Detail Sub-Voucher"
            />
          )}
        </div>

        <div className="grid grid-cols-1 gap-6 p-6 md:grid-cols-2">
          <div>
            <p className="text-sm font-medium">Ditarik Oleh</p>
            <p className="text-lg font-semibold">
              {doc.users_with_profiles?.nama || "N/A"}
            </p>
          </div>
          <div>
            <p className="text-sm font-medium">Departemen</p>
            <p className="text-lg font-semibold">
              {doc.petty_cash_voucher?.department || "-"}
            </p>
          </div>
          <div>
            <p className="text-sm font-medium">Dari Voucher</p>
            <p className="text-lg font-semibold">
              {doc.petty_cash_voucher?.kode_voucher || "-"}
              {doc.petty_cash_voucher?.petty_cash_pengajuan?.kode_pengajuan
                ? ` (Pengajuan ${doc.petty_cash_voucher.petty_cash_pengajuan.kode_pengajuan})`
                : ""}
            </p>
          </div>
          <div>
            <p className="text-sm font-medium">Tanggal Ditarik</p>
            <p className="text-lg font-semibold">
              {formatDateFriendly(doc.created_at)}
            </p>
          </div>
          <div>
            <p className="text-sm font-medium">Nominal Tarikan</p>
            <p className="text-lg font-semibold">
              {formatCurrency(doc.amount)}
            </p>
          </div>
          <div>
            <p className="text-sm font-medium">Status</p>
            <p className="text-lg font-semibold">{doc.status}</p>
          </div>
        </div>

        <div className="px-6 pb-6">
          <h2 className="text-xl font-semibold mb-3">Daftar Barang</h2>
          <div className="rounded-md border overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Nama Barang</TableHead>
                  <TableHead>COA</TableHead>
                  <TableHead>Qty</TableHead>
                  <TableHead className="text-right">Subtotal</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {(doc.items || []).map((it, i) => (
                  <TableRow key={i}>
                    <TableCell>{it.part_name}</TableCell>
                    <TableCell>
                      <PcCoaBadge coa={it.coa} />
                    </TableCell>
                    <TableCell>
                      {it.qty} {it.uom || ""}
                    </TableCell>
                    <TableCell className="text-right">
                      {formatCurrency(it.subtotal)}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </div>

        <div className="p-6 pt-0">
          <h2 className="text-xl font-semibold">Status Pembayaran</h2>
          <div className="mt-4 rounded-md border p-4">
            {doc.status === "Selesai" ? (
              <div className="flex items-center justify-between flex-wrap gap-3">
                <div>
                  <p className="text-sm text-muted-foreground">Dibayar Oleh</p>
                  <p className="font-semibold">
                    {doc.paid_by_profile?.nama || "-"}
                  </p>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">
                    Tanggal Dibayar
                  </p>
                  <p className="font-semibold">
                    {doc.paid_at ? formatDateWithTime(doc.paid_at) : "-"}
                  </p>
                </div>
                <Badge className="bg-green-500 text-white">
                  <Check className="mr-1 h-3 w-3" /> Selesai Dibayar
                </Badge>
              </div>
            ) : (
              <div className="flex items-center justify-between">
                <p className="text-sm text-muted-foreground">
                  Belum ditransfer/dibayar Finance.
                </p>
                <Badge variant="secondary">
                  <Clock className="mr-1 h-3 w-3" /> Menunggu Pembayaran
                </Badge>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
