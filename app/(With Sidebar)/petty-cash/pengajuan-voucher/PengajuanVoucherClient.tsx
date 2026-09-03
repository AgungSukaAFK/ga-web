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

"use client";

import { useEffect, useState } from "react";
import { Content } from "@/components/content";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { createClient } from "@/lib/supabase/client";
import { formatCurrency } from "@/lib/utils";
import { toast } from "sonner";
import { PettyCashPengajuan, PettyCashVoucher } from "@/type";
import {
  PC_VOUCHER_STATUS_COLORS,
  PC_VOUCHER_STATUS_COLOR_DEFAULT,
} from "@/type/enum";
import {
  fetchApprovedPengajuanForVoucher,
  fetchMyVouchers,
  createVoucherFromPengajuan,
} from "@/services/pettyCashVoucherService";
import {
  Loader2,
  RefreshCcw,
  FileCheck2,
  ReceiptText,
  CalendarDays,
} from "lucide-react";

const formatDate = (dateStr: string | Date) =>
  new Date(dateStr).toLocaleDateString("id-ID", {
    day: "2-digit",
    month: "long",
    year: "numeric",
  });

const StatusBadge = ({ status }: { status: string }) => (
  <Badge
    className={`whitespace-nowrap ${
      PC_VOUCHER_STATUS_COLORS[status] || PC_VOUCHER_STATUS_COLOR_DEFAULT
    }`}
  >
    {status}
  </Badge>
);

