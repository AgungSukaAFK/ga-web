// src/app/approval-po/[id]/page.tsx
"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { PurchaseOrder, Approval } from "@/type";
import {
  formatCurrency,
  formatDateFriendly,
  formatDateWithTime,
} from "@/lib/utils";
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
import { Check, Clock, X } from "lucide-react";

// Tipe data yang disederhanakan untuk halaman ini
type POApprovalDetail = Pick<
  PurchaseOrder,
  "kode_po" | "total_price" | "created_at" | "status" | "approvals" | "items"
> & {
  users_with_profiles: { nama: string } | null;
  material_requests: { kode_mr: string } | null;
};

// Helper Badge
const getApprovalStatusBadge = (
  status: "pending" | "approved" | "rejected"
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

export default function ApprovalPOPage() {
  const params = useParams();
  const poId = params.id as string;
  const [po, setPo] = useState<POApprovalDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (poId) {
      const fetchPoData = async () => {
        setLoading(true);
        const supabase = createClient();
        const { data, error } = await supabase
          .from("purchase_orders")
          .select(
            `
              kode_po, total_price, created_at, status, approvals, items,
              users_with_profiles!user_id (nama),
              material_requests!mr_id (kode_mr)
            `
          )
          .eq("id", poId)
          .single();

        if (error) {
          setError(error.message);
        } else if (data) {
          // REVISI: Transformasi data sebelum set state
          const transformedData = {
            ...data,
            users_with_profiles: Array.isArray(data.users_with_profiles)
              ? data.users_with_profiles[0] ?? null
              : data.users_with_profiles,
            material_requests: Array.isArray(data.material_requests)
              ? data.material_requests[0] ?? null
              : data.material_requests,
          };
          setPo(transformedData as POApprovalDetail);
        }
        setLoading(false);
      };
      fetchPoData();
    }
  }, [poId]);

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-gray-100 p-4">
        <div className="w-full max-w-2xl space-y-4">
          <Skeleton className="h-10 w-1/2" />
          <Skeleton className="h-40 w-full" />
          <Skeleton className="h-64 w-full" />
        </div>
      </div>
    );
  }

  if (error || !po) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-gray-100 p-4">
        <div className="rounded-lg border bg-white p-8 text-center shadow-md">
          <h1 className="text-2xl font-bold text-destructive">
            Gagal Memuat Data
          </h1>
          <p className="mt-2 text-muted-foreground">
            {error || "Purchase Order tidak ditemukan."}
          </p>
        </div>
      </div>
    );
  }

  const subtotal = (po.items || []).reduce(
    (acc, item) => acc + (item.price || 0) * (item.qty || 0),
    0
  );

  return (
    <div className="min-h-screen bg-gray-100 p-4 md:p-8">
      <div className="mx-auto max-w-3xl rounded-lg border bg-white shadow-lg">
        <div className="border-b p-6">
          <h1 className="text-3xl font-bold text-gray-900">
            Verifikasi Purchase Order
          </h1>
          <p className="text-lg text-gray-700">{po.kode_po}</p>
        </div>

        <div className="grid grid-cols-1 gap-6 p-6 md:grid-cols-2">
          <div>
            <p className="text-sm font-medium text-gray-500">Dibuat Oleh</p>
            <p className="text-lg font-semibold">
              {po.users_with_profiles?.nama || "N/A"}
            </p>
          </div>
          <div>
            <p className="text-sm font-medium text-gray-500">Ref. MR</p>
            <p className="text-lg font-semibold">
              {po.material_requests?.kode_mr || "N/A"}
            </p>
          </div>
          <div>
            <p className="text-sm font-medium text-gray-500">Tanggal Dibuat</p>
            <p className="text-lg font-semibold">
              {formatDateFriendly(po.created_at)}
            </p>
          </div>
          <div>
            <p className="text-sm font-medium text-gray-500">Total Biaya</p>
            <p className="text-lg font-semibold text-blue-600">
              {formatCurrency(po.total_price)}
            </p>
          </div>
        </div>

        <div className="p-6">
          <h2 className="text-xl font-semibold">Riwayat Persetujuan</h2>
          <div className="mt-4 rounded-md border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Nama Approver</TableHead>
                  <TableHead>Jenis</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Tanggal Diproses</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {!po.approvals || po.approvals.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={4} className="text-center">
                      Belum ada riwayat persetujuan.
                    </TableCell>
                  </TableRow>
                ) : (
                  po.approvals.map((app, index) => (
                    <TableRow key={index}>
                      <TableCell className="font-medium">{app.nama}</TableCell>
                      <TableCell>{app.type}</TableCell>
                      <TableCell>
                        {getApprovalStatusBadge(app.status)}
                      </TableCell>
                      <TableCell>
                        {app.processed_at
                          ? formatDateWithTime(app.processed_at)
                          : "-"}
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>
        </div>
      </div>
    </div>
  );
}
