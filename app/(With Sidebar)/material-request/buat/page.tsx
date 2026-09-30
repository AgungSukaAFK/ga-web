// src/app/(With Sidebar)/material-request/buat/page.tsx

"use client";

import { Content } from "@/components/content";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import {
  MaterialRequest,
  Order,
  Attachment,
  Barang,
  Discussion,
  DiscussionSubmitPayload,
  MrTemplate,
} from "@/type";
import { DiscussionPanel } from "@/components/discussion-panel";
import { Combobox, ComboboxData } from "@/components/combobox";
import { Textarea } from "@/components/ui/textarea";
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
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Loader2,
  Trash2,
  Edit as EditIcon,
  Building2,
  AlertTriangle,
  ExternalLink,
  FileStack,
  Search,
  X,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogTitle,
  DialogHeader,
} from "@/components/ui/dialog";
import { toast } from "sonner";
import { createClient } from "@/lib/supabase/client";
import {
  getActiveUserProfile,
  generateMRCode,
  uploadAttachment,
  removeAttachment,
  createMaterialRequest,
  getDueDateFromPriority,
  findActiveDuplicateMrs,
  type DuplicateMrInfo,
} from "@/services/mrService";
import { fetchBarangAssetFlags } from "@/services/purchaseOrderService";
import { Checkbox } from "@/components/ui/checkbox";
import { CurrencyInput } from "@/components/ui/currency-input";
import { formatCurrency, cn } from "@/lib/utils";
import { getAttachmentSizeError, getUploadErrorMessage } from "@/lib/attachments";
import { format } from "date-fns";
import { notifyGAOnMRSubmit } from "@/lib/notifications/client";
import { logActivity } from "@/services/logService";
import { BarangSearchCombobox } from "../../purchase-order/BarangSearchCombobox";
import { Badge } from "@/components/ui/badge"; // <--- UPDATE: Import Badge
import { AssetGoodsBadge } from "@/components/asset-goods-badge";
import { MR_KATEGORI_OPTIONS } from "@/lib/constants/mr";
import {
  applyMrTemplate,
  fetchMrTemplateById,
  fetchMrTemplates,
} from "@/services/mrTemplateService";

const kategoriData: ComboboxData = MR_KATEGORI_OPTIONS;

const dataLokasi: ComboboxData = [
  { label: "Head Office", value: "Head Office" },
  { label: "Tanjung Enim", value: "Tanjung Enim" },
  { label: "Balikpapan", value: "Balikpapan" },
  { label: "Site BA", value: "Site BA" },
  { label: "Site TAL", value: "Site TAL" },
  { label: "Site MIP", value: "Site MIP" },
  { label: "Site MIFA", value: "Site MIFA" },
  { label: "Site BIB", value: "Site BIB" },
  { label: "Site AMI", value: "Site AMI" },
  { label: "Site Tabang", value: "Site Tabang" },
  { label: "GIS BPN", value: "GIS BPN" },
  { label: "Site Manado", value: "Site Manado" },
  { label: "Site DIZA", value: "Site DIZA" },
  { label: "Site PIK", value: "Site PIK" },
  { label: "Site BGE", value: "Site BGE" },
];

const PRIORITY_OPTIONS: {
  value: "P0" | "P1" | "P2" | "P3" | "P4";
  label: string;
  days: string;
}[] = [
  { value: "P0", label: "Emergency", days: "Maks. 2 hari" },
  { value: "P1", label: "High", days: "Maks. 10 hari" },
  { value: "P2", label: "Medium", days: "Maks. 15 hari" },
  { value: "P3", label: "Low", days: "Maks. 25 hari" },
  { value: "P4", label: "Umum", days: "30 hari" },
];

