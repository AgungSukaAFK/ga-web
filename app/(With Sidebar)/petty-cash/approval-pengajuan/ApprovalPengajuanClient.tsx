// src/app/(With Sidebar)/petty-cash/approval-pengajuan/ApprovalPengajuanClient.tsx
//
// Antrian approval Input Pengajuan Petty Cash (petty_cash_pengajuan) - cuma
// menampilkan dokumen yang SEDANG giliran user login (lihat
// fetchPengajuanApprovalQueue, services/pettyCashPengajuanService.ts).
// Approve/reject di sini memproses satu step di array `approvals` lewat
// lib/pcApprovalFlow.ts - begitu approver terakhir approve, status dokumen
// naik jadi "Approved" yang jadi syarat requester bisa bikin Pengajuan
// Voucher (lihat /petty-cash/pengajuan-voucher).

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
import { PettyCashPengajuan } from "@/type";
import {
  fetchPengajuanApprovalQueue,
  approvePengajuanStep,
  rejectPengajuanStep,
} from "@/services/pettyCashPengajuanService";
import {
  Loader2,
  RefreshCcw,
  Inbox,
  CheckCircle2,
  XCircle,
  Clock,
  CalendarDays,
} from "lucide-react";

const formatDate = (dateStr: string | Date) =>
  new Date(dateStr).toLocaleDateString("id-ID", {
    day: "2-digit",
    month: "long",
    year: "numeric",
  });

export default function ApprovalPengajuanClient() {
  const supabase = createClient();

  const [profile, setProfile] = useState<{ id: string; nama: string } | null>(
    null,
  );
  const [queue, setQueue] = useState<PettyCashPengajuan[]>([]);
  const [loading, setLoading] = useState(true);
  const [processing, setProcessing] = useState(false);

  const [selected, setSelected] = useState<PettyCashPengajuan | null>(null);
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

      const data = await fetchPengajuanApprovalQueue(user.id);
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
      await approvePengajuanStep(selected, profile.id);
      toast.success(`${selected.kode_pengajuan} berhasil disetujui.`);
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
      await rejectPengajuanStep(
        selected,
        profile.id,
        profile.nama,
        rejectReason,
      );
      toast.success(`${selected.kode_pengajuan} telah ditolak.`);
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
        title="Approval Pengajuan"
        description="Daftar Input Pengajuan Petty Cash yang menunggu persetujuan Anda."
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
          <Table className="min-w-[800px]">
            <TableHeader>
              <TableRow>
                <TableHead className="w-[180px]">Kode Pengajuan</TableHead>
                <TableHead>Pemohon</TableHead>
                <TableHead className="w-[140px]">Departemen</TableHead>
                <TableHead className="w-[150px] text-right">
                  Total Pengajuan
                </TableHead>
                <TableHead className="w-[130px]">Dibutuhkan</TableHead>
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
                    Tidak ada Pengajuan yang menunggu persetujuan Anda.
                  </TableCell>
                </TableRow>
              ) : (
                queue.map((pj) => (
                  <TableRow key={pj.id}>
                    <TableCell className="font-semibold text-sm">
                      {pj.kode_pengajuan}
                    </TableCell>
                    <TableCell className="text-sm">
                      {pj.users_with_profiles?.nama || "-"}
                    </TableCell>
                    <TableCell className="text-sm">{pj.department}</TableCell>
                    <TableCell className="text-right font-medium text-sm">
                      {formatCurrency(pj.total_amount)}
                    </TableCell>
                    <TableCell className="text-sm">
                      {formatDate(pj.needed_date)}
                    </TableCell>
                    <TableCell className="text-center">
                      <Button
                        size="sm"
                        variant="secondary"
                        onClick={() => setSelected(pj)}
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
            <DialogTitle>{selected?.kode_pengajuan}</DialogTitle>
            <DialogDescription>
              Diajukan oleh {selected?.users_with_profiles?.nama || "-"} (
              {selected?.department}) -{" "}
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
              <div className="flex justify-end">
                <div className="text-right">
                  <p className="text-xs text-muted-foreground">
                    Total Pengajuan
                  </p>
                  <p className="text-xl font-bold text-primary">
                    {formatCurrency(selected.total_amount)}
                  </p>
                </div>
              </div>

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
            <DialogTitle>Tolak Pengajuan</DialogTitle>
            <DialogDescription>
              Jelaskan alasan penolakan - requester akan melihat catatan ini.
            </DialogDescription>
          </DialogHeader>
          <Textarea
            value={rejectReason}
            onChange={(e) => setRejectReason(e.target.value)}
            placeholder="Contoh: Nominal terlalu besar untuk kebutuhan ini..."
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
              Tolak Pengajuan
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
