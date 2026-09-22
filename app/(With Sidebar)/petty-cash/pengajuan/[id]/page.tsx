// src/app/(With Sidebar)/petty-cash/pengajuan/[id]/page.tsx
//
// Halaman detail LENGKAP + cetak sebuah Input Pengajuan Petty Cash - mirror
// arsitektur purchase-order/[id]/page.tsx (PrintablePO): tombol Cetak
// menunggu logo company ready (waitForLogoReady, lib/companyDetails.ts) lalu
// window.print() lewat double requestAnimationFrame, dan blok `.print-only`
// dirender DI LUAR <Content> (Card) - kalau dinest di dalamnya, border/
// shadow/padding Card ikut ke-print (lihat komentar sama persis di file
// PO). Dibuat sebagai halaman terpisah (bukan print dari dalam Dialog)
// karena pola print-only ini butuh hidup di luar wrapper Dialog/Card.

"use client";

import { use, Suspense, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Content } from "@/components/content";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { fetchPengajuanById } from "@/services/pettyCashPengajuanService";
import { PettyCashPengajuan } from "@/type";
import {
  PC_PENGAJUAN_STATUS_COLORS,
  PC_PENGAJUAN_STATUS_COLOR_DEFAULT,
} from "@/type/enum";
import { PcDocumentInfoPanel } from "@/components/petty-cash/PcDocumentInfoPanel";
import { PrintablePettyCashDocument } from "@/components/petty-cash/PrintablePettyCashDocument";
import { getCompanyDetails, waitForLogoReady } from "@/lib/companyDetails";
import { toast } from "sonner";
import { AlertTriangle, ArrowLeft, Printer } from "lucide-react";

const DetailSkeleton = () => (
  <Content className="col-span-12">
    <Skeleton className="h-96 w-full" />
  </Content>
);

function PengajuanDetailContent({ id }: { id: string }) {
  const router = useRouter();
  const [doc, setDoc] = useState<PettyCashPengajuan | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isPrinting, setIsPrinting] = useState(false);
  const [qrUrl, setQrUrl] = useState("");

  useEffect(() => {
    const load = async () => {
      setLoading(true);
      try {
        const data = await fetchPengajuanById(Number(id));
        setDoc(data);
      } catch (err: any) {
        setError(err.message || "Pengajuan tidak ditemukan.");
      } finally {
        setLoading(false);
      }
    };
    load();
  }, [id]);

  useEffect(() => {
    if (typeof window !== "undefined") {
      setQrUrl(`${window.location.origin}/approval-pc-pengajuan/${id}`);
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
    PC_PENGAJUAN_STATUS_COLORS[doc.status] || PC_PENGAJUAN_STATUS_COLOR_DEFAULT;

  return (
    <>
      <Content
        title={doc.kode_pengajuan}
        description="Detail lengkap Input Pengajuan Petty Cash."
        cardAction={
          <div className="flex items-center gap-2 no-print">
            <Button variant="outline" size="sm" onClick={() => router.back()}>
              <ArrowLeft className="h-4 w-4 mr-1" /> Kembali
            </Button>
            <Button size="sm" onClick={handlePrint}>
              <Printer className="h-4 w-4 mr-1" /> Cetak
            </Button>
          </div>
        }
      >
        <div className="mb-4">
          <Badge className={statusColor}>{doc.status}</Badge>
        </div>
        <PcDocumentInfoPanel
          requesterName={doc.users_with_profiles?.nama}
          requesterEmail={doc.users_with_profiles?.email}
          department={doc.department}
          companyCode={doc.company_code}
          site={doc.site}
          costCenterName={doc.cost_centers?.name}
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
      </Content>

      <div className="print-only">
        <PrintablePettyCashDocument
          docTitle="Input Pengajuan"
          kode={doc.kode_pengajuan}
          companyCode={doc.company_code}
          createdAt={doc.created_at}
          requesterName={doc.users_with_profiles?.nama}
          department={doc.department}
          site={doc.site}
          neededDate={doc.needed_date}
          weekOfMonth={doc.week_of_month}
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

export default function PengajuanDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const resolvedParams = use(params);
  return (
    <Suspense fallback={<DetailSkeleton />}>
      <PengajuanDetailContent id={resolvedParams.id} />
    </Suspense>
  );
}
