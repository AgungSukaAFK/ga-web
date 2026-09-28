// src/app/(With Sidebar)/petty-cash/approval/ApprovalPettyCashClient.tsx
//
// Approval Petty Cash - satu halaman yang menggabungkan 3 antrian approval
// (dulu 3 menu terpisah: /approval-pengajuan, /approval-voucher,
// /approval-deklarasi - implementasi lamanya masih ada di riwayat git)
// jadi 3 sesi/Content di halaman yang sama, mengikuti pola halaman
// "Approval & Validation" milik MR/PO (app/(With Sidebar)/approval-validation).
// Tiap sesi cuma menampilkan dokumen yang SEDANG giliran user login (lihat
// fetch*ApprovalQueue di masing-masing service). Approver bisa: Tolak,
// Setujui Langsung, atau Edit & Setujui - lihat PcApprovalActions,
// components/petty-cash/.
//
// Sesi ke-4 ("Pembayaran Sub-Voucher") BEDA dari 3 sesi approval di atas -
// bukan approval sekuensial per-dokumen, tapi antrian pembayaran Finance
// (department "Finance" + role "approver", atau admin) atas Sub-Voucher yang
// sudah "Menunggu Pembayaran" (lihat komentar PettyCashSubVoucher,
// type/index.ts). Menyelesaikan pembayaran WAJIB sertakan bukti transfer -
// dijamin di RPC mark_petty_cash_sub_voucher_paid, bukan cuma validasi UI.

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
import {
  Attachment,
  PettyCashDeklarasi,
  PettyCashPengajuan,
  PettyCashSubVoucher,
  PettyCashVoucher,
} from "@/type";
import {
  fetchPengajuanApprovalQueue,
  approvePengajuanStep,
  rejectPengajuanStep,
  editAndApprovePengajuanStep,
} from "@/services/pettyCashPengajuanService";
import {
  fetchVoucherApprovalQueue,
  approveVoucherStep,
  rejectVoucherStep,
  editAndApproveVoucherStep,
} from "@/services/pettyCashVoucherService";
import {
  fetchDeklarasiApprovalQueue,
  approveDeklarasiStep,
  rejectDeklarasiStep,
  editAndApproveDeklarasiStep,
} from "@/services/pettyCashDeklarasiService";
import {
  fetchSubVoucherPaymentQueue,
  markSubVoucherPaid,
} from "@/services/pettyCashSubVoucherService";
import { PcDocumentInfoPanel } from "@/components/petty-cash/PcDocumentInfoPanel";
import { PcApprovalActions } from "@/components/petty-cash/PcApprovalActions";
import { PcRequesterHistoryDialog } from "@/components/petty-cash/PcRequesterHistoryDialog";
import { PcSubVoucherPaymentForm } from "@/components/petty-cash/PcSubVoucherPaymentForm";
import {
  Loader2,
  RefreshCcw,
  Inbox,
  CalendarDays,
  ExternalLink,
} from "lucide-react";

const formatDate = (dateStr: string | Date) =>
  new Date(dateStr).toLocaleDateString("id-ID", {
    day: "2-digit",
    month: "long",
    year: "numeric",
  });

type Profile = {
  id: string;
  nama: string;
  department: string | null;
  role: string | null;
  company: string | null;
};

