// src/app/(With Sidebar)/petty-cash/deklarasi/[id]/page.tsx
//
// Halaman detail LENGKAP + cetak sebuah Deklarasi Petty Cash - mirror
// arsitektur petty-cash/pengajuan/[id]/page.tsx (lihat komentar di sana utk
// alasan lengkap pola print-only-nya). BEDA dari Pengajuan: Deklarasi tidak
// punya needed_date (showNeededDate={false} di semua komponen bersama), dan
// menampilkan kode Voucher asal + Pengajuan asalnya sebagai info tambahan
// dekat header (PcDocumentInfoPanel tidak punya slot khusus utk itu).

"use client";

import { use, Suspense, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Content } from "@/components/content";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { fetchDeklarasiById } from "@/services/pettyCashDeklarasiService";
import { PettyCashDeklarasi } from "@/type";
import {
  PC_DEKLARASI_STATUS_COLORS,
  PC_DEKLARASI_STATUS_COLOR_DEFAULT,
} from "@/type/enum";
import { PcDocumentInfoPanel } from "@/components/petty-cash/PcDocumentInfoPanel";
import { PrintablePettyCashDocument } from "@/components/petty-cash/PrintablePettyCashDocument";
import { getCompanyDetails, waitForLogoReady } from "@/lib/companyDetails";
import { AlertTriangle, ArrowLeft, Printer } from "lucide-react";

const DetailSkeleton = () => (
  <Content className="col-span-12">
    <Skeleton className="h-96 w-full" />
  </Content>
);

function DeklarasiDetailContent({ id }: { id: string }) {
  const router = useRouter();
  const [doc, setDoc] = useState<PettyCashDeklarasi | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isPrinting, setIsPrinting] = useState(false);
  const [qrUrl, setQrUrl] = useState("");

  useEffect(() => {
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
    load();
  }, [id]);

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

  return (
    <>
      <Content
        title={doc.kode_deklarasi}
        description="Detail lengkap Deklarasi Petty Cash."
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
          costCenterName={doc.cost_centers?.name}
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
