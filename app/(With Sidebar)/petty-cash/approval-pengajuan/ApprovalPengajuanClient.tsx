// src/app/(With Sidebar)/petty-cash/approval-pengajuan/ApprovalPengajuanClient.tsx
//
// Antrian approval Input Pengajuan Petty Cash (petty_cash_pengajuan) - cuma
// menampilkan dokumen yang SEDANG giliran user login (lihat
// fetchPengajuanApprovalQueue, services/pettyCashPengajuanService.ts).
// Approver bisa: Tolak, Setujui Langsung, atau Edit & Setujui (edit seluruh
// field lalu approve sekaligus, dengan versi sebelumnya dicatat ke
// `revisions[]`) - lihat PcApprovalActions, components/petty-cash/.

"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Content } from "@/components/content";
import { Button } from "@/components/ui/button";
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
  editAndApprovePengajuanStep,
} from "@/services/pettyCashPengajuanService";
import { PcDocumentInfoPanel } from "@/components/petty-cash/PcDocumentInfoPanel";
import { PcApprovalActions } from "@/components/petty-cash/PcApprovalActions";
import { Loader2, RefreshCcw, Inbox, CalendarDays, ExternalLink } from "lucide-react";

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

  const handleReject = async (reason: string) => {
    if (!selected || !profile) return;
    setProcessing(true);
    try {
      await rejectPengajuanStep(selected, profile.id, profile.nama, reason);
      toast.success(`${selected.kode_pengajuan} telah ditolak.`);
      setSelected(null);
      await loadData();
    } catch (error: any) {
      toast.error("Gagal menolak", { description: error.message });
      throw error;
    } finally {
      setProcessing(false);
    }
  };

  const handleEditAndApprove = async (edits: any) => {
    if (!selected || !profile) return;
    setProcessing(true);
    try {
      await editAndApprovePengajuanStep(
        selected,
        profile.id,
        profile.nama,
        edits,
      );
      toast.success(
        `${selected.kode_pengajuan} berhasil diedit & disetujui.`,
      );
      setSelected(null);
      await loadData();
    } catch (error: any) {
      toast.error("Gagal edit & setujui", { description: error.message });
      throw error;
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

      {/* DIALOG DETAIL + AKSI APPROVE/REJECT/EDIT */}
      <Dialog
        open={!!selected}
        onOpenChange={(open) => !open && setSelected(null)}
      >
        <DialogContent className="sm:max-w-3xl max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center justify-between gap-2">
              <span>{selected?.kode_pengajuan}</span>
              {selected && (
                <Link
                  href={`/petty-cash/pengajuan/${selected.id}`}
                  target="_blank"
                  className="text-xs font-normal text-primary hover:underline flex items-center gap-1"
                >
                  Detail Lengkap / Cetak <ExternalLink className="h-3 w-3" />
                </Link>
              )}
            </DialogTitle>
            <DialogDescription>
              {selected && (
                <span className="inline-flex items-center gap-1">
                  <CalendarDays className="h-3 w-3" />
                  Dibutuhkan {formatDate(selected.needed_date)}
                </span>
              )}
            </DialogDescription>
          </DialogHeader>

          {selected && (
            <PcDocumentInfoPanel
              requesterName={selected.users_with_profiles?.nama}
              requesterEmail={selected.users_with_profiles?.email}
              department={selected.department}
              companyCode={selected.company_code}
              site={selected.site}
              neededDate={selected.needed_date}
              weekOfMonth={selected.week_of_month}
              notes={selected.notes}
              items={selected.items}
              totalAmount={selected.total_amount}
              attachments={selected.attachments}
              approvals={selected.approvals}
              discussions={selected.discussions}
              revisions={selected.revisions}
            />
          )}

          <DialogFooter className="sm:justify-between flex-wrap gap-2">
            {selected && profile && (
              <PcApprovalActions
                docLabel="Pengajuan"
                kode={selected.kode_pengajuan}
                companyCode={selected.company_code}
                editInitial={{
                  needed_date: selected.needed_date,
                  week_of_month: selected.week_of_month,
                  notes: selected.notes,
                  items: selected.items,
                  attachments: selected.attachments,
                }}
                processing={processing}
                onApprove={handleApprove}
                onReject={handleReject}
                onEditAndApprove={handleEditAndApprove}
              />
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
