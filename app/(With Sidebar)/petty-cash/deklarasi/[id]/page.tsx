// src/app/(With Sidebar)/petty-cash/deklarasi/[id]/page.tsx
//
// Halaman detail LENGKAP sebuah Deklarasi Petty Cash - VIEW + EDIT di
// halaman yang sama: cetak (mirror arsitektur petty-cash/pengajuan/[id]/page.tsx
// - lihat komentar lengkap di sana), approve/reject/edit-&-setujui
// (PcApprovalActions, muncul HANYA kalau giliran approval user ini sedang
// pending), override admin (PcAdminOverridePanel, role admin), dan panel
// diskusi (PcDiscussionPanel, semua user login boleh kirim pesan). BEDA dari
// Pengajuan/Voucher: Deklarasi tidak punya needed_date (showNeededDate=false
// di semua komponen bersama), dan menampilkan kode Voucher asal + Pengajuan
// asalnya sebagai info tambahan dekat header.
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
import { createClient } from "@/lib/supabase/client";
import {
  fetchDeklarasiById,
  approveDeklarasiStep,
  rejectDeklarasiStep,
  editAndApproveDeklarasiStep,
  adminUpdateDeklarasi,
} from "@/services/pettyCashDeklarasiService";
import {
  addDeklarasiDiscussion,
  PcDiscussionPayload,
} from "@/services/pcDiscussionService";
import { PettyCashDeklarasi } from "@/type";
import {
  PC_DEKLARASI_STATUS_COLORS,
  PC_DEKLARASI_STATUS_COLOR_DEFAULT,
  PC_DEKLARASI_STATUS_OPTIONS,
} from "@/type/enum";
import { isMyApprovalTurn } from "@/lib/pcApprovalFlow";
import { PcDocumentInfoPanel } from "@/components/petty-cash/PcDocumentInfoPanel";
import { PcApprovalActions } from "@/components/petty-cash/PcApprovalActions";
import { PcAdminOverridePanel } from "@/components/petty-cash/PcAdminOverridePanel";
import { PcDiscussionPanel } from "@/components/petty-cash/PcDiscussionPanel";
import { PrintablePettyCashDocument } from "@/components/petty-cash/PrintablePettyCashDocument";
import { getCompanyDetails, waitForLogoReady } from "@/lib/companyDetails";
import { toast } from "sonner";
import { AlertTriangle, ArrowLeft, Printer } from "lucide-react";

const DetailSkeleton = () => (
  <Content className="col-span-12">
    <Skeleton className="h-96 w-full" />
  </Content>
);

function DeklarasiDetailContent({ id }: { id: string }) {
  const router = useRouter();
  const supabase = createClient();
  const [doc, setDoc] = useState<PettyCashDeklarasi | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isPrinting, setIsPrinting] = useState(false);
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
      const data = await fetchDeklarasiById(Number(id));
      setDoc(data);
    } catch (err: any) {
      setError(err.message || "Deklarasi tidak ditemukan.");
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
      setQrUrl(`${window.location.origin}/approval-pc-deklarasi/${id}`);
    }
  }, [id]);

  const handlePrint = () => setIsPrinting(true);

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
      await approveDeklarasiStep(doc, viewer.id);
      toast.success(`${doc.kode_deklarasi} berhasil disetujui.`);
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
      await rejectDeklarasiStep(doc, viewer.id, viewer.nama, reason);
      toast.success(`${doc.kode_deklarasi} ditolak.`);
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
      await editAndApproveDeklarasiStep(doc, viewer.id, viewer.nama, edits);
      toast.success(`${doc.kode_deklarasi} berhasil diedit & disetujui.`);
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
      await adminUpdateDeklarasi(doc.id, patch);
      toast.success(`${doc.kode_deklarasi} berhasil diperbarui (override).`);
      await load();
    } catch (error: any) {
      toast.error("Gagal menyimpan override", { description: error.message });
    }
  };

  const handlePostDiscussion = async (payload: PcDiscussionPayload) => {
    if (!doc) return;
    await addDeklarasiDiscussion(doc.id, payload);
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
    PC_DEKLARASI_STATUS_COLORS[doc.status] || PC_DEKLARASI_STATUS_COLOR_DEFAULT;
  const isMyTurn = viewer ? isMyApprovalTurn(doc.approvals, viewer.id) : false;

  return (
    <>
      <Content
        className="no-print"
        title={doc.kode_deklarasi}
        description="Detail lengkap Deklarasi Petty Cash."
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
                {doc.petty_cash_voucher?.kode_voucher || "-"}
              </span>
              {doc.petty_cash_voucher?.petty_cash_pengajuan?.kode_pengajuan && (
                <>
                  {" "}
                  (Pengajuan{" "}
                  <span className="font-medium text-foreground">
                    {doc.petty_cash_voucher.petty_cash_pengajuan.kode_pengajuan}
                  </span>
                  )
                </>
              )}
            </span>
          </div>
          <PcDocumentInfoPanel
            requesterName={doc.users_with_profiles?.nama}
            requesterEmail={doc.users_with_profiles?.email}
            department={doc.department}
            companyCode={doc.company_code}
            site={doc.site}
            budgetName={doc.petty_cash_voucher?.petty_cash_budget?.name}
            budgetRemaining={
              doc.petty_cash_voucher?.petty_cash_budget?.current_budget
            }
            weekOfMonth={doc.week_of_month}
            showNeededDate={false}
            notes={doc.notes}
            items={doc.items}
            totalAmount={doc.total_amount}
            attachments={doc.attachments}
            approvals={doc.approvals}
            discussions={doc.discussions}
            revisions={doc.revisions}
          />

          {isMyTurn && (
            <div className="flex flex-wrap justify-end gap-2 border-t pt-4">
              <PcApprovalActions
                docLabel="Deklarasi"
                kode={doc.kode_deklarasi}
                companyCode={doc.company_code}
                showNeededDate={false}
                editInitial={{
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
              status={doc.status}
              approvals={doc.approvals}
              statusOptions={PC_DEKLARASI_STATUS_OPTIONS}
              onSave={handleAdminSave}
            />
          )}

          <PcDiscussionPanel
            discussions={doc.discussions}
            onSubmit={handlePostDiscussion}
          />
        </div>
      </Content>

      <div className="print-only">
        <PrintablePettyCashDocument
          docTitle="Deklarasi"
          kode={doc.kode_deklarasi}
          companyCode={doc.company_code}
          createdAt={doc.created_at}
          requesterName={doc.users_with_profiles?.nama}
          department={doc.department}
          site={doc.site}
          showNeededDate={false}
          notes={doc.notes}
          items={doc.items}
          totalAmount={doc.total_amount}
          qrUrl={qrUrl}
          printTrigger={isPrinting}
        />
      </div>
    </>
  );
}

export default function DeklarasiDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const resolvedParams = use(params);
  return (
    <Suspense fallback={<DetailSkeleton />}>
      <DeklarasiDetailContent id={resolvedParams.id} />
    </Suspense>
  );
}
