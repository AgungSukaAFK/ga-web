// src/app/(With Sidebar)/petty-cash/[id]/page.tsx

"use client";

import { Content } from "@/components/content";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogDescription,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { createClient } from "@/lib/supabase/client";
import { useState, useEffect } from "react";
import { toast } from "sonner";
import { useParams, useRouter } from "next/navigation";
import { getPettyCashById } from "@/services/pettyCashService";
import {
  fetchPcTemplateList,
  fetchPcTemplateById,
} from "@/services/pcApprovalTemplateService";
import { PettyCashRequest } from "@/type";
import { PETTY_CASH_STATUS_COLORS } from "@/type/enum";
import { PcDiscussionSection } from "./pc-discussion";
import {
  Loader2,
  ArrowLeft,
  ReceiptText,
  CalendarDays,
  UploadCloud,
  X,
  CheckCircle2,
  XCircle,
  Clock,
  FileSignature,
  Wallet,
  Banknote,
  Printer,
  HelpCircle,
} from "lucide-react";
import Image from "next/image";

// Helper Formatters
const formatRupiah = (angka: number) =>
  new Intl.NumberFormat("id-ID", {
    style: "currency",
    currency: "IDR",
    minimumFractionDigits: 0,
  }).format(angka);
const formatDate = (dateStr: string | Date) =>
  new Date(dateStr).toLocaleDateString("id-ID", {
    day: "2-digit",
    month: "long",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });

