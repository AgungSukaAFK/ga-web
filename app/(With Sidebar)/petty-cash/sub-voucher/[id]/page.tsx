// src/app/(With Sidebar)/petty-cash/sub-voucher/[id]/page.tsx
//
// Halaman detail LENGKAP sebuah Sub-Voucher (Tarikan Dana) Petty Cash - VIEW
// + cetak, mirror arsitektur petty-cash/pengajuan/[id]/page.tsx (lihat
// komentar lengkap di sana utk alasan pola cetak/QR-nya) - BEDA-nya
// Sub-Voucher tidak punya jalur approval sendiri (persetujuannya sudah ada
// di level Voucher induk, lihat komentar PettyCashSubVoucher, type/index.ts)
// jadi TIDAK ADA PcApprovalActions/PcAdminOverridePanel di sini. Sebagai
// gantinya, kalau viewer Finance approver (department "Finance" + role
// "approver", atau admin) dan status masih "Menunggu Pembayaran", muncul
// form "Selesaikan Pembayaran" (PcSubVoucherPaymentForm, dipakai bareng oleh
// dialog antrian di /petty-cash/approval).
//
// SELURUH <Content> di atas dibungkus `no-print` - lihat komentar sama
// persis di petty-cash/pengajuan/[id]/page.tsx untuk alasannya.

"use client";

import { use, Suspense, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Content } from "@/components/content";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { createClient } from "@/lib/supabase/client";
import { formatCurrency, formatDateFriendly } from "@/lib/utils";
import {
  fetchSubVoucherById,
  markSubVoucherPaid,
  adminForceUpdateSubVoucher,
} from "@/services/pettyCashSubVoucherService";
import {
  adminDeletePettyCashDocument,
  adminRenamePettyCashKode,
} from "@/services/pettyCashAdminService";
import {
  addSubVoucherDiscussion,
  PcDiscussionPayload,
} from "@/services/pcDiscussionService";
import { Attachment, PettyCashSubVoucher } from "@/type";
import {
  PC_SUB_VOUCHER_STATUS_COLORS,
  PC_SUB_VOUCHER_STATUS_COLOR_DEFAULT,
} from "@/type/enum";
import { PcDocumentInfoPanel } from "@/components/petty-cash/PcDocumentInfoPanel";
import { PcSubVoucherPaymentForm } from "@/components/petty-cash/PcSubVoucherPaymentForm";
import { PcAdminSubVoucherPanel } from "@/components/petty-cash/PcAdminSubVoucherPanel";
import { DiscussionPanel } from "@/components/discussion-panel";
import { PrintablePettyCashDocument } from "@/components/petty-cash/PrintablePettyCashDocument";
import { getCompanyDetails, waitForLogoReady } from "@/lib/companyDetails";
import { toast } from "sonner";
import { AlertTriangle, ArrowLeft, Printer } from "lucide-react";

const DetailSkeleton = () => (
  <Content className="col-span-12">
    <Skeleton className="h-96 w-full" />
  </Content>
);

