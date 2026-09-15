// src/app/(With Sidebar)/petty-cash/approval-deklarasi/ApprovalDeklarasiClient.tsx
//
// Antrian approval Deklarasi Petty Cash (petty_cash_deklarasi) - sama
// persis mekanismenya dengan ApprovalVoucherClient.tsx (satu tabel approval
// sekuensial berbeda, lihat lib/pcApprovalFlow.ts), tapi jalur approval-nya
// sendiri terpisah (Template Approval ber-approval_type "Approval
// Deklarasi", lihat services/pcApprovalTemplateService.ts). Nominal Voucher
// (rencana) ditampilkan berdampingan dengan nominal Deklarasi (riil) supaya
// approver bisa lihat kalau ada selisih - lihat createDeklarasiFromVoucher,
// services/pettyCashDeklarasiService.ts.

"use client";

import { useEffect, useState } from "react";
import { Content } from "@/components/content";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
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
import { PettyCashDeklarasi } from "@/type";
import {
  fetchDeklarasiApprovalQueue,
  approveDeklarasiStep,
  rejectDeklarasiStep,
} from "@/services/pettyCashDeklarasiService";
import {
  Loader2,
  RefreshCcw,
  Inbox,
  CheckCircle2,
  XCircle,
  Clock,
  Paperclip,
} from "lucide-react";