export default function ApprovalPettyCashClient() {
  const supabase = createClient();

  const [profile, setProfile] = useState<Profile | null>(null);
  const [loading, setLoading] = useState(true);

  const [pengajuanQueue, setPengajuanQueue] = useState<PettyCashPengajuan[]>(
    [],
  );
  const [voucherQueue, setVoucherQueue] = useState<PettyCashVoucher[]>([]);
  const [deklarasiQueue, setDeklarasiQueue] = useState<PettyCashDeklarasi[]>(
    [],
  );
  const [paymentQueue, setPaymentQueue] = useState<PettyCashSubVoucher[]>([]);

  const [selectedPengajuan, setSelectedPengajuan] =
    useState<PettyCashPengajuan | null>(null);
  const [selectedVoucher, setSelectedVoucher] =
    useState<PettyCashVoucher | null>(null);
  const [selectedDeklarasi, setSelectedDeklarasi] =
    useState<PettyCashDeklarasi | null>(null);
  const [selectedPayment, setSelectedPayment] =
    useState<PettyCashSubVoucher | null>(null);

  const [processingPengajuan, setProcessingPengajuan] = useState(false);
  const [processingVoucher, setProcessingVoucher] = useState(false);
  const [processingDeklarasi, setProcessingDeklarasi] = useState(false);
  const [processingPayment, setProcessingPayment] = useState(false);

  const isFinanceApprover = (p: Profile | null) =>
    !!p && (p.role === "admin" || (p.department === "Finance" && p.role === "approver"));

  const loadData = async () => {
    setLoading(true);
    try {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) throw new Error("Tidak terautentikasi.");

      const { data: prof, error } = await supabase
        .from("profiles")
        .select("id, nama, department, role, company")
        .eq("id", user.id)
        .single();
      if (error) throw error;
      const currentProfile: Profile = {
        id: prof.id,
        nama: prof.nama || "",
        department: prof.department,
        role: prof.role,
        company: prof.company,
      };
      setProfile(currentProfile);

      const [pengajuan, voucher, deklarasi, payment] = await Promise.all([
        fetchPengajuanApprovalQueue(user.id),
        fetchVoucherApprovalQueue(user.id),
        fetchDeklarasiApprovalQueue(user.id),
        isFinanceApprover(currentProfile)
          ? fetchSubVoucherPaymentQueue(currentProfile.company)
          : Promise.resolve([]),
      ]);
      setPengajuanQueue(pengajuan);
      setVoucherQueue(voucher);
      setDeklarasiQueue(deklarasi);
      setPaymentQueue(payment);
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

  const refetchPengajuan = async () => {
    if (!profile) return;
    setPengajuanQueue(await fetchPengajuanApprovalQueue(profile.id));
  };
  const refetchVoucher = async () => {
    if (!profile) return;
    setVoucherQueue(await fetchVoucherApprovalQueue(profile.id));
  };
  const refetchDeklarasi = async () => {
    if (!profile) return;
    setDeklarasiQueue(await fetchDeklarasiApprovalQueue(profile.id));
  };
  const refetchPayment = async () => {
    if (!profile || !isFinanceApprover(profile)) return;
    setPaymentQueue(await fetchSubVoucherPaymentQueue(profile.company));
  };

  // --- Pengajuan ---
  const handleApprovePengajuan = async () => {
    if (!selectedPengajuan || !profile) return;
    setProcessingPengajuan(true);
    try {
      await approvePengajuanStep(selectedPengajuan, profile.id);
      toast.success(`${selectedPengajuan.kode_pengajuan} berhasil disetujui.`);
      setSelectedPengajuan(null);
      await refetchPengajuan();
    } catch (error: any) {
      toast.error("Gagal menyetujui", { description: error.message });
    } finally {
      setProcessingPengajuan(false);
    }
  };

  const handleRejectPengajuan = async (reason: string) => {
    if (!selectedPengajuan || !profile) return;
    setProcessingPengajuan(true);
    try {
      await rejectPengajuanStep(
        selectedPengajuan,
        profile.id,
        profile.nama,
        reason,
      );
      toast.success(`${selectedPengajuan.kode_pengajuan} telah ditolak.`);
      setSelectedPengajuan(null);
      await refetchPengajuan();
    } catch (error: any) {
      toast.error("Gagal menolak", { description: error.message });
      throw error;
    } finally {
      setProcessingPengajuan(false);
    }
  };

  const handleEditAndApprovePengajuan = async (edits: any) => {
    if (!selectedPengajuan || !profile) return;
    setProcessingPengajuan(true);
    try {
      await editAndApprovePengajuanStep(
        selectedPengajuan,
        profile.id,
        profile.nama,
        edits,
      );
      toast.success(
        `${selectedPengajuan.kode_pengajuan} berhasil diedit & disetujui.`,
      );
      setSelectedPengajuan(null);
      await refetchPengajuan();
    } catch (error: any) {
      toast.error("Gagal edit & setujui", { description: error.message });
      throw error;
    } finally {
      setProcessingPengajuan(false);
    }
  };

  // --- Voucher ---
  const handleApproveVoucher = async () => {
    if (!selectedVoucher || !profile) return;
    setProcessingVoucher(true);
    try {
      await approveVoucherStep(selectedVoucher, profile.id);
      toast.success(`${selectedVoucher.kode_voucher} berhasil disetujui.`);
      setSelectedVoucher(null);
      await refetchVoucher();
    } catch (error: any) {
      toast.error("Gagal menyetujui", { description: error.message });
    } finally {
      setProcessingVoucher(false);
    }
  };

  const handleRejectVoucher = async (reason: string) => {
    if (!selectedVoucher || !profile) return;
    setProcessingVoucher(true);
    try {
      await rejectVoucherStep(
        selectedVoucher,
        profile.id,
        profile.nama,
        reason,
      );
      toast.success(`${selectedVoucher.kode_voucher} telah ditolak.`);
      setSelectedVoucher(null);
      await refetchVoucher();
    } catch (error: any) {
      toast.error("Gagal menolak", { description: error.message });
      throw error;
    } finally {
      setProcessingVoucher(false);
    }
  };

  const handleEditAndApproveVoucher = async (edits: any) => {
    if (!selectedVoucher || !profile) return;
    setProcessingVoucher(true);
    try {
      await editAndApproveVoucherStep(
        selectedVoucher,
        profile.id,
        profile.nama,
        edits,
      );
      toast.success(
        `${selectedVoucher.kode_voucher} berhasil diedit & disetujui.`,
      );
      setSelectedVoucher(null);
      await refetchVoucher();
    } catch (error: any) {
      toast.error("Gagal edit & setujui", { description: error.message });
      throw error;
    } finally {
      setProcessingVoucher(false);
    }
  };

  // --- Deklarasi ---
  const handleApproveDeklarasi = async () => {
    if (!selectedDeklarasi || !profile) return;
    setProcessingDeklarasi(true);
    try {
      await approveDeklarasiStep(selectedDeklarasi, profile.id);
      toast.success(`${selectedDeklarasi.kode_deklarasi} berhasil disetujui.`);
      setSelectedDeklarasi(null);
      await refetchDeklarasi();
    } catch (error: any) {
      toast.error("Gagal menyetujui", { description: error.message });
    } finally {
      setProcessingDeklarasi(false);
    }
  };

  const handleRejectDeklarasi = async (reason: string) => {
    if (!selectedDeklarasi || !profile) return;
    setProcessingDeklarasi(true);
    try {
      await rejectDeklarasiStep(
        selectedDeklarasi,
        profile.id,
        profile.nama,
        reason,
      );
      toast.success(`${selectedDeklarasi.kode_deklarasi} telah ditolak.`);
      setSelectedDeklarasi(null);
      await refetchDeklarasi();
    } catch (error: any) {
      toast.error("Gagal menolak", { description: error.message });
      throw error;
    } finally {
      setProcessingDeklarasi(false);
    }
  };

  const handleEditAndApproveDeklarasi = async (edits: any) => {
    if (!selectedDeklarasi || !profile) return;
    setProcessingDeklarasi(true);
    try {
      await editAndApproveDeklarasiStep(
        selectedDeklarasi,
        profile.id,
        profile.nama,
        edits,
      );
      toast.success(
        `${selectedDeklarasi.kode_deklarasi} berhasil diedit & disetujui.`,
      );
      setSelectedDeklarasi(null);
      await refetchDeklarasi();
    } catch (error: any) {
      toast.error("Gagal edit & setujui", { description: error.message });
      throw error;
    } finally {
      setProcessingDeklarasi(false);
    }
  };

  // --- Pembayaran Sub-Voucher (Finance) ---
  const openPaymentDialog = (sv: PettyCashSubVoucher) => setSelectedPayment(sv);

  const handleSubmitPayment = async (paymentProof: Attachment[]) => {
    if (!selectedPayment) return;
    setProcessingPayment(true);
    try {
      await markSubVoucherPaid(selectedPayment.id, paymentProof);
      toast.success(
        `${selectedPayment.kode_sub_voucher} berhasil ditandai selesai dibayar.`,
      );
      setSelectedPayment(null);
      await refetchPayment();
    } catch (error: any) {
      toast.error("Gagal menyelesaikan pembayaran", {
        description: error.message,
      });
    } finally {
      setProcessingPayment(false);
    }
  };

  return (
    <>
      {/* --- SESI 1: PENGAJUAN --- */}
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
              ) : pengajuanQueue.length === 0 ? (
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
                pengajuanQueue.map((pj) => (
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
                        onClick={() => setSelectedPengajuan(pj)}
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

      {/* --- SESI 2: VOUCHER --- */}
      <Content
        title="Approval Voucher"
        description="Daftar Pengajuan Voucher Petty Cash yang menunggu persetujuan Anda."
      >
        <div className="rounded-md border overflow-x-auto">
          <Table className="min-w-[850px]">
            <TableHeader>
              <TableRow>
                <TableHead className="w-[180px]">Kode Voucher</TableHead>
                <TableHead className="w-[180px]">Dari Pengajuan</TableHead>
                <TableHead>Pemohon</TableHead>
                <TableHead className="w-[140px]">Departemen</TableHead>
                <TableHead className="w-[150px] text-right">
                  Total Voucher
                </TableHead>
                <TableHead className="w-[130px]">Dibutuhkan</TableHead>
                <TableHead className="w-[110px] text-center">Aksi</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {loading ? (
                <TableRow>
                  <TableCell colSpan={7} className="text-center h-32">
                    <Loader2 className="animate-spin h-6 w-6 mx-auto text-primary" />
                  </TableCell>
                </TableRow>
              ) : voucherQueue.length === 0 ? (
                <TableRow>
                  <TableCell
                    colSpan={7}
                    className="text-center h-32 text-muted-foreground"
                  >
                    <Inbox className="h-8 w-8 mx-auto mb-2 text-muted-foreground/50" />
                    Tidak ada Voucher yang menunggu persetujuan Anda.
                  </TableCell>
                </TableRow>
              ) : (
                voucherQueue.map((v) => (
                  <TableRow key={v.id}>
                    <TableCell className="font-semibold text-sm">
                      {v.kode_voucher}
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground">
                      {v.petty_cash_pengajuan?.kode_pengajuan || "-"}
                    </TableCell>
                    <TableCell className="text-sm">
                      {v.users_with_profiles?.nama || "-"}
                    </TableCell>
                    <TableCell className="text-sm">{v.department}</TableCell>
                    <TableCell className="text-right font-medium text-sm">
                      {formatCurrency(v.total_amount)}
                    </TableCell>
                    <TableCell className="text-sm">
                      {formatDate(v.needed_date)}
                    </TableCell>
                    <TableCell className="text-center">
                      <Button
                        size="sm"
                        variant="secondary"
                        onClick={() => setSelectedVoucher(v)}
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

      {/* --- SESI 3: DEKLARASI --- */}
      <Content
        title="Approval Deklarasi"
        description="Daftar Deklarasi Petty Cash yang menunggu persetujuan Anda."
      >
        <div className="rounded-md border overflow-x-auto">
          <Table className="min-w-[900px]">
            <TableHeader>
              <TableRow>
                <TableHead className="w-[180px]">Kode Deklarasi</TableHead>
                <TableHead className="w-[180px]">Dari Voucher</TableHead>
                <TableHead>Pemohon</TableHead>
                <TableHead className="w-[140px]">Departemen</TableHead>
                <TableHead className="w-[150px] text-right">
                  Total Deklarasi
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
              ) : deklarasiQueue.length === 0 ? (
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
                deklarasiQueue.map((d) => (
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
                    <TableCell className="text-sm">{d.department}</TableCell>
                    <TableCell className="text-right font-medium text-sm">
                      {formatCurrency(d.total_amount)}
                    </TableCell>
                    <TableCell className="text-center">
                      <Button
                        size="sm"
                        variant="secondary"
                        onClick={() => setSelectedDeklarasi(d)}
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

      {/* --- SESI 4: PEMBAYARAN SUB-VOUCHER (Finance/admin only) --- */}
      {isFinanceApprover(profile) && (
        <Content
          title="Pembayaran Sub-Voucher"
          description="Daftar tarikan dana Petty Cash yang menunggu ditransfer/dibayar Finance."
        >
          <div className="rounded-md border overflow-x-auto">
            <Table className="min-w-[850px]">
              <TableHeader>
                <TableRow>
                  <TableHead className="w-[180px]">Kode Sub-Voucher</TableHead>
                  <TableHead className="w-[180px]">Dari Voucher</TableHead>
                  <TableHead>Pemohon</TableHead>
                  <TableHead className="w-[140px]">Departemen</TableHead>
                  <TableHead className="w-[150px] text-right">
                    Nominal Tarikan
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
                ) : paymentQueue.length === 0 ? (
                  <TableRow>
                    <TableCell
                      colSpan={6}
                      className="text-center h-32 text-muted-foreground"
                    >
                      <Inbox className="h-8 w-8 mx-auto mb-2 text-muted-foreground/50" />
                      Tidak ada tarikan yang menunggu pembayaran.
                    </TableCell>
                  </TableRow>
                ) : (
                  paymentQueue.map((sv) => (
                    <TableRow key={sv.id}>
                      <TableCell className="font-semibold text-sm">
                        {sv.kode_sub_voucher}
                      </TableCell>
                      <TableCell className="text-sm text-muted-foreground">
                        {sv.petty_cash_voucher?.kode_voucher || "-"}
                      </TableCell>
                      <TableCell className="text-sm">
                        {sv.users_with_profiles?.nama || "-"}
                      </TableCell>
                      <TableCell className="text-sm">
                        {sv.petty_cash_voucher?.department || "-"}
                      </TableCell>
                      <TableCell className="text-right font-medium text-sm">
                        {formatCurrency(sv.amount)}
                      </TableCell>
                      <TableCell className="text-center">
                        <Button
                          size="sm"
                          variant="secondary"
                          onClick={() => openPaymentDialog(sv)}
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
      )}

      {/* DIALOG DETAIL + AKSI - PENGAJUAN */}
      <Dialog
        open={!!selectedPengajuan}
        onOpenChange={(open) => !open && setSelectedPengajuan(null)}
      >
        <DialogContent className="sm:max-w-3xl max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center justify-between gap-2">
              <span>{selectedPengajuan?.kode_pengajuan}</span>
              {selectedPengajuan && (
                <Link
                  href={`/petty-cash/pengajuan/${selectedPengajuan.id}`}
                  target="_blank"
                  className="text-xs font-normal text-primary hover:underline flex items-center gap-1"
                >
                  Detail Lengkap / Cetak <ExternalLink className="h-3 w-3" />
                </Link>
              )}
            </DialogTitle>
            <DialogDescription>
              {selectedPengajuan && (
                <span className="inline-flex items-center gap-1">
                  <CalendarDays className="h-3 w-3" />
                  Dibutuhkan {formatDate(selectedPengajuan.needed_date)}
                </span>
              )}
            </DialogDescription>
          </DialogHeader>

          {selectedPengajuan && (
            <div className="flex justify-end">
              <PcRequesterHistoryDialog
                userId={selectedPengajuan.user_id}
                requesterName={selectedPengajuan.users_with_profiles?.nama}
              />
            </div>
          )}

          {selectedPengajuan && (
            <PcDocumentInfoPanel
              requesterName={selectedPengajuan.users_with_profiles?.nama}
              requesterEmail={selectedPengajuan.users_with_profiles?.email}
              department={selectedPengajuan.department}
              companyCode={selectedPengajuan.company_code}
              site={selectedPengajuan.site}
              budgetName={selectedPengajuan.petty_cash_budget?.name}
              budgetRemaining={
                selectedPengajuan.petty_cash_budget?.current_budget
              }
              neededDate={selectedPengajuan.needed_date}
              weekOfMonth={selectedPengajuan.week_of_month}
              notes={selectedPengajuan.notes}
              items={selectedPengajuan.items}
              totalAmount={selectedPengajuan.total_amount}
              attachments={selectedPengajuan.attachments}
              approvals={selectedPengajuan.approvals}
              discussions={selectedPengajuan.discussions}
              revisions={selectedPengajuan.revisions}
            />
          )}

          <DialogFooter className="sm:justify-between flex-wrap gap-2">
            {selectedPengajuan && profile && (
              <PcApprovalActions
                docLabel="Pengajuan"
                kode={selectedPengajuan.kode_pengajuan}
                companyCode={selectedPengajuan.company_code}
                showBudget
                editInitial={{
                  needed_date: selectedPengajuan.needed_date,
                  week_of_month: selectedPengajuan.week_of_month,
                  notes: selectedPengajuan.notes,
                  items: selectedPengajuan.items,
                  attachments: selectedPengajuan.attachments,
                  budget_id: selectedPengajuan.budget_id,
                }}
                processing={processingPengajuan}
                onApprove={handleApprovePengajuan}
                onReject={handleRejectPengajuan}
                onEditAndApprove={handleEditAndApprovePengajuan}
              />
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* DIALOG DETAIL + AKSI - VOUCHER */}
      <Dialog
        open={!!selectedVoucher}
        onOpenChange={(open) => !open && setSelectedVoucher(null)}
      >
        <DialogContent className="sm:max-w-3xl max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center justify-between gap-2">
              <span>{selectedVoucher?.kode_voucher}</span>
              {selectedVoucher && (
                <Link
                  href={`/petty-cash/voucher/${selectedVoucher.id}`}
                  target="_blank"
                  className="text-xs font-normal text-primary hover:underline flex items-center gap-1"
                >
                  Detail Lengkap / Cetak <ExternalLink className="h-3 w-3" />
                </Link>
              )}
            </DialogTitle>
            <DialogDescription>
              {selectedVoucher && (
                <span className="inline-flex items-center gap-1">
                  Dari Pengajuan{" "}
                  {selectedVoucher.petty_cash_pengajuan?.kode_pengajuan ||
                    "-"}{" "}
                  - <CalendarDays className="h-3 w-3" />
                  Dibutuhkan {formatDate(selectedVoucher.needed_date)}
                </span>
              )}
            </DialogDescription>
          </DialogHeader>

          {selectedVoucher && (
            <div className="flex justify-end">
              <PcRequesterHistoryDialog
                userId={selectedVoucher.user_id}
                requesterName={selectedVoucher.users_with_profiles?.nama}
              />
            </div>
          )}

          {selectedVoucher && (
            <PcDocumentInfoPanel
              requesterName={selectedVoucher.users_with_profiles?.nama}
              requesterEmail={selectedVoucher.users_with_profiles?.email}
              department={selectedVoucher.department}
              companyCode={selectedVoucher.company_code}
              site={selectedVoucher.site}
              budgetName={selectedVoucher.petty_cash_budget?.name}
              budgetRemaining={
                selectedVoucher.petty_cash_budget?.current_budget
              }
              neededDate={selectedVoucher.needed_date}
              weekOfMonth={selectedVoucher.week_of_month}
              notes={selectedVoucher.notes}
              items={selectedVoucher.items}
              totalAmount={selectedVoucher.total_amount}
              attachments={selectedVoucher.attachments}
              approvals={selectedVoucher.approvals}
              discussions={selectedVoucher.discussions}
              revisions={selectedVoucher.revisions}
            />
          )}

          <DialogFooter className="sm:justify-between flex-wrap gap-2">
            {selectedVoucher && profile && (
              <PcApprovalActions
                docLabel="Voucher"
                kode={selectedVoucher.kode_voucher}
                companyCode={selectedVoucher.company_code}
                editInitial={{
                  needed_date: selectedVoucher.needed_date,
                  week_of_month: selectedVoucher.week_of_month,
                  notes: selectedVoucher.notes,
                  items: selectedVoucher.items,
                  attachments: selectedVoucher.attachments,
                }}
                processing={processingVoucher}
                onApprove={handleApproveVoucher}
                onReject={handleRejectVoucher}
                onEditAndApprove={handleEditAndApproveVoucher}
              />
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* DIALOG DETAIL + AKSI - DEKLARASI */}
      <Dialog
        open={!!selectedDeklarasi}
        onOpenChange={(open) => !open && setSelectedDeklarasi(null)}
      >
        <DialogContent className="sm:max-w-3xl max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center justify-between gap-2">
              <span>{selectedDeklarasi?.kode_deklarasi}</span>
              {selectedDeklarasi && (
                <Link
                  href={`/petty-cash/deklarasi/${selectedDeklarasi.id}`}
                  target="_blank"
                  className="text-xs font-normal text-primary hover:underline flex items-center gap-1"
                >
                  Detail Lengkap / Cetak <ExternalLink className="h-3 w-3" />
                </Link>
              )}
            </DialogTitle>
            <DialogDescription>
              {selectedDeklarasi && (
                <span className="inline-flex items-center gap-1">
                  <CalendarDays className="h-3 w-3" />
                  Dari Voucher{" "}
                  {selectedDeklarasi.petty_cash_voucher?.kode_voucher || "-"}{" "}
                  - dibuat {formatDate(selectedDeklarasi.created_at)}
                </span>
              )}
            </DialogDescription>
          </DialogHeader>

          {selectedDeklarasi && (
            <div className="flex justify-end">
              <PcRequesterHistoryDialog
                userId={selectedDeklarasi.user_id}
                requesterName={selectedDeklarasi.users_with_profiles?.nama}
              />
            </div>
          )}

          {selectedDeklarasi && (
            <PcDocumentInfoPanel
              requesterName={selectedDeklarasi.users_with_profiles?.nama}
              requesterEmail={selectedDeklarasi.users_with_profiles?.email}
              department={selectedDeklarasi.department}
              companyCode={selectedDeklarasi.company_code}
              site={selectedDeklarasi.site}
              budgetName={
                selectedDeklarasi.petty_cash_voucher?.petty_cash_budget?.name
              }
              budgetRemaining={
                selectedDeklarasi.petty_cash_voucher?.petty_cash_budget
                  ?.current_budget
              }
              weekOfMonth={selectedDeklarasi.week_of_month}
              showNeededDate={false}
              notes={selectedDeklarasi.notes}
              items={selectedDeklarasi.items}
              totalAmount={selectedDeklarasi.total_amount}
              attachments={selectedDeklarasi.attachments}
              approvals={selectedDeklarasi.approvals}
              discussions={selectedDeklarasi.discussions}
              revisions={selectedDeklarasi.revisions}
            />
          )}

          <DialogFooter className="sm:justify-between flex-wrap gap-2">
            {selectedDeklarasi && profile && (
              <PcApprovalActions
                docLabel="Deklarasi"
                kode={selectedDeklarasi.kode_deklarasi}
                companyCode={selectedDeklarasi.company_code}
                showNeededDate={false}
                editInitial={{
                  notes: selectedDeklarasi.notes,
                  items: selectedDeklarasi.items,
                  attachments: selectedDeklarasi.attachments,
                }}
                processing={processingDeklarasi}
                onApprove={handleApproveDeklarasi}
                onReject={handleRejectDeklarasi}
                onEditAndApprove={handleEditAndApproveDeklarasi}
              />
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* DIALOG SELESAIKAN PEMBAYARAN - SUB-VOUCHER */}
      <Dialog
        open={!!selectedPayment}
        onOpenChange={(open) => !open && setSelectedPayment(null)}
      >
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center justify-between gap-2">
              <span>Selesaikan Pembayaran {selectedPayment?.kode_sub_voucher}</span>
              {selectedPayment && (
                <Link
                  href={`/petty-cash/sub-voucher/${selectedPayment.id}`}
                  target="_blank"
                  className="text-xs font-normal text-primary hover:underline flex items-center gap-1"
                >
                  Detail Lengkap / Cetak <ExternalLink className="h-3 w-3" />
                </Link>
              )}
            </DialogTitle>
            <DialogDescription>
              Dari Voucher {selectedPayment?.petty_cash_voucher?.kode_voucher || "-"}
              . Unggah bukti transfer/pembayaran sebelum menandai tarikan ini
              selesai dibayar.
            </DialogDescription>
          </DialogHeader>

          {selectedPayment && (
            <PcSubVoucherPaymentForm
              key={selectedPayment.id}
              subVoucher={selectedPayment}
              processing={processingPayment}
              onSubmit={handleSubmitPayment}
            />
          )}
        </DialogContent>
      </Dialog>
    </>
  );
}