export default function PettyCashDetailPage() {
  const params = useParams();
  const router = useRouter();
  const supabase = createClient();

  const [pc, setPc] = useState<PettyCashRequest | null>(null);
  const [loading, setLoading] = useState(true);
  const [profile, setProfile] = useState<any>(null);
  const [templates, setTemplates] = useState<
    { id: number; template_name: string }[]
  >([]);

  // States Aksi General
  const [processing, setProcessing] = useState(false);
  const [selectedTemplateId, setSelectedTemplateId] = useState<string>("");

  // State Reject Dialog
  const [isRejectDialogOpen, setIsRejectDialogOpen] = useState(false);
  const [rejectReason, setRejectReason] = useState("");

  // States Settlement (Khusus Cash Advance)
  const [actualAmount, setActualAmount] = useState("");
  const [settlementAttachments, setSettlementAttachments] = useState<
    { url: string; name: string }[]
  >([]);
  const [uploading, setUploading] = useState(false);

  const loadData = async () => {
    setLoading(true);
    try {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) throw new Error("Tidak terautentikasi");

      const userProfile = await supabase
        .from("profiles")
        .select("*")
        .eq("id", user.id)
        .single();
      setProfile(userProfile.data);

      const data = await getPettyCashById(Number(params.id));
      if (!data) throw new Error("Data Petty Cash tidak ditemukan.");
      setPc(data);

      // Jika GA & status masih pending validation, tarik daftar template dari master
      if (
        data.status === "Pending Validation" &&
        ["General Affair", "Finance"].includes(userProfile.data?.department)
      ) {
        const tpl = await fetchPcTemplateList();
        setTemplates(tpl);
      }
    } catch (error: any) {
      toast.error("Gagal memuat detail", { description: error.message });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, [params.id]);

  // ==========================================
  // LOGIC 1: GA ROUTING (PILIH TEMPLATE)
  // ==========================================
  const handleGAValidation = async () => {
    if (!selectedTemplateId)
      return toast.error("Silakan pilih template approval terlebih dahulu.");
    setProcessing(true);
    try {
      const templateData = await fetchPcTemplateById(
        Number(selectedTemplateId),
      );

      const { error } = await supabase
        .from("petty_cash_requests")
        .update({
          status: "In Approval",
          approvals: templateData.approval_path, // Injeksi jalur dari template
          discussions: [
            ...(pc?.discussions || []),
            {
              user_name: "Sistem",
              message: `Jalur Approval diset ke: ${templateData.template_name} oleh ${profile.nama} (${profile.department})`,
              timestamp: new Date().toISOString(),
            },
          ],
          updated_at: new Date().toISOString(),
        })
        .eq("id", pc?.id);

      if (error) throw error;
      toast.success(
        "Petty Cash berhasil divalidasi dan masuk jalur persetujuan.",
      );
      loadData();
    } catch (err: any) {
      toast.error("Gagal memvalidasi", { description: err.message });
    } finally {
      setProcessing(false);
    }
  };

  // ==========================================
  // LOGIC 2: APPROVE
  // ==========================================
  const handleApprove = async () => {
    if (!pc || !profile) return;
    setProcessing(true);

    const myIndex = pc.approvals.findIndex(
      (a: any) => a.userid === profile.id && a.status === "pending",
    );
    if (myIndex === -1) return setProcessing(false);

    const updatedApprovals = [...pc.approvals];
    updatedApprovals[myIndex].status = "approved";
    updatedApprovals[myIndex].processed_at = new Date().toISOString();

    const isLastApprover = myIndex === updatedApprovals.length - 1;
    let nextStatus = pc.status;

    // Jika ini approver terakhir, tentukan nasib dana
    if (isLastApprover) {
      nextStatus = pc.type === "Reimbursement" ? "Settled" : "Cash Distributed";
    }

    try {
      const { error } = await supabase
        .from("petty_cash_requests")
        .update({
          status: nextStatus,
          approvals: updatedApprovals,
          updated_at: new Date().toISOString(),
        })
        .eq("id", pc.id);

      if (error) throw error;
      toast.success("Dokumen berhasil disetujui.");
      loadData();
    } catch (error: any) {
      toast.error("Gagal menyetujui", { description: error.message });
    } finally {
      setProcessing(false);
    }
  };

  // ==========================================
  // LOGIC 3: REJECT (Dipakai oleh GA maupun Approver)
  // ==========================================
  const handleRejectSubmit = async () => {
    if (!rejectReason.trim())
      return toast.error("Alasan penolakan wajib diisi.");
    if (!pc || !profile) return;

    setProcessing(true);
    const updatedApprovals = pc.approvals ? [...pc.approvals] : [];

    // Jika yang menolak adalah Approver (status In Approval), update jejak status individunya
    if (pc.status === "In Approval") {
      const myIndex = updatedApprovals.findIndex(
        (a: any) => a.userid === profile.id && a.status === "pending",
      );
      if (myIndex !== -1) {
        updatedApprovals[myIndex].status = "rejected";
        updatedApprovals[myIndex].processed_at = new Date().toISOString();
      }
    }
    // Jika yang menolak adalah GA di "Pending Validation", dia tidak ada di array approvals,
    // langsung ubah status menjadi Rejected.

    // Masukkan alasan reject ke diskusi sebagai jejak audit
    const newDiscussion = {
      user_id: profile.id,
      user_name: profile.nama,
      message: `[PENOLAKAN] Alasan: ${rejectReason}`,
      timestamp: new Date().toISOString(),
    };

    try {
      const { error } = await supabase
        .from("petty_cash_requests")
        .update({
          status: "Rejected",
          approvals: updatedApprovals,
          discussions: [...(pc.discussions || []), newDiscussion],
          updated_at: new Date().toISOString(),
        })
        .eq("id", pc.id);

      if (error) throw error;
      toast.success("Dokumen telah ditolak.");
      setIsRejectDialogOpen(false);
      loadData();
    } catch (error: any) {
      toast.error("Gagal menolak", { description: error.message });
    } finally {
      setProcessing(false);
    }
  };

  // ==========================================
  // LOGIC 4: SETTLEMENT (UPLOAD BUKTI OLEH USER)
  // ==========================================
  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (file.size > 5 * 1024 * 1024)
      return toast.error("Ukuran file maksimal 5MB.");

    setUploading(true);
    try {
      const fileExt = file.name.split(".").pop();
      const fileName = `settlement-${Date.now()}-${Math.random().toString(36).substring(2)}.${fileExt}`;
      const filePath = `petty-cash/${fileName}`;

      const { error: uploadError } = await supabase.storage
        .from("mr-attachments")
        .upload(filePath, file);
      if (uploadError) throw uploadError;

      const { data: publicUrlData } = supabase.storage
        .from("mr-attachments")
        .getPublicUrl(filePath);

      setSettlementAttachments((prev) => [
        ...prev,
        { url: publicUrlData.publicUrl, name: file.name },
      ]);
      toast.success("Bukti nota berhasil diunggah.");
    } catch (error: any) {
      toast.error("Gagal unggah file", { description: error.message });
    } finally {
      setUploading(false);
      e.target.value = "";
    }
  };

  const removeAttachment = (index: number) => {
    setSettlementAttachments((prev) => prev.filter((_, i) => i !== index));
  };

  const submitSettlement = async () => {
    if (!actualAmount || Number(actualAmount) < 0)
      return toast.error("Nominal riil wajib diisi dengan benar.");
    if (settlementAttachments.length === 0)
      return toast.error("Wajib mengunggah minimal 1 bukti nota/struk.");

    setProcessing(true);
    try {
      const { error } = await supabase
        .from("petty_cash_requests")
        .update({
          actual_amount: Number(actualAmount),
          settlement_attachments: settlementAttachments,
          status: "Pending Settlement",
          updated_at: new Date().toISOString(),
        })
        .eq("id", pc?.id);

      if (error) throw error;
      toast.success("Laporan Settlement berhasil diajukan!");
      loadData();
    } catch (error: any) {
      toast.error("Gagal submit settlement", { description: error.message });
    } finally {
      setProcessing(false);
    }
  };

  // ==========================================
  // LOGIC 5: VERIFIKASI SETTLEMENT (OLEH FINANCE/GA)
  // ==========================================
  const handleVerifySettlement = async () => {
    if (!pc || !profile) return;
    setProcessing(true);
    try {
      const { error } = await supabase
        .from("petty_cash_requests")
        .update({
          status: "Settled",
          discussions: [
            ...(pc.discussions || []),
            {
              user_name: "Sistem",
              message: `Laporan Settlement telah diverifikasi dan diselesaikan oleh ${profile.nama} (${profile.department}).`,
              timestamp: new Date().toISOString(),
            },
          ],
          updated_at: new Date().toISOString(),
        })
        .eq("id", pc.id);

      if (error) throw error;
      toast.success("Settlement berhasil diverifikasi dan diselesaikan.");
      loadData();
    } catch (error: any) {
      toast.error("Gagal verifikasi settlement", {
        description: error.message,
      });
    } finally {
      setProcessing(false);
    }
  };

  // ==========================================
  // RENDER UI
  // ==========================================
  if (loading)
    return (
      <div className="flex justify-center items-center h-64">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  if (!pc)
    return (
      <div className="text-center py-10 text-muted-foreground">
        Data tidak ditemukan.
      </div>
    );

  // Cek Hak Akses
  const isCreator = profile?.id === pc.user_id;
  const isGAorFinance = ["General Affair", "Finance"].includes(
    profile?.department,
  );
  const myApprovalIndex = pc.approvals?.findIndex(
    (a: any) => a.userid === profile?.id && a.status === "pending",
  );
  const isMyTurn =
    myApprovalIndex !== -1 &&
    pc.approvals
      ?.slice(0, myApprovalIndex)
      .every((a: any) => a.status === "approved");

  // URL Dinamis untuk QR Code Cetak
  const qrUrl =
    typeof window !== "undefined"
      ? `https://api.qrserver.com/v1/create-qr-code/?size=150x150&data=${encodeURIComponent(window.location.href)}`
      : "";

  return (
    <Content>
      {/* HEADER BESERTA TOMBOL PRINT */}
      <div className="flex justify-between items-center mb-6 print:hidden">
        <Button variant="outline" size="sm" onClick={() => router.back()}>
          <ArrowLeft className="h-4 w-4 mr-2" /> Kembali
        </Button>
        {pc.status !== "Pending Validation" && (
          <Button variant="secondary" size="sm" onClick={() => window.print()}>
            <Printer className="h-4 w-4 mr-2" /> Cetak Dokumen
          </Button>
        )}
      </div>

      {/* STRUKTUR UTAMA (Ter-support untuk Print) */}
      <div className="grid grid-cols-1 xl:grid-cols-3 gap-6 items-start pb-10 print:block print:w-full">
        {/* ==================================== */}
        {/* KOLOM KIRI (Detail Data & Settlement) */}
        {/* ==================================== */}
        <div className="xl:col-span-2 space-y-6 print:w-full">
          {/* HEADER CETAK (Hanya Muncul Saat di-Print via CSS) */}
          <div className="hidden print:flex justify-between items-start border-b pb-6 mb-6">
            <div>
              <h1 className="text-2xl font-bold text-slate-900">
                PETTY CASH REQUEST
              </h1>
              <p className="text-slate-600">{pc.kode_pc}</p>
            </div>
            <Image
              width={20}
              height={20}
              src={qrUrl}
              alt="QR Code URL"
              className="w-20 h-20 border p-1"
            />
          </div>

          {/* CARD INFORMASI UTAMA */}
          <Card className="print:border-0 print:shadow-none">
            <CardHeader className="border-b bg-muted/20 pb-4 print:bg-transparent print:p-0 print:border-b-2 print:border-slate-800">
              <div className="flex justify-between items-center">
                <div>
                  <CardTitle className="text-lg flex items-center gap-2">
                    <ReceiptText className="h-5 w-5 text-primary print:text-black" />
                    Informasi Pengajuan
                  </CardTitle>
                </div>
                <Badge
                  className={`${PETTY_CASH_STATUS_COLORS[pc.status]} print:border print:text-black print:bg-white`}
                >
                  {pc.status}
                </Badge>
              </div>
            </CardHeader>
            <CardContent className="p-6 space-y-6 print:px-0">
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                <div className="space-y-1">
                  <span className="text-muted-foreground text-xs font-medium">
                    Pemohon
                  </span>
                  <p className="font-semibold">
                    {pc.users_with_profiles?.nama || "-"}
                  </p>
                </div>
                <div className="space-y-1">
                  <span className="flex items-center text-muted-foreground text-xs font-medium gap-1">
                    Tipe
                    <TooltipProvider>
                      <Tooltip>
                        <TooltipTrigger className="print:hidden">
                          <HelpCircle className="h-3 w-3" />
                        </TooltipTrigger>
                        <TooltipContent>
                          Reimburse (Diganti) atau Cash Advance (Kasbon di awal)
                        </TooltipContent>
                      </Tooltip>
                    </TooltipProvider>
                  </span>
                  <p className="font-semibold">{pc.type}</p>
                </div>
                <div className="space-y-1">
                  <span className="text-muted-foreground text-xs font-medium">
                    Tgl Dibutuhkan
                  </span>
                  <p className="font-medium flex items-center gap-1">
                    <CalendarDays className="h-3 w-3 text-muted-foreground print:hidden" />
                    {new Date(pc.needed_date).toLocaleDateString("id-ID")}
                  </p>
                </div>
                <div className="space-y-1">
                  <span className="flex items-center text-muted-foreground text-xs font-medium gap-1">
                    Cost Center
                    <TooltipProvider>
                      <Tooltip>
                        <TooltipTrigger className="print:hidden">
                          <HelpCircle className="h-3 w-3" />
                        </TooltipTrigger>
                        <TooltipContent>
                          Pusat Anggaran yang membiayai pengeluaran ini
                        </TooltipContent>
                      </Tooltip>
                    </TooltipProvider>
                  </span>
                  <p className="font-medium text-primary bg-primary/10 px-2 py-0.5 rounded w-fit print:bg-transparent print:px-0 print:text-black">
                    {pc.cost_centers?.name || "Belum Ditentukan"}
                  </p>
                </div>
              </div>

              <div className="bg-muted/30 p-4 rounded-lg border space-y-4 print:bg-transparent print:border-slate-300">
                <div>
                  <span className="text-muted-foreground text-xs font-medium block mb-1">
                    Nominal Pengajuan
                  </span>
                  <span className="text-2xl font-bold text-foreground">
                    {formatRupiah(pc.amount)}
                  </span>
                </div>
                <Separator className="print:bg-slate-300" />
                <div>
                  <span className="text-muted-foreground text-xs font-medium block mb-1">
                    Tujuan Penggunaan
                  </span>
                  <p className="text-sm whitespace-pre-wrap">{pc.purpose}</p>
                </div>
              </div>

              {/* LAMPIRAN AWAL (Sembunyikan saat print) */}
              {pc.attachments?.length > 0 && (
                <div className="space-y-2 pt-2 print:hidden">
                  <span className="text-muted-foreground text-xs font-medium block">
                    Lampiran Pengajuan Awal
                  </span>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                    {pc.attachments.map((file, idx) => (
                      <a
                        key={idx}
                        href={file.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="flex items-center gap-2 p-2 border rounded-md text-sm text-primary hover:bg-muted truncate"
                      >
                        <FileSignature className="h-4 w-4 shrink-0" />{" "}
                        {file.name}
                      </a>
                    ))}
                  </div>
                </div>
              )}
            </CardContent>
          </Card>

          {/* CARD HASIL SETTLEMENT (Jika pelaporan kasbon sudah dilakukan) */}
          {pc.actual_amount !== null && (
            <Card className="border-purple-200 shadow-sm print:border-slate-300">
              <CardHeader className="bg-purple-50/50 pb-4 border-b border-purple-100 print:bg-transparent print:border-slate-300">
                <CardTitle className="text-base flex items-center gap-2 text-purple-800 print:text-black">
                  <Wallet className="h-5 w-5 print:hidden" />
                  Laporan Settlement (Pemakaian Riil)
                </CardTitle>
              </CardHeader>
              <CardContent className="p-6 space-y-4 print:px-4">
                <div className="flex items-center justify-between p-4 bg-background border rounded-lg print:border-slate-300">
                  <div>
                    <span className="text-xs font-medium text-muted-foreground block mb-1">
                      Dana Terpakai Aktual
                    </span>
                    <span className="text-xl font-bold text-foreground">
                      {formatRupiah(pc.actual_amount)}
                    </span>
                  </div>
                  <div className="text-right">
                    <span className="text-xs font-medium text-muted-foreground block mb-1">
                      Selisih (Kembalian)
                    </span>
                    <span
                      className={`text-lg font-bold ${pc.amount - pc.actual_amount > 0 ? "text-green-600 print:text-black" : "text-muted-foreground print:text-black"}`}
                    >
                      {formatRupiah(pc.amount - pc.actual_amount)}
                    </span>
                  </div>
                </div>

                {pc.settlement_attachments?.length > 0 && (
                  <div className="space-y-2 pt-2 print:hidden">
                    <span className="text-muted-foreground text-xs font-medium block">
                      Bukti Nota Settlement
                    </span>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                      {pc.settlement_attachments.map((file, idx) => (
                        <a
                          key={idx}
                          href={file.url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="flex items-center gap-2 p-2 border border-purple-100 bg-purple-50/30 rounded-md hover:bg-purple-50 text-sm text-purple-700 truncate"
                        >
                          <ReceiptText className="h-4 w-4 shrink-0" />{" "}
                          {file.name}
                        </a>
                      ))}
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>
          )}

          {/* FORM INPUT SETTLEMENT (Hanya muncul untuk Pembuat jika status Cash Distributed) */}
          {isCreator &&
            pc.type === "Cash Advance" &&
            pc.status === "Cash Distributed" && (
              <Card className="border-blue-200 shadow-md print:hidden">
                <CardHeader className="bg-blue-50 pb-4 border-b border-blue-100">
                  <CardTitle className="text-base flex items-center gap-2 text-blue-800">
                    <Banknote className="h-5 w-5" />
                    Lakukan Laporan Settlement Kasbon
                  </CardTitle>
                  <CardDescription className="text-blue-600/80">
                    Dana kasbon telah Anda terima. Silakan laporkan nominal uang
                    yang benar-benar terpakai dan unggah bukti struknya di sini.
                  </CardDescription>
                </CardHeader>
                <CardContent className="p-6 space-y-4">
                  <div className="grid gap-2">
                    <Label>
                      Nominal Aktual Terpakai (Rp){" "}
                      <span className="text-red-500">*</span>
                    </Label>
                    <Input
                      type="number"
                      placeholder="Contoh: 145000"
                      value={actualAmount}
                      onChange={(e) => setActualAmount(e.target.value)}
                      min="0"
                    />
                    {actualAmount && (
                      <p className="text-xs text-muted-foreground mt-1">
                        Format: {formatRupiah(Number(actualAmount))}
                      </p>
                    )}
                  </div>

                  <div className="grid gap-2 pt-2">
                    <Label>
                      Unggah Bukti Transaksi Akhir{" "}
                      <span className="text-red-500">*</span>
                    </Label>
                    <div className="flex items-center gap-2">
                      <Input
                        type="file"
                        className="hidden"
                        id="settle-upload"
                        onChange={handleFileUpload}
                        disabled={uploading}
                      />
                      <Button asChild variant="outline" disabled={uploading}>
                        <label
                          htmlFor="settle-upload"
                          className="cursor-pointer"
                        >
                          {uploading ? (
                            <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                          ) : (
                            <UploadCloud className="h-4 w-4 mr-2" />
                          )}
                          Pilih File Nota
                        </label>
                      </Button>
                    </div>
                    {settlementAttachments.length > 0 && (
                      <div className="mt-2 space-y-2">
                        {settlementAttachments.map((file, idx) => (
                          <div
                            key={idx}
                            className="flex items-center justify-between p-2 bg-muted rounded-md text-sm border"
                          >
                            <span className="truncate max-w-[80%]">
                              {file.name}
                            </span>
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-6 w-6 text-red-500"
                              onClick={() => removeAttachment(idx)}
                            >
                              <X className="h-4 w-4" />
                            </Button>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>

                  <Button
                    className="w-full mt-4"
                    onClick={submitSettlement}
                    disabled={processing || uploading}
                  >
                    {processing ? (
                      <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    ) : (
                      <CheckCircle2 className="h-4 w-4 mr-2" />
                    )}
                    Submit Laporan Settlement
                  </Button>
                </CardContent>
              </Card>
            )}

          {/* KOMPONEN DISKUSI (Sembunyikan saat print) */}
          <div className="print:hidden">
            <PcDiscussionSection
              pcId={pc.id}
              initialDiscussions={pc.discussions}
            />
          </div>
        </div>

        {/* ==================================== */}
        {/* KOLOM KANAN (Aksi & Timeline) */}
        {/* ==================================== */}
        <div className="space-y-6 print:w-full print:mt-6">
          {/* PANEL AKSI 1: GA ROUTING (Hanya Muncul jika Pending Validation) */}
          {pc.status === "Pending Validation" && isGAorFinance && (
            <Card className="border-primary shadow-sm print:hidden">
              <CardHeader className="bg-primary/5 pb-4 border-b">
                <CardTitle className="text-base text-primary">
                  Validasi & Rute Approval
                </CardTitle>
                <CardDescription>
                  Pilih template persetujuan yang sesuai atau tolak pengajuan
                  ini jika tidak valid.
                </CardDescription>
              </CardHeader>
              <CardContent className="p-4 space-y-4">
                <div className="space-y-2">
                  <Label className="text-xs font-semibold">
                    Tentukan Jalur Approval:
                  </Label>
                  <Select
                    value={selectedTemplateId}
                    onValueChange={setSelectedTemplateId}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Pilih Template..." />
                    </SelectTrigger>
                    <SelectContent>
                      {templates.map((t) => (
                        <SelectItem key={t.id} value={String(t.id)}>
                          {t.template_name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="flex flex-col gap-2 pt-2 border-t">
                  <Button
                    className="w-full bg-primary hover:bg-primary/90"
                    onClick={handleGAValidation}
                    disabled={processing || !selectedTemplateId}
                  >
                    {processing ? (
                      <Loader2 className="animate-spin h-4 w-4 mr-2" />
                    ) : (
                      <CheckCircle2 className="h-4 w-4 mr-2" />
                    )}
                    Mulai Rute Approval
                  </Button>
                  <Button
                    variant="destructive"
                    className="w-full"
                    onClick={() => setIsRejectDialogOpen(true)}
                    disabled={processing}
                  >
                    <XCircle className="h-4 w-4 mr-2" /> Tolak Pengajuan
                  </Button>
                </div>
              </CardContent>
            </Card>
          )}

          {/* PANEL AKSI 2: APPROVER (Hanya Muncul jika In Approval & Gilirannya) */}
          {pc.status === "In Approval" && isMyTurn && (
            <Card className="border-primary shadow-sm print:hidden">
              <CardHeader className="bg-primary/5 pb-4 border-b">
                <CardTitle className="text-base text-primary">
                  Tindakan Anda
                </CardTitle>
              </CardHeader>
              <CardContent className="p-4 space-y-3">
                <Button
                  className="w-full bg-green-600 hover:bg-green-700 text-white"
                  onClick={handleApprove}
                  disabled={processing}
                >
                  {processing ? (
                    <Loader2 className="animate-spin h-4 w-4 mr-2" />
                  ) : (
                    <CheckCircle2 className="h-4 w-4 mr-2" />
                  )}
                  Setujui Dokumen
                </Button>
                <Button
                  variant="destructive"
                  className="w-full"
                  onClick={() => setIsRejectDialogOpen(true)}
                  disabled={processing}
                >
                  <XCircle className="h-4 w-4 mr-2" /> Tolak & Beri Alasan
                </Button>
              </CardContent>
            </Card>
          )}

          {/* PANEL AKSI 3: FINANCE VERIFY SETTLEMENT (Hanya Muncul jika Pending Settlement) */}
          {pc.status === "Pending Settlement" && isGAorFinance && (
            <Card className="border-purple-200 shadow-sm print:hidden">
              <CardHeader className="bg-purple-50 pb-4 border-b border-purple-100">
                <CardTitle className="text-base text-purple-800">
                  Verifikasi Settlement
                </CardTitle>
              </CardHeader>
              <CardContent className="p-4">
                <Button
                  className="w-full bg-purple-600 hover:bg-purple-700 text-white"
                  onClick={handleVerifySettlement}
                  disabled={processing}
                >
                  {processing ? (
                    <Loader2 className="animate-spin h-4 w-4 mr-2" />
                  ) : (
                    <CheckCircle2 className="h-4 w-4 mr-2" />
                  )}
                  Tandai Selesai (Settled)
                </Button>
              </CardContent>
            </Card>
          )}

          {/* TIMELINE APPROVAL (Bentuk Vertikal di Web, Bentuk Kotak TTD di Kertas) */}
          <Card className="print:border-0 print:shadow-none">
            <CardHeader className="pb-4 border-b print:border-b-2 print:border-black print:px-0">
              <CardTitle className="text-base flex items-center gap-2">
                <Clock className="h-4 w-4 text-muted-foreground print:hidden" />
                Jalur Persetujuan
              </CardTitle>
            </CardHeader>
            <CardContent className="p-4 print:px-0">
              {pc.approvals?.length > 0 ? (
                <div className="space-y-4 print:flex print:flex-wrap print:gap-8 print:space-y-0">
                  {pc.approvals.map((log: any, idx: number) => (
                    <div
                      key={idx}
                      className="flex flex-col border rounded-md p-3 print:border-0 print:border-t-2 print:border-black print:rounded-none print:w-40 print:text-center print:pt-16"
                    >
                      <span className="text-sm font-bold text-slate-800">
                        {log.nama}
                      </span>
                      <span className="text-xs text-muted-foreground">
                        {log.department}
                      </span>
                      <div className="mt-2 print:hidden">
                        {log.status === "approved" ? (
                          <Badge className="bg-green-100 text-green-700">
                            Approved
                          </Badge>
                        ) : log.status === "rejected" ? (
                          <Badge variant="destructive">Rejected</Badge>
                        ) : (
                          <Badge variant="secondary">Menunggu</Badge>
                        )}
                      </div>
                      {/* Di kertas print, status dicetak sebagai teks */}
                      <span className="hidden print:block mt-1 text-[10px] uppercase font-bold tracking-widest">
                        {log.status}
                      </span>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-sm text-muted-foreground italic">
                  Menunggu penetapan jalur dari GA.
                </p>
              )}
            </CardContent>
          </Card>
        </div>
      </div>

      {/* ==================================== */}
      {/* DIALOG ALASAN REJECT */}
      {/* ==================================== */}
      <Dialog open={isRejectDialogOpen} onOpenChange={setIsRejectDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="text-red-600 flex items-center gap-2">
              <XCircle className="h-5 w-5" /> Tolak Pengajuan
            </DialogTitle>
            <DialogDescription>
              Anda wajib memberikan alasan mengapa pengajuan Petty Cash ini
              ditolak. Alasan akan tercatat permanen di log diskusi.
            </DialogDescription>
          </DialogHeader>
          <Textarea
            placeholder="Ketik alasan penolakan di sini..."
            rows={4}
            value={rejectReason}
            onChange={(e) => setRejectReason(e.target.value)}
          />
          <DialogFooter className="pt-2">
            <Button
              variant="outline"
              onClick={() => setIsRejectDialogOpen(false)}
            >
              Batal
            </Button>
            <Button
              variant="destructive"
              onClick={handleRejectSubmit}
              disabled={processing || !rejectReason.trim()}
            >
              {processing ? (
                <Loader2 className="animate-spin h-4 w-4 mr-2" />
              ) : (
                <X className="h-4 w-4 mr-2" />
              )}
              Konfirmasi Tolak
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Content>
  );
}
