// src/app/(With Sidebar)/approval-validation/page.tsx

"use client";

import { Suspense, useEffect, useState } from "react";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import { Content } from "@/components/content";
import { Button } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Skeleton } from "@/components/ui/skeleton";
import { toast } from "sonner";
import {
  fetchMyPendingMrApprovals,
  fetchMyDraftPOs,
  fetchPendingValidationMRs,
  fetchPendingValidationPOs,
  fetchMyPendingPoApprovals,
} from "@/services/approvalService";
import { MaterialRequest, User as Profile, PurchaseOrder } from "@/type";
import { formatCurrency, formatDateFriendly } from "@/lib/utils";

// Tipe baru untuk daftar PO yang butuh validasi
interface ValidationPO {
  id: number;
  kode_po: string;
  created_at: string;
  total_price: number;
  users_with_profiles: {
    nama: string;
  } | null;
}

function ApprovalValidationContent() {
  const [userProfile, setUserProfile] = useState<Profile | null>(null);
  const [pendingValidationMRs, setPendingValidationMRs] = useState<
    MaterialRequest[]
  >([]);
  const [pendingValidationPOs, setPendingValidationPOs] = useState<
    ValidationPO[]
  >([]);
  const [pendingApprovalMRs, setPendingApprovalMRs] = useState<
    MaterialRequest[]
  >([]);
  const [pendingApprovalPOs, setPendingApprovalPOs] = useState<PurchaseOrder[]>(
    []
  ); // <-- State baru
  const [loading, setLoading] = useState(true);

  const s = createClient();

  useEffect(() => {
    const loadInitialData = async () => {
      setLoading(true);
      const {
        data: { user },
      } = await s.auth.getUser();

      if (user) {
        const { data: profile } = await s
          .from("profiles")
          .select("*")
          .eq("id", user.id)
          .single();
        setUserProfile(profile);

        try {
          // REVISI: Logika fetch data disederhanakan

          // 1. Selalu fetch data yang relevan untuk semua user
          const [myMrApprovals, myPoApprovals, myDrafts] = await Promise.all([
            fetchMyPendingMrApprovals(user.id),
            fetchMyPendingPoApprovals(user.id), // <-- Panggil fungsi baru
            fetchMyDraftPOs(user.id),
          ]);
          setPendingApprovalMRs(myMrApprovals);
          setPendingApprovalPOs(myPoApprovals);

          // 2. Fetch data tambahan KHUSUS jika user adalah General Affair
          if (profile?.department === "General Affair") {
            const [validationMRs, validationPOs] = await Promise.all([
              fetchPendingValidationMRs(),
              fetchPendingValidationPOs(),
            ]);
            setPendingValidationMRs(validationMRs);
            setPendingValidationPOs((validationPOs as ValidationPO[]) || []);
          }
        } catch (error: any) {
          toast.error("Gagal memuat data", { description: error.message });
        }
      }
      setLoading(false);
    };
    loadInitialData();
  }, [s]);

  if (loading) {
    return (
      <>
        <Content className="col-span-12">
          <Skeleton className="h-64 w-full" />
        </Content>
        <Content className="col-span-12">
          <Skeleton className="h-64 w-full" />
        </Content>
      </>
    );
  }

  return (
    <>
      {userProfile?.department === "General Affair" && (
        <>
          <Content
            title="Menunggu Validasi Anda (Material Request)"
            description="Daftar MR baru yang membutuhkan validasi dan penentuan alur approval."
            className="col-span-12"
          >
            <div className="rounded-md border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Kode MR</TableHead>
                    <TableHead>Requester</TableHead>
                    <TableHead>Departemen</TableHead>
                    <TableHead>Tanggal Dibuat</TableHead>
                    <TableHead className="text-right">Aksi</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {pendingValidationMRs.length > 0 ? (
                    pendingValidationMRs.map((mr) => (
                      <TableRow key={`mr-val-${mr.id}`}>
                        <TableCell className="font-medium">
                          {mr.kode_mr}
                        </TableCell>
                        <TableCell>
                          {(mr as any).users_with_profiles?.nama || "N/A"}
                        </TableCell>
                        <TableCell>{mr.department}</TableCell>
                        <TableCell>
                          {formatDateFriendly(mr.created_at)}
                        </TableCell>
                        <TableCell className="text-right">
                          <Button asChild variant="default" size="sm">
                            <Link href={`/material-request/validate/${mr.id}`}>
                              Validasi MR
                            </Link>
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))
                  ) : (
                    <TableRow>
                      <TableCell colSpan={5} className="text-center h-24">
                        Tidak ada Material Request yang menunggu validasi.
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </div>
          </Content>

          <Content
            title="Menunggu Validasi Anda (Purchase Order)"
            description="Daftar PO baru yang membutuhkan validasi dan penentuan alur approval."
            className="col-span-12"
          >
            <div className="rounded-md border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Kode PO</TableHead>
                    <TableHead>Pembuat</TableHead>
                    <TableHead>Total Harga</TableHead>
                    <TableHead>Tanggal Dibuat</TableHead>
                    <TableHead className="text-right">Aksi</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {pendingValidationPOs.length > 0 ? (
                    pendingValidationPOs.map((po) => (
                      <TableRow key={`po-val-${po.id}`}>
                        <TableCell className="font-medium">
                          {po.kode_po}
                        </TableCell>
                        <TableCell>
                          {(po as any).users_with_profiles?.nama || "N/A"}
                        </TableCell>
                        <TableCell>{formatCurrency(po.total_price)}</TableCell>
                        <TableCell>
                          {formatDateFriendly(po.created_at)}
                        </TableCell>
                        <TableCell className="text-right">
                          <Button asChild variant="default" size="sm">
                            <Link href={`/purchase-order/validate/${po.id}`}>
                              Validasi PO
                            </Link>
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))
                  ) : (
                    <TableRow>
                      <TableCell colSpan={5} className="text-center h-24">
                        Tidak ada Purchase Order yang menunggu validasi.
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </div>
          </Content>
        </>
      )}

      <Content
        title="Menunggu Persetujuan Anda (Material Request)"
        description="Daftar MR berikut membutuhkan tindakan persetujuan dari Anda."
        className="col-span-12"
      >
        <div className="rounded-md border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Kode MR</TableHead>
                <TableHead>Requester</TableHead>
                <TableHead>Remarks</TableHead>
                <TableHead>Tanggal Dibuat</TableHead>
                <TableHead className="text-right">Aksi</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {pendingApprovalMRs.length > 0 ? (
                pendingApprovalMRs.map((mr) => (
                  <TableRow key={`mr-app-${mr.id}`}>
                    <TableCell className="font-medium">{mr.kode_mr}</TableCell>
                    <TableCell>
                      {(mr as any).users_with_profiles?.nama || "N/A"}
                    </TableCell>
                    <TableCell className="max-w-xs truncate">
                      {mr.remarks}
                    </TableCell>
                    <TableCell>{formatDateFriendly(mr.created_at)}</TableCell>
                    <TableCell className="text-right">
                      <Button asChild variant="outline" size="sm">
                        <Link href={`/material-request/${mr.id}`}>
                          Lihat & Respon
                        </Link>
                      </Button>
                    </TableCell>
                  </TableRow>
                ))
              ) : (
                <TableRow>
                  <TableCell colSpan={5} className="text-center h-24">
                    Tidak ada Material Request yang menunggu persetujuan Anda
                    saat ini.
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </div>
      </Content>

      {/* --- TABEL BARU UNTUK APPROVAL PO --- */}
      <Content
        title="Menunggu Persetujuan Anda (Purchase Order)"
        description="Daftar PO berikut membutuhkan tindakan persetujuan dari Anda."
        className="col-span-12"
      >
        <div className="rounded-md border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Kode PO</TableHead>
                <TableHead>Ref. MR</TableHead>
                <TableHead>Pembuat</TableHead>
                <TableHead>Total Harga</TableHead>
                <TableHead className="text-right">Aksi</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {pendingApprovalPOs.length > 0 ? (
                pendingApprovalPOs.map((po) => (
                  <TableRow key={`po-app-${po.id}`}>
                    <TableCell className="font-medium">{po.kode_po}</TableCell>
                    <TableCell>
                      {(po as any).material_requests?.kode_mr || "N/A"}
                    </TableCell>
                    <TableCell>
                      {(po as any).users_with_profiles?.nama || "N/A"}
                    </TableCell>
                    <TableCell>{formatCurrency(po.total_price)}</TableCell>
                    <TableCell className="text-right">
                      <Button asChild variant="outline" size="sm">
                        {/* TODO: Buat halaman detail/respon untuk PO */}
                        <Link href={`/purchase-order/${po.id}`}>
                          Lihat & Respon
                        </Link>
                      </Button>
                    </TableCell>
                  </TableRow>
                ))
              ) : (
                <TableRow>
                  <TableCell colSpan={5} className="text-center h-24">
                    Tidak ada Purchase Order yang menunggu persetujuan Anda saat
                    ini.
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </div>
      </Content>
    </>
  );
}

// Komponen Induk untuk membungkus dengan Suspense
export default function ApprovalValidationPage() {
  return (
    <Suspense
      fallback={
        <>
          <Content className="col-span-12">
            <Skeleton className="h-64 w-full" />
          </Content>
          <Content className="col-span-12">
            <Skeleton className="h-64 w-full" />
          </Content>
        </>
      }
    >
      <ApprovalValidationContent />
    </Suspense>
  );
}
