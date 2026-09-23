// src/app/(With Sidebar)/petty-cash/sub-voucher/PettyCashSubVoucherClient.tsx
//
// Tarik dana SEBAGIAN dari Voucher yang sudah "Approved" (sub-voucher, lihat
// komentar PettyCashSubVoucher di type/index.ts) - MENGGANTIKAN halaman
// "Klaim Voucher" lama (klaim sekali-penuh). Requester bisa tarik berkali-
// kali selama sisa Voucher & sisa Budget departemennya masih cukup - server
// (RPC create_petty_cash_sub_voucher, SECURITY DEFINER) yang jadi penentu
// akhir, batas di dialog ini cuma bantuan UX.

"use client";

import { useEffect, useState } from "react";
import { Content } from "@/components/content";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { CurrencyInput } from "@/components/ui/currency-input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
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
import { PettyCashSubVoucher, PettyCashVoucher } from "@/type";
import {
  PC_VOUCHER_STATUS_COLORS,
  PC_VOUCHER_STATUS_COLOR_DEFAULT,
} from "@/type/enum";
import {
  fetchDrawableVouchers,
  fetchMySubVouchers,
  createSubVoucher,
} from "@/services/pettyCashSubVoucherService";
import {
  Loader2,
  RefreshCcw,
  Wallet,
  ReceiptText,
  Eye,
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

export default function PettyCashSubVoucherClient() {
  const supabase = createClient();

  const [userId, setUserId] = useState<string | null>(null);
  const [drawable, setDrawable] = useState<PettyCashVoucher[]>([]);
  const [subVouchers, setSubVouchers] = useState<PettyCashSubVoucher[]>([]);
  const [loading, setLoading] = useState(true);
  const [drawing, setDrawing] = useState(false);

  const [selected, setSelected] = useState<PettyCashVoucher | null>(null);
  const [amount, setAmount] = useState(0);
  const [notes, setNotes] = useState("");

  const loadData = async () => {
    setLoading(true);
    try {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) throw new Error("Tidak terautentikasi.");
      setUserId(user.id);

      const [drawableData, subVoucherData] = await Promise.all([
        fetchDrawableVouchers(user.id),
        fetchMySubVouchers(user.id),
      ]);
      setDrawable(drawableData);
      setSubVouchers(subVoucherData);
    } catch (error: any) {
      toast.error("Gagal memuat data", { description: error.message });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const openDraw = (v: PettyCashVoucher) => {
    setSelected(v);
    setAmount(0);
    setNotes("");
  };

  const remainingVoucher = selected
    ? selected.total_amount - drawnOf(selected)
    : 0;
  const remainingBudget = selected?.petty_cash_budget?.current_budget ?? null;
  const maxDraw =
    remainingBudget != null
      ? Math.min(remainingVoucher, remainingBudget)
      : remainingVoucher;

  const handleDraw = async () => {
    if (!selected || !userId) return;
    if (amount <= 0) {
      return toast.error("Nominal tarikan harus lebih dari 0.");
    }
    if (amount > maxDraw) {
      return toast.error(
        `Nominal melebihi batas maksimal (Rp${maxDraw.toLocaleString("id-ID")}).`,
      );
    }
    setDrawing(true);
    try {
      const sv = await createSubVoucher(selected, amount, notes);
      toast.success(`Sub-Voucher ${sv.kode_sub_voucher} berhasil dibuat.`);
      setSelected(null);
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
        title="Sub-Voucher"
        description="Tarik dana sebagian dari Voucher yang sudah disetujui - bisa berkali-kali selama belum melebihi total Voucher & sisa Budget departemen."
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
              <Wallet className="h-4 w-4 text-primary" />
              Voucher Bisa Ditarik
            </h3>
            <div className="rounded-md border overflow-x-auto">
              <Table className="min-w-[820px]">
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-[180px]">Kode Voucher</TableHead>
                    <TableHead className="w-[180px]">Dari Pengajuan</TableHead>
                    <TableHead className="w-[160px] text-right">
                      Progress Tarikan
                    </TableHead>
                    <TableHead className="w-[150px] text-right">
                      Sisa
                    </TableHead>
                    <TableHead className="w-[140px] text-center">
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
                  ) : drawable.length === 0 ? (
                    <TableRow>
                      <TableCell
                        colSpan={5}
                        className="text-center h-28 text-muted-foreground"
                      >
                        Belum ada Voucher yang bisa ditarik.
                      </TableCell>
                    </TableRow>
                  ) : (
                    drawable.map((v) => {
                      const drawn = drawnOf(v);
                      const remaining = v.total_amount - drawn;
                      return (
                        <TableRow key={v.id}>
                          <TableCell className="font-semibold text-sm">
                            {v.kode_voucher}
                          </TableCell>
                          <TableCell className="text-sm text-muted-foreground">
                            {v.petty_cash_pengajuan?.kode_pengajuan || "-"}
                          </TableCell>
                          <TableCell className="text-right text-sm">
                            {formatCurrency(drawn)} /{" "}
                            {formatCurrency(v.total_amount)}
                          </TableCell>
                          <TableCell className="text-right font-medium text-sm">
                            {formatCurrency(remaining)}
                          </TableCell>
                          <TableCell className="text-center">
                            <Button size="sm" onClick={() => openDraw(v)}>
                              Tarik Dana
                            </Button>
                          </TableCell>
                        </TableRow>
                      );
                    })
                  )}
                </TableBody>
              </Table>
            </div>
          </div>

          <div>
            <h3 className="text-sm font-semibold mb-2 flex items-center gap-2">
              <ReceiptText className="h-4 w-4 text-primary" />
              Riwayat Sub-Voucher
            </h3>
            <div className="rounded-md border overflow-x-auto">
              <Table className="min-w-[700px]">
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-[200px]">Kode Sub-Voucher</TableHead>
                    <TableHead className="w-[180px]">Dari Voucher</TableHead>
                    <TableHead className="w-[150px] text-right">
                      Nominal
                    </TableHead>
                    <TableHead className="w-[140px]">Tanggal</TableHead>
                    <TableHead className="w-[70px] text-center">
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
                  ) : subVouchers.length === 0 ? (
                    <TableRow>
                      <TableCell
                        colSpan={5}
                        className="text-center h-28 text-muted-foreground"
                      >
                        Belum ada sub-voucher yang ditarik.
                      </TableCell>
                    </TableRow>
                  ) : (
                    subVouchers.map((sv) => (
                      <TableRow key={sv.id}>
                        <TableCell className="font-semibold text-sm">
                          {sv.kode_sub_voucher}
                        </TableCell>
                        <TableCell className="text-sm text-muted-foreground">
                          {sv.petty_cash_voucher?.kode_voucher || "-"}
                        </TableCell>
                        <TableCell className="text-right font-medium text-sm">
                          {formatCurrency(sv.amount)}
                        </TableCell>
                        <TableCell className="text-sm">
                          {formatDate(sv.created_at)}
                        </TableCell>
                        <TableCell className="text-center">
                          <Link href={`/petty-cash/voucher/${sv.voucher_id}`}>
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-7 w-7 text-muted-foreground hover:text-primary"
                            >
                              <Eye className="h-4 w-4" />
                            </Button>
                          </Link>
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

      {/* DIALOG TARIK DANA */}
      <Dialog
        open={!!selected}
        onOpenChange={(open) => !open && setSelected(null)}
      >
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Tarik Dana {selected?.kode_voucher}</DialogTitle>
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
                value={amount}
                onValueChange={setAmount}
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
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                rows={2}
                placeholder="Ex: Kebutuhan minggu ini..."
              />
            </div>
          </div>

          <DialogFooter>
            <Button
              variant="ghost"
              onClick={() => setSelected(null)}
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