function SubVoucherDetailContent({ id }: { id: string }) {
  const router = useRouter();
  const supabase = createClient();
  const [doc, setDoc] = useState<PettyCashSubVoucher | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isPrinting, setIsPrinting] = useState(false);
  const [qrUrl, setQrUrl] = useState("");
  const [viewer, setViewer] = useState<{
    isFinanceApprover: boolean;
    isAdmin: boolean;
  } | null>(null);
  const [processingPayment, setProcessingPayment] = useState(false);

  const load = async () => {
    setLoading(true);
    try {
      const data = await fetchSubVoucherById(Number(id));
      setDoc(data);
    } catch (err: any) {
      setError(err.message || "Sub-Voucher tidak ditemukan.");
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
        .select("role, department")
        .eq("id", user.id)
        .single();
      setViewer({
        isFinanceApprover:
          profile?.role === "admin" ||
          (profile?.department === "Finance" && profile?.role === "approver"),
        isAdmin: profile?.role === "admin",
      });
    };
    loadViewer();
  }, []);

  useEffect(() => {
    if (typeof window !== "undefined") {
      setQrUrl(`${window.location.origin}/approval-pc-sub-voucher/${id}`);
    }
  }, [id]);

  const handlePrint = () => setIsPrinting(true);

  useEffect(() => {
    if (!isPrinting || !doc) return;
    let cancelled = false;
    let raf1 = 0;
    const companyCode = doc.petty_cash_voucher?.company_code || "";
    waitForLogoReady(getCompanyDetails(companyCode).logo).then(() => {
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

  const handleMarkPaid = async (paymentProof: Attachment[]) => {
    if (!doc) return;
    setProcessingPayment(true);
    try {
      await markSubVoucherPaid(doc.id, paymentProof);
      toast.success(`${doc.kode_sub_voucher} berhasil ditandai selesai dibayar.`);
      await load();
    } catch (error: any) {
      toast.error("Gagal menyelesaikan pembayaran", {
        description: error.message,
      });
    } finally {
      setProcessingPayment(false);
    }
  };

  const handlePostDiscussion = async (payload: PcDiscussionPayload) => {
    if (!doc) return;
    await addSubVoucherDiscussion(doc.id, payload);
    await load();
  };

  const handleForceEdit = async (edits: any, reason: string) => {
    if (!doc) return;
    await adminForceUpdateSubVoucher(
      doc.id,
      { ...edits, payment_proof: doc.payment_proof },
      reason,
    );
    toast.success(`${doc.kode_sub_voucher} berhasil diedit paksa.`);
    await load();
  };

  const handleRenameKode = async (newKode: string, reason: string) => {
    if (!doc) return;
    await adminRenamePettyCashKode("sub_voucher", doc.id, newKode, reason);
    await load();
  };

  const handleDeleteDoc = async (reason: string) => {
    if (!doc) return;
    await adminDeletePettyCashDocument("sub_voucher", doc.id, reason);
    toast.success(`${doc.kode_sub_voucher} berhasil dihapus & dana direfund.`);
    router.push("/petty-cash/management");
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
    PC_SUB_VOUCHER_STATUS_COLORS[doc.status] || PC_SUB_VOUCHER_STATUS_COLOR_DEFAULT;
  const voucher = doc.petty_cash_voucher;

  return (
    <>
      <Content
        className="no-print"
        title={doc.kode_sub_voucher}
        description="Detail lengkap Sub-Voucher (Tarikan Dana) Petty Cash."
        cardAction={
          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" onClick={() => router.back()}>
              <ArrowLeft className="h-4 w-4 mr-1" /> Kembali
            </Button>
            <Button size="sm" onClick={handlePrint}>
              <Printer className="h-4 w-4 mr-1" /> Cetak
            </Button>
          </div>
        }
      >
        <div className="space-y-6">
          <div className="mb-4 flex items-center gap-3 flex-wrap">
            <Badge className={statusColor}>{doc.status}</Badge>
            <span className="text-xs text-muted-foreground">
              Dari Voucher{" "}
              <span className="font-medium text-foreground">
                {voucher?.kode_voucher || "-"}
              </span>
              {voucher?.petty_cash_pengajuan?.kode_pengajuan && (
                <>
                  {" "}
                  (Pengajuan{" "}
                  <span className="font-medium text-foreground">
                    {voucher.petty_cash_pengajuan.kode_pengajuan}
                  </span>
                  )
                </>
              )}
            </span>
          </div>

          <PcDocumentInfoPanel
            requesterName={doc.users_with_profiles?.nama}
            requesterEmail={doc.users_with_profiles?.email}
            department={voucher?.department || "-"}
            companyCode={voucher?.company_code || "-"}
            site={voucher?.site}
            budgetName={voucher?.petty_cash_budget?.name}
            budgetRemaining={voucher?.petty_cash_budget?.current_budget}
            weekOfMonth={voucher?.week_of_month}
            showNeededDate={false}
            notes={doc.notes}
            items={doc.items}
            totalAmount={doc.amount}
            attachments={[]}
            approvals={[]}
            showApprovals={false}
            discussions={doc.discussions}
          />

          {doc.status === "Selesai" && (
            <Card className="print:hidden">
              <CardHeader>
                <CardTitle className="text-base">Informasi Pembayaran</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-sm">
                  <div>
                    <p className="text-xs text-muted-foreground">Dibayar Oleh</p>
                    <p className="font-medium">
                      {doc.paid_by_profile?.nama || "-"}
                    </p>
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground">Tanggal Dibayar</p>
                    <p className="font-medium">
                      {doc.paid_at ? formatDateFriendly(doc.paid_at) : "-"}
                    </p>
                  </div>
                </div>
                {doc.payment_proof.length > 0 && (
                  <div className="space-y-2">
                    <p className="text-xs font-medium text-muted-foreground">
                      Bukti Transfer/Pembayaran
                    </p>
                    <div className="grid gap-2">
                      {doc.payment_proof.map((file, i) => (
                        <a
                          key={i}
                          href={file.url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-sm text-primary hover:underline p-2 border rounded-md bg-background truncate block"
                        >
                          {file.name}
                        </a>
                      ))}
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>
          )}

          {doc.status === "Menunggu Pembayaran" && viewer?.isFinanceApprover && (
            <Card className="border-amber-300 dark:border-amber-800 print:hidden">
              <CardHeader>
                <CardTitle className="text-base">Selesaikan Pembayaran</CardTitle>
              </CardHeader>
              <CardContent>
                <PcSubVoucherPaymentForm
                  key={doc.id}
                  subVoucher={doc}
                  processing={processingPayment}
                  onSubmit={handleMarkPaid}
                />
              </CardContent>
            </Card>
          )}

          {viewer?.isAdmin && (
            <PcAdminSubVoucherPanel
              key={doc.id}
              docId={doc.id}
              kode={doc.kode_sub_voucher}
              status={doc.status}
              notes={doc.notes}
              items={doc.items}
              onForceEdit={handleForceEdit}
              onRenameKode={handleRenameKode}
              onDelete={handleDeleteDoc}
            />
          )}

          <DiscussionPanel
            discussions={doc.discussions}
            onSubmit={handlePostDiscussion}
            storagePathPrefix={`discussions/petty-cash/sub-voucher/${doc.id}`}
          />
        </div>
      </Content>

      <div className="print-only">
        <PrintablePettyCashDocument
          docTitle="Sub-Voucher (Tarik Dana)"
          kode={doc.kode_sub_voucher}
          companyCode={voucher?.company_code || ""}
          createdAt={doc.created_at}
          requesterName={doc.users_with_profiles?.nama}
          department={voucher?.department || "-"}
          site={voucher?.site}
          showNeededDate={false}
          notes={doc.notes}
          items={doc.items}
          totalAmount={doc.amount}
          qrUrl={qrUrl}
          printTrigger={isPrinting}
        />
      </div>
    </>
  );
}

export default function SubVoucherDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const resolvedParams = use(params);
  return (
    <Suspense fallback={<DetailSkeleton />}>
      <SubVoucherDetailContent id={resolvedParams.id} />
    </Suspense>
  );
}