export default function ApprovalDeklarasiClient() {
  const supabase = createClient();

  const [profile, setProfile] = useState<{ id: string; nama: string } | null>(
    null,
  );
  const [queue, setQueue] = useState<PettyCashDeklarasi[]>([]);
  const [loading, setLoading] = useState(true);
  const [processing, setProcessing] = useState(false);

  const [selected, setSelected] = useState<PettyCashDeklarasi | null>(null);
  const [isRejectOpen, setIsRejectOpen] = useState(false);
  const [rejectReason, setRejectReason] = useState("");

  const loadData = async () => {
    setLoading(true);
    try {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) throw new Error("Tidak terautentikasi.");

      const { data: prof, error } = await supabase
        .from("profiles")
        .select("id, nama")
        .eq("id", user.id)
        .single();
      if (error) throw error;
      setProfile({ id: prof.id, nama: prof.nama || "" });

      const data = await fetchDeklarasiApprovalQueue(user.id);
      setQueue(data);
    } catch (error: any) {
      toast.error("Gagal memuat antrian approval", {
        description: error.message,
      });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const handleApprove = async () => {
    if (!selected || !profile) return;
    setProcessing(true);
    try {
      await approveDeklarasiStep(selected, profile.id);
      toast.success(`${selected.kode_deklarasi} berhasil disetujui.`);
      setSelected(null);
      await loadData();
    } catch (error: any) {
      toast.error("Gagal menyetujui", { description: error.message });
    } finally {
      setProcessing(false);
    }
  };

  const handleRejectSubmit = async () => {
    if (!rejectReason.trim())
      return toast.error("Alasan penolakan wajib diisi.");
    if (!selected || !profile) return;

    setProcessing(true);
    try {
      await rejectDeklarasiStep(
        selected,
        profile.id,
        profile.nama,
        rejectReason,
      );
      toast.success(`${selected.kode_deklarasi} telah ditolak.`);
      setIsRejectOpen(false);
      setRejectReason("");
      setSelected(null);
      await loadData();
    } catch (error: any) {
      toast.error("Gagal menolak", { description: error.message });
    } finally {
      setProcessing(false);
    }
  };

  return (
    <>
      <Content
        title="Approval Deklarasi"
        description="Daftar Deklarasi Petty Cash yang menunggu persetujuan Anda."
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
        <div className="rounded-md border overflow-x-auto">
          <Table className="min-w-[900px]">
            <TableHeader>
              <TableRow>
                <TableHead className="w-[180px]">Kode Deklarasi</TableHead>
                <TableHead className="w-[180px]">Dari Voucher</TableHead>
                <TableHead>Pemohon</TableHead>
                <TableHead className="w-[140px] text-right">
                  Nominal Rencana
                </TableHead>
                <TableHead className="w-[140px] text-right">
                  Nominal Riil
                </TableHead>
                <TableHead className="w-[110px] text-center">Aksi</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {loading ? (
                <TableRow>
                  <TableCell colSpan={6} className="text-center h-32">
                    <Loader2 className="animate-spin h-6 w-6 mx-auto text-primary" />
                  </TableCell>
                </TableRow>
              ) : queue.length === 0 ? (
                <TableRow>
                  <TableCell
                    colSpan={6}
                    className="text-center h-32 text-muted-foreground"
                  >
                    <Inbox className="h-8 w-8 mx-auto mb-2 text-muted-foreground/50" />
                    Tidak ada Deklarasi yang menunggu persetujuan Anda.
                  </TableCell>
                </TableRow>
              ) : (
                queue.map((d) => (
                  <TableRow key={d.id}>
                    <TableCell className="font-semibold text-sm">
                      {d.kode_deklarasi}
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground">
                      {d.petty_cash_voucher?.kode_voucher || "-"}
                    </TableCell>
                    <TableCell className="text-sm">
                      {d.users_with_profiles?.nama || "-"}
                    </TableCell>
                    <TableCell className="text-right text-sm text-muted-foreground">
                      {formatCurrency(d.petty_cash_voucher?.total_amount || 0)}
                    </TableCell>
                    <TableCell className="text-right font-medium text-sm">
                      {formatCurrency(d.total_amount)}
                    </TableCell>
                    <TableCell className="text-center">
                      <Button
                        size="sm"
                        variant="secondary"
                        onClick={() => setSelected(d)}
                      >
                        Proses
                      </Button>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </div>
      </Content>

      {/* DIALOG DETAIL + AKSI APPROVE/REJECT */}
      <Dialog
        open={!!selected}
        onOpenChange={(open) => !open && setSelected(null)}
      >
        <DialogContent className="sm:max-w-2xl max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{selected?.kode_deklarasi}</DialogTitle>
            <DialogDescription>
              Dari Voucher {selected?.petty_cash_voucher?.kode_voucher} -
              diajukan oleh {selected?.users_with_profiles?.nama || "-"} (
              {selected?.department})
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
                        <TableCell>
                          <div className="font-medium">{it.part_name}</div>
                          {it.note && (
                            <div className="text-xs text-muted-foreground">
                              {it.note}
                            </div>
                          )}
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

              <div className="flex flex-wrap items-end justify-between gap-4">
                <div className="text-sm text-muted-foreground">
                  Nominal Voucher (rencana):{" "}
                  <span className="font-medium text-foreground">
                    {formatCurrency(selected.petty_cash_voucher?.total_amount || 0)}
                  </span>
                </div>
                <div className="text-right">
                  <p className="text-xs text-muted-foreground">
                    Total Deklarasi (riil)
                  </p>
                  <p className="text-xl font-bold text-primary">
                    {formatCurrency(selected.total_amount)}
                  </p>
                </div>
              </div>

              {selected.attachments.length > 0 && (
                <div className="space-y-2">
                  <p className="text-xs font-medium text-muted-foreground">
                    Bukti Struk/Nota
                  </p>
                  <div className="grid gap-2">
                    {selected.attachments.map((file, i) => (
                      <a
                        key={i}
                        href={file.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="flex items-center gap-2 text-sm text-primary hover:underline border rounded-md px-3 py-1.5"
                      >
                        <Paperclip className="h-3 w-3 shrink-0" />
                        <span className="truncate">{file.name}</span>
                      </a>
                    ))}
                  </div>
                </div>
              )}

              <div className="space-y-2">
                <p className="text-xs font-medium text-muted-foreground">
                  Jalur Approval
                </p>
                <div className="space-y-1">
                  {selected.approvals.map((app, i) => (
                    <div
                      key={i}
                      className="flex items-center justify-between text-sm border rounded-md px-3 py-1.5"
                    >
                      <span>
                        {i + 1}. {app.nama}{" "}
                        <span className="text-xs text-muted-foreground">
                          ({app.department})
                        </span>
                      </span>
                      {app.status === "approved" ? (
                        <Badge className="bg-green-50 text-green-700 border-green-200 dark:bg-green-900/40 dark:text-green-300 dark:border-green-800">
                          <CheckCircle2 className="h-3 w-3 mr-1" /> Approved
                        </Badge>
                      ) : app.status === "rejected" ? (
                        <Badge variant="destructive">
                          <XCircle className="h-3 w-3 mr-1" /> Rejected
                        </Badge>
                      ) : (
                        <Badge variant="outline">
                          <Clock className="h-3 w-3 mr-1" /> Pending
                        </Badge>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}

          <DialogFooter className="sm:justify-between">
            <Button
              variant="outline"
              className="text-destructive hover:text-destructive"
              onClick={() => setIsRejectOpen(true)}
              disabled={processing}
            >
              <XCircle className="mr-2 h-4 w-4" /> Tolak
            </Button>
            <Button onClick={handleApprove} disabled={processing}>
              {processing ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : (
                <CheckCircle2 className="mr-2 h-4 w-4" />
              )}
              Setujui
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* DIALOG ALASAN PENOLAKAN */}
      <Dialog open={isRejectOpen} onOpenChange={setIsRejectOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Tolak Deklarasi</DialogTitle>
            <DialogDescription>
              Jelaskan alasan penolakan - requester akan melihat catatan ini.
            </DialogDescription>
          </DialogHeader>
          <Textarea
            value={rejectReason}
            onChange={(e) => setRejectReason(e.target.value)}
            placeholder="Contoh: Bukti struk belum lengkap..."
            rows={4}
          />
          <DialogFooter>
            <Button
              variant="ghost"
              onClick={() => setIsRejectOpen(false)}
              disabled={processing}
            >
              Batal
            </Button>
            <Button
              variant="destructive"
              onClick={handleRejectSubmit}
              disabled={processing}
            >
              {processing && (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              )}
              Tolak Deklarasi
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
