// src/app/(With Sidebar)/petty-cash/input-pengajuan/InputPengajuanClient.tsx
//
// Form "Input Pengajuan" Petty Cash - alur BARU berbasis item (barang dari
// katalog petty_cash_barang atau manual), terpisah dari /petty-cash/buat
// (alur lama lump-sum Reimbursement/Cash Advance). Begitu disubmit, jalur
// approval-nya OTOMATIS diambil dari Template Approval Petty Cash sesuai
// departemen requester (lihat services/pcApprovalTemplateService.ts).
//
// Company baris item (field `coa`, lihat PcItemsEditor,
// components/petty-cash/) - requester non-Lourdes dikunci ke company sendiri
// (coaMode="locked", combobox katalog otomatis cuma nampilin barang yang
// COA-nya terisi di company itu). Akun Lourdes wajib pilih SATU company
// (GMI/GIS) dulu utk SELURUH pengajuan ini (lourdesCoa di bawah) SEBELUM
// bisa nambah barang - bukan per baris lagi - biar konsisten sama requester
// company lain & combobox katalognya ikut terfilter ke company itu.
//
// `?ulang=<id>` = "Ajukan Ulang" Pengajuan yang ditolak: barang, catatan, &
// lampiran Pengajuan lama dimuat ke form, requester tinggal memperbaiki lalu
// mengirimnya sbg Pengajuan BARU (kode & jalur approval baru - Pengajuan lama
// tetap "Rejected" sbg riwayat). Tanggal & minggu dibutuhkan diisi ulang.

"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { format } from "date-fns";
import { id as localeId } from "date-fns/locale";
import { Content } from "@/components/content";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { DatePicker } from "@/components/date-picker";
import {
  FormSummaryCheck,
  FormSummaryLayout,
} from "@/components/form-summary-panel";
import {
  RichMentionEditor,
  RichMentionEditorHandle,
} from "@/components/rich-mention-editor";
import {
  extractPlainText,
  parseRichValue,
  stringifyRichContent,
} from "@/lib/rich-content";
import {
  SearchableSelect,
  SearchableSelectTrigger,
  SearchableSelectValue,
  SearchableSelectContent,
  SearchableSelectItem,
} from "@/components/ui/searchable-select";
import { createClient } from "@/lib/supabase/client";
import { uploadAttachmentDirect } from "@/lib/uploadDirect";
import {
  getAttachmentSizeError,
  getUploadErrorMessage,
} from "@/lib/attachments";
import { toast } from "@/lib/toast";
import {
  checkPengajuanEligibility,
  createPettyCashPengajuan,
  fetchPengajuanById,
  PengajuanEligibility,
} from "@/services/pettyCashPengajuanService";
import { fetchPengajuanTemplateById } from "@/services/pettyCashPengajuanTemplateService";
import {
  fetchPettyCashBarangCoaByIds,
  pettyCashBarangCoaFor,
} from "@/services/pettyCashBarangService";
import { resolveAutoBudget } from "@/services/pettyCashBudgetService";
import {
  PettyCashBudget,
  PettyCashPengajuan,
  PettyCashPengajuanItem,
} from "@/type";
import {
  PcItemsEditor,
  hasUnresolvedCoa,
} from "@/components/petty-cash/PcItemsEditor";
import { PcCoaBreakdown } from "@/components/petty-cash/PcCoaBreakdown";
import { PcPengajuanTemplatePicker } from "@/components/petty-cash/PcPengajuanTemplatePicker";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import {
  getSelectableWeeksOfCurrentMonth,
  getWeekOfMonth,
} from "@/lib/weekOfMonth";
import { cn, formatCurrency, getLocalDateString } from "@/lib/utils";
import {
  Loader2,
  Send,
  Info,
  CalendarClock,
  AlertTriangle,
  Building2,
  FileStack,
  Paperclip,
  Trash2,
} from "lucide-react";

