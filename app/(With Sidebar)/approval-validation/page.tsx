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
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { toast } from "sonner";
import {
  fetchMyPendingMrApprovals,
  fetchMyDraftPOs,
  fetchPendingValidationMRs,
} from "@/services/approvalService";
import { MaterialRequest, User as Profile } from "@/type";
import { formatCurrency, formatDateFriendly } from "@/lib/utils";

// Tipe sederhana untuk daftar PO
interface DraftPO {
  id: number;
  kode_po: string;
  status: string;
  total_price: number;
  created_at: string;
}

function ApprovalValidationContent() {
  const [userProfile, setUserProfile] = useState<Profile | null>(null);
  const [pendingValidationMRs, setPendingValidationMRs] = useState<
    MaterialRequest[]
  >([]);
  const [pendingApprovalMRs, setPendingApprovalMRs] = useState<
    MaterialRequest[]
  >([]);
  const [draftPOs, setDraftPOs] = useState<DraftPO[]>([]);
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
          const promises = [
            fetchMyPendingMrApprovals(user.id),
            fetchMyDraftPOs(user.id),
          ];

          if (profile?.department === "General Affair") {
            promises.unshift(fetchPendingValidationMRs());
          }

          const results = await Promise.all(promises);

          if (profile?.department === "General Affair") {
            setPendingValidationMRs(results[0] as MaterialRequest[]);
            setPendingApprovalMRs(results[1] as MaterialRequest[]);
            setDraftPOs((results[2] as DraftPO[]) || []);
          } else {
            setPendingApprovalMRs(results[0] as MaterialRequest[]);
            setDraftPOs((results[1] as DraftPO[]) || []);
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
        <Content
          title="Menunggu Validasi Anda (Material Request)"
          description="Daftar MR baru yang membutuhkan validasi dan penentuan alur approval."
          className="col-span-12"
          cardAction={
            <Button asChild variant="outline">
              <Link href="/approval-validation/templates">
                Kelola Template Approval
              </Link>
            </Button>
          }
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
                    <TableRow key={mr.id}>
                      <TableCell className="font-medium">
                        {mr.kode_mr}
                      </TableCell>
                      <TableCell>
                        {(mr as any).users_with_profiles?.nama || "N/A"}
                      </TableCell>
                      <TableCell>{mr.department}</TableCell>
                      <TableCell>{formatDateFriendly(mr.created_at)}</TableCell>
                      <TableCell className="text-right">
                        <Button asChild variant="default" size="sm">
                          <Link href={`/material-request/validate/${mr.id}`}>
                            Validasi
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
                  <TableRow key={mr.id}>
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

      <Content
        title="Draft Purchase Order Anda"
        description="Daftar PO yang telah Anda buat namun belum difinalisasi."
        className="col-span-12"
      >
        <div className="rounded-md border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Kode PO</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Total Harga</TableHead>
                <TableHead>Tanggal Dibuat</TableHead>
                <TableHead className="text-right">Aksi</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {draftPOs.length > 0 ? (
                draftPOs.map((po) => (
                  <TableRow key={po.id}>
                    <TableCell className="font-medium">{po.kode_po}</TableCell>
                    <TableCell>
                      <Badge variant="secondary">{po.status}</Badge>
                    </TableCell>
                    <TableCell>{formatCurrency(po.total_price)}</TableCell>
                    <TableCell>
                      {formatDateFriendly(new Date(po.created_at))}
                    </TableCell>
                    <TableCell className="text-right">
                      <Button asChild variant="outline" size="sm">
                        <Link href={`/purchase-order/edit/${po.id}`}>
                          Lanjutkan Draft
                        </Link>
                      </Button>
                    </TableCell>
                  </TableRow>
                ))
              ) : (
                <TableRow>
                  <TableCell colSpan={5} className="text-center h-24">
                    Anda tidak memiliki Purchase Order dalam status Draft.
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
