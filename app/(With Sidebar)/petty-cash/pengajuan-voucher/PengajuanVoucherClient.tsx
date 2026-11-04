// src/app/(With Sidebar)/petty-cash/pengajuan-voucher/PengajuanVoucherClient.tsx
//
// Requester bikin Pengajuan Voucher dari salah satu Pengajuan miliknya yang
// sudah berstatus "Approved" (lihat approvePengajuanStep,
// services/pettyCashPengajuanService.ts) dan belum pernah di-voucher-kan.
// Voucher yang dihasilkan adalah SNAPSHOT persis dari Pengajuan asalnya -
// item/qty/harga/catatan/lampiran tidak bisa diubah di sini (lihat
// createVoucherFromPengajuan, services/pettyCashVoucherService.ts) - begitu
// dibuat, Voucher langsung masuk jalur approval-nya sendiri (Template
// Approval ber-approval_type "Approval Voucher").
//
// "Voucher Saya" di sini JUGA jadi tempat menarik dana sebagian
// (Sub-Voucher, lihat komentar PettyCashSubVoucher di type/index.ts) begitu
// sebuah Voucher full-approved - SENGAJA digabung di sini (bukan halaman
// terpisah) karena satu alur natural: requester lihat status Voucher-nya
// lalu langsung tarik dana dari tabel yang sama. Tiap tarikan dapat kode
// unik sendiri (kode_sub_voucher) & wajib dideklarasikan terpisah nanti
// (lihat /petty-cash/deklarasi, DeklarasiClient.tsx).
//
// Dialog "Buat Voucher" & "Tarik Dana" ada di PcCreateVoucherDialog &
// PcTarikDanaDialog (components/petty-cash) - dipakai juga sbg shortcut di
// Dokumen Petty Cash Saya. Sub-Voucher yang baru dibuat BELUM berarti dana
// diterima - requester wajib menunggu Finance approver menyelesaikan
// pembayarannya dulu (lihat sesi "Pembayaran Sub-Voucher" di
// /petty-cash/approval) sebelum bisa dideklarasikan.

"use client";

import { Fragment, useEffect, useState } from "react";
import { Content } from "@/components/content";
import { RowActionsMenu } from "@/components/row-actions-menu";
import { StickyHeaderTable } from "@/components/sticky-header-table";
import { TablePaginationFooter } from "@/components/table-pagination-footer";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { DropdownMenuItem } from "@/components/ui/dropdown-menu";
import {
  TableBody,
  TableCell,
  TableHead,
  TableRow,
} from "@/components/ui/table";
import { useListUrlParams } from "@/hooks/use-list-url-params";
import { paginateRows } from "@/lib/client-list";
import { createClient } from "@/lib/supabase/client";
import { formatCurrency } from "@/lib/utils";
import { toast } from "@/lib/toast";
import Link from "next/link";
import {
  PettyCashPengajuan,
  PettyCashVoucher,
  PettyCashVoucherWithChain,
} from "@/type";
import {
  LIMIT_OPTIONS,
  PC_VOUCHER_STATUS_COLORS,
  PC_VOUCHER_STATUS_COLOR_DEFAULT,
  PC_SUB_VOUCHER_STATUS_COLORS,
  PC_SUB_VOUCHER_STATUS_COLOR_DEFAULT,
  PC_DEKLARASI_STATUS_COLORS,
  PC_DEKLARASI_STATUS_COLOR_DEFAULT,
  pcStatusLabel,
} from "@/type/enum";
import {
  fetchApprovedPengajuanForVoucher,
  fetchMyVouchers,
} from "@/services/pettyCashVoucherService";
import {
  deklarasiHref,
  getActiveDoc,
  getPendingPembatalan,
  pickCurrentDoc,
} from "@/lib/pcChain";
import { pickPcPayment } from "@/lib/pcPayment";
import { PcPaymentInfoView } from "@/components/petty-cash/PcPaymentInfoView";
import { PcGlossaryButton } from "@/components/petty-cash/PcGlossary";
import { PcCreateVoucherDialog } from "@/components/petty-cash/PcCreateVoucherDialog";
import {
  PcTarikDanaDialog,
  canDrawVoucher,
  drawnOf,
} from "@/components/petty-cash/PcTarikDanaDialog";
import { PcDownloadMenuItems } from "@/components/petty-cash/PcPrintMenu";
import {
  Loader2,
  RefreshCcw,
  FileCheck2,
  ReceiptText,
  Eye,
  Wallet,
  CornerDownRight,
  Clock,
  Send,
} from "lucide-react";

