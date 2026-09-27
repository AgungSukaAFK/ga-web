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
// Tarik Dana dipilih PER-BARIS BARANG (checklist, qty boleh sebagian & bisa
// di-split ke beberapa tarikan berbeda) - BUKAN input nominal bebas, lihat
// komentar PettyCashSubVoucherItem (type/index.ts) & createSubVoucher
// (services/pettyCashSubVoucherService.ts). Sub-Voucher yang baru dibuat
// BELUM berarti dana diterima - requester wajib menunggu Finance approver
// menyelesaikan pembayarannya dulu (lihat sesi "Pembayaran Sub-Voucher" di
// /petty-cash/approval) sebelum bisa dideklarasikan.

"use client";

import { useEffect, useRef, useState } from "react";
import { Content } from "@/components/content";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import {
  RichMentionEditor,
  RichMentionEditorHandle,
} from "@/components/rich-mention-editor";
import { RichContentView } from "@/components/rich-content-view";
import { parseRichValue, stringifyRichContent } from "@/lib/rich-content";
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
import {
  createSubVoucher,
  SubVoucherDraw,
} from "@/services/pettyCashSubVoucherService";
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

// Baris checklist "Tarik Dana" - satu baris per item Voucher yang MASIH
// punya sisa qty (belum sepenuhnya ditarik di sub-voucher lain). `qty` cuma
// relevan/bisa diedit selagi `checked` - default full sisa begitu dicentang
// (lihat toggleRow/toggleAll di bawah), boleh dikurangi manual (tarikan
// sebagian, sisanya ditarik lagi lain kali).
type DrawRow = {
  item_index: number;
  part_name: string;
  uom: string | null;
  unit_price: number;
  remainingQty: number;
  checked: boolean;
  qty: string;
};

