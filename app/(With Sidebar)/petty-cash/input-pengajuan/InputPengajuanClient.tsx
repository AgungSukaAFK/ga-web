// src/app/(With Sidebar)/petty-cash/input-pengajuan/InputPengajuanClient.tsx
//
// Form "Input Pengajuan" Petty Cash - alur BARU berbasis item (barang dari
// katalog petty_cash_barang atau manual), terpisah dari /petty-cash/buat
// (alur lama lump-sum Reimbursement/Cash Advance). Begitu disubmit, jalur
// approval-nya OTOMATIS diambil dari Template Approval Petty Cash sesuai
// departemen requester (lihat services/pcApprovalTemplateService.ts).
//
// COA (lihat PcItemsEditor, components/petty-cash/) - requester non-Lourdes
// dikunci ke company sendiri (coaMode="locked", combobox katalog otomatis
// cuma nampilin barang yang coa-nya memuat company itu). Akun Lourdes wajib
// pilih SATU COA (GMI/GIS) dulu utk SELURUH pengajuan ini (lourdesCoa di
// bawah) SEBELUM bisa nambah barang - bukan per baris lagi - biar konsisten
// sama requester company lain & combobox katalognya ikut terfilter ke COA
// yang dipilih itu.

"use client";

import { useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Content } from "@/components/content";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { createClient } from "@/lib/supabase/client";
import { uploadAttachmentDirect } from "@/lib/uploadDirect";
import {
  getAttachmentSizeError,
  getUploadErrorMessage,
} from "@/lib/attachments";
import { toast } from "sonner";
import { createPettyCashPengajuan } from "@/services/pettyCashPengajuanService";
import { fetchPengajuanTemplateById } from "@/services/pettyCashPengajuanTemplateService";
import { resolveAutoBudget } from "@/services/pettyCashBudgetService";
import { PettyCashBudget, PettyCashPengajuanItem } from "@/type";
import {
  PcItemsEditor,
  hasUnresolvedCoa,
} from "@/components/petty-cash/PcItemsEditor";
import { PcCoaBreakdown } from "@/components/petty-cash/PcCoaBreakdown";
import { getSelectableWeeksOfCurrentMonth } from "@/lib/weekOfMonth";
import { formatCurrency, getLocalDateString } from "@/lib/utils";
import {
  Loader2,
  Save,
  Package,
  UploadCloud,
  X,
  Info,
  UserCircle,
  CalendarClock,
} from "lucide-react";