const formatDate = (dateStr: string | Date) =>
  new Date(dateStr).toLocaleDateString("id-ID", {
    day: "2-digit",
    month: "long",
    year: "numeric",
  });

const StatusBadge = ({
  status,
  colors = PC_VOUCHER_STATUS_COLORS,
  fallback = PC_VOUCHER_STATUS_COLOR_DEFAULT,
  label,
}: {
  status: string;
  colors?: Record<string, string>;
  fallback?: string;
  label?: string;
}) => (
  <Badge className={`whitespace-nowrap ${colors[status] || fallback}`}>
    {label ?? pcStatusLabel(status)}
  </Badge>
);

// Label jenis dokumen di tabel "Voucher Saya" - Voucher induk & Sub-Voucher
// (tarikan) tampil di tabel yang sama, jadi wajib dibedakan jelas.
const DocTypeBadge = ({ sub }: { sub?: boolean }) => (
  <Badge
    variant="outline"
    className={`text-[10px] px-1.5 py-0 font-medium ${
      sub
        ? "border-sky-300 text-sky-700 dark:border-sky-800 dark:text-sky-300"
        : "border-primary/40 text-primary"
    }`}
  >
    {sub ? "Sub-Voucher" : "Voucher"}
  </Badge>
);

/** Menu "Lihat Detail" + "Download PDF" kolom Aksi - `href` = halaman detail dokumen. */
const DocRowActions = ({ href }: { href: string }) => (
  <RowActionsMenu>
    <DropdownMenuItem asChild>
      <Link href={href} className="cursor-pointer">
        <Eye className="mr-2 h-4 w-4" /> Lihat Detail
      </Link>
    </DropdownMenuItem>
    <PcDownloadMenuItems href={href} />
  </RowActionsMenu>
);

/** Bar progress tipis "sudah ditarik / total Voucher" - dipakai kolom Progress. */
const DrawProgressBar = ({
  drawn,
  total,
}: {
  drawn: number;
  total: number;
}) => {
  const pct = total > 0 ? Math.min(100, Math.round((drawn / total) * 100)) : 0;
  return (
    <div className="space-y-1 min-w-[140px]">
      <div className="h-1.5 w-full rounded-full bg-muted overflow-hidden">
        <div
          className="h-full rounded-full bg-primary transition-all"
          style={{ width: `${pct}%` }}
        />
      </div>
      <p className="text-xs text-muted-foreground">
        {formatCurrency(drawn)} / {formatCurrency(total)}
      </p>
    </div>
  );
};

