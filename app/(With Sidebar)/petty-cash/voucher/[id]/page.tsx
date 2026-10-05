// src/app/(With Sidebar)/petty-cash/voucher/[id]/page.tsx
//
// Halaman detail LENGKAP sebuah Pengajuan Voucher Petty Cash - VIEW + EDIT
// di halaman yang sama: cetak (mirror arsitektur purchase-order/[id]/page.tsx
// & persis petty-cash/pengajuan/[id]/page.tsx - lihat komentar lengkap di
// sana), approve/reject/edit-&-setujui (PcApprovalActions, muncul HANYA
// kalau giliran approval user ini sedang pending), override admin
// (PcAdminOverridePanel, role admin), dan panel diskusi (DiscussionPanel,
// semua user login boleh kirim pesan).
//
// SELURUH <Content> di atas dibungkus `no-print` - lihat komentar sama
// persis di petty-cash/pengajuan/[id]/page.tsx untuk alasannya (kalau
// tidak, web UI-nya ikut nampil di hasil cetak barengan blok .print-only).

"use client";

import { use, Suspense, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Content } from "@/components/content";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { createClient } from "@/lib/supabase/client";
import { formatCurrency } from "@/lib/utils";
import {
  fetchVoucherById,
  approveVoucherStep,
  rejectVoucherStep,
  editAndApproveVoucherStep,
  adminUpdateVoucher,
  adminForceUpdateVoucher,
} from "@/services/pettyCashVoucherService";
import {
  adminDeletePettyCashDocument,
  adminRenamePettyCashKode,
} from "@/services/pettyCashAdminService";
import {
  addVoucherDiscussion,
  PcDiscussionPayload,
} from "@/services/pcDiscussionService";
import { PettyCashVoucher } from "@/type";
import {
  PC_VOUCHER_STATUS_COLORS,
  PC_VOUCHER_STATUS_COLOR_DEFAULT,
  PC_VOUCHER_STATUS_OPTIONS,
  PC_SUB_VOUCHER_STATUS_COLORS,
  PC_SUB_VOUCHER_STATUS_COLOR_DEFAULT,
} from "@/type/enum";
import { isMyApprovalTurn } from "@/lib/pcApprovalFlow";
import { PcDocumentInfoPanel } from "@/components/petty-cash/PcDocumentInfoPanel";
import { PcApprovalActions } from "@/components/petty-cash/PcApprovalActions";
import { PcAdminOverridePanel } from "@/components/petty-cash/PcAdminOverridePanel";
import { DiscussionPanel } from "@/components/discussion-panel";
import { PrintablePettyCashDocument } from "@/components/petty-cash/PrintablePettyCashDocument";
import { PcPrintMenu, PcPrintMode } from "@/components/petty-cash/PcPrintMenu";
import { getCompanyDetails, waitForLogoReady } from "@/lib/companyDetails";
import { toast } from "sonner";
import { AlertTriangle, ArrowLeft } from "lucide-react";

const DetailSkeleton = () => (
  <Content className="col-span-12">
    <Skeleton className="h-96 w-full" />
  </Content>
);