export default function InputPengajuanClient() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const templateId = searchParams.get("template");
  const supabase = createClient();

  const [profile, setProfile] = useState<{
    company: string;
    department: string;
    nama: string;
    lokasi: string | null;
  } | null>(null);

  const [neededDate, setNeededDate] = useState(getLocalDateString());
  // Batas bawah "Tanggal Dibutuhkan" - HARI INI menurut jam lokal device
  // requester (bukan UTC/server), lihat komentar getLocalDateString
  // (lib/utils.ts). Dicek ulang tiap menit supaya kalau form ini dibiarkan
  // terbuka lewat tengah malam lokal, batasnya otomatis maju ke hari
  // berikutnya tanpa perlu refresh halaman.
  const [minDate, setMinDate] = useState(getLocalDateString());
  useEffect(() => {
    const interval = setInterval(
      () => setMinDate(getLocalDateString()),
      60_000,
    );
    return () => clearInterval(interval);
  }, []);
  // Kalau tengah malam lokal lewat sementara form ini terbuka, tanggal yang
  // sudah dipilih requester ikut jadi backdate - majukan otomatis ke hari
  // baru daripada baru ketahuan pas submit.
  useEffect(() => {
    setNeededDate((prev) => (prev < minDate ? minDate : prev));
  }, [minDate]);
  const selectableWeeks = getSelectableWeeksOfCurrentMonth();
  const [weekOfMonth, setWeekOfMonth] = useState<number | "">(
    selectableWeeks[0] ?? "",
  );
  const [notes, setNotes] = useState("");
  const [items, setItems] = useState<PettyCashPengajuanItem[]>([]);
  const [attachments, setAttachments] = useState<
    { url: string; name: string }[]
  >([]);

  const [loading, setLoading] = useState(false);
  const [uploading, setUploading] = useState(false);

  useEffect(() => {
    const fetchInitialData = async () => {
      try {
        const {
          data: { user },
        } = await supabase.auth.getUser();
        if (!user) throw new Error("User tidak terautentikasi.");

        const { data: userProfile, error } = await supabase
          .from("profiles")
          .select("company, department, nama, lokasi")
          .eq("id", user.id)
          .single();
        if (error) throw error;
        setProfile(userProfile);
      } catch (error: any) {
        toast.error("Gagal memuat data awal", { description: error.message });
      }
    };
    fetchInitialData();
  }, []);

  // Preview budget yang BAKAL auto-terisi sesuai departemen & site (resolusi
  // sebenarnya terjadi lagi di createPettyCashPengajuan saat submit, ini
  // cuma tampilan transparansi ke requester sebelum kirim) - null = belum
  // ada budget aktif utk kombinasi ini (TIDAK memblokir submit, lihat
  // komentar resolveAutoBudget, services/pettyCashBudgetService.ts).
  const [resolvedBudget, setResolvedBudget] = useState<PettyCashBudget | null>(
    null,
  );
  useEffect(() => {
    if (!profile?.department) return;
    resolveAutoBudget(profile.department, profile.lokasi ?? null)
      .then(setResolvedBudget)
      .catch(() => setResolvedBudget(null));
  }, [profile?.department, profile?.lokasi]);

  const isLourdes = profile?.company === "LOURDES";
  // COA (GMI/GIS) yang berlaku utk SELURUH pengajuan ini - cuma dipilih
  // akun Lourdes (lihat komentar di atas file ini). Reset daftar barang
  // begitu dipilih ulang lewat `key={lourdesCoa}` di PcItemsEditor -
  // barang yang sudah ditambah bisa jadi tidak relevan lagi dengan COA
  // baru, jadi dianggap sebagai pengajuan baru daripada disinkron manual.
  const [lourdesCoa, setLourdesCoa] = useState<"GMI" | "GIS" | null>(null);
  const totalAmount = items.reduce((sum, it) => sum + it.subtotal, 0);

  // Terapkan Template Pengajuan (?template=<id>, lihat
  // PettyCashPengajuanTemplateClient.tsx) - `coa` tiap item template
  // SENGAJA diabaikan di sini, diresolusi ulang ke currentLockedCoa di
  // bawah pas dioper sebagai initialItems ke PcItemsEditor (lihat komentar
  // di type/index.ts: COA tidak boleh dibekukan dari saat template dibuat).
  const [templateItems, setTemplateItems] = useState<PettyCashPengajuanItem[]>(
    [],
  );
  const [templateLoading, setTemplateLoading] = useState(!!templateId);

  useEffect(() => {
    if (!templateId) return;
    setTemplateLoading(true);
    fetchPengajuanTemplateById(Number(templateId))
      .then((tpl) => {
        setTemplateItems(tpl.items || []);
        toast.success(
          `Template "${tpl.nama_template}" diterapkan - ${
            tpl.items?.length ?? 0
          } barang dimuat.`,
        );
      })
      .catch((error: any) => {
        toast.error("Gagal memuat template", { description: error.message });
      })
      .finally(() => setTemplateLoading(false));
  }, [templateId]);

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const sizeError = getAttachmentSizeError(file);
    if (sizeError) {
      return toast.error("Ukuran file terlalu besar", {
        description: sizeError,
      });
    }

    setUploading(true);
    try {
      const fileExt = file.name.split(".").pop();
      const fileName = `${Date.now()}-${Math.random().toString(36).substring(2)}.${fileExt}`;
      const filePath = `petty-cash-pengajuan/${fileName}`;

      const result = await uploadAttachmentDirect(file, filePath);
      if (!result.success) throw new Error(result.message);

      setAttachments((prev) => [...prev, { url: result.url, name: file.name }]);
      toast.success("Lampiran berhasil diunggah");
    } catch (error: any) {
      toast.error("Gagal mengunggah file", {
        description: getUploadErrorMessage(error),
      });
    } finally {
      setUploading(false);
      e.target.value = "";
    }
  };

  const removeAttachment = (index: number) =>
    setAttachments((prev) => prev.filter((_, i) => i !== index));

  const handleSubmit = async () => {
    // Dicek ulang pakai jam lokal SAAT INI (bukan minDate yang bisa sedikit
    // basi kalau interval-nya belum tick) - jaga-jaga native date picker-nya
    // dilewati (browser lama/aneh) atau tab dibiarkan terbuka lewat tengah
    // malam lokal persis saat submit.
    if (neededDate < getLocalDateString()) {
      return toast.error(
        "Tanggal Dibutuhkan tidak boleh tanggal yang sudah lewat.",
      );
    }
    if (isLourdes && !lourdesCoa) {
      return toast.error("Pilih COA (GMI/GIS) untuk pengajuan ini dulu.");
    }
    if (items.length === 0) {
      return toast.error("Tambahkan minimal 1 barang.");
    }
    if (items.some((it) => !it.part_name.trim())) {
      return toast.error("Nama barang wajib diisi untuk semua baris.");
    }
    if (items.some((it) => !it.qty || it.qty <= 0)) {
      return toast.error("Qty setiap barang wajib diisi dan lebih dari 0.");
    }
    if (hasUnresolvedCoa(items)) {
      return toast.error(
        "Setiap barang wajib punya COA (GMI/GIS) - lengkapi dulu baris yang belum dipilih.",
      );
    }
    if (!weekOfMonth) {
      return toast.error("Pilih minggu ke berapa dana ini dibutuhkan.");
    }
    if (!profile?.company || !profile?.department) {
      return toast.error("Data profil (Company/Departemen) tidak lengkap.");
    }

    setLoading(true);
    try {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) throw new Error("Sesi login berakhir.");

      const newPengajuan = await createPettyCashPengajuan(
        {
          company_code: profile.company,
          department: profile.department,
          needed_date: neededDate,
          week_of_month: weekOfMonth,
          site: profile.lokasi ?? null,
          notes,
          items,
          attachments,
        },
        user.id,
      );

      toast.success(
        `Pengajuan ${newPengajuan.kode_pengajuan} berhasil dikirim dan masuk jalur approval.`,
      );
      router.push("/petty-cash");
    } catch (error: any) {
      toast.error("Gagal mengirim pengajuan", { description: error.message });
    } finally {
      setLoading(false);
    }
  };

  return (
    <Content
      title="Input Pengajuan Petty Cash"
      description="Ajukan kebutuhan barang Petty Cash - pilih dari katalog atau tambah manual."
    >
      <div className="grid grid-cols-1 xl:grid-cols-3 gap-6 pb-10 items-start">
        {/* KOLOM KIRI: FORM UTAMA */}
        <div className="xl:col-span-2 space-y-6">
          <Card>
            <CardHeader className="border-b bg-muted/20 pb-4">
              <CardTitle className="text-lg flex items-center gap-2">
                <Package className="h-5 w-5 text-primary" />
                Detail Pengajuan
              </CardTitle>
              <CardDescription>
                Tanggal dibutuhkan, minggu ke berapa, dan catatan tambahan
                (opsional).
              </CardDescription>
            </CardHeader>
            <CardContent className="p-6 space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="space-y-2">
                  <Label>
                    Tanggal Dibutuhkan <span className="text-red-500">*</span>
                  </Label>
                  <Input
                    type="date"
                    value={neededDate}
                    min={minDate}
                    onChange={(e) => setNeededDate(e.target.value)}
                  />
                </div>
                <div className="space-y-2">
                  <Label className="flex items-center gap-1.5">
                    <CalendarClock className="h-3.5 w-3.5" />
                    Minggu ke- (bulan ini){" "}
                    <span className="text-red-500">*</span>
                  </Label>
                  <Select
                    value={weekOfMonth ? String(weekOfMonth) : ""}
                    onValueChange={(val) => setWeekOfMonth(Number(val))}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Pilih minggu" />
                    </SelectTrigger>
                    <SelectContent>
                      {selectableWeeks.map((w) => (
                        <SelectItem key={w} value={String(w)}>
                          Minggu ke-{w}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <p className="text-xs text-muted-foreground">
                    Cuma minggu ini atau minggu berikutnya di bulan berjalan -
                    minggu yang sudah lewat tidak bisa dipilih.
                  </p>
                </div>
              </div>
              <div className="space-y-2">
                <Label>
                  Catatan Tambahan{" "}
                  <span className="text-xs font-normal text-muted-foreground">
                    (Opsional)
                  </span>
                </Label>
                <Textarea
                  placeholder="Konteks/keterangan tambahan untuk pengajuan ini..."
                  rows={3}
                  className="resize-none"
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                />
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="border-b bg-muted/20 pb-4">
              <CardTitle className="text-lg flex items-center gap-2">
                <Package className="h-5 w-5 text-primary" />
                Daftar Barang <span className="text-red-500">*</span>
              </CardTitle>
              <CardDescription>
                Cari dari katalog Barang Petty Cash, atau tambah barang manual
                kalau belum ada di katalog.
                {isLourdes &&
                  " Pilih dulu COA (GMI/GIS) untuk pengajuan ini - katalog barang yang muncul ikut COA yang dipilih."}
              </CardDescription>
            </CardHeader>
            <CardContent className="p-6 space-y-4">
              {isLourdes && (
                <div className="space-y-2 max-w-[220px]">
                  <Label>
                    COA Pengajuan <span className="text-red-500">*</span>
                  </Label>
                  <Select
                    value={lourdesCoa ?? ""}
                    onValueChange={(val) =>
                      setLourdesCoa(val as "GMI" | "GIS")
                    }
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Pilih GMI/GIS" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="GMI">GMI</SelectItem>
                      <SelectItem value="GIS">GIS</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              )}
              {templateLoading ? (
                <p className="text-sm text-muted-foreground italic flex items-center gap-2">
                  <Loader2 className="h-4 w-4 animate-spin" /> Memuat
                  template...
                </p>
              ) : isLourdes && !lourdesCoa ? (
                <p className="text-sm text-muted-foreground italic">
                  Pilih COA di atas dulu sebelum menambahkan barang.
                </p>
              ) : (
                <PcItemsEditor
                  key={`${isLourdes ? lourdesCoa : "fixed"}-${templateId ?? "blank"}`}
                  initialItems={templateItems.map((it) => ({
                    ...it,
                    coa: isLourdes
                      ? lourdesCoa
                      : ((profile?.company as "GMI" | "GIS" | undefined) ??
                        null),
                    subtotal: it.qty * it.unit_price,
                  }))}
                  onChange={setItems}
                  coaMode="locked"
                  lockedCoa={
                    isLourdes
                      ? lourdesCoa
                      : ((profile?.company as "GMI" | "GIS" | undefined) ??
                        null)
                  }
                  coaSearchFilter={
                    isLourdes
                      ? lourdesCoa
                      : ((profile?.company as "GMI" | "GIS" | undefined) ??
                        null)
                  }
                />
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="border-b bg-muted/20 pb-4">
              <CardTitle className="text-lg">
                Lampiran{" "}
                <span className="text-xs font-normal text-muted-foreground">
                  (Opsional)
                </span>
              </CardTitle>
              <CardDescription>
                Referensi pendukung, misal quotation/link produk.
              </CardDescription>
            </CardHeader>
            <CardContent className="p-6 space-y-4">
              <div className="p-4 border-2 border-dashed rounded-lg bg-muted/10 transition-colors hover:bg-muted/30">
                <div className="flex flex-col sm:flex-row items-center justify-between gap-4">
                  <div className="text-sm text-muted-foreground text-center sm:text-left">
                    <p className="font-medium text-foreground">
                      Upload Bukti Pendukung
                    </p>
                    <p className="text-xs">Format: JPG, PNG, PDF. Maks: 5MB.</p>
                  </div>
                  <Input
                    type="file"
                    className="hidden"
                    id="pengajuan-file-upload"
                    onChange={handleFileUpload}
                    disabled={uploading}
                  />
                  <Button
                    asChild
                    variant="outline"
                    className="cursor-pointer shrink-0"
                    disabled={uploading}
                  >
                    <label htmlFor="pengajuan-file-upload">
                      {uploading ? (
                        <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                      ) : (
                        <UploadCloud className="h-4 w-4 mr-2" />
                      )}
                      {uploading ? "Mengunggah..." : "Pilih File"}
                    </label>
                  </Button>
                </div>
              </div>

              {attachments.length > 0 && (
                <div className="grid gap-2">
                  {attachments.map((file, index) => (
                    <div
                      key={index}
                      className="flex items-center justify-between p-3 bg-background border rounded-md shadow-sm"
                    >
                      <a
                        href={file.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-sm font-medium text-primary hover:underline truncate max-w-[85%]"
                      >
                        {file.name}
                      </a>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8 text-destructive hover:text-destructive/80 hover:bg-destructive/10"
                        onClick={() => removeAttachment(index)}
                      >
                        <X className="h-4 w-4" />
                      </Button>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>

          <div className="flex justify-end gap-3">
            <Button
              variant="outline"
              onClick={() => router.back()}
              disabled={loading}
            >
              Batal
            </Button>
            <Button onClick={handleSubmit} disabled={loading}>
              {loading ? (
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              ) : (
                <Save className="h-4 w-4 mr-2" />
              )}
              Kirim Pengajuan
            </Button>
          </div>
        </div>

        {/* KOLOM KANAN: PANEL INFO */}
        <div className="space-y-6">
          <Card>
            <CardHeader className="pb-3 border-b bg-muted/20">
              <CardTitle className="text-base flex items-center gap-2">
                <UserCircle className="h-5 w-5 text-muted-foreground" />
                Data Pemohon
              </CardTitle>
            </CardHeader>
            <CardContent className="p-4 text-sm space-y-4">
              <div>
                <p className="text-muted-foreground text-xs mb-1">
                  Nama Lengkap
                </p>
                <p className="font-semibold">{profile?.nama || "Memuat..."}</p>
              </div>
              <div>
                <p className="text-muted-foreground text-xs mb-1">Departemen</p>
                <p className="font-semibold">{profile?.department || "-"}</p>
              </div>
              <div>
                <p className="text-muted-foreground text-xs mb-1">
                  Perusahaan (Company)
                </p>
                <p className="font-semibold">{profile?.company || "-"}</p>
              </div>
              <div>
                <p className="text-muted-foreground text-xs mb-1">Site</p>
                <p className="font-semibold">{profile?.lokasi || "-"}</p>
              </div>
              <div>
                <p className="text-muted-foreground text-xs mb-1">Budget</p>
                {resolvedBudget ? (
                  <p className="font-semibold">
                    {resolvedBudget.name}{" "}
                    <span className="font-normal text-muted-foreground">
                      (Sisa {formatCurrency(resolvedBudget.current_budget)})
                    </span>
                  </p>
                ) : (
                  <p className="font-semibold text-muted-foreground">
                    Belum ada budget aktif utk departemen ini
                  </p>
                )}
              </div>
            </CardContent>
          </Card>

          {items.length > 0 && (
            <Card>
              <CardHeader className="pb-3 border-b bg-muted/20">
                <CardTitle className="text-base">Ringkasan</CardTitle>
              </CardHeader>
              <CardContent className="p-4 space-y-3">
                <div className="flex justify-between items-center">
                  <p className="text-sm text-muted-foreground">
                    Total Pengajuan
                  </p>
                  <p className="text-lg font-bold text-primary">
                    {formatCurrency(totalAmount)}
                  </p>
                </div>
                <PcCoaBreakdown items={items} />
              </CardContent>
            </Card>
          )}

          <Card className="bg-primary/5 border-primary/20">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm flex items-center gap-2 text-primary">
                <Info className="h-4 w-4" />
                Informasi Penting
              </CardTitle>
            </CardHeader>
            <CardContent className="text-xs text-muted-foreground space-y-3 pb-4">
              <p>
                Begitu dikirim, pengajuan{" "}
                <strong className="text-foreground">
                  otomatis masuk jalur approval
                </strong>{" "}
                sesuai Template Approval yang berlaku untuk departemen Anda -
                tidak perlu validasi manual GA.
              </p>
              <p>
                Barang yang belum ada di katalog bisa ditambahkan lewat{" "}
                <strong className="text-foreground">
                  &quot;Barang Manual&quot;
                </strong>
                , tapi kalau sering dipakai, minta GA menambahkannya ke
                katalog Barang Petty Cash.
              </p>
              <p>
                * Kalau departemen Anda belum punya Template Approval yang
                di-set, pengajuan tidak bisa dikirim - hubungi GA/Admin.
              </p>
            </CardContent>
          </Card>
        </div>
      </div>
    </Content>
  );
}