/** Sisa qty tiap baris item Voucher = qty asli - total qty yang sudah dipakai di sub-voucher yang sudah ada. */
const buildDrawRows = (voucher: PettyCashVoucher): DrawRow[] => {
  const drawnByIndex = new Map<number, number>();
  (voucher.petty_cash_sub_voucher ?? []).forEach((sv) => {
    (sv.items ?? []).forEach((it) => {
      drawnByIndex.set(
        it.item_index,
        (drawnByIndex.get(it.item_index) ?? 0) + it.qty,
      );
    });
  });

  return voucher.items
    .map((it, idx) => ({
      item_index: idx,
      part_name: it.part_name,
      uom: it.uom,
      unit_price: it.unit_price,
      remainingQty: it.qty - (drawnByIndex.get(idx) ?? 0),
      checked: false,
      qty: "",
    }))
    .filter((row) => row.remainingQty > 0);
};

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
  const drawNotesEditorRef = useRef<RichMentionEditorHandle>(null);
  const supabase = createClient();

  const [userId, setUserId] = useState<string | null>(null);
  const [eligible, setEligible] = useState<PettyCashPengajuan[]>([]);
  const [vouchers, setVouchers] = useState<PettyCashVoucher[]>([]);
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const [drawing, setDrawing] = useState(false);

  const [selected, setSelected] = useState<PettyCashPengajuan | null>(null);
  const [drawTarget, setDrawTarget] = useState<PettyCashVoucher | null>(null);
  const [drawRows, setDrawRows] = useState<DrawRow[]>([]);
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
    setDrawRows(buildDrawRows(v));
    setDrawNotes("");
  };

  const toggleRow = (itemIndex: number, checked: boolean) => {
    setDrawRows((prev) =>
      prev.map((row) =>
        row.item_index === itemIndex
          ? { ...row, checked, qty: checked ? String(row.remainingQty) : "" }
          : row,
      ),
    );
  };

  const updateRowQty = (itemIndex: number, qty: string) => {
    setDrawRows((prev) =>
      prev.map((row) => (row.item_index === itemIndex ? { ...row, qty } : row)),
    );
  };

  const allRowsChecked = drawRows.length > 0 && drawRows.every((r) => r.checked);
  const toggleAllRows = (checked: boolean) => {
    setDrawRows((prev) =>
      prev.map((row) => ({
        ...row,
        checked,
        qty: checked ? String(row.remainingQty) : "",
      })),
    );
  };

  const remainingVoucher = drawTarget
    ? drawTarget.total_amount - drawnOf(drawTarget)
    : 0;
  const remainingBudget = drawTarget?.petty_cash_budget?.current_budget ?? null;

  const selectedDrawRows = drawRows.filter(
    (row) => row.checked && Number(row.qty) > 0,
  );
  const drawTotal = selectedDrawRows.reduce(
    (sum, row) => sum + Number(row.qty) * row.unit_price,
    0,
  );
  const overBudget = remainingBudget != null && drawTotal > remainingBudget;

  const handleDraw = async () => {
    if (!drawTarget) return;
    if (selectedDrawRows.length === 0) {
      return toast.error("Pilih minimal 1 barang untuk ditarik.");
    }
    if (
      drawRows.some(
        (row) =>
          row.checked &&
          (!row.qty || Number(row.qty) <= 0 || Number(row.qty) > row.remainingQty),
      )
    ) {
      return toast.error(
        "Qty tarikan tiap barang wajib lebih dari 0 dan tidak melebihi sisa qty-nya.",
      );
    }
    if (overBudget) {
      return toast.error(
        `Total tarikan melebihi sisa budget departemen (${formatCurrency(
          remainingBudget ?? 0,
        )}). Kurangi qty/barang yang dipilih.`,
      );
    }
    const draws: SubVoucherDraw[] = selectedDrawRows.map((row) => ({
      item_index: row.item_index,
      qty: Number(row.qty),
    }));
    setDrawing(true);
    try {
      const sv = await createSubVoucher(drawTarget, draws, drawNotes);
      toast.success(
        `Sub-Voucher ${sv.kode_sub_voucher} berhasil dibuat, menunggu pembayaran Finance.`,
      );
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
                  <RichContentView content={parseRichValue(selected.notes)} />
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

      {/* DIALOG TARIK DANA (SUB-VOUCHER) - checklist per barang, qty boleh
          sebagian & di-split ke tarikan lain nanti (lihat buildDrawRows). */}
      <Dialog
        open={!!drawTarget}
        onOpenChange={(open) => !open && setDrawTarget(null)}
      >
        <DialogContent className="sm:max-w-2xl max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Tarik Dana {drawTarget?.kode_voucher}</DialogTitle>
            <DialogDescription>
              Pilih barang yang mau ditarik dananya sekarang - qty boleh
              sebagian, sisanya bisa ditarik lagi lain kali. Sisa Voucher{" "}
              {formatCurrency(remainingVoucher)}
              {remainingBudget != null &&
                ` - Sisa Budget departemen ${formatCurrency(remainingBudget)}`}
              .
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            {drawRows.length === 0 ? (
              <p className="text-sm text-muted-foreground italic">
                Semua barang di Voucher ini sudah habis ditarik.
              </p>
            ) : (
              <div className="overflow-x-auto rounded-md border">
                <Table className="min-w-[560px]">
                  <TableHeader>
                    <TableRow>
                      <TableHead className="w-[40px]">
                        <Checkbox
                          checked={allRowsChecked}
                          onCheckedChange={(v) => toggleAllRows(!!v)}
                          aria-label="Pilih semua"
                        />
                      </TableHead>
                      <TableHead>Nama Barang</TableHead>
                      <TableHead className="w-[100px] text-right">
                        Sisa Qty
                      </TableHead>
                      <TableHead className="w-[110px]">Qty Ditarik</TableHead>
                      <TableHead className="w-[120px] text-right">
                        Subtotal
                      </TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {drawRows.map((row) => (
                      <TableRow key={row.item_index}>
                        <TableCell>
                          <Checkbox
                            checked={row.checked}
                            onCheckedChange={(v) =>
                              toggleRow(row.item_index, !!v)
                            }
                          />
                        </TableCell>
                        <TableCell className="font-medium text-sm">
                          {row.part_name}
                        </TableCell>
                        <TableCell className="text-right text-sm">
                          {row.remainingQty} {row.uom || ""}
                        </TableCell>
                        <TableCell>
                          <Input
                            type="number"
                            min={0}
                            max={row.remainingQty}
                            value={row.qty}
                            disabled={!row.checked}
                            onChange={(e) =>
                              updateRowQty(row.item_index, e.target.value)
                            }
                            className="h-9 w-24"
                          />
                        </TableCell>
                        <TableCell className="text-right text-sm font-mono">
                          {formatCurrency(
                            row.checked
                              ? (Number(row.qty) || 0) * row.unit_price
                              : 0,
                          )}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            )}

            <div className="flex justify-end">
              <div className="text-right">
                <p className="text-xs text-muted-foreground">
                  Total Tarikan
                </p>
                <p
                  className={`text-xl font-bold ${
                    overBudget ? "text-destructive" : "text-primary"
                  }`}
                >
                  {formatCurrency(drawTotal)}
                </p>
                {overBudget && (
                  <p className="text-xs text-destructive">
                    Melebihi sisa budget departemen.
                  </p>
                )}
              </div>
            </div>

            <div className="space-y-2">
              <Label>
                Catatan{" "}
                <span className="text-xs font-normal text-muted-foreground">
                  (Opsional)
                </span>
              </Label>
              <RichMentionEditor
                ref={drawNotesEditorRef}
                placeholder="Ex: Kebutuhan minggu ini..."
                onChange={() =>
                  setDrawNotes(
                    drawNotesEditorRef.current?.isEmpty()
                      ? ""
                      : stringifyRichContent(
                          drawNotesEditorRef.current?.getJSON() ?? {
                            type: "doc",
                          },
                        ),
                  )
                }
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
            <Button
              onClick={handleDraw}
              disabled={drawing || selectedDrawRows.length === 0 || overBudget}
            >
              {drawing && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Tarik Dana
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
