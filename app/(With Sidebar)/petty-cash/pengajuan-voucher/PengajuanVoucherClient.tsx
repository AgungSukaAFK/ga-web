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

"use client";

import { useEffect, useState } from "react";
import { Content } from "@/components/content";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { CurrencyInput } from "@/components/ui/currency-input";
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
import Link from "next/link";
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
import { createSubVoucher } from "@/services/pettyCashSubVoucherService";
import {
  Loader2,
  RefreshCcw,
  FileCheck2,
  ReceiptText,
  CalendarDays,
  Eye,
  Wallet,
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

const drawnOf = (v: PettyCashVoucher) =>
  (v.petty_cash_sub_voucher ?? []).reduce((sum, sv) => sum + sv.amount, 0);

/** Bar progress tipis "sudah ditarik / total Voucher" - dipakai kolom Progress. */
const DrawProgressBar = ({ drawn, total }: { drawn: number; total: number }) => {
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

  const [userId, setUserId] = useState<string | null>(null);
  const [eligible, setEligible] = useState<PettyCashPengajuan[]>([]);
  const [vouchers, setVouchers] = useState<PettyCashVoucher[]>([]);
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const [drawing, setDrawing] = useState(false);

  const [selected, setSelected] = useState<PettyCashPengajuan | null>(null);
  const [drawTarget, setDrawTarget] = useState<PettyCashVoucher | null>(null);
  const [drawAmount, setDrawAmount] = useState(0);
  const [drawNotes, setDrawNotes] = useState("");

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

  const openDraw = (v: PettyCashVoucher) => {
    setDrawTarget(v);
    setDrawAmount(0);
    setDrawNotes("");
  };

  const remainingVoucher = drawTarget
    ? drawTarget.total_amount - drawnOf(drawTarget)
    : 0;
  const remainingBudget = drawTarget?.petty_cash_budget?.current_budget ?? null;
  const maxDraw =
    remainingBudget != null
      ? Math.min(remainingVoucher, remainingBudget)
      : remainingVoucher;

  const handleDraw = async () => {
    if (!drawTarget) return;
    if (drawAmount <= 0) {
      return toast.error("Nominal tarikan harus lebih dari 0.");
    }
    if (drawAmount > maxDraw) {
      return toast.error(
        `Nominal melebihi batas maksimal (${formatCurrency(maxDraw)}).`,
      );
    }
    setDrawing(true);
    try {
      const sv = await createSubVoucher(drawTarget, drawAmount, drawNotes);
      toast.success(`Sub-Voucher ${sv.kode_sub_voucher} berhasil dibuat.`);
      setDrawTarget(null);
      await loadData();
    } catch (error: any) {
      toast.error("Gagal menarik dana", { description: error.message });
    } finally {
      setDrawing(false);
    }
  };

  return (
    <>
      <Content
        title="Pengajuan Voucher"
        description="Buat Voucher pencairan dari Pengajuan yang sudah disetujui, lalu tarik dananya bertahap (sub-voucher) sesuai kebutuhan."
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
              <Table className="min-w-[860px]">
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-[180px]">Kode Voucher</TableHead>
                    <TableHead className="w-[180px]">Dari Pengajuan</TableHead>
                    <TableHead className="w-[170px]">
                      Progress Tarikan
                    </TableHead>
                    <TableHead className="w-[140px]">Status</TableHead>
                    <TableHead className="w-[190px] text-center">
                      Aksi
                    </TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {loading ? (
                    <TableRow>
                      <TableCell colSpan={5} className="text-center h-28">
                        <Loader2 className="animate-spin h-6 w-6 mx-auto text-primary" />
                      </TableCell>
                    </TableRow>
                  ) : vouchers.length === 0 ? (
                    <TableRow>
                      <TableCell
                        colSpan={5}
                        className="text-center h-28 text-muted-foreground"
                      >
                        Belum ada Voucher yang dibuat.
                      </TableCell>
                    </TableRow>
                  ) : (
                    vouchers.map((v) => {
                      const drawn = drawnOf(v);
                      const remaining = v.total_amount - drawn;
                      const canDraw = v.status === "Approved" && remaining > 0;
                      return (
                        <TableRow key={v.id}>
                          <TableCell className="font-semibold text-sm">
                            {v.kode_voucher}
                          </TableCell>
                          <TableCell className="text-sm text-muted-foreground">
                            {v.petty_cash_pengajuan?.kode_pengajuan || "-"}
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
                            <div className="flex items-center justify-center gap-1">
                              {canDraw && (
                                <Button size="sm" onClick={() => openDraw(v)}>
                                  <Wallet className="h-3.5 w-3.5 mr-1" />{" "}
                                  Tarik Dana
                                </Button>
                              )}
                              <Link href={`/petty-cash/voucher/${v.id}`}>
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  className="h-8 w-8 text-muted-foreground hover:text-primary"
                                >
                                  <Eye className="h-4 w-4" />
                                </Button>
                              </Link>
                            </div>
                          </TableCell>
                        </TableRow>
                      );
                    })
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

      {/* DIALOG TARIK DANA (SUB-VOUCHER) */}
      <Dialog
        open={!!drawTarget}
        onOpenChange={(open) => !open && setDrawTarget(null)}
      >
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Tarik Dana {drawTarget?.kode_voucher}</DialogTitle>
            <DialogDescription>
              Sisa Voucher {formatCurrency(remainingVoucher)}
              {remainingBudget != null &&
                ` - Sisa Budget departemen ${formatCurrency(remainingBudget)}`}
              .
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Nominal Tarikan</Label>
              <CurrencyInput
                value={drawAmount}
                onValueChange={setDrawAmount}
                placeholder="Rp 0"
              />
              <p className="text-xs text-muted-foreground">
                Maksimal {formatCurrency(maxDraw)}.
              </p>
            </div>
            <div className="space-y-2">
              <Label>
                Catatan{" "}
                <span className="text-xs font-normal text-muted-foreground">
                  (Opsional)
                </span>
              </Label>
              <Textarea
                value={drawNotes}
                onChange={(e) => setDrawNotes(e.target.value)}
                rows={2}
                placeholder="Ex: Kebutuhan minggu ini..."
              />
            </div>
          </div>

          <DialogFooter>
            <Button
              variant="ghost"
              onClick={() => setDrawTarget(null)}
              disabled={drawing}
            >
              Batal
            </Button>
            <Button onClick={handleDraw} disabled={drawing || maxDraw <= 0}>
              {drawing && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Tarik Dana
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
