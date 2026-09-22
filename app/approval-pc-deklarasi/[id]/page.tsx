// src/app/approval-pc-deklarasi/[id]/page.tsx
//
// Halaman verifikasi publik utk kode QR di dokumen cetak Deklarasi Petty
// Cash - mirror app/approval-pc-pengajuan/[id]/page.tsx (lihat komentar di
// sana utk alasan bentuknya). BEDA: Deklarasi tidak punya needed_date/
// week_of_month yang relevan sebagai "kapan dibutuhkan" (laporan pemakaian
// riil, bukan rencana) - baris itu diganti "Tanggal Dibuat" + info Voucher
// asalnya. Tetap butuh login (RLS petty_cash_deklarasi_select scoped `to
// authenticated`, sama batasannya dengan approval-pc-pengajuan/[id]).

"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { PettyCashDeklarasi, PettyCashPengajuanApprover } from "@/type";
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
import { Check, Clock, X } from "lucide-react";

type DeklarasiApprovalDetail = Pick<
  PettyCashDeklarasi,
  | "kode_deklarasi"
  | "department"
  | "site"
  | "total_amount"
  | "status"
  | "approvals"
  | "items"
  | "created_at"
> & {
  users_with_profiles: { nama: string } | null;
  petty_cash_voucher: {
    kode_voucher: string;
    petty_cash_pengajuan: { kode_pengajuan: string } | null;
  } | null;
};

const getApprovalStatusBadge = (
  status: "pending" | "approved" | "rejected",
) => {
  switch (status) {
    case "approved":
      return (
        <Badge className="bg-green-500 text-white">
          <Check className="mr-1 h-3 w-3" />
          Approved
        </Badge>
      );
    case "rejected":
      return (
        <Badge variant="destructive">
          <X className="mr-1 h-3 w-3" />
          Rejected
        </Badge>
      );
    default:
      return (
        <Badge variant="secondary">
          <Clock className="mr-1 h-3 w-3" />
          Pending
        </Badge>
      );
  }
};

export default function ApprovalPcDeklarasiPage() {
  const params = useParams();
  const id = params.id as string;
  const [doc, setDoc] = useState<DeklarasiApprovalDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!id) return;
    const fetchData = async () => {
      setLoading(true);
      const supabase = createClient();

      const { data, error } = await supabase
        .from("petty_cash_deklarasi")
        .select(
          `
            kode_deklarasi, department, site, total_amount, status, approvals,
            items, created_at,
            users_with_profiles:profiles!user_id (nama),
            petty_cash_voucher (kode_voucher, petty_cash_pengajuan (kode_pengajuan))
          `,
        )
        .eq("id", id)
        .maybeSingle();

      if (error) {
        setError(error.message);
      } else if (data) {
        const normalized = {
          ...data,
          users_with_profiles: Array.isArray(
            (data as any).users_with_profiles,
          )
            ? (data as any).users_with_profiles[0] || null
            : (data as any).users_with_profiles || null,
          petty_cash_voucher: Array.isArray((data as any).petty_cash_voucher)
            ? (data as any).petty_cash_voucher[0] || null
            : (data as any).petty_cash_voucher || null,
        } as unknown as DeklarasiApprovalDetail;
        setDoc(normalized);
      } else {
        setError("Deklarasi Petty Cash tidak ditemukan.");
      }
      setLoading(false);
    };
    fetchData();
  }, [id]);

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
            {error || "Deklarasi Petty Cash tidak ditemukan."}
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen p-4 md:p-8">
      <div className="mx-auto max-w-3xl rounded-lg border shadow-lg">
        <div className="border-b p-6">
          <h1 className="text-3xl font-bold">Verifikasi Petty Cash - Deklarasi</h1>
          <p className="text-lg">{doc.kode_deklarasi}</p>
        </div>

        <div className="grid grid-cols-1 gap-6 p-6 md:grid-cols-2">
          <div>
            <p className="text-sm font-medium">Dibuat Oleh</p>
            <p className="text-lg font-semibold">
              {doc.users_with_profiles?.nama || "N/A"}
            </p>
          </div>
          <div>
            <p className="text-sm font-medium">Departemen</p>
            <p className="text-lg font-semibold">{doc.department}</p>
          </div>
          <div>
            <p className="text-sm font-medium">Site</p>
            <p className="text-lg font-semibold">{doc.site || "-"}</p>
          </div>
          <div>
            <p className="text-sm font-medium">Dari Voucher</p>
            <p className="text-lg font-semibold">
              {doc.petty_cash_voucher?.kode_voucher || "-"}
            </p>
          </div>
          <div>
            <p className="text-sm font-medium">Tanggal Dibuat</p>
            <p className="text-lg font-semibold">
              {formatDateFriendly(doc.created_at)}
            </p>
          </div>
          <div>
            <p className="text-sm font-medium">Total Deklarasi</p>
            <p className="text-lg font-semibold">
              {formatCurrency(doc.total_amount)}
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
          <h2 className="text-xl font-semibold">Riwayat Persetujuan</h2>
          <div className="mt-4 rounded-md border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Nama Approver</TableHead>
                  <TableHead>Departemen</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Tanggal Diproses</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {!doc.approvals || doc.approvals.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={4} className="text-center">
                      Belum ada riwayat persetujuan.
                    </TableCell>
                  </TableRow>
                ) : (
                  (doc.approvals as PettyCashPengajuanApprover[]).map(
                    (app, index) => (
                      <TableRow key={index}>
                        <TableCell className="font-medium">
                          {app.nama}
                        </TableCell>
                        <TableCell>{app.department}</TableCell>
                        <TableCell>
                          {getApprovalStatusBadge(app.status)}
                        </TableCell>
                        <TableCell>
                          {app.processed_at
                            ? formatDateWithTime(app.processed_at)
                            : "-"}
                        </TableCell>
                      </TableRow>
                    ),
                  )
                )}
              </TableBody>
            </Table>
          </div>
        </div>
      </div>
    </div>
  );
}