export default function PengajuanVoucherClient() {
  const supabase = createClient();

  const [userId, setUserId] = useState<string | null>(null);
  const [eligible, setEligible] = useState<PettyCashPengajuan[]>([]);
  const [vouchers, setVouchers] = useState<PettyCashVoucher[]>([]);
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);

  const [selected, setSelected] = useState<PettyCashPengajuan | null>(null);

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

  const handleCreateVoucher = async () => {
    if (!selected || !userId) return;
    setCreating(true);
    try {
      const voucher = await createVoucherFromPengajuan(selected, userId);
      toast.success(
        `Voucher ${voucher.kode_voucher} berhasil dibuat dan masuk jalur approval.`,
      );
      setSelected(null);
      await loadData();
    } catch (error: any) {
      toast.error("Gagal membuat voucher", { description: error.message });
    } finally {
      setCreating(false);
    }
  };

  return (
    <>
      <Content
        title="Pengajuan Voucher"
        description="Buat Voucher pencairan dari Pengajuan Anda yang sudah disetujui."
        cardAction={
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
        }
      >
        <div className="space-y-8">
          <div>
            <h3 className="text-sm font-semibold mb-2 flex items-center gap-2">
              <FileCheck2 className="h-4 w-4 text-primary" />
              Pengajuan Siap Di-Voucher-kan
            </h3>
            <div className="rounded-md border overflow-x-auto">
              <Table className="min-w-[700px]">
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-[180px]">Kode Pengajuan</TableHead>
                    <TableHead className="w-[150px] text-right">
                      Total Pengajuan
                    </TableHead>
                    <TableHead className="w-[140px]">Dibutuhkan</TableHead>
                    <TableHead className="w-[140px] text-center">
                      Aksi
                    </TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {loading ? (
                    <TableRow>
                      <TableCell colSpan={4} className="text-center h-28">
                        <Loader2 className="animate-spin h-6 w-6 mx-auto text-primary" />
                      </TableCell>
                    </TableRow>
                  ) : eligible.length === 0 ? (
                    <TableRow>
                      <TableCell
                        colSpan={4}
                        className="text-center h-28 text-muted-foreground"
                      >
                        Belum ada Pengajuan yang disetujui dan siap
                        di-voucher-kan.
                      </TableCell>
                    </TableRow>
                  ) : (
                    eligible.map((pj) => (
                      <TableRow key={pj.id}>
                        <TableCell className="font-semibold text-sm">
                          {pj.kode_pengajuan}
                        </TableCell>
                        <TableCell className="text-right font-medium text-sm">
                          {formatCurrency(pj.total_amount)}
                        </TableCell>
                        <TableCell className="text-sm">
                          {formatDate(pj.needed_date)}
                        </TableCell>
                        <TableCell className="text-center">
                          <Button size="sm" onClick={() => setSelected(pj)}>
                            Buat Voucher
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </div>
          </div>

          <div>
            <h3 className="text-sm font-semibold mb-2 flex items-center gap-2">
              <ReceiptText className="h-4 w-4 text-primary" />
              Voucher Saya
            </h3>
            <div className="rounded-md border overflow-x-auto">
              <Table className="min-w-[700px]">
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-[180px]">Kode Voucher</TableHead>
                    <TableHead className="w-[180px]">Dari Pengajuan</TableHead>
                    <TableHead className="w-[150px] text-right">
                      Total Voucher
                    </TableHead>
                    <TableHead className="w-[140px]">Status</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {loading ? (
                    <TableRow>
                      <TableCell colSpan={4} className="text-center h-28">
                        <Loader2 className="animate-spin h-6 w-6 mx-auto text-primary" />
                      </TableCell>
                    </TableRow>
                  ) : vouchers.length === 0 ? (
                    <TableRow>
                      <TableCell
                        colSpan={4}
                        className="text-center h-28 text-muted-foreground"
                      >
                        Belum ada Voucher yang dibuat.
                      </TableCell>
                    </TableRow>
                  ) : (
                    vouchers.map((v) => (
                      <TableRow key={v.id}>
                        <TableCell className="font-semibold text-sm">
                          {v.kode_voucher}
                        </TableCell>
                        <TableCell className="text-sm text-muted-foreground">
                          {v.petty_cash_pengajuan?.kode_pengajuan || "-"}
                        </TableCell>
                        <TableCell className="text-right font-medium text-sm">
                          {formatCurrency(v.total_amount)}
                        </TableCell>
                        <TableCell>
                          <StatusBadge status={v.status} />
                        </TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </div>
          </div>
        </div>
      </Content>

      {/* DIALOG KONFIRMASI - PREVIEW SNAPSHOT SEBELUM BUAT VOUCHER */}
      <Dialog
        open={!!selected}
        onOpenChange={(open) => !open && setSelected(null)}
      >
        <DialogContent className="sm:max-w-2xl max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Buat Voucher dari {selected?.kode_pengajuan}</DialogTitle>
            <DialogDescription>
              Item dan nominal di bawah adalah salinan persis dari Pengajuan
              ini - tidak bisa diubah.{" "}
              {selected && (
                <span className="inline-flex items-center gap-1">
                  <CalendarDays className="h-3 w-3" />
                  Dibutuhkan {formatDate(selected.needed_date)}
                </span>
              )}
            </DialogDescription>
          </DialogHeader>

          {selected && (
            <div className="space-y-4">
              {selected.notes && (
                <div className="text-sm bg-muted/50 rounded-md p-3 border">
                  {selected.notes}
                </div>
              )}
              <div className="overflow-x-auto rounded-md border">
                <Table className="min-w-[500px]">
                  <TableHeader>
                    <TableRow>
                      <TableHead>Nama Barang</TableHead>
                      <TableHead className="w-[70px]">Qty</TableHead>
                      <TableHead className="w-[110px] text-right">
                        Harga Satuan
                      </TableHead>
                      <TableHead className="w-[120px] text-right">
                        Subtotal
                      </TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {selected.items.map((it, i) => (
                      <TableRow key={i}>
                        <TableCell className="font-medium">
                          {it.part_name}
                        </TableCell>
                        <TableCell>
                          {it.qty} {it.uom || ""}
                        </TableCell>
                        <TableCell className="text-right">
                          {formatCurrency(it.unit_price)}
                        </TableCell>
                        <TableCell className="text-right font-medium">
                          {formatCurrency(it.subtotal)}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
              <div className="flex justify-end">
                <div className="text-right">
                  <p className="text-xs text-muted-foreground">
                    Total Voucher
                  </p>
                  <p className="text-xl font-bold text-primary">
                    {formatCurrency(selected.total_amount)}
                  </p>
                </div>
              </div>
            </div>
          )}

          <DialogFooter>
            <Button
              variant="ghost"
              onClick={() => setSelected(null)}
              disabled={creating}
            >
              Batal
            </Button>
            <Button onClick={handleCreateVoucher} disabled={creating}>
              {creating && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Kirim Voucher
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