export default function BuatMRPage() {
  const router = useRouter();
  const remarksEditorRef = useRef<RichMentionEditorHandle>(null);

  const [formCreateMR, setFormCreateMR] = useState<Omit<MaterialRequest, "id">>(
    {
      userid: "",
      kode_mr: "Memuat...",
      kategori: "",
      status: "Pending Validation",
      level: "OPEN 1",
      prioritas: "P4",
      remarks: "",
      cost_estimation: "0",
      department: "",
      company_code: "",
      cost_center_id: null,
      tujuan_site: "",
      created_at: new Date(),
      due_date: getDueDateFromPriority("P4"),
      orders: [],
      approvals: [],
      attachments: [],
      discussions: [],
    },
  );

  const [userLokasi, setUserLokasi] = useState("");
  const [formattedCost, setFormattedCost] = useState("Rp 0");
  const [loading, setLoading] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [tujuanSamaDenganLokasi, setTujuanSamaDenganLokasi] = useState(true);

  const [isLourdes, setIsLourdes] = useState(false);
  const [userProfile, setUserProfile] = useState<{
    nama: string;
    department: string;
    lokasi: string;
    company: string;
  } | null>(null);

  // Id sesi form (BUKAN kode_mr - kode_mr masih preview & bisa berubah sampai
  // 3x sebelum insert final, lihat generateMRCode/proceedCreateMR/createMaterialRequest)
  // dipakai sebagai prefix folder upload gambar diskusi selama MR belum
  // tersimpan di DB.
  const [draftId] = useState(() => crypto.randomUUID());
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);

  useEffect(() => {
    const supabase = createClient();
    supabase.auth.getUser().then(({ data }) => {
      setCurrentUserId(data.user?.id ?? null);
    });
  }, []);

  // --- Template MR (disediakan GA, lihat mr-template/MrTemplateClient.tsx) ---
  // Template yang terakhir diterapkan - dicatat di activity log saat MR
  // diajukan. `formKey` dipakai remount Combobox Kategori & editor Remarks
  // (keduanya uncontrolled) supaya nilai dari template ikut tampil.
  const [appliedTemplate, setAppliedTemplate] = useState<{
    id: number;
    nama: string;
  } | null>(null);
  const [formKey, setFormKey] = useState(0);
  const [openTemplateDialog, setOpenTemplateDialog] = useState(false);
  const [mrTemplates, setMrTemplates] = useState<MrTemplate[]>([]);
  const [loadingTemplates, setLoadingTemplates] = useState(false);
  const [applyingTemplateId, setApplyingTemplateId] = useState<number | null>(
    null,
  );
  const [templateSearch, setTemplateSearch] = useState("");

  const handleApplyTemplate = async (template: MrTemplate) => {
    setApplyingTemplateId(template.id);
    try {
      const { orders, missing } = await applyMrTemplate(template);
      if (orders.length === 0) {
        toast.error("Template tidak bisa dipakai", {
          description:
            "Semua barang di template ini sudah tidak ada di database barang.",
        });
        return;
      }

      setFormCreateMR((prev) => ({
        ...prev,
        orders,
        kategori: template.kategori || prev.kategori,
        // Remarks yang sudah diketik requester tidak ditimpa.
        remarks: prev.remarks || template.remarks || "",
      }));
      setAppliedTemplate({ id: template.id, nama: template.nama_template });
      setFormKey((k) => k + 1);
      setOpenTemplateDialog(false);

      toast.success(`Template "${template.nama_template}" diterapkan.`, {
        description: `${orders.length} barang dimuat. Silakan cek & sesuaikan sebelum mengajukan.`,
      });
      if (missing.length > 0) {
        toast.warning(
          `${missing.length} barang dilewati karena sudah tidak ada di database`,
          { description: missing.join(", ") },
        );
      }
    } catch (error: any) {
      toast.error("Gagal menerapkan template", { description: error.message });
    } finally {
      setApplyingTemplateId(null);
    }
  };

  const handleOpenTemplateDialog = async () => {
    setTemplateSearch("");
    setOpenTemplateDialog(true);
    setLoadingTemplates(true);
    try {
      setMrTemplates(await fetchMrTemplates());
    } catch (error: any) {
      toast.error("Gagal memuat template MR", { description: error.message });
    } finally {
      setLoadingTemplates(false);
    }
  };

  // Terapkan template dari ?template=<id> (tombol "Gunakan" di halaman
  // Template MR). Pakai window.location, bukan useSearchParams, supaya
  // halaman ini tidak perlu dibungkus Suspense.
  useEffect(() => {
    const templateId = Number(
      new URLSearchParams(window.location.search).get("template"),
    );
    if (!templateId) return;
    fetchMrTemplateById(templateId)
      .then(handleApplyTemplate)
      .catch(() => toast.error("Template MR tidak ditemukan."));
  }, []);

  const filteredMrTemplates = mrTemplates.filter((t) => {
    const q = templateSearch.trim().toLowerCase();
    if (!q) return true;
    return (
      t.nama_template.toLowerCase().includes(q) ||
      (t.deskripsi || "").toLowerCase().includes(q) ||
      (t.orders || []).some((o) => o.name.toLowerCase().includes(q))
    );
  });

  const handleDraftDiscussionSubmit = (payload: DiscussionSubmitPayload) => {
    const entry: Discussion = {
      user_id: currentUserId ?? "",
      user_name: userProfile?.nama || "Anda",
      timestamp: new Date().toISOString(),
      ...payload,
    };
    setFormCreateMR((prev) => ({
      ...prev,
      discussions: [...(prev.discussions ?? []), entry],
    }));
  };

  const getPriorityColor = (p: string) => {
    switch (p) {
      case "P0":
        return "bg-red-600 hover:bg-red-700";
      case "P1":
        return "bg-orange-500 hover:bg-orange-600";
      case "P2":
        return "bg-yellow-500 hover:bg-yellow-600";
      case "P3":
        return "bg-green-600 hover:bg-green-700";
      default:
        return "bg-gray-500";
    }
  };

  // Due date sekarang DIURUNKAN dari prioritas yang dipilih requester
  // (bukan sebaliknya) - pakai batas hari MAKSIMAL tiap tier
  // (getDueDateFromPriority, services/mrService.ts) supaya hasil
  // calculatePriority atas due_date itu nanti balik lagi ke tier yang sama
  // persis pas MR-nya dibuat di server (createMaterialRequest selalu
  // hitung ulang prioritas dari due_date).
  const handleSelectPriority = (priority: "P0" | "P1" | "P2" | "P3" | "P4") => {
    setFormCreateMR((prev) => ({
      ...prev,
      prioritas: priority,
      due_date: getDueDateFromPriority(priority),
    }));
  };

  useEffect(() => {
    const fetchUserData = async () => {
      try {
        const profile = await getActiveUserProfile();
        if (
          profile &&
          profile.department &&
          profile.lokasi &&
          profile.company
        ) {
          setUserProfile({
            nama: profile.nama || "",
            department: profile.department,
            lokasi: profile.lokasi,
            company: profile.company,
          });
          setUserLokasi(profile.lokasi);

          if (profile.company === "LOURDES") {
            setIsLourdes(true);
            setFormCreateMR((prev) => ({
              ...prev,
              department: profile.department || "",
              tujuan_site: profile.lokasi || "",
              kode_mr: "Pilih perusahaan tujuan dulu...",
            }));
          } else {
            const newKodeMR = await generateMRCode(
              profile.department,
              profile.lokasi,
              profile.company,
            );
            setFormCreateMR((prev) => ({
              ...prev,
              department: profile.department || "",
              company_code: profile.company || "",
              tujuan_site: profile.lokasi || "",
              kode_mr: newKodeMR,
            }));
          }
        } else {
          toast.warning("Profil belum lengkap.");
        }
      } catch (error: any) {
        toast.error("Gagal mengambil profil user", {
          description: error.message,
        });
      }
    };
    fetchUserData();
  }, []);

  const handleTargetCompanyChange = async (company: string) => {
    if (!userProfile) return;
    setFormCreateMR((prev) => ({
      ...prev,
      company_code: company,
      kode_mr: "Memuat...",
    }));
    try {
      // Kode MR ikut tujuan_site (site TUJUAN pengiriman barang), BUKAN
      // lokasi asal user - fallback ke userProfile.lokasi kalau tujuan_site
      // somehow belum keisi (harusnya sudah, di-default pas profile ke-load).
      const newKodeMR = await generateMRCode(
        userProfile.department,
        formCreateMR.tujuan_site || userProfile.lokasi,
        company,
      );
      setFormCreateMR((prev) => ({ ...prev, kode_mr: newKodeMR }));
    } catch (error: any) {
      toast.error("Gagal generate kode MR", { description: error.message });
    }
  };

  // Regenerate kode_mr (preview) tiap kali site TUJUAN pengiriman berubah -
  // baik lewat toggle "Sama dengan lokasi saya" maupun combobox pilih lokasi
  // tujuan manual. Kode MR harus ikut tujuan_site, BUKAN lokasi asal user
  // yang bikin MR (lihat juga proceedCreateMR yang regenerate ulang tepat
  // sebelum submit, sumber kebenarannya sama).
  useEffect(() => {
    if (!userProfile) return;
    if (!formCreateMR.tujuan_site || !formCreateMR.department) return;
    if (isLourdes && !formCreateMR.company_code) return;

    const company = isLourdes ? formCreateMR.company_code : userProfile.company;
    if (!company) return;

    generateMRCode(formCreateMR.department, formCreateMR.tujuan_site, company)
      .then((newKodeMR) => {
        setFormCreateMR((prev) => ({ ...prev, kode_mr: newKodeMR }));
      })
      .catch((error: any) => {
        toast.error("Gagal generate ulang kode MR", {
          description: error.message,
        });
      });
  }, [
    formCreateMR.tujuan_site,
    formCreateMR.department,
    formCreateMR.company_code,
    userProfile,
    isLourdes,
  ]);

  useEffect(() => {
    const total = formCreateMR.orders.reduce((acc, item) => {
      const qty = Number(item.qty) || 0;
      const price = Number(item.estimasi_harga) || 0;
      return acc + qty * price;
    }, 0);

    setFormCreateMR((prev) => ({
      ...prev,
      cost_estimation: String(total),
    }));
    setFormattedCost(formatCurrency(total));
  }, [formCreateMR.orders]);

  const handleCBKategori = (value: string) => {
    setFormCreateMR({ ...formCreateMR, kategori: value });
  };

  const handleCBTujuanSite = (value: string) => {
    setFormCreateMR({ ...formCreateMR, tujuan_site: value });
  };

  useEffect(() => {
    if (tujuanSamaDenganLokasi) {
      setFormCreateMR((prev) => ({ ...prev, tujuan_site: userLokasi }));
    } else {
      if (userLokasi) {
        setFormCreateMR((prev) => ({ ...prev, tujuan_site: "" }));
      }
    }
  }, [tujuanSamaDenganLokasi, userLokasi]);

  // --- Item Management ---
  const [openItemDialog, setOpenItemDialog] = useState(false);
  const [editingIndex, setEditingIndex] = useState<number | null>(null);
  // Peta barang_id -> is_asset, dipakai utk badge Aset/Barang di tabel item.
  const [barangAssetMap, setBarangAssetMap] = useState<
    Record<number, boolean>
  >({});

  const [orderItem, setOrderItem] = useState<Order>({
    name: "",
    qty: "1",
    uom: "Pcs",
    estimasi_harga: 0,
    url: "",
    note: "",
    barang_id: null,
    part_number: null,
  });

  const handleOpenAddItemDialog = () => {
    setEditingIndex(null);
    setOrderItem({
      name: "",
      qty: "1",
      uom: "Pcs",
      estimasi_harga: 0,
      url: "",
      note: "",
      barang_id: null,
      part_number: null,
    });
    setOpenItemDialog(true);
  };

  // --- EFFECT: Peta is_asset per barang_id (utk badge Aset/Barang) ---
  useEffect(() => {
    const barangIds = formCreateMR.orders
      .map((o) => o.barang_id)
      .filter((id): id is number => !!id);
    if (barangIds.length === 0) return;
    fetchBarangAssetFlags(barangIds).then((map) =>
      setBarangAssetMap((prev) => ({ ...prev, ...map })),
    );
  }, [formCreateMR.orders]);

  const handleOpenEditItemDialog = (index: number) => {
    setEditingIndex(index);
    setOrderItem(formCreateMR.orders[index]);
    setOpenItemDialog(true);
  };

  // --- LOGIC REVISI: Auto-fill Estimasi Harga dari Last Purchase Price ---
  const handleSelectBarang = (barang: Barang) => {
    setOrderItem((prev) => ({
      ...prev,
      name: barang.part_name || prev.name,
      part_number: barang.part_number,
      uom: barang.uom || "Pcs",
      barang_id: barang.id,
      // Jika last_purchase_price ada (dari update sebelumnya), pakai itu. Jika tidak, 0.
      estimasi_harga: barang.last_purchase_price || 0,
    }));

    if (barang.last_purchase_price && barang.last_purchase_price > 0) {
      toast.info("Harga estimasi otomatis terisi dari database.");
    }
  };

  // Barang yang sama (barang_id sama) sudah ada di daftar item lain (selain
  // item yang sedang diedit) - cegah duplikat, arahkan user edit qty item
  // yang sudah ada saja.
  const isDuplicateItem =
    !!orderItem.barang_id &&
    formCreateMR.orders.some(
      (o, i) => o.barang_id === orderItem.barang_id && i !== editingIndex,
    );

  const handleSaveOrUpdateItem = () => {
    if (!orderItem.barang_id || !orderItem.name) {
      toast.error("Wajib memilih barang dari database.");
      return;
    }
    if (isDuplicateItem) {
      toast.error(
        "Barang ini sudah ada di daftar. Edit item yang sudah ada, jangan tambah duplikat.",
      );
      return;
    }
    if (!orderItem.qty || Number(orderItem.qty) <= 0) {
      toast.error("Quantity harus lebih dari 0.");
      return;
    }

    const itemToSave: Order = {
      ...orderItem,
      estimasi_harga: Number(orderItem.estimasi_harga) || 0,
      level: "Open 1",
    };

    setFormCreateMR((prevForm) => {
      const updatedOrders = [...prevForm.orders];
      if (editingIndex !== null) {
        updatedOrders[editingIndex] = itemToSave;
      } else {
        updatedOrders.push(itemToSave);
      }
      return { ...prevForm, orders: updatedOrders };
    });

    setOpenItemDialog(false);
  };

  const removeItem = (index: number) => {
    setFormCreateMR((prev) => ({
      ...prev,
      orders: prev.orders.filter((_, i) => i !== index),
    }));
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0 || formCreateMR.kode_mr === "Memuat...") {
      toast.warning("Kode MR belum siap, tunggu sebentar.");
      return;
    }

    const fileList = Array.from(files);
    const oversizedErrors = fileList
      .map((file) => getAttachmentSizeError(file))
      .filter((err): err is string => !!err);
    const validFiles = fileList.filter((file) => !getAttachmentSizeError(file));

    if (oversizedErrors.length > 0) {
      toast.error(
        oversizedErrors.length === fileList.length
          ? "Semua file melebihi batas ukuran"
          : `${oversizedErrors.length} file dilewati karena melebihi batas ukuran`,
        { description: oversizedErrors.join(" ") },
      );
    }

    if (validFiles.length === 0) {
      e.target.value = "";
      return;
    }

    setIsUploading(true);
    const toastId = toast.loading(`Mengunggah ${validFiles.length} file...`);
    const successfulUploads: Attachment[] = [];
    const failedMessages: string[] = [];

    try {
      for (const file of validFiles) {
        try {
          const newAttachment = await uploadAttachment(
            file,
            formCreateMR.kode_mr,
          );
          successfulUploads.push(newAttachment);
        } catch (error) {
          failedMessages.push(`${file.name}: ${getUploadErrorMessage(error)}`);
        }
      }

      if (successfulUploads.length > 0) {
        setFormCreateMR((prev) => ({
          ...prev,
          attachments: [...(prev.attachments || []), ...successfulUploads],
        }));
        toast.success(`${successfulUploads.length} file berhasil diunggah.`, {
          id: toastId,
        });
      }
      if (failedMessages.length > 0) {
        toast.error(`Gagal mengunggah ${failedMessages.length} file.`, {
          id: toastId,
          description: failedMessages.join(" "),
        });
      } else if (successfulUploads.length === 0) {
        toast.dismiss(toastId);
      }
    } finally {
      setIsUploading(false);
      e.target.value = "";
    }
  };

  const handleRemoveAttachment = async (index: number, path: string) => {
    const toastId = toast.loading("Menghapus file...");
    try {
      await removeAttachment(path);
      const updatedAttachments = (formCreateMR.attachments || []).filter(
        (_, i) => i !== index,
      );
      setFormCreateMR((prev) => ({ ...prev, attachments: updatedAttachments }));
      toast.success("File berhasil dihapus.", { id: toastId });
    } catch (error: any) {
      toast.error(`Gagal menghapus file: ${error.message}`, { id: toastId });
    }
  };

  const [ajukanAlert, setAjukanAlert] = useState<string>("");

  // --- Deteksi MR Duplikat ---
  const [duplicateMrs, setDuplicateMrs] = useState<DuplicateMrInfo[]>([]);
  const [openDuplicateDialog, setOpenDuplicateDialog] = useState(false);

  // Eksekusi pembuatan MR yang sebenarnya (dipanggil setelah lolos cek duplikat)
  const proceedCreateMR = async () => {
    setLoading(true);
    const toastId = toast.loading("Mengajukan MR...");

    try {
      const s = createClient();
      const {
        data: { user },
      } = await s.auth.getUser();
      if (!user) throw new Error("User tidak ditemukan.");

      const { company_code, ...payload } = formCreateMR;

      // Regenerate kode MR fresh tepat sebelum submit agar tidak pakai kode
      // stale dari saat halaman pertama dibuka (menghindari race condition
      // antar user). Pakai tujuan_site (site TUJUAN pengiriman barang),
      // BUKAN userLokasi (lokasi asal user yang bikin MR) - keduanya bisa
      // beda kalau user uncheck "Sama dengan lokasi saya" dan pilih tujuan
      // site lain secara manual.
      const freshKodeMr = await generateMRCode(
        payload.department,
        payload.tujuan_site,
        company_code,
      );

      const finalPayload = {
        ...payload,
        kode_mr: freshKodeMr,
        cost_estimation: Number(payload.cost_estimation),
        cost_center_id: null,
        level: "OPEN 1",
        prioritas: payload.prioritas || "P4",
      };

      const { id: mrId } = await createMaterialRequest(
        finalPayload as any,
        user.id,
        company_code,
      );

      await logActivity(
        user.id,
        "CREATE_MR",
        "material_request",
        String(mrId),
        `Requester ${userProfile?.nama || "Unknown"} membuat MR ${freshKodeMr} dengan ${finalPayload.orders.length} barang${appliedTemplate ? ` menggunakan Template MR "${appliedTemplate.nama}"` : ""}. Estimasi biaya: ${formatCurrency(finalPayload.cost_estimation)}`,
        {
          kode_mr: freshKodeMr,
          company_code,
          department: finalPayload.department,
          tujuan_site: finalPayload.tujuan_site,
          kategori: finalPayload.kategori,
          total_items: finalPayload.orders.length,
          cost_estimation: finalPayload.cost_estimation,
          template_id: appliedTemplate?.id ?? null,
          template_nama: appliedTemplate?.nama ?? null,
        },
      );

      // Notify all GA members that a new MR needs validation
      notifyGAOnMRSubmit({
        actorId: user.id,
        companyCode: company_code,
        kodeMR: freshKodeMr,
        mrId,
      });

      toast.success("Material Request berhasil dibuat dan menunggu validasi!", {
        id: toastId,
      });
      router.push("/material-request");
    } catch (err: any) {
      toast.error(`Gagal mengajukan MR: ${err.message}`, { id: toastId });
      setAjukanAlert(`Terjadi kesalahan: ${err.message}`);
    } finally {
      setLoading(false);
    }
  };

  // Tombol "Tetap tambahkan item": lanjut buat MR walau ada duplikat
  const handleProceedAnyway = async () => {
    setOpenDuplicateDialog(false);
    await proceedCreateMR();
  };

  // Tombol "Hapus item terdeteksi duplikat": buang item duplikat lalu kembali ke form
  const handleRemoveDuplicateItems = () => {
    const dupBarangIds = new Set<number>();
    const dupPartNumbers = new Set<string>();
    duplicateMrs.forEach((mr) =>
      mr.matched_items.forEach((it) => {
        if (it.barang_id != null) dupBarangIds.add(it.barang_id);
        if (it.part_number)
          dupPartNumbers.add(it.part_number.trim().toLowerCase());
      }),
    );

    setFormCreateMR((prev) => ({
      ...prev,
      orders: prev.orders.filter((o) => {
        const idDup = o.barang_id != null && dupBarangIds.has(o.barang_id);
        const pnDup =
          o.part_number &&
          dupPartNumbers.has(o.part_number.trim().toLowerCase());
        return !(idDup || pnDup);
      }),
    }));

    setOpenDuplicateDialog(false);
    setDuplicateMrs([]);
    toast.info(
      "Item duplikat telah dihapus dari daftar. Silakan tinjau kembali sebelum mengajukan.",
    );
  };

  // Tombol "Batalkan Pembuatan MR": kembali ke halaman list MR
  const handleCancelMrCreation = () => {
    setOpenDuplicateDialog(false);
    router.push("/material-request");
  };

  const handleAjukanMR = async () => {
    setAjukanAlert("");

    if (isLourdes && !formCreateMR.company_code) {
      setAjukanAlert(
        "Pilih perusahaan tujuan MR (GMI atau GIS) terlebih dahulu.",
      );
      return;
    }

    if (
      !formCreateMR.kategori ||
      !formCreateMR.remarks ||
      !formCreateMR.due_date ||
      !formCreateMR.department ||
      !formCreateMR.tujuan_site ||
      !formCreateMR.company_code
    ) {
      setAjukanAlert(
        "Semua data utama (Kategori, Prioritas, Remarks, Tujuan) wajib diisi.",
      );
      return;
    }

    if (formCreateMR.orders.length === 0) {
      setAjukanAlert("Minimal harus ada satu order item.");
      return;
    }

    if (formCreateMR.orders.some((o) => !o.barang_id)) {
      setAjukanAlert(
        "Terdapat item yang tidak valid (bukan dari database). Hapus dan input ulang.",
      );
      return;
    }

    if (Number(formCreateMR.cost_estimation) <= 0) {
      setAjukanAlert("Total estimasi biaya harus lebih besar dari Rp 0.");
      return;
    }

    const wajibLampiran = ["Replace Item", "Fix & Repair", "Upgrade"];
    if (
      wajibLampiran.includes(formCreateMR.kategori) &&
      (formCreateMR.attachments || []).length === 0
    ) {
      setAjukanAlert(
        `Kategori '${formCreateMR.kategori}' wajib menyertakan lampiran.`,
      );
      return;
    }

    // --- CEK DUPLIKAT: MR aktif dengan barang sama (company & departemen sama) ---
    setLoading(true);
    try {
      const duplicates = await findActiveDuplicateMrs(
        formCreateMR.company_code,
        formCreateMR.department,
        formCreateMR.orders,
      );
      if (duplicates.length > 0) {
        setDuplicateMrs(duplicates);
        setOpenDuplicateDialog(true);
        setLoading(false);
        return;
      }
    } catch (err) {
      // Jika pengecekan gagal, jangan blok user — lanjutkan pembuatan MR
      console.error("Gagal memeriksa MR duplikat:", err);
    }

    await proceedCreateMR();
  };

  return (
    <>
      <Content
        title="Buat Material Request Baru"
        description="Isi data pada form di bawah ini. Departemen & Lokasi Anda akan terisi otomatis."
      >
        <div className="grid grid-cols-12 gap-4">
          <div className="col-span-12 flex flex-col gap-2 rounded-lg border border-dashed p-3 sm:flex-row sm:items-center sm:justify-between">
            {appliedTemplate ? (
              <div className="flex items-center gap-2 text-sm">
                <FileStack className="h-4 w-4 shrink-0 text-primary" />
                <span>
                  Menggunakan template{" "}
                  <strong>{appliedTemplate.nama}</strong>. Semua isian tetap
                  bisa diedit.
                </span>
                <Button
                  type="button"
                  size="icon"
                  variant="ghost"
                  className="h-6 w-6"
                  title="Lepas keterangan template"
                  onClick={() => setAppliedTemplate(null)}
                >
                  <X className="h-3.5 w-3.5" />
                </Button>
              </div>
            ) : (
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <FileStack className="h-4 w-4 shrink-0" />
                MR rutin? Pakai template dari GA supaya tidak perlu input
                barang satu per satu.
              </div>
            )}
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={handleOpenTemplateDialog}
              disabled={loading}
            >
              {appliedTemplate ? "Ganti Template" : "Gunakan Template MR"}
            </Button>
          </div>

          {isLourdes && (
            <div className="col-span-12 flex flex-col gap-2">
              <Label className="flex items-center gap-2">
                <Building2 className="h-4 w-4 text-primary" />
                Buat MR untuk Perusahaan <span className="text-red-500">*</span>
              </Label>
              <div className="grid grid-cols-2 gap-3">
                {(["GMI", "GIS"] as const).map((company) => (
                  <button
                    key={company}
                    type="button"
                    onClick={() => handleTargetCompanyChange(company)}
                    className={cn(
                      "py-4 rounded-lg border-2 font-bold text-lg transition-all",
                      formCreateMR.company_code === company
                        ? "border-primary bg-primary/10 text-primary shadow-sm"
                        : "border-border hover:border-primary/40 text-muted-foreground",
                    )}
                  >
                    {company}
                  </button>
                ))}
              </div>
              {formCreateMR.company_code && (
                <p className="text-xs text-muted-foreground">
                  MR ini akan dicatat sebagai dokumen{" "}
                  <strong>{formCreateMR.company_code}</strong>.
                </p>
              )}
            </div>
          )}

          <div className="flex flex-col gap-2 col-span-12">
            <Label>Kode MR</Label>
            <Input readOnly disabled value={formCreateMR.kode_mr} />
          </div>
          <div className="flex flex-col gap-2 col-span-12 md:col-span-4">
            <Label>Perusahaan</Label>
            <Input
              readOnly
              disabled
              value={formCreateMR.company_code || "Memuat..."}
            />
          </div>
          <div className="flex flex-col gap-2 col-span-12 md:col-span-4">
            <Label>Departemen</Label>
            <Input
              readOnly
              disabled
              value={formCreateMR.department || "Memuat..."}
            />
          </div>
          <div className="flex flex-col gap-2 col-span-12 md:col-span-4">
            <Label>Lokasi Saya (Pengaju)</Label>
            <Input readOnly disabled value={userLokasi || "Memuat..."} />
          </div>

          <div className="flex flex-col gap-2 col-span-12 md:col-span-6">
            <Label>Kategori</Label>
            <Combobox
              key={`kategori-${formKey}`}
              data={kategoriData}
              onChange={handleCBKategori}
              placeholder="Pilih kategori..."
              defaultValue={formCreateMR.kategori}
            />
          </div>

          <div className="flex flex-col gap-2 col-span-12 md:col-span-6">
            <Label>Prioritas</Label>
            <div className="grid grid-cols-5 gap-1.5">
              {PRIORITY_OPTIONS.map((opt) => {
                const selected = formCreateMR.prioritas === opt.value;
                return (
                  <button
                    key={opt.value}
                    type="button"
                    onClick={() => handleSelectPriority(opt.value)}
                    className={cn(
                      "flex flex-col items-center justify-center gap-0.5 rounded-md border px-1 py-2 text-center transition-colors",
                      selected
                        ? cn(
                            getPriorityColor(opt.value),
                            "text-white border-transparent",
                          )
                        : "border-input hover:bg-muted",
                    )}
                  >
                    <span className="text-xs font-bold">{opt.value}</span>
                    <span className="text-[9px] leading-tight">
                      {opt.label}
                    </span>
                    <span className="text-[9px] leading-tight opacity-80">
                      {opt.days}
                    </span>
                  </button>
                );
              })}
            </div>
            {formCreateMR.due_date && (
              <p className="text-xs text-muted-foreground">
                Target Pemakaian:{" "}
                <span className="font-medium text-foreground">
                  {format(formCreateMR.due_date, "dd MMMM yyyy")}
                </span>
              </p>
            )}
            <p className="text-[10px] text-muted-foreground">
              *Due date otomatis ditentukan dari prioritas yang dipilih.
            </p>
          </div>

          <div className="flex flex-col gap-2 col-span-12 md:col-span-6">
            <Label>Tujuan Pengiriman (Site)</Label>
            <div className="flex items-center space-x-2 mt-2 h-9">
              <Checkbox
                id="tujuan-sama"
                checked={tujuanSamaDenganLokasi}
                onCheckedChange={(checked) =>
                  setTujuanSamaDenganLokasi(checked as boolean)
                }
              />
              <label
                htmlFor="tujuan-sama"
                className="text-sm font-medium leading-none cursor-pointer"
              >
                Sama dengan lokasi saya
              </label>
            </div>
            {!tujuanSamaDenganLokasi && (
              <div className="mt-2 animate-in fade-in">
                <Combobox
                  data={dataLokasi}
                  onChange={handleCBTujuanSite}
                  placeholder="Pilih lokasi tujuan..."
                  defaultValue={formCreateMR.tujuan_site}
                />
              </div>
            )}
          </div>

          <div className="flex flex-col gap-2 col-span-12">
            <Label>Remarks (Tujuan & Latar Belakang)</Label>
            <RichMentionEditor
              key={`remarks-${formKey}`}
              ref={remarksEditorRef}
              initialContent={parseRichValue(formCreateMR.remarks)}
              placeholder="Contoh: Laptop lama rusak layar, dibutuhkan untuk kerja harian tim IT..."
              onChange={() =>
                setFormCreateMR({
                  ...formCreateMR,
                  remarks: remarksEditorRef.current?.isEmpty()
                    ? ""
                    : stringifyRichContent(
                        remarksEditorRef.current?.getJSON() ?? { type: "doc" },
                      ),
                })
              }
            />
            <p className="text-xs text-muted-foreground">
              Isi jelas & detail (alasan, kondisi saat ini, urgensi) - remarks
              yang lengkap mempercepat keputusan approver. Bisa pakai @ (orang),
              # (barang), $ (vendor), / (dokumen) buat tag.
            </p>
          </div>
          <div className="flex flex-col gap-2 col-span-12">
            <Label>Estimasi Biaya (Otomatis)</Label>
            <Input
              readOnly
              disabled
              value={formattedCost}
              className="font-bold text-lg"
            />
          </div>
        </div>
      </Content>

      <Content
        title="Order Item"
        size="lg"
        cardAction={
          <Button
            variant="outline"
            disabled={loading}
            onClick={handleOpenAddItemDialog}
          >
            Tambah Order Item
          </Button>
        }
      >
        <div className="rounded-md border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>No</TableHead>
                <TableHead>Nama Item</TableHead>
                <TableHead>Part Number</TableHead>
                <TableHead>Qty</TableHead>
                <TableHead>Estimasi Harga</TableHead>
                <TableHead>Total</TableHead>
                <TableHead>Aksi</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {formCreateMR.orders.map((order, index) => (
                <TableRow key={index}>
                  <TableCell>{index + 1}</TableCell>
                  <TableCell>
                    <div className="flex items-center gap-2">
                      {order.name}
                      <AssetGoodsBadge
                        isAsset={
                          !!(
                            order.barang_id && barangAssetMap[order.barang_id]
                          )
                        }
                      />
                    </div>
                  </TableCell>
                  <TableCell className="text-xs font-mono">
                    {order.part_number || "-"}
                  </TableCell>
                  <TableCell>
                    {order.qty} {order.uom}
                  </TableCell>
                  <TableCell>{formatCurrency(order.estimasi_harga)}</TableCell>
                  <TableCell>
                    {formatCurrency(Number(order.qty) * order.estimasi_harga)}
                  </TableCell>
                  <TableCell>
                    <div className="flex gap-1">
                      <Button
                        size="icon"
                        variant="outline"
                        onClick={() => handleOpenEditItemDialog(index)}
                      >
                        <EditIcon className="h-4 w-4" />
                      </Button>
                      <Button
                        size="icon"
                        variant="destructive"
                        onClick={() => removeItem(index)}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      </Content>

      <Dialog open={openItemDialog} onOpenChange={setOpenItemDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {editingIndex !== null ? "Edit Order Item" : "Tambah Order Item"}
            </DialogTitle>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="space-y-2">
              <Label className="text-right">Cari Barang (Wajib)</Label>
              <BarangSearchCombobox onSelect={handleSelectBarang} />
              {orderItem.name && (
                <div className="text-xs text-muted-foreground mt-1 p-2 bg-muted rounded border">
                  Terpilih: <strong>{orderItem.name}</strong> (
                  {orderItem.part_number})
                </div>
              )}
              {isDuplicateItem && (
                <p className="text-xs text-destructive mt-1">
                  Barang ini sudah ada di daftar item. Edit item yang sudah
                  ada kalau mau ubah quantity-nya, jangan ditambah lagi.
                </p>
              )}
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Quantity</Label>
                <Input
                  type="number"
                  value={orderItem.qty}
                  onChange={(e) =>
                    setOrderItem({ ...orderItem, qty: e.target.value })
                  }
                  min="1"
                />
              </div>
              <div className="space-y-2">
                <Label>UoM</Label>
                <Input
                  value={orderItem.uom}
                  readOnly
                  disabled
                  className="bg-muted"
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label>Estimasi Harga Satuan</Label>
              <CurrencyInput
                value={orderItem.estimasi_harga}
                onValueChange={(value) =>
                  setOrderItem({ ...orderItem, estimasi_harga: value })
                }
              />
            </div>

            <div className="space-y-2">
              <Label>Catatan / Link Ref</Label>
              <Textarea
                value={orderItem.note}
                onChange={(e) =>
                  setOrderItem({ ...orderItem, note: e.target.value })
                }
                placeholder="(Opsional)"
                rows={3}
              />
            </div>
          </div>
          <DialogFooter>
            <Button onClick={handleSaveOrUpdateItem} disabled={isDuplicateItem}>
              {editingIndex !== null ? "Simpan Perubahan" : "Tambah"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Content title="Lampiran File" size="sm">
        <div className="flex flex-col gap-4">
          <Input
            type="file"
            multiple
            onChange={handleFileUpload}
            disabled={isUploading}
          />
          {(formCreateMR.attachments || []).length > 0 && (
            <ul className="space-y-2">
              {formCreateMR.attachments.map((att, index) => (
                <li
                  key={index}
                  className="flex justify-between items-center p-2 bg-muted rounded text-sm"
                >
                  <span className="truncate max-w-[200px]">{att.name}</span>
                  <Button
                    size="icon"
                    variant="ghost"
                    onClick={() => handleRemoveAttachment(index, att.url)}
                  >
                    <Trash2 className="h-4 w-4 text-destructive" />
                  </Button>
                </li>
              ))}
            </ul>
          )}
        </div>
      </Content>

      <Content title="Diskusi" size="lg">
        <DiscussionPanel
          discussions={formCreateMR.discussions ?? []}
          onSubmit={handleDraftDiscussionSubmit}
          storagePathPrefix={`discussions/material-request/draft/${draftId}`}
          currentUserId={currentUserId}
          placeholder="Tulis catatan awal untuk MR ini... (opsional, bisa drag & drop atau paste gambar)"
        />
      </Content>

      <Content size="lg">
        <div className="flex flex-col gap-4">
          {ajukanAlert && (
            <Alert variant="destructive">
              <AlertTitle>Perhatian!</AlertTitle>
              <AlertDescription>{ajukanAlert}</AlertDescription>
            </Alert>
          )}
          <Button
            onClick={handleAjukanMR}
            disabled={loading || isUploading}
            className="w-full"
          >
            {loading ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" /> Mengajukan...
              </>
            ) : (
              "Buat Material Request"
            )}
          </Button>
        </div>
      </Content>

      {/* MODAL: Pilih Template MR */}
      <Dialog open={openTemplateDialog} onOpenChange={setOpenTemplateDialog}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <FileStack className="h-5 w-5" />
              Pilih Template MR
            </DialogTitle>
          </DialogHeader>

          <p className="text-sm text-muted-foreground">
            Barang di template akan <strong>mengganti</strong> daftar Order
            Item saat ini. Kategori ikut terisi dari template, remarks hanya
            terisi kalau masih kosong.
          </p>

          <div className="relative">
            <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
            <Input
              value={templateSearch}
              onChange={(e) => setTemplateSearch(e.target.value)}
              placeholder="Cari template atau nama barang..."
              className="pl-8"
            />
          </div>

          <div className="max-h-[50vh] space-y-2 overflow-y-auto pr-1">
            {loadingTemplates ? (
              <div className="flex h-24 items-center justify-center">
                <Loader2 className="h-6 w-6 animate-spin text-primary" />
              </div>
            ) : filteredMrTemplates.length === 0 ? (
              <p className="py-8 text-center text-sm text-muted-foreground">
                {mrTemplates.length === 0
                  ? "Belum ada template MR dari GA."
                  : "Tidak ada template yang cocok."}
              </p>
            ) : (
              filteredMrTemplates.map((t) => (
                <div
                  key={t.id}
                  className={cn(
                    "flex items-start justify-between gap-3 rounded-lg border p-3",
                    appliedTemplate?.id === t.id && "border-primary",
                  )}
                >
                  <div className="min-w-0 space-y-1">
                    <p className="text-sm font-semibold">{t.nama_template}</p>
                    {t.deskripsi && (
                      <p className="text-xs text-muted-foreground">
                        {t.deskripsi}
                      </p>
                    )}
                    <div className="flex flex-wrap items-center gap-1.5">
                      {t.kategori && (
                        <Badge variant="outline">{t.kategori}</Badge>
                      )}
                      <span className="text-xs text-muted-foreground">
                        {t.orders?.length ?? 0} barang
                      </span>
                    </div>
                    <p className="text-xs text-muted-foreground line-clamp-2">
                      {(t.orders || [])
                        .map((o) => `${o.name} (${o.qty} ${o.uom})`)
                        .join(", ")}
                    </p>
                    {t.remarks && (
                      <p className="text-xs italic text-muted-foreground line-clamp-1">
                        Remarks: {extractPlainText(t.remarks)}
                      </p>
                    )}
                  </div>
                  <Button
                    size="sm"
                    className="shrink-0"
                    onClick={() => handleApplyTemplate(t)}
                    disabled={applyingTemplateId !== null}
                  >
                    {applyingTemplateId === t.id && (
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    )}
                    Gunakan
                  </Button>
                </div>
              ))
            )}
          </div>
        </DialogContent>
      </Dialog>

      {/* MODAL: Notifikasi MR Duplikat */}
      <Dialog open={openDuplicateDialog} onOpenChange={setOpenDuplicateDialog}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-amber-600">
              <AlertTriangle className="h-5 w-5" />
              Terdeteksi Material Request Serupa
            </DialogTitle>
          </DialogHeader>

          <p className="text-sm text-muted-foreground">
            Ditemukan <strong>{duplicateMrs.length} MR aktif</strong> dari
            departemen <strong>{formCreateMR.department}</strong> (
            {formCreateMR.company_code}) yang masih berjalan dan meminta barang
            yang sama. Periksa dulu untuk menghindari pengajuan ganda.
          </p>

          <div className="max-h-[45vh] space-y-3 overflow-y-auto pr-1">
            {duplicateMrs.map((mr) => (
              <div key={mr.id} className="space-y-2 rounded-lg border p-3">
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <a
                      href={`/material-request/${mr.id}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex items-center gap-1 font-mono text-sm font-semibold text-primary hover:underline"
                    >
                      {mr.kode_mr}
                      <ExternalLink className="h-3 w-3 shrink-0" />
                    </a>
                    <p className="text-xs text-muted-foreground">
                      {mr.requester_name || "-"} ·{" "}
                      {format(new Date(mr.created_at), "dd MMM yyyy")}
                    </p>
                  </div>
                  <div className="flex shrink-0 flex-col items-end gap-1">
                    <Badge variant="outline">{mr.status}</Badge>
                    {mr.level && (
                      <span className="text-[10px] text-muted-foreground">
                        {mr.level}
                      </span>
                    )}
                  </div>
                </div>

                <div className="rounded-md bg-muted p-2">
                  <p className="mb-1 text-[11px] font-medium text-muted-foreground">
                    Item yang sama:
                  </p>
                  <ul className="space-y-1">
                    {mr.matched_items.map((it, i) => (
                      <li
                        key={i}
                        className="flex justify-between gap-2 text-xs"
                      >
                        <span className="truncate">
                          {it.name}{" "}
                          {it.part_number && (
                            <span className="font-mono text-muted-foreground">
                              ({it.part_number})
                            </span>
                          )}
                        </span>
                        <span className="whitespace-nowrap text-muted-foreground">
                          {it.qty} {it.uom}
                        </span>
                      </li>
                    ))}
                  </ul>
                </div>
              </div>
            ))}
          </div>

          <DialogFooter className="flex-col gap-2 sm:flex-col sm:space-x-0">
            <Button
              variant="destructive"
              className="w-full"
              onClick={handleRemoveDuplicateItems}
              disabled={loading}
            >
              <Trash2 className="mr-2 h-4 w-4" />
              Hapus Item Terdeteksi Duplikat
            </Button>
            <Button
              className="w-full"
              onClick={handleProceedAnyway}
              disabled={loading}
            >
              {loading ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />{" "}
                  Mengajukan...
                </>
              ) : (
                "Tetap Tambahkan Item & Ajukan"
              )}
            </Button>
            <Button
              variant="outline"
              className="w-full"
              onClick={handleCancelMrCreation}
              disabled={loading}
            >
              Batalkan Pembuatan MR
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