function VoucherDetailContent({ id }: { id: string }) {
  const router = useRouter();
  const supabase = createClient();
  const [doc, setDoc] = useState<PettyCashVoucher | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isPrinting, setIsPrinting] = useState(false);
  const [printMode, setPrintMode] = useState<PcPrintMode>("qr");
  const [qrUrl, setQrUrl] = useState("");
  const [viewer, setViewer] = useState<{
    id: string;
    nama: string;
    isAdmin: boolean;
  } | null>(null);
  const [processing, setProcessing] = useState(false);

  const load = async () => {
    setLoading(true);
    try {
      const data = await fetchVoucherById(Number(id));
      setDoc(data);
    } catch (err: any) {
      setError(err.message || "Voucher tidak ditemukan.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, [id]);

  useEffect(() => {
    const loadViewer = async () => {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) return;
      const { data: profile } = await supabase
        .from("profiles")
        .select("nama, role")
        .eq("id", user.id)
        .single();
      setViewer({
        id: user.id,
        nama: profile?.nama || user.email || "Unknown User",
        isAdmin: profile?.role === "admin",
      });
    };
    loadViewer();
  }, []);

  useEffect(() => {
    if (typeof window !== "undefined") {
      setQrUrl(`${window.location.origin}/approval-pc-voucher/${id}`);
    }
  }, [id]);

  const handlePrint = (mode: PcPrintMode) => {
    setPrintMode(mode);
    setIsPrinting(true);
  };

  useEffect(() => {
    if (!isPrinting || !doc) return;
    let cancelled = false;
    let raf1 = 0;
    waitForLogoReady(getCompanyDetails(doc.company_code).logo).then(() => {
      if (cancelled) return;
      raf1 = requestAnimationFrame(() => {
        requestAnimationFrame(() => {
          if (!cancelled) window.print();
        });
      });
    });
    const reset = () => setIsPrinting(false);
    window.addEventListener("afterprint", reset, { once: true });
    return () => {
      cancelled = true;
      cancelAnimationFrame(raf1);
      window.removeEventListener("afterprint", reset);
    };
  }, [isPrinting, doc]);

  const handleApprove = async () => {
    if (!doc || !viewer) return;
    setProcessing(true);
    try {
      await approveVoucherStep(doc, viewer.id);
      toast.success(`${doc.kode_voucher} berhasil disetujui.`);
      await load();
    } catch (error: any) {
      toast.error("Gagal menyetujui", { description: error.message });
    } finally {
      setProcessing(false);
    }
  };

  const handleReject = async (reason: string) => {
    if (!doc || !viewer) return;
    setProcessing(true);
    try {
      await rejectVoucherStep(doc, viewer.id, viewer.nama, reason);
      toast.success(`${doc.kode_voucher} ditolak.`);
      await load();
    } catch (error: any) {
      toast.error("Gagal menolak", { description: error.message });
    } finally {
      setProcessing(false);
    }
  };

  const handleEditAndApprove = async (edits: any) => {
    if (!doc || !viewer) return;
    setProcessing(true);
    try {
      await editAndApproveVoucherStep(doc, viewer.id, viewer.nama, edits);
      toast.success(`${doc.kode_voucher} berhasil diedit & disetujui.`);
      await load();
    } catch (error: any) {
      toast.error("Gagal menyimpan & menyetujui", {
        description: error.message,
      });
    } finally {
      setProcessing(false);
    }
  };

  const handleAdminSave = async (patch: {
    status: string;
    approvals: any[];
  }) => {
    if (!doc) return;
    try {
      await adminUpdateVoucher(doc.id, patch);
      toast.success(`${doc.kode_voucher} berhasil diperbarui (override).`);
      await load();
    } catch (error: any) {
      toast.error("Gagal menyimpan override", { description: error.message });
    }
  };

  const handleForceEdit = async (edits: any, reason: string) => {
    if (!doc) return;
    await adminForceUpdateVoucher(doc.id, edits, reason);
    toast.success(`${doc.kode_voucher} berhasil diedit paksa.`);
    await load();
  };

  const handleRenameKode = async (newKode: string, reason: string) => {
    if (!doc) return;
    const result = await adminRenamePettyCashKode(
      "voucher",
      doc.id,
      newKode,
      reason,
    );
    if (result.cascaded_sub_voucher_count > 0) {
      toast.success(
        `Kode ${result.cascaded_sub_voucher_count} Sub-Voucher turunan ikut diperbarui.`,
      );
    }
    await load();
  };

  const handleDeleteDoc = async (reason: string) => {
    if (!doc) return;
    await adminDeletePettyCashDocument("voucher", doc.id, reason);
    toast.success(`${doc.kode_voucher} & seluruh turunannya berhasil dihapus.`);
    router.push("/petty-cash/management");
  };

  const handlePostDiscussion = async (payload: PcDiscussionPayload) => {
    if (!doc) return;
    await addVoucherDiscussion(doc.id, payload);
    await load();
  };

  if (loading) return <DetailSkeleton />;

  if (error || !doc) {
    return (
      <Content className="col-span-12">
        <div className="flex flex-col items-center justify-center h-96 text-center">
          <AlertTriangle className="w-16 h-16 text-destructive mb-4" />
          <h1 className="text-2xl font-bold">Data Tidak Ditemukan</h1>
          <p className="text-muted-foreground">{error}</p>
        </div>
      </Content>
    );
  }

  const statusColor =
    PC_VOUCHER_STATUS_COLORS[doc.status] || PC_VOUCHER_STATUS_COLOR_DEFAULT;
  const isMyTurn = viewer ? isMyApprovalTurn(doc.approvals, viewer.id) : false;

  return (
    <>
      <Content
        className="no-print"
        title={doc.kode_voucher}
        description={`Detail lengkap Pengajuan Voucher Petty Cash - dari Pengajuan ${
          doc.petty_cash_pengajuan?.kode_pengajuan || "-"
        }.`}
        cardAction={
          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" onClick={() => router.back()}>
              <ArrowLeft className="h-4 w-4 mr-1" /> Kembali
            </Button>
            <PcPrintMenu onPrint={handlePrint} />
          </div>
        }
      >
        <div className="space-y-6">
          <div className="mb-4">
            <Badge className={statusColor}>{doc.status}</Badge>
          </div>
          <PcDocumentInfoPanel
            requesterName={doc.users_with_profiles?.nama}
            requesterEmail={doc.users_with_profiles?.email}
            department={doc.department}
            companyCode={doc.company_code}
            site={doc.site}
            budgetName={doc.petty_cash_budget?.name}
            budgetRemaining={doc.petty_cash_budget?.current_budget}
            neededDate={doc.needed_date}
            weekOfMonth={doc.week_of_month}
            notes={doc.notes}
            items={doc.items}
            totalAmount={doc.total_amount}
            attachments={doc.attachments}
            approvals={doc.approvals}
            discussions={doc.discussions}
            revisions={doc.revisions}
          />

          {doc.status !== "In Approval" && doc.status !== "Rejected" && (
            <Card className="print:hidden">
              <CardHeader>
                <CardTitle className="text-base">
                  Riwayat Sub-Voucher (Tarikan Dana)
                </CardTitle>
              </CardHeader>
              <CardContent>
                {(() => {
                  const subVouchers = doc.petty_cash_sub_voucher ?? [];
                  const drawn = subVouchers.reduce(
                    (sum, sv) => sum + sv.amount,
                    0,
                  );
                  return (
                    <div className="space-y-3">
                      <p className="text-sm text-muted-foreground">
                        Progress:{" "}
                        <span className="font-medium text-foreground">
                          {formatCurrency(drawn)} /{" "}
                          {formatCurrency(doc.total_amount)}
                        </span>
                      </p>
                      {subVouchers.length === 0 ? (
                        <p className="text-sm text-muted-foreground italic">
                          Belum ada dana yang ditarik.
                        </p>
                      ) : (
                        <div className="rounded-md border overflow-x-auto">
                          <Table>
                            <TableHeader>
                              <TableRow>
                                <TableHead>Kode Sub-Voucher</TableHead>
                                <TableHead className="text-right">
                                  Nominal
                                </TableHead>
                                <TableHead>Status Pembayaran</TableHead>
                                <TableHead>Status Deklarasi</TableHead>
                              </TableRow>
                            </TableHeader>
                            <TableBody>
                              {subVouchers.map((sv) => {
                                const deklarasi =
                                  sv.petty_cash_deklarasi?.[0];
                                return (
                                  <TableRow key={sv.id}>
                                    <TableCell className="font-medium text-sm">
                                      <Link
                                        href={`/petty-cash/sub-voucher/${sv.id}`}
                                        className="text-primary hover:underline"
                                      >
                                        {sv.kode_sub_voucher}
                                      </Link>
                                    </TableCell>
                                    <TableCell className="text-right text-sm">
                                      {formatCurrency(sv.amount)}
                                    </TableCell>
                                    <TableCell className="text-sm">
                                      <Badge
                                        className={
                                          PC_SUB_VOUCHER_STATUS_COLORS[sv.status] ||
                                          PC_SUB_VOUCHER_STATUS_COLOR_DEFAULT
                                        }
                                      >
                                        {sv.status}
                                      </Badge>
                                    </TableCell>
                                    <TableCell className="text-sm">
                                      {deklarasi ? (
                                        <Link
                                          href={`/petty-cash/deklarasi/${deklarasi.id}`}
                                          className="text-primary hover:underline"
                                        >
                                          {deklarasi.kode_deklarasi} -{" "}
                                          {deklarasi.status}
                                        </Link>
                                      ) : (
                                        <span className="text-muted-foreground italic">
                                          Belum dideklarasikan
                                        </span>
                                      )}
                                    </TableCell>
                                  </TableRow>
                                );
                              })}
                            </TableBody>
                          </Table>
                        </div>
                      )}
                    </div>
                  );
                })()}
              </CardContent>
            </Card>
          )}

          {isMyTurn && (
            <div className="flex flex-wrap justify-end gap-2 border-t pt-4">
              <PcApprovalActions
                docLabel="Voucher"
                kode={doc.kode_voucher}
                companyCode={doc.company_code}
                editInitial={{
                  needed_date: doc.needed_date,
                  week_of_month: doc.week_of_month,
                  notes: doc.notes,
                  items: doc.items,
                  attachments: doc.attachments,
                }}
                processing={processing}
                onApprove={handleApprove}
                onReject={handleReject}
                onEditAndApprove={handleEditAndApprove}
              />
            </div>
          )}

          {viewer?.isAdmin && (
            <PcAdminOverridePanel
              key={doc.id}
              docType="voucher"
              docId={doc.id}
              kode={doc.kode_voucher}
              status={doc.status}
              approvals={doc.approvals}
              statusOptions={PC_VOUCHER_STATUS_OPTIONS}
              onSaveStatus={handleAdminSave}
              docLabel="Voucher"
              showNeededDate
              showBudget
              editInitial={{
                needed_date: doc.needed_date,
                week_of_month: doc.week_of_month,
                site: doc.site,
                company_code: doc.company_code,
                department: doc.department,
                budget_id: doc.budget_id,
                notes: doc.notes,
                items: doc.items,
                attachments: doc.attachments,
              }}
              onForceEdit={handleForceEdit}
              onRenameKode={handleRenameKode}
              onDelete={handleDeleteDoc}
            />
          )}

          <DiscussionPanel
            discussions={doc.discussions}
            onSubmit={handlePostDiscussion}
            storagePathPrefix={`discussions/petty-cash/voucher/${doc.id}`}
          />
        </div>
      </Content>

      <div className="print-only">
        <PrintablePettyCashDocument
          docTitle="Pengajuan Voucher"
          kode={doc.kode_voucher}
          companyCode={doc.company_code}
          createdAt={doc.created_at}
          requesterName={doc.users_with_profiles?.nama}
          department={doc.department}
          site={doc.site}
          neededDate={doc.needed_date}
          weekOfMonth={doc.week_of_month}
          budgetName={doc.petty_cash_budget?.name}
          references={[
            {
              label: "Ref. Pengajuan",
              value: doc.petty_cash_pengajuan?.kode_pengajuan,
            },
          ]}
          approvals={doc.approvals}
          notes={doc.notes}
          items={doc.items}
          totalAmount={doc.total_amount}
          qrUrl={qrUrl}
          signatureMode={printMode}
          printTrigger={isPrinting}
        />
      </div>
    </>
  );
}

export default function VoucherDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const resolvedParams = use(params);
  return (
    <Suspense fallback={<DetailSkeleton />}>
      <VoucherDetailContent id={resolvedParams.id} />
    </Suspense>
  );
}