export default function PengajuanVoucherClient() {
  const supabase = createClient();
  const { page, limit, setParams, setFilters } = useListUrlParams();

  const [userId, setUserId] = useState<string | null>(null);
  const [eligible, setEligible] = useState<PettyCashPengajuan[]>([]);
  const [vouchers, setVouchers] = useState<PettyCashVoucherWithChain[]>([]);
  const [loading, setLoading] = useState(true);

  const [selected, setSelected] = useState<PettyCashPengajuan | null>(null);
  const [drawTarget, setDrawTarget] = useState<PettyCashVoucher | null>(null);

  const loadData = async () => {
    setLoading(true);
    try {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) throw new Error("Tidak terautentikasi.");
      setUserId(user.id);

      const [eligibleData, vouchersData] = await Promise.all([
        fetchApprovedPengajuanForVoucher(user.id),
        fetchMyVouchers(user.id),
      ]);
      setEligible(eligibleData);
      setVouchers(vouchersData);
    } catch (error: any) {
      toast.error("Gagal memuat data", { description: error.message });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const pendingFinance = vouchers.flatMap((v) =>
    (v.petty_cash_sub_voucher ?? []).filter(
      (sv) => sv.status === "Menunggu Pembayaran",
    ),
  );

  const {
    rows: visibleVouchers,
    currentPage,
    offset,
  } = paginateRows(vouchers, page, limit);

  return (
    <>
      <Content
        title="Pengajuan Voucher"
        description="Buat Voucher pencairan dari Pengajuan yang sudah disetujui, lalu tarik dananya bertahap (sub-voucher) sesuai kebutuhan."
        cardAction={
          <div className="flex items-center gap-1">
            <PcGlossaryButton focus="voucher" />
            <Button
              variant="outline"
              size="sm"
              onClick={loadData}
              disabled={loading}
            >
              <RefreshCcw
                className={`h-4 w-4 mr-1 ${loading ? "animate-spin" : ""}`}
              />
              Refresh
            </Button>
          </div>
        }
      >
        <div className="space-y-8">
          <div>
            <h3 className="text-sm font-semibold mb-2 flex items-center gap-2">
              <FileCheck2 className="h-4 w-4 text-primary" />
              Pengajuan Siap Di-Voucher-kan
            </h3>
            <StickyHeaderTable
              className="min-w-[810px]"
              containerClassName="rounded-md border overflow-x-auto"
              header={
                <TableRow>
                  <TableHead className="w-[50px]">No</TableHead>
                  <TableHead>Kode Pengajuan</TableHead>
                  <TableHead className="w-[150px] text-right">
                    Total Pengajuan
                  </TableHead>
                  <TableHead className="w-[160px]">Dibutuhkan</TableHead>
                  <TableHead className="w-[220px] text-right">Aksi</TableHead>
                </TableRow>
              }
            >
              <TableBody>
                {loading ? (
                  <TableRow>
                    <TableCell colSpan={5} className="h-24 text-center">
                      <Loader2 className="animate-spin h-6 w-6 mx-auto text-primary" />
                    </TableCell>
                  </TableRow>
                ) : eligible.length === 0 ? (
                  <TableRow>
                    <TableCell
                      colSpan={5}
                      className="h-24 text-center text-muted-foreground"
                    >
                      Belum ada Pengajuan yang disetujui dan siap
                      di-voucher-kan.
                    </TableCell>
                  </TableRow>
                ) : (
                  eligible.map((pj, index) => {
                    // fetchApprovedPengajuanForVoucher cuma mengembalikan
                    // Pengajuan tanpa Voucher aktif - kalau masih ada
                    // Voucher di sini, berarti itu yang ditolak.
                    const rejectedVoucher = pickCurrentDoc(
                      pj.petty_cash_voucher,
                    );
                    return (
                      <TableRow key={pj.id}>
                        <TableCell>{index + 1}</TableCell>
                        <TableCell className="text-sm">
                          <div className="font-mono text-xs font-semibold">
                            {pj.kode_pengajuan}
                          </div>
                          {rejectedVoucher && (
                            <Link
                              href={`/petty-cash/voucher/${rejectedVoucher.id}`}
                              target="_blank"
                              className="text-[11px] text-red-600 dark:text-red-400 hover:underline"
                            >
                              Voucher {rejectedVoucher.kode_voucher} ditolak
                              - lihat alasan
                            </Link>
                          )}
                        </TableCell>
                        <TableCell className="text-right font-medium text-sm tabular-nums">
                          {formatCurrency(pj.total_amount)}
                        </TableCell>
                        <TableCell className="text-sm">
                          {formatDate(pj.needed_date)}
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center justify-end gap-1.5">
                            <Button size="sm" onClick={() => setSelected(pj)}>
                              <Send />
                              {rejectedVoucher
                                ? "Ajukan Ulang Voucher"
                                : "Buat Voucher"}
                            </Button>
                            <DocRowActions
                              href={`/petty-cash/pengajuan/${pj.id}`}
                            />
                          </div>
                        </TableCell>
                      </TableRow>
                    );
                  })
                )}
              </TableBody>
            </StickyHeaderTable>
          </div>

          <div>
            <h3 className="text-sm font-semibold mb-2 flex items-center gap-2">
              <ReceiptText className="h-4 w-4 text-primary" />
              Voucher & Sub-Voucher Saya
            </h3>
            {!loading && pendingFinance.length > 0 && (
              <div className="mb-3 flex items-start gap-2 rounded-md border border-yellow-200 bg-yellow-50 p-3 text-sm text-yellow-800 dark:border-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-200">
                <Clock className="h-4 w-4 mt-0.5 shrink-0" />
                <div>
                  <p className="font-medium">
                    {pendingFinance.length} tarikan dana menunggu pembayaran
                    Finance (total{" "}
                    {formatCurrency(
                      pendingFinance.reduce((sum, sv) => sum + sv.amount, 0),
                    )}
                    )
                  </p>
                  <p className="text-xs">
                    {pendingFinance.map((sv) => sv.kode_sub_voucher).join(", ")}{" "}
                    - dana belum ditransfer. Deklarasi baru bisa dibuat setelah
                    Finance menyelesaikan pembayaran.
                  </p>
                </div>
              </div>
            )}
            <StickyHeaderTable
              className="min-w-[1030px]"
              containerClassName="rounded-md border overflow-x-auto"
              header={
                <TableRow>
                  <TableHead className="w-[50px]">No</TableHead>
                  <TableHead className="w-[220px]">Kode</TableHead>
                  <TableHead className="w-[180px]">Asal Dokumen</TableHead>
                  <TableHead className="w-[170px]">
                    Progress / Nominal
                  </TableHead>
                  <TableHead className="w-[150px]">Status</TableHead>
                  <TableHead className="w-[180px] text-right">Aksi</TableHead>
                </TableRow>
              }
            >
              <TableBody>
                {loading ? (
                  <TableRow>
                    <TableCell colSpan={6} className="h-24 text-center">
                      <Loader2 className="animate-spin h-6 w-6 mx-auto text-primary" />
                    </TableCell>
                  </TableRow>
                ) : vouchers.length === 0 ? (
                  <TableRow>
                    <TableCell
                      colSpan={6}
                      className="h-24 text-center text-muted-foreground"
                    >
                      Belum ada Voucher yang dibuat.
                    </TableCell>
                  </TableRow>
                ) : (
                  visibleVouchers.map((v, index) => {
                    const drawn = drawnOf(v);
                    const canDraw = canDrawVoucher(v);
                    const subs = v.petty_cash_sub_voucher ?? [];
                    return (
                      <Fragment key={v.id}>
                        <TableRow>
                          <TableCell>{offset + index + 1}</TableCell>
                          <TableCell>
                            <div className="flex flex-col gap-1">
                              <DocTypeBadge />
                              <span className="font-mono text-xs font-semibold">
                                {v.kode_voucher}
                              </span>
                            </div>
                          </TableCell>
                          <TableCell className="text-sm text-muted-foreground">
                            <span className="block text-[11px]">
                              Pengajuan
                            </span>
                            {v.petty_cash_pengajuan?.kode_pengajuan || "-"}
                            <span className="mt-1 block text-[11px]">
                              Metode
                            </span>
                            <PcPaymentInfoView
                              payment={pickPcPayment(v)}
                              compact
                              className="text-foreground"
                            />
                            {getPendingPembatalan(
                              v.petty_cash_pengajuan?.petty_cash_pembatalan,
                            ) && (
                              <span className="mt-1 block text-[11px] text-yellow-700 dark:text-yellow-300">
                                Pembatalan diajukan - Tarik Dana ditahan
                              </span>
                            )}
                          </TableCell>
                          <TableCell>
                            <DrawProgressBar
                              drawn={drawn}
                              total={v.total_amount}
                            />
                          </TableCell>
                          <TableCell>
                            <StatusBadge status={v.status} />
                          </TableCell>
                          <TableCell>
                            <div className="flex items-center justify-end gap-1.5">
                              {canDraw && (
                                <Button
                                  size="sm"
                                  onClick={() => setDrawTarget(v)}
                                >
                                  <Wallet /> Tarik Dana
                                </Button>
                              )}
                              <DocRowActions
                                href={`/petty-cash/voucher/${v.id}`}
                              />
                            </div>
                          </TableCell>
                        </TableRow>
                        {subs.map((sv) => {
                          const dek = pickCurrentDoc(sv.petty_cash_deklarasi);
                          const canDeclare =
                            sv.status === "Selesai" &&
                            !getActiveDoc(sv.petty_cash_deklarasi);
                          return (
                            <TableRow
                              key={`sv-${sv.id}`}
                              className="bg-muted/30"
                            >
                              <TableCell />
                              <TableCell>
                                <div className="flex items-start gap-1.5 pl-3">
                                  <CornerDownRight className="h-4 w-4 mt-0.5 shrink-0 text-muted-foreground" />
                                  <div className="flex flex-col gap-1">
                                    <DocTypeBadge sub />
                                    <span className="font-mono text-xs font-medium">
                                      {sv.kode_sub_voucher}
                                    </span>
                                  </div>
                                </div>
                              </TableCell>
                              <TableCell className="text-sm text-muted-foreground">
                                <span className="block text-[11px]">
                                  Tarikan dari Voucher
                                </span>
                                {v.kode_voucher}
                                <span className="block text-[11px]">
                                  {formatDate(sv.created_at)}
                                </span>
                              </TableCell>
                              <TableCell className="text-sm font-medium tabular-nums">
                                {formatCurrency(sv.amount)}
                              </TableCell>
                              <TableCell>
                                <div className="flex flex-col items-start gap-1">
                                  <StatusBadge
                                    status={sv.status}
                                    label={pcStatusLabel(sv.status, "sub_voucher")}
                                    colors={PC_SUB_VOUCHER_STATUS_COLORS}
                                    fallback={
                                      PC_SUB_VOUCHER_STATUS_COLOR_DEFAULT
                                    }
                                  />
                                  {sv.status === "Menunggu Pembayaran" ? (
                                    <span className="text-[11px] text-yellow-700 dark:text-yellow-300 flex items-center gap-1">
                                      <Clock className="h-3 w-3 shrink-0" />
                                      Dana belum ditransfer, menunggu Finance
                                    </span>
                                  ) : dek ? (
                                    <span className="text-[11px] text-muted-foreground flex items-center gap-1">
                                      Deklarasi:
                                      <StatusBadge
                                        status={dek.status}
                                        colors={PC_DEKLARASI_STATUS_COLORS}
                                        fallback={
                                          PC_DEKLARASI_STATUS_COLOR_DEFAULT
                                        }
                                      />
                                    </span>
                                  ) : (
                                    <span className="text-[11px] text-muted-foreground">
                                      {sv.paid_at
                                        ? `Dibayar ${formatDate(sv.paid_at)} - `
                                        : ""}
                                      Belum dideklarasikan
                                    </span>
                                  )}
                                </div>
                              </TableCell>
                              <TableCell>
                                <div className="flex items-center justify-end gap-1.5">
                                  {canDeclare && (
                                    <Button asChild size="sm" variant="secondary">
                                      <Link href={deklarasiHref(sv.id)}>
                                        <FileCheck2 /> Deklarasikan
                                      </Link>
                                    </Button>
                                  )}
                                  <DocRowActions
                                    href={`/petty-cash/sub-voucher/${sv.id}`}
                                  />
                                </div>
                              </TableCell>
                            </TableRow>
                          );
                        })}
                      </Fragment>
                    );
                  })
                )}
              </TableBody>
            </StickyHeaderTable>
            <TablePaginationFooter
              currentPage={currentPage}
              totalItems={vouchers.length}
              limit={limit}
              limitOptions={LIMIT_OPTIONS}
              itemLabel="voucher"
              onPageChange={(value) => setParams({ page: value })}
              onLimitChange={(value) => setFilters({ limit: value })}
              className="mt-6"
            />
          </div>
        </div>
      </Content>

      <PcCreateVoucherDialog
        pengajuan={selected}
        userId={userId}
        onOpenChange={(open) => !open && setSelected(null)}
        onCreated={loadData}
      />

      <PcTarikDanaDialog
        voucher={drawTarget}
        onOpenChange={(open) => !open && setDrawTarget(null)}
        onCreated={loadData}
      />
    </>
  );
}