// Default value "Minggu ke-" = minggu SETELAH minggu tempat Tanggal
// Dibutuhkan jatuh (bukan minggu yang sama) - cuma nilai default yang
// otomatis mengikuti tanggal, requester tetap bebas mengubahnya manual
// lewat Select di bawah (lihat weekManuallySet).
const getDefaultWeekForDate = (dateStr: string): number | "" => {
  const weeks = getSelectableWeeksOfCurrentMonth();
  if (weeks.length === 0) return "";
  const date = new Date(`${dateStr}T00:00:00`);
  if (Number.isNaN(date.getTime())) return weeks[0];
  const candidate = getWeekOfMonth(date) + 1;
  return Math.min(Math.max(candidate, weeks[0]), weeks[weeks.length - 1]);
};

export default function InputPengajuanClient() {
  const notesEditorRef = useRef<RichMentionEditorHandle>(null);
  const router = useRouter();
  const searchParams = useSearchParams();
  const templateId = searchParams.get("template");
  const ulangId = searchParams.get("ulang");
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
  const [weekOfMonth, setWeekOfMonth] = useState<number | "">(() =>
    getDefaultWeekForDate(getLocalDateString()),
  );
  // Requester bisa ganti manual weekOfMonth-nya kapan saja lewat Select di
  // bawah - begitu disentuh, berhenti auto-update walau neededDate berubah
  // lagi, supaya pilihan manual tidak ketiban ulang oleh default.
  const [weekManuallySet, setWeekManuallySet] = useState(false);
  useEffect(() => {
    if (weekManuallySet) return;
    setWeekOfMonth(getDefaultWeekForDate(neededDate));
  }, [neededDate, weekManuallySet]);
  const [notes, setNotes] = useState("");
  const [items, setItems] = useState<PettyCashPengajuanItem[]>([]);
  const [attachments, setAttachments] = useState<
    { url: string; name: string }[]
  >([]);

  const [loading, setLoading] = useState(false);
  const [uploading, setUploading] = useState(false);

  // Cek kelayakan SEBELUM requester mulai mengisi form (bukan baru ketahuan
  // sebagai error setelah form diisi penuh & disubmit) - lihat komentar
  // checkPengajuanEligibility, services/pettyCashPengajuanService.ts.
  const [eligibility, setEligibility] = useState<PengajuanEligibility | null>(
    null,
  );
  const [eligibilityLoading, setEligibilityLoading] = useState(true);

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

        const eligibilityResult = await checkPengajuanEligibility(
          user.id,
          userProfile.department,
          userProfile.lokasi ?? null,
          userProfile.company,
        );
        setEligibility(eligibilityResult);
      } catch (error: any) {
        toast.error("Gagal memuat data awal", { description: error.message });
      } finally {
        setEligibilityLoading(false);
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
    if (!profile?.department || !profile?.company) return;
    resolveAutoBudget(profile.department, profile.lokasi ?? null, profile.company)
      .then(setResolvedBudget)
      .catch(() => setResolvedBudget(null));
  }, [profile?.department, profile?.lokasi, profile?.company]);

  const isLourdes = profile?.company === "LOURDES";
  // COA (GMI/GIS) yang berlaku utk SELURUH pengajuan ini - cuma dipilih
  // akun Lourdes (lihat komentar di atas file ini). Reset daftar barang
  // begitu dipilih ulang lewat `key={lourdesCoa}` di PcItemsEditor -
  // barang yang sudah ditambah bisa jadi tidak relevan lagi dengan COA
  // baru, jadi dianggap sebagai pengajuan baru daripada disinkron manual.
  const [lourdesCoa, setLourdesCoa] = useState<"GMI" | "GIS" | null>(null);
  const itemsCoa: "GMI" | "GIS" | null = isLourdes
    ? lourdesCoa
    : ((profile?.company as "GMI" | "GIS" | undefined) ?? null);
  const totalAmount = items.reduce((sum, it) => sum + it.subtotal, 0);

  // Terapkan Template Pengajuan (?template=<id>, lihat
  // PettyCashPengajuanTemplateClient.tsx) - `coa` tiap item template
  // SENGAJA diabaikan di sini, diresolusi ulang ke currentLockedCoa di
  // bawah pas dioper sebagai initialItems ke PcItemsEditor (lihat komentar
  // di type/index.ts: COA tidak boleh dibekukan dari saat template dibuat).
  const [templateItems, setTemplateItems] = useState<PettyCashPengajuanItem[]>(
    [],
  );
  // COA katalog per company tiap barang di templateItems - `category` baris
  // diresolusi ulang ke COA itemsCoa (sama alasannya dengan `coa` di atas).
  // Gagal ambil = pakai category tersimpan apa adanya.
  const [templateCatalogCoa, setTemplateCatalogCoa] = useState<
    Awaited<ReturnType<typeof fetchPettyCashBarangCoaByIds>>
  >({});
  const loadTemplateCatalogCoa = (items: PettyCashPengajuanItem[]) =>
    fetchPettyCashBarangCoaByIds(
      items.flatMap((it) => (it.barang_id ? [it.barang_id] : [])),
    )
      .catch(() => ({}))
      .then(setTemplateCatalogCoa);
  const [templateLoading, setTemplateLoading] = useState(!!templateId);
  const [appliedTemplateName, setAppliedTemplateName] = useState<
    string | null
  >(null);

  useEffect(() => {
    if (!templateId) return;
    setTemplateLoading(true);
    fetchPengajuanTemplateById(Number(templateId))
      .then(async (tpl) => {
        await loadTemplateCatalogCoa(tpl.items || []);
        setTemplateItems(tpl.items || []);
        setAppliedTemplateName(tpl.nama_template);
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

  // Ajukan Ulang (?ulang=<id>) - lihat komentar di atas file ini. Barang
  // lewat jalur yang sama dgn template (templateItems -> initialItems), COA
  // dibawa dari Pengajuan lama supaya akun Lourdes tidak perlu memilih ulang.
  const [ulangSource, setUlangSource] = useState<PettyCashPengajuan | null>(
    null,
  );
  const [ulangLoading, setUlangLoading] = useState(!!ulangId);

  useEffect(() => {
    if (!ulangId) return;
    setUlangLoading(true);
    (async () => {
      try {
        const {
          data: { user },
        } = await supabase.auth.getUser();
        const src = await fetchPengajuanById(Number(ulangId));
        if (src.user_id !== user?.id) {
          throw new Error("Pengajuan ini bukan milik Anda.");
        }
        if (src.status !== "Rejected") {
          throw new Error("Hanya Pengajuan yang ditolak yang bisa diajukan ulang.");
        }
        const coa = src.items?.find((it) => it.coa)?.coa ?? null;
        if (coa) setLourdesCoa(coa);
        await loadTemplateCatalogCoa(src.items || []);
        setTemplateItems(src.items || []);
        setNotes(src.notes || "");
        setAttachments(src.attachments || []);
        setUlangSource(src);
        toast.success(
          `Data dari ${src.kode_pengajuan} dimuat - perbaiki lalu kirim sebagai Pengajuan baru.`,
        );
      } catch (error: any) {
        toast.error("Gagal memuat Pengajuan yang ditolak", {
          description: error.message,
        });
      } finally {
        setUlangLoading(false);
      }
    })();
  }, [ulangId]);

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

  // "Pakai Template" - lewat ?template=<id> yang sama dgn tombol "Gunakan" di
  // halaman Template Pengajuan; param lain (mis. ?ulang=) dipertahankan.
  const applyTemplate = (id: number) => {
    const params = new URLSearchParams(searchParams.toString());
    params.set("template", String(id));
    router.replace(`/petty-cash/input-pengajuan?${params.toString()}`);
  };

  const handleSubmit = async () => {
    // Dicek ulang pakai jam lokal SAAT INI (bukan minDate yang bisa sedikit
    // basi kalau interval-nya belum tick) - jaga-jaga tab dibiarkan terbuka
    // lewat tengah malam lokal persis saat submit.
    if (neededDate < getLocalDateString()) {
      return toast.error(
        "Tanggal Dibutuhkan tidak boleh tanggal yang sudah lewat.",
      );
    }
    if (isLourdes && !lourdesCoa) {
      return toast.error("Pilih company (GMI/GIS) untuk pengajuan ini dulu.");
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
        "Setiap barang wajib punya company (GMI/GIS) - lengkapi dulu baris yang belum dipilih.",
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
      router.push("/petty-cash/pengajuan-saya");
    } catch (error: any) {
      toast.error("Gagal mengirim pengajuan", { description: error.message });
    } finally {
      setLoading(false);
    }
  };

  // Nilai "YYYY-MM-DD" diparse sebagai jam lokal (bukan UTC), sama dengan
  // getDefaultWeekForDate di atas.
  const neededDateValue = new Date(`${neededDate}T00:00:00`);
  const minDateValue = new Date(`${minDate}T00:00:00`);
  const calendarEndMonth = new Date(minDateValue.getFullYear() + 1, 11, 1);

  const notesText = extractPlainText(notes);
  const incompleteItemCount = items.filter(
    (it) => !it.part_name.trim() || !it.qty || it.qty <= 0 || !it.coa,
  ).length;

  const summaryChecks: FormSummaryCheck[] = [
    ...(isLourdes
      ? [
          {
            id: "company",
            label: "Company pengajuan",
            status: lourdesCoa ? "done" : "todo",
            value: lourdesCoa ?? undefined,
            hint: lourdesCoa ? undefined : "Pilih GMI atau GIS",
            targetId: "pc-field-company",
          } satisfies FormSummaryCheck,
        ]
      : []),
    {
      id: "tanggal",
      label: "Tanggal dibutuhkan",
      status: neededDate >= minDate ? "done" : "todo",
      value: format(neededDateValue, "dd MMM yyyy", { locale: localeId }),
      targetId: "pc-field-tanggal",
    },
    {
      id: "minggu",
      label: "Minggu ke-",
      status: weekOfMonth ? "done" : "todo",
      value: weekOfMonth ? `Minggu ke-${weekOfMonth}` : undefined,
      targetId: "pc-field-minggu",
    },
    {
      id: "items",
      label: "Daftar barang",
      status: items.length > 0 && incompleteItemCount === 0 ? "done" : "todo",
      value: items.length > 0 ? `${items.length} barang` : undefined,
      hint:
        items.length === 0
          ? "Minimal 1 barang"
          : incompleteItemCount > 0
            ? `${incompleteItemCount} barang belum lengkap (nama/qty/company)`
            : undefined,
      targetId: "pc-section-items",
    },
    {
      id: "catatan",
      label: "Catatan tambahan",
      status: notes ? "done" : "optional",
      value: notesText ? (
        <span className="font-normal text-muted-foreground">{notesText}</span>
      ) : undefined,
      targetId: "pc-field-catatan",
    },
    {
      id: "lampiran",
      label: "Lampiran",
      status: attachments.length > 0 ? "done" : "optional",
      value:
        attachments.length > 0 ? `${attachments.length} file` : undefined,
      targetId: "pc-section-attachments",
    },
  ];

  if (eligibilityLoading) {
    return (
      <Content title="Input Pengajuan Petty Cash">
        <div className="flex items-center justify-center h-64">
          <Loader2 className="h-6 w-6 animate-spin text-primary" />
        </div>
      </Content>
    );
  }

  if (eligibility && !eligibility.eligible) {
    return (
      <Content
        title="Input Pengajuan Petty Cash"
        description="Ajukan kebutuhan barang Petty Cash - pilih dari katalog atau tambah manual."
      >
        <Alert variant="destructive">
          <AlertTriangle className="h-4 w-4" />
          <AlertTitle>Belum bisa membuat Pengajuan baru</AlertTitle>
          <AlertDescription>
            <ul className="list-disc pl-4 space-y-1">
              {eligibility.reasons.map((reason, i) => (
                <li key={i}>{reason}</li>
              ))}
            </ul>
          </AlertDescription>
        </Alert>
        <div className="mt-4">
          <Button variant="outline" onClick={() => router.push("/petty-cash/pengajuan-saya")}>
            Kembali ke Pengajuan Saya
          </Button>
        </div>
      </Content>
    );
  }

  return (
    <FormSummaryLayout
      summary={{
        title: "Ringkasan Pengajuan",
        subtitle: [itemsCoa ?? profile?.company, profile?.department]
          .filter(Boolean)
          .join(" · "),
        checks: summaryChecks,
        submitLabel: "Kirim Pengajuan",
        submittingLabel: "Mengirim...",
        submitIcon: <Send className="mr-2 h-4 w-4" />,
        onSubmit: handleSubmit,
        submitting: loading,
        disabled: uploading || templateLoading || ulangLoading,
        children: (
          <div className="space-y-3">
            <div className="flex items-baseline justify-between gap-2">
              <span className="text-sm text-muted-foreground">
                Total pengajuan
              </span>
              <span className="text-lg font-bold tabular-nums">
                {formatCurrency(totalAmount)}
              </span>
            </div>
            <PcCoaBreakdown items={items} />
            <div className="flex items-baseline justify-between gap-2 text-sm">
              <span className="text-muted-foreground">Sisa budget</span>
              <span className="font-medium tabular-nums">
                {resolvedBudget
                  ? formatCurrency(resolvedBudget.current_budget)
                  : "-"}
              </span>
            </div>
          </div>
        ),
      }}
    >
      <Content
        title="Input Pengajuan Petty Cash"
        description="Ajukan kebutuhan barang Petty Cash. Setelah dikirim, pengajuan otomatis masuk jalur approval sesuai Template Approval departemen Anda."
      >
        <div className="grid grid-cols-12 gap-4 [&>*]:min-w-0">
          {ulangSource && (
            <Alert className="col-span-12">
              <Info className="h-4 w-4" />
              <AlertTitle>
                Mengajukan ulang {ulangSource.kode_pengajuan} yang ditolak
              </AlertTitle>
              <AlertDescription>
                <p>
                  Barang, catatan, dan lampiran sudah dimuat dari Pengajuan
                  lama. Perbaiki sesuai alasan penolakan (
                  <Link
                    href={`/petty-cash/pengajuan/${ulangSource.id}`}
                    target="_blank"
                    className="text-primary hover:underline"
                  >
                    lihat detail
                  </Link>
                  ), pilih ulang tanggal dibutuhkan, lalu kirim sebagai
                  Pengajuan baru.
                </p>
              </AlertDescription>
            </Alert>
          )}

          <div className="col-span-12 flex flex-col gap-2 rounded-lg border border-dashed p-3 sm:flex-row sm:items-center sm:justify-between">
            {appliedTemplateName ? (
              <div className="flex min-w-0 items-center gap-2 text-sm">
                <FileStack className="h-4 w-4 shrink-0 text-primary" />
                <span className="min-w-0 [overflow-wrap:anywhere]">
                  Menggunakan template <strong>{appliedTemplateName}</strong>.
                  Semua isian tetap bisa diedit.
                </span>
              </div>
            ) : (
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <FileStack className="h-4 w-4 shrink-0" />
                Pengajuan rutin? Pakai Template Pengajuan supaya tidak perlu
                input barang satu per satu.
              </div>
            )}
            <div className="flex shrink-0">
              <PcPengajuanTemplatePicker
                hasItems={items.length > 0}
                onSelect={applyTemplate}
              />
            </div>
          </div>

          {isLourdes && (
            <div
              id="pc-field-company"
              className="col-span-12 flex flex-col gap-2 rounded-md"
            >
              <Label className="flex items-center gap-2">
                <Building2 className="h-4 w-4 text-primary" />
                Company Pengajuan <span className="text-red-500">*</span>
              </Label>
              <div className="grid grid-cols-2 gap-3 [&>*]:min-w-0">
                {(["GMI", "GIS"] as const).map((company) => (
                  <button
                    key={company}
                    type="button"
                    onClick={() => setLourdesCoa(company)}
                    className={cn(
                      "py-4 rounded-lg border-2 font-bold text-lg transition-all",
                      lourdesCoa === company
                        ? "border-primary bg-primary/10 text-primary shadow-sm"
                        : "border-border hover:border-primary/40 text-muted-foreground",
                    )}
                  >
                    {company}
                  </button>
                ))}
              </div>
              <p className="text-xs text-muted-foreground">
                {lourdesCoa ? (
                  <>
                    Pengajuan ini dicatat untuk company{" "}
                    <strong>{lourdesCoa}</strong> dan katalog barang mengikuti
                    company tersebut.{" "}
                  </>
                ) : (
                  "Katalog barang yang muncul mengikuti company yang dipilih. "
                )}
                Mengganti company akan mengosongkan daftar barang.
              </p>
            </div>
          )}

          <div className="flex flex-col gap-2 col-span-12 md:col-span-6">
            <Label>Nama Pemohon</Label>
            <Input readOnly disabled value={profile?.nama || "Memuat..."} />
          </div>
          <div className="flex flex-col gap-2 col-span-12 md:col-span-6">
            <Label>Budget</Label>
            <Input
              readOnly
              disabled
              value={
                resolvedBudget
                  ? `${resolvedBudget.name} (Sisa ${formatCurrency(resolvedBudget.current_budget)})`
                  : "Belum ada budget aktif untuk departemen ini"
              }
            />
          </div>
          <div className="flex flex-col gap-2 col-span-12 md:col-span-4">
            <Label>Perusahaan</Label>
            <Input readOnly disabled value={profile?.company || "Memuat..."} />
          </div>
          <div className="flex flex-col gap-2 col-span-12 md:col-span-4">
            <Label>Departemen</Label>
            <Input
              readOnly
              disabled
              value={profile?.department || "Memuat..."}
            />
          </div>
          <div className="flex flex-col gap-2 col-span-12 md:col-span-4">
            <Label>Site</Label>
            <Input readOnly disabled value={profile?.lokasi || "-"} />
          </div>

          <div
            id="pc-field-tanggal"
            className="flex flex-col gap-2 col-span-12 md:col-span-6 rounded-md"
          >
            <Label>
              Tanggal Dibutuhkan <span className="text-red-500">*</span>
            </Label>
            <DatePicker
              value={neededDateValue}
              onChange={(date) => date && setNeededDate(getLocalDateString(date))}
              minDate={minDateValue}
              endMonth={calendarEndMonth}
            />
            <p className="text-xs text-muted-foreground">
              Tanggal yang sudah lewat tidak bisa dipilih.
            </p>
          </div>
          <div
            id="pc-field-minggu"
            className="flex flex-col gap-2 col-span-12 md:col-span-6 rounded-md"
          >
            <Label className="flex items-center gap-1.5">
              <CalendarClock className="h-3.5 w-3.5" />
              Minggu ke- (bulan ini) <span className="text-red-500">*</span>
            </Label>
            <SearchableSelect
              value={weekOfMonth ? String(weekOfMonth) : ""}
              onValueChange={(val) => {
                setWeekOfMonth(Number(val));
                setWeekManuallySet(true);
              }}
            >
              <SearchableSelectTrigger>
                <SearchableSelectValue placeholder="Pilih minggu" />
              </SearchableSelectTrigger>
              <SearchableSelectContent>
                {selectableWeeks.map((w) => (
                  <SearchableSelectItem key={w} value={String(w)}>
                    Minggu ke-{w}
                  </SearchableSelectItem>
                ))}
              </SearchableSelectContent>
            </SearchableSelect>
            <p className="text-xs text-muted-foreground">
              Hanya minggu ini atau minggu berikutnya di bulan berjalan -
              minggu yang sudah lewat tidak bisa dipilih.
            </p>
          </div>

          <div
            id="pc-field-catatan"
            className="flex flex-col gap-2 col-span-12 rounded-md"
          >
            <Label>
              Catatan Tambahan{" "}
              <span className="text-xs font-normal text-muted-foreground">
                (Opsional)
              </span>
            </Label>
            <RichMentionEditor
              key={ulangSource ? `ulang-${ulangSource.id}` : "new"}
              ref={notesEditorRef}
              initialContent={
                ulangSource ? parseRichValue(ulangSource.notes) : undefined
              }
              placeholder="Konteks/keterangan tambahan untuk pengajuan ini..."
              onChange={() =>
                setNotes(
                  notesEditorRef.current?.isEmpty()
                    ? ""
                    : stringifyRichContent(
                        notesEditorRef.current?.getJSON() ?? {
                          type: "doc",
                        },
                      ),
                )
              }
            />
            <p className="text-xs text-muted-foreground">
              Gunakan @ (orang), # (barang), $ (vendor), / (dokumen) untuk
              menandai (tag).
            </p>
          </div>
        </div>
      </Content>

      <Content
        id="pc-section-items"
        title="Daftar Barang"
        description="Cari dari katalog Barang Petty Cash, atau tambahkan Barang Manual jika belum ada di katalog. Barang manual yang sering diajukan sebaiknya diminta ke GA untuk ditambahkan ke katalog."
      >
        {templateLoading || ulangLoading ? (
          <p className="text-sm text-muted-foreground italic flex items-center gap-2">
            <Loader2 className="h-4 w-4 animate-spin" />{" "}
            {ulangLoading ? "Memuat Pengajuan lama..." : "Memuat template..."}
          </p>
        ) : isLourdes && !lourdesCoa ? (
          <div className="rounded-md border border-dashed p-6 text-center text-sm text-muted-foreground">
            Pilih Company Pengajuan (GMI/GIS) terlebih dahulu sebelum
            menambahkan barang.
          </div>
        ) : (
          <PcItemsEditor
            key={`${isLourdes ? lourdesCoa : "fixed"}-${
              templateId ?? (ulangSource ? `ulang-${ulangSource.id}` : "blank")
            }`}
            initialItems={templateItems.map((it) => {
              const catalog = it.barang_id
                ? templateCatalogCoa[it.barang_id]
                : undefined;
              return {
                ...it,
                coa: itemsCoa,
                category:
                  (catalog &&
                    itemsCoa &&
                    pettyCashBarangCoaFor(catalog, itemsCoa)) ||
                  it.category,
                subtotal: it.qty * it.unit_price,
              };
            })}
            onChange={setItems}
            coaMode="locked"
            lockedCoa={itemsCoa}
            coaSearchFilter={itemsCoa}
          />
        )}
      </Content>

      <Content
        id="pc-section-attachments"
        title="Lampiran File"
        description="Opsional - referensi pendukung, misalnya quotation atau link produk. Format JPG, PNG, PDF, maksimal 5MB."
      >
        <div className="flex flex-col gap-4">
          <Input
            type="file"
            onChange={handleFileUpload}
            disabled={uploading}
          />
          {uploading && (
            <p className="flex items-center gap-2 text-xs text-muted-foreground">
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
              Mengunggah lampiran...
            </p>
          )}
          {attachments.length > 0 && (
            <ul className="space-y-2">
              {attachments.map((file, index) => (
                <li
                  key={index}
                  className="flex justify-between items-center gap-2 p-2 bg-muted rounded text-sm"
                >
                  <a
                    href={file.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center gap-2 min-w-0 hover:underline"
                  >
                    <Paperclip className="h-4 w-4 shrink-0 text-muted-foreground" />
                    <span className="truncate">{file.name}</span>
                  </a>
                  <Button
                    type="button"
                    size="icon"
                    variant="ghost"
                    onClick={() => removeAttachment(index)}
                  >
                    <Trash2 className="h-4 w-4 text-destructive" />
                  </Button>
                </li>
              ))}
            </ul>
          )}
        </div>
      </Content>
    </FormSummaryLayout>
  );
}
