// src/app/(With Sidebar)/material-request/[id]/page.tsx

"use client";

import { use, useEffect, useState, Suspense } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import {
  uploadAttachmentVps,
  removeAttachmentVps,
} from "@/services/storageService";
import {
  resolveAttachmentUrl,
  getAttachmentSizeError,
  getUploadErrorMessage,
} from "@/lib/attachments";
import { Content } from "@/components/content";
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
  CircleUser,
  Building,
  Tag,
  Calendar,
  DollarSign,
  Info,
  Link as LinkIcon,
  AlertTriangle,
  Check,
  X,
  Loader2,
  Edit,
  Pencil,
  Save,
  Plus,
  Trash2,
  Paperclip,
  Upload,
  Truck,
  Building2,
  ExternalLink,
  Zap,
  Layers,
  HelpCircle,
  Calendar as CalendarIcon,
  FileText,
  MapPin,
  MessageSquare,
  ArrowRight,
  CheckCircle2,
  Clock,
  XCircle,
  AlertCircle, // <--- Added Icon
} from "lucide-react";
import Link from "next/link";
import { Skeleton } from "@/components/ui/skeleton";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { User as AuthUser } from "@supabase/supabase-js";
import {
  MaterialRequest,
  Approval,
  Discussion,
  Order,
  Profile,
  Attachment,
  MrItemStatus,
} from "@/type";
import {
  formatCurrency,
  formatDateFriendly,
  cn,
  formatDateWithTime,
  calculatePriority, // <--- Pastikan ini terimport
} from "@/lib/utils";
import { DiscussionSection } from "./discussion-component";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Combobox, ComboboxData } from "@/components/combobox";
import { CurrencyInput } from "@/components/ui/currency-input";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  MR_LEVELS,
  MR_ITEM_STATUS_COLORS,
  MR_ITEM_STATUS_LABELS,
} from "@/type/enum";
import { ItemLevelBadge } from "@/components/item-level-badge";
import { AssetGoodsBadge } from "@/components/asset-goods-badge";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Calendar as CalendarComponent } from "@/components/ui/calendar";
import { format } from "date-fns";
import { processMrApproval } from "@/services/approvalService";
import {
  fetchMaterialRequestById,
  updateMrItemStatus,
  recalculateMrStatus,
  uploadBastForMrItem,
  removeBastForMrItem,
  addManualPoLink,
  removeManualPoLink,
  setItemPaymentIssue,
} from "@/services/mrService";
import {
  fetchPoQtyBreakdownForMr,
  fetchPosForMr,
  fetchBarangAssetFlags,
  PoQtyBreakdownEntry,
} from "@/services/purchaseOrderService";
import {
  notifyOnMRApproval,
  notifyGAOnMRSubmit,
} from "@/lib/notifications/client";
import { logActivity } from "@/services/logService";

const kategoriData: ComboboxData = [
  { label: "New Item", value: "New Item" },
  { label: "Replace Item", value: "Replace Item" },
  { label: "Fix & Repair", value: "Fix & Repair" },
  { label: "Upgrade", value: "Upgrade" },
];

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

const dataUoM: ComboboxData = [
  { label: "Pcs", value: "Pcs" },
  { label: "Unit", value: "Unit" },
  { label: "Set", value: "Set" },
  { label: "Box", value: "Box" },
  { label: "Rim", value: "Rim" },
  { label: "Roll", value: "Roll" },
];

function DetailMRPageContent({ params }: { params: { id: string } }) {
  const mrId = parseInt(params.id);
  const router = useRouter();
  const supabase = createClient();

  const [mr, setMr] = useState<MaterialRequest | null>(null);
  const [currentUser, setCurrentUser] = useState<AuthUser | null>(null);
  const [userProfile, setUserProfile] = useState<Profile | null>(null);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [isEditing, setIsEditing] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [formattedCost, setFormattedCost] = useState("Rp 0");

  const [costCenterName, setCostCenterName] = useState<string | null>(null);
  const [costCenterBudget, setCostCenterBudget] = useState<number | null>(null);

  const [isLevelInfoOpen, setIsLevelInfoOpen] = useState(false);
  const [isDatePopoverOpen, setIsDatePopoverOpen] = useState(false);

  // --- STATE: KELOLA STATUS & PO PER ITEM ---
  const [poBreakdown, setPoBreakdown] = useState<
    Record<string, PoQtyBreakdownEntry[]>
  >({});
  // Peta barang_id -> is_asset, dipakai utk badge Aset/Barang di tabel item.
  const [barangAssetMap, setBarangAssetMap] = useState<
    Record<number, boolean>
  >({});
  const [isItemStatusOpen, setIsItemStatusOpen] = useState(false);
  const [selectedItemForStatus, setSelectedItemForStatus] =
    useState<Order | null>(null);
  const [itemStatusForm, setItemStatusForm] = useState({
    status: "Pending" as string,
    note: "",
  });
  const [savingItemStatus, setSavingItemStatus] = useState(false);

  // --- STATE: LINK MANUAL KE PO (barang disubstitusi pas beli) ---
  const [posForMr, setPosForMr] = useState<
    { id: number; kode_po: string; status: string; is_asset: boolean }[]
  >([]);
  const [manualLinkPoCode, setManualLinkPoCode] = useState("");
  const [manualLinkQty, setManualLinkQty] = useState("");
  const [savingManualLink, setSavingManualLink] = useState(false);

  // --- STATE: UPLOAD BAST PER ITEM (REQUESTER) ---
  const [isBastUploadOpen, setIsBastUploadOpen] = useState(false);
  const [selectedItemForBast, setSelectedItemForBast] =
    useState<Order | null>(null);
  const [bastFiles, setBastFiles] = useState<FileList | null>(null);
  const [uploadingBast, setUploadingBast] = useState(false);

  // --- FETCH DATA ---
  const fetchMrData = async () => {
    if (isNaN(mrId)) {
      setError("ID Material Request tidak valid.");
      return null;
    }

    try {
      const data = await fetchMaterialRequestById(mrId);

      if (!data) throw new Error("Data tidak ditemukan");

      const initialData = {
        ...data,
        attachments: Array.isArray(data.attachments) ? data.attachments : [],
        discussions: Array.isArray(data.discussions) ? data.discussions : [],
        approvals: Array.isArray(data.approvals) ? data.approvals : [],
        orders: Array.isArray(data.orders) ? data.orders : [],
        due_date: data.due_date ? new Date(data.due_date) : undefined,
      };

      setMr(initialData as any);

      const ccData = data.cost_centers as any;
      setCostCenterName(ccData?.name || null);
      setCostCenterBudget(ccData?.current_budget ?? null);

      return initialData;
    } catch (err: any) {
      setError("Gagal memuat data MR.");
      toast.error("Gagal memuat data", { description: err.message });
      return null;
    }
  };

  useEffect(() => {
    const initializePage = async () => {
      setLoading(true);
      setError(null);
      const {
        data: { user },
      } = await supabase.auth.getUser();
      setCurrentUser(user);

      if (user) {
        const { data: profile } = await supabase
          .from("profiles")
          .select("*")
          .eq("id", user.id)
          .single();
        setUserProfile(profile as Profile | null);
      }
      await fetchMrData();
      setLoading(false);
    };
    initializePage();
  }, [mrId]);

  // --- EFFECT: Calculate Total Cost ---
  useEffect(() => {
    if (mr) {
      const total = mr.orders.reduce((acc, item) => {
        const qty = Number(item.qty) || 0;
        const price = Number(item.estimasi_harga) || 0;
        return acc + qty * price;
      }, 0);
      setFormattedCost(formatCurrency(total));
    }
  }, [mr?.orders]);

  // --- EFFECT: Ambil breakdown qty PO per item (utk validasi qty terpenuhi) ---
  useEffect(() => {
    if (!mr?.id || isNaN(mrId)) return;
    fetchPoQtyBreakdownForMr(mrId).then(setPoBreakdown);
    fetchPosForMr(mrId).then(setPosForMr);
  }, [mr?.id]);

  // --- EFFECT: Peta is_asset per barang_id (utk badge Aset/Barang) ---
  useEffect(() => {
    const barangIds = (mr?.orders || [])
      .map((o) => o.barang_id)
      .filter((id): id is number => !!id);
    if (barangIds.length === 0) return;
    fetchBarangAssetFlags(barangIds).then(setBarangAssetMap);
  }, [mr?.orders]);

  const myApprovalIndex =
    mr && currentUser && mr.approvals
      ? mr.approvals.findIndex(
          (a) => a.userid === currentUser.id && a.status === "pending",
        )
      : -1;

  const isMyTurnForApproval =
    myApprovalIndex !== -1 && mr
      ? mr.approvals
          .slice(0, myApprovalIndex)
          .every((a) => a.status === "approved")
      : false;

  const canEdit =
    userProfile?.role === "admin" ||
    userProfile?.role === "approver" ||
    (userProfile?.role === "requester" && mr?.status === "Pending Validation");

  const isPurchasing =
    userProfile?.department === "Purchasing" ||
    userProfile?.department === "Procurement" ||
    userProfile?.role === "admin";

  // Toggle-nya nempel di dialog "Kelola Status & PO Barang", yang tombol
  // pembukanya sendiri sudah dibatasi ke isPurchasing (lihat pencil icon di
  // bawah) - jadi ikutin gate yang sama biar ga jadi kondisi yang ga
  // ke-reach (approver non-purchasing ga pernah bisa buka dialognya sama
  // sekali).
  const canTogglePaymentIssue = isPurchasing;

  // --- ACTIONS ---

  const handleSaveChanges = async () => {
    if (!mr) return;
    setActionLoading(true);
    const toastId = toast.loading("Menyimpan perubahan...");

    const totalCost = mr.orders.reduce((acc, item) => {
      return acc + (Number(item.qty) || 0) * (Number(item.estimasi_harga) || 0);
    }, 0);

    const { users_with_profiles, cost_centers, ...restOfData } = mr as any;

    const updateData = {
      ...restOfData,
      cost_estimation: String(totalCost),
      prioritas: mr.prioritas,
      due_date: mr.due_date,
    };

    const { error: updateError } = await supabase
      .from("material_requests")
      .update(updateData)
      .eq("id", mr.id);

    setActionLoading(false);
    if (updateError) {
      toast.error("Gagal menyimpan perubahan", {
        id: toastId,
        description: updateError.message,
      });
      return false;
    } else {
      toast.success("Perubahan berhasil disimpan!", { id: toastId });
      setIsEditing(false);
      await fetchMrData();
      return true;
    }
  };

  // Requester memperbaiki MR yang di-Hold lalu mengajukannya ulang ke validasi GA.
  const handleResubmit = async () => {
    if (!mr || !currentUser) return;
    if (
      !confirm(
        "Ajukan ulang MR ini untuk divalidasi GA? Pastikan perbaikan sudah sesuai arahan yang diberikan.",
      )
    )
      return;
    setActionLoading(true);
    const toastId = toast.loading("Mengajukan ulang MR...");

    const totalCost = mr.orders.reduce((acc, item) => {
      return acc + (Number(item.qty) || 0) * (Number(item.estimasi_harga) || 0);
    }, 0);

    const { users_with_profiles, cost_centers, ...restOfData } = mr as any;

    const newDiscussion: Discussion = {
      user_id: currentUser.id,
      user_name: userProfile?.nama || "Requester",
      message:
        "MR diperbaiki dan diajukan ulang oleh requester untuk validasi.",
      timestamp: new Date().toISOString(),
    };
    const updatedDiscussions = Array.isArray(mr.discussions)
      ? [...(mr.discussions as Discussion[]), newDiscussion]
      : [newDiscussion];

    const updateData = {
      ...restOfData,
      cost_estimation: String(totalCost),
      prioritas: mr.prioritas,
      due_date: mr.due_date,
      status: "Pending Validation",
      discussions: updatedDiscussions,
    };

    const { error: updateError } = await supabase
      .from("material_requests")
      .update(updateData)
      .eq("id", mr.id);

    setActionLoading(false);
    if (updateError) {
      toast.error("Gagal mengajukan ulang MR", {
        id: toastId,
        description: updateError.message,
      });
      return;
    }

    await logActivity(
      currentUser.id,
      "RESUBMIT_MR",
      "material_request",
      String(mr.id),
      `Requester ${userProfile?.nama || "Unknown"} memperbaiki & mengajukan ulang MR ${mr.kode_mr} untuk validasi.`,
    );

    notifyGAOnMRSubmit({
      actorId: currentUser.id,
      companyCode: mr.company_code,
      kodeMR: mr.kode_mr,
      mrId: mr.id,
    });

    toast.success("MR berhasil diajukan ulang!", { id: toastId });
    setIsEditing(false);
    await fetchMrData();
  };

  const handleApprovalAction = async (decision: "approved" | "rejected") => {
    if (!mr || !currentUser) return;

    if (isEditing && decision === "approved") {
      const saveSuccess = await handleSaveChanges();
      if (!saveSuccess) {
        toast.error("Persetujuan dibatalkan karena gagal menyimpan perubahan.");
        return;
      }
    }

    setActionLoading(true);
    try {
      await processMrApproval(
        mr.id as any,
        currentUser.id,
        decision,
        mr.approvals,
      );

      // Notify next approver (if any) or creator
      const currentApprovals = mr.approvals || [];
      const myIndex = currentApprovals.findIndex(
        (a) => a.userid === currentUser.id && a.status === "pending",
      );
      const nextApprover =
        decision === "approved"
          ? currentApprovals.find(
              (a, i) => i > myIndex && a.status === "pending",
            )
          : undefined;
      notifyOnMRApproval({
        actorId: currentUser.id,
        creatorId: mr.userid,
        nextApproverId: nextApprover?.userid,
        decision,
        kodeMR: mr.kode_mr,
        mrId: mr.id,
      });

      toast.success(
        `MR berhasil di-${decision === "approved" ? "setujui" : "tolak"}`,
      );
      await fetchMrData();
      setIsEditing(false);
    } catch (err: any) {
      toast.error("Aksi gagal", { description: err.message });
    } finally {
      setActionLoading(false);
    }
  };

  const handleDelete = async () => {
    if (!confirm("Apakah Anda yakin ingin menghapus MR ini?")) return;
    try {
      const { error } = await supabase
        .from("material_requests")
        .delete()
        .eq("id", mrId);

      if (error) throw error;

      toast.success("MR berhasil dihapus");
      router.push("/material-request");
    } catch (error: any) {
      toast.error("Gagal menghapus MR", { description: error.message });
    }
  };

  // --- KELOLA STATUS & PO PER ITEM ---
  const handleOpenItemStatusDialog = (item: Order) => {
    setSelectedItemForStatus(item);
    setItemStatusForm({
      status: item.status || "Pending",
      note: item.status_note || "",
    });
    setManualLinkPoCode("");
    setManualLinkQty("");
    setIsItemStatusOpen(true);
  };

  const handleSaveItemStatus = async () => {
    if (!mr?.id || !selectedItemForStatus?.part_number) return;

    const cumulativeQty = (
      poBreakdown[selectedItemForStatus.part_number] || []
    ).reduce((sum, entry) => sum + (entry.qty || 0), 0);
    const requestedQty = Number(selectedItemForStatus.qty) || 0;
    // "PO Created" (dulu status terpisah utk "qty penuh ke-cover PO") sudah
    // dilebur ke "Processing" - jadi warning qty-belum-penuh ini sekarang
    // ikut dicek juga kalau admin manual set "Processing".
    const isFulfillingStatus = ["Processing", "Completed"].includes(
      itemStatusForm.status,
    );

    setSavingItemStatus(true);
    try {
      await updateMrItemStatus(
        mrId,
        selectedItemForStatus.part_number,
        { status: itemStatusForm.status, note: itemStatusForm.note },
        currentUser?.id || "",
      );
      await recalculateMrStatus(mrId);

      if (isFulfillingStatus && cumulativeQty < requestedQty) {
        toast.warning("Status disimpan, tapi qty PO belum penuh", {
          description: `Baru ${cumulativeQty} dari ${requestedQty} ${selectedItemForStatus.uom} yang ke-cover PO.`,
        });
      } else {
        toast.success("Status barang berhasil diperbarui");
      }

      setIsItemStatusOpen(false);
      await fetchMrData();
      fetchPoQtyBreakdownForMr(mrId).then(setPoBreakdown);
    } catch (err: any) {
      toast.error("Gagal update status", { description: err.message });
    } finally {
      setSavingItemStatus(false);
    }
  };

  // Toggle "Payment Issue" (Open 3A <-> Open 3B) - independen dari form
  // status di atas, langsung tersimpan begitu diklik.
  const handleTogglePaymentIssue = async () => {
    if (!selectedItemForStatus?.part_number || !currentUser) return;
    const hasIssue = selectedItemForStatus.level !== "Open 3B";

    setSavingItemStatus(true);
    try {
      await setItemPaymentIssue(
        mrId,
        selectedItemForStatus.part_number,
        hasIssue,
        currentUser.id,
      );
      toast.success(
        hasIssue
          ? "Item ditandai Payment Issue (Open 3B)"
          : "Payment Issue dilepas, kembali ke Open 3A",
      );

      const freshMr = await fetchMrData();
      const freshItem = freshMr?.orders.find(
        (o: Order) => o.part_number === selectedItemForStatus.part_number,
      );
      if (freshItem) setSelectedItemForStatus(freshItem);
    } catch (err: any) {
      toast.error("Gagal update payment issue", { description: err.message });
    } finally {
      setSavingItemStatus(false);
    }
  };

  // Status "lanjutan" yang ga boleh dimundurkan cuma gara-gara utak-atik
  // link PO manual (barang sudah diterima GA / requester sudah upload BAST /
  // sudah dibatalkan/diganti secara sengaja).
  const ADVANCED_ITEM_STATUSES = ["Completed", "Pending BAST", "Cancelled", "Replaced"];

  const syncItemStatusFromBreakdown = async (
    item: Order,
    freshBreakdown: Record<string, PoQtyBreakdownEntry[]>,
  ) => {
    if (!item.part_number || !currentUser) return;
    if (ADVANCED_ITEM_STATUSES.includes(item.status || "")) return;

    const cumulative = (freshBreakdown[item.part_number] || []).reduce(
      (sum, e) => sum + (e.qty || 0),
      0,
    );
    const requested = Number(item.qty) || 0;
    // "PO Created" (dulu status terpisah utk qty penuh ke-cover) sudah
    // dilebur ke "Processing" - sinyal "penuh ke-cover" dipindah ke `level`
    // (Open 3A), sama seperti alur pembuatan PO normal di
    // purchaseOrderService.ts, supaya recalculateMrStatus (mrService.ts)
    // tetap bisa bedain item yang sudah penuh vs masih sebagian ke-cover.
    const isFulfilled = cumulative >= requested && requested > 0;
    const newStatus = cumulative > 0 ? "Processing" : "Pending";
    const newLevel =
      isFulfilled && item.level !== "Open 3B" ? "Open 3A" : undefined;

    if (newStatus !== item.status || (newLevel && newLevel !== item.level)) {
      await updateMrItemStatus(
        mrId,
        item.part_number,
        { status: newStatus, level: newLevel },
        currentUser.id,
      );
    }
  };

  const handleAddManualLink = async () => {
    if (!selectedItemForStatus?.part_number || !currentUser) return;
    const qty = Number(manualLinkQty);
    if (!manualLinkPoCode) {
      toast.error("Pilih PO terlebih dahulu");
      return;
    }
    if (!qty || qty <= 0) {
      toast.error("Qty harus lebih dari 0");
      return;
    }

    setSavingManualLink(true);
    try {
      await addManualPoLink(
        mrId,
        selectedItemForStatus.part_number,
        manualLinkPoCode,
        qty,
        currentUser.id,
      );

      const freshBreakdown = await fetchPoQtyBreakdownForMr(mrId);
      setPoBreakdown(freshBreakdown);
      await syncItemStatusFromBreakdown(selectedItemForStatus, freshBreakdown);
      await recalculateMrStatus(mrId);

      toast.success("Link PO manual berhasil ditambahkan");
      setManualLinkPoCode("");
      setManualLinkQty("");

      const freshMr = await fetchMrData();
      const freshItem = freshMr?.orders.find(
        (o: Order) => o.part_number === selectedItemForStatus.part_number,
      );
      if (freshItem) setSelectedItemForStatus(freshItem);
    } catch (err: any) {
      toast.error("Gagal menambahkan link PO", { description: err.message });
    } finally {
      setSavingManualLink(false);
    }
  };

  const handleRemoveManualLink = async (kodePo: string) => {
    if (!selectedItemForStatus?.part_number || !currentUser) return;

    setSavingManualLink(true);
    try {
      await removeManualPoLink(
        mrId,
        selectedItemForStatus.part_number,
        kodePo,
        currentUser.id,
      );

      const freshBreakdown = await fetchPoQtyBreakdownForMr(mrId);
      setPoBreakdown(freshBreakdown);
      await syncItemStatusFromBreakdown(selectedItemForStatus, freshBreakdown);
      await recalculateMrStatus(mrId);

      toast.success("Link PO manual dihapus");

      const freshMr = await fetchMrData();
      const freshItem = freshMr?.orders.find(
        (o: Order) => o.part_number === selectedItemForStatus.part_number,
      );
      if (freshItem) setSelectedItemForStatus(freshItem);
    } catch (err: any) {
      toast.error("Gagal menghapus link PO", { description: err.message });
    } finally {
      setSavingManualLink(false);
    }
  };

  // --- UPLOAD BAST PER ITEM (REQUESTER) ---
  const handleOpenBastUpload = (item: Order) => {
    setSelectedItemForBast(item);
    setBastFiles(null);
    setIsBastUploadOpen(true);
  };

  const handleUploadItemBast = async () => {
    if (!mr || !selectedItemForBast?.part_number) return;
    if (!bastFiles || bastFiles.length === 0) {
      toast.error("Pilih file BAST terlebih dahulu");
      return;
    }
    if (!currentUser) {
      toast.error("Sesi tidak valid, silakan muat ulang halaman");
      return;
    }

    for (const file of bastFiles) {
      const sizeError = getAttachmentSizeError(file);
      if (sizeError) {
        toast.error("Ukuran file terlalu besar", { description: sizeError });
        return;
      }
    }

    setUploadingBast(true);
    try {
      const uploadedAttachments: Attachment[] = [];
      for (let i = 0; i < bastFiles.length; i++) {
        const file = bastFiles[i];
        const filePath = `${mr.kode_mr.replace(/\//g, "-")}/bast/${
          selectedItemForBast.part_number
        }/${Date.now()}_${file.name}`;
        const formData = new FormData();
        formData.append("file", file);
        const result = await uploadAttachmentVps(formData, filePath);
        if (!result.success) throw new Error(result.message);
        uploadedAttachments.push({
          name: file.name,
          url: result.url,
          type: "bast",
        });
      }

      await uploadBastForMrItem(
        mrId,
        selectedItemForBast.part_number,
        uploadedAttachments,
        currentUser.id,
      );

      toast.success("BAST berhasil diunggah, item ditandai selesai");
      setIsBastUploadOpen(false);
      await fetchMrData();
      fetchPoQtyBreakdownForMr(mrId).then(setPoBreakdown);
    } catch (err: any) {
      toast.error("Gagal upload BAST", {
        description: getUploadErrorMessage(err),
      });
    } finally {
      setUploadingBast(false);
    }
  };

  const handleRemoveItemBast = async (item: Order, attachmentUrl: string) => {
    if (!item.part_number || !currentUser) return;
    try {
      await removeBastForMrItem(
        mrId,
        item.part_number,
        attachmentUrl,
        currentUser.id,
      );
      toast.success("Lampiran BAST dihapus");
      await fetchMrData();
      fetchPoQtyBreakdownForMr(mrId).then(setPoBreakdown);
    } catch (err: any) {
      toast.error("Gagal hapus lampiran BAST", { description: err.message });
    }
  };

  // --- ITEM MANAGEMENT (CRUD in Memory) ---

  const handleItemChange = (
    index: number,
    field: keyof Order,
    value: string | number,
  ) => {
    if (!mr) return;
    const newOrders = [...mr.orders];
    (newOrders[index] as any)[field] = value;
    setMr({ ...mr, orders: newOrders });
  };

  const [openItemDialog, setOpenItemDialog] = useState(false);
  const [editingIndex, setEditingIndex] = useState<number | null>(null);

  const [orderItem, setOrderItem] = useState<Partial<Order>>({
    name: "",
    qty: "1",
    uom: "Pcs",
    estimasi_harga: 0,
    url: "",
    note: "",
    status: "Pending",
    po_refs: [],
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
      status: "Pending",
      po_refs: [],
    });
    setOpenItemDialog(true);
  };

  const handleOpenEditItemDialog = (index: number) => {
    if (!mr) return;
    setEditingIndex(index);
    setOrderItem({ ...mr.orders[index] });
    setOpenItemDialog(true);
  };

  const handleSaveOrUpdateItem = () => {
    if (
      !orderItem.name?.trim() ||
      !String(orderItem.qty).trim() ||
      !orderItem.uom?.trim()
    ) {
      toast.error("Nama item, quantity, dan UoM harus diisi.");
      return;
    }
    if (!mr) return;

    const itemToSave: Order = {
      name: orderItem.name || "",
      qty: String(orderItem.qty),
      uom: orderItem.uom || "Pcs",
      estimasi_harga: Number(orderItem.estimasi_harga) || 0,
      url: orderItem.url || "",
      note: orderItem.note || "",
      part_number: orderItem.part_number || null,
      barang_id: orderItem.barang_id || null,
      status: (orderItem.status as MrItemStatus) || "Pending",
      po_refs: orderItem.po_refs || [],
      status_note: orderItem.status_note || "",
    };

    const updatedOrders = [...mr.orders];
    if (editingIndex !== null) {
      updatedOrders[editingIndex] = itemToSave;
    } else {
      updatedOrders.push(itemToSave);
    }
    setMr({ ...mr, orders: updatedOrders });
    setOpenItemDialog(false);
  };

  const removeItem = (index: number) => {
    if (!mr) return;
    setMr({ ...mr, orders: mr.orders.filter((_, i) => i !== index) });
  };

  // --- ATTACHMENT HANDLERS ---

  const handleAttachmentUpload = async (
    e: React.ChangeEvent<HTMLInputElement>,
  ) => {
    const files = e.target.files;
    if (!files || files.length === 0 || !mr) return;

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
    try {
      const uploadPromises = validFiles.map(async (file) => {
        const filePath = `${mr.kode_mr.replace(/\//g, "-")}/${Date.now()}_${
          file.name
        }`;
        const formData = new FormData();
        formData.append("file", file);
        try {
          const result = await uploadAttachmentVps(formData, filePath);
          if (!result.success) return { error: result.message };
          return { data: { url: result.url, name: file.name }, error: null };
        } catch (err) {
          return { error: getUploadErrorMessage(err) };
        }
      });
      const results = await Promise.all(uploadPromises);
      const successfulUploads = results
        .filter((r) => !r.error)
        .map((r) => r.data as Attachment);
      if (successfulUploads.length === 0) {
        toast.error("Semua file gagal diunggah.", {
          id: toastId,
          description: results.map((r) => r.error).filter(Boolean).join(" "),
        });
        return;
      }
      const updatedAttachments = [
        ...(mr.attachments || []),
        ...successfulUploads,
      ];
      const { error: updateError } = await supabase
        .from("material_requests")
        .update({ attachments: updatedAttachments })
        .eq("id", mr.id);
      if (updateError) {
        toast.error("Gagal menyimpan data lampiran", {
          id: toastId,
          description: updateError.message,
        });
      } else {
        const failedCount = results.length - successfulUploads.length;
        toast.success(
          failedCount > 0
            ? `${successfulUploads.length} file berhasil diunggah, ${failedCount} gagal.`
            : `${successfulUploads.length} file berhasil diunggah & disimpan.`,
          { id: toastId },
        );
        await fetchMrData();
      }
    } catch (err: any) {
      toast.error("Gagal mengunggah file", {
        id: toastId,
        description: getUploadErrorMessage(err),
      });
    } finally {
      setIsUploading(false);
      e.target.value = "";
    }
  };

  const removeAttachment = (indexToRemove: number) => {
    if (!mr || !Array.isArray(mr.attachments)) return;
    const attachmentToRemove = mr.attachments[indexToRemove];
    if (!attachmentToRemove) return;
    const updatedAttachments = mr.attachments.filter(
      (_, i) => i !== indexToRemove,
    );
    setMr({ ...mr, attachments: updatedAttachments });
    if (attachmentToRemove.url.startsWith("http")) {
      removeAttachmentVps(attachmentToRemove.url);
    } else {
      supabase.storage.from("mr").remove([attachmentToRemove.url]);
    }
    supabase
      .from("material_requests")
      .update({ attachments: updatedAttachments })
      .eq("id", mr.id)
      .then(({ error }) => {
        if (error) {
          toast.error("Gagal menghapus lampiran dari DB");
          fetchMrData();
        } else {
          toast.success(
            `Lampiran "${attachmentToRemove.name}" berhasil dihapus.`,
          );
        }
      });
  };


  const ApprovalActions = () => {
    const activeStatuses = [
      "Pending Approval",
      "Pending Validation",
      "On Process",
    ];

    if (!mr || !currentUser) return null;
    if (!activeStatuses.includes(mr.status)) return null;
    if (myApprovalIndex === -1) return null;

    if (!isMyTurnForApproval)
      return (
        <p className="text-sm text-muted-foreground text-center">
          Menunggu persetujuan dari approver sebelumnya.
        </p>
      );

    return (
      <div className="flex gap-2">
        <Button
          className="w-full"
          onClick={() => handleApprovalAction("approved")}
          disabled={actionLoading}
        >
          {actionLoading ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <Check className="mr-2 h-4 w-4" />
          )}{" "}
          Setujui
        </Button>
        <Button
          variant="destructive"
          className="w-full"
          onClick={() => handleApprovalAction("rejected")}
          disabled={actionLoading}
        >
          {actionLoading ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <X className="mr-2 h-4 w-4" />
          )}{" "}
          Tolak
        </Button>
      </div>
    );
  };

  const getStatusBadge = (status: string) => {
    switch (status?.toLowerCase()) {
      case "approved":
        return <Badge variant="outline">Approved</Badge>;
      case "rejected":
        return <Badge variant="destructive">Rejected</Badge>;
      case "pending approval":
        return <Badge variant="secondary">Pending Approval</Badge>;
      case "pending validation":
        return <Badge variant="secondary">Pending Validation</Badge>;
      case "on hold":
        return <Badge className="bg-orange-500 text-white">On Hold</Badge>;
      case "waiting po":
        return <Badge className="bg-blue-500 text-white">Waiting PO</Badge>;
      case "pending receive":
        return <Badge className="bg-yellow-500 text-white">Pending Receive</Badge>;
      case "partial receive":
        return <Badge className="bg-amber-500 text-white">Partial Receive</Badge>;
      case "full received":
        return <Badge className="bg-green-500 text-white">Full Received</Badge>;
      case "po open":
      case "on process":
        return <Badge className="bg-cyan-500 text-white">PO Open</Badge>;
      default:
        return <Badge>{status || "N/A"}</Badge>;
    }
  };

  const getApprovalStatusBadge = (
    status: "pending" | "approved" | "rejected" | string,
  ) => {
    switch (status) {
      case "approved":
        return (
          <Badge variant="outline" className="capitalize">
            {status}
          </Badge>
        );
      case "rejected":
        return (
          <Badge variant="destructive" className="capitalize">
            {status}
          </Badge>
        );
      default:
        return (
          <Badge variant="secondary" className="capitalize">
            {status}
          </Badge>
        );
    }
  };

  const getPriorityBadge = (p?: string | null) => {
    if (!p) return null;
    let colorClass = "";
    switch (p) {
      case "P0":
        colorClass = "border-red-500 text-red-600 bg-red-50";
        break;
      case "P1":
        colorClass = "border-orange-500 text-orange-600 bg-orange-50";
        break;
      case "P2":
        colorClass = "border-yellow-500 text-yellow-600 bg-yellow-50";
        break;
      case "P3":
        colorClass = "border-green-500 text-green-600 bg-green-50";
        break;
      default:
        colorClass = "border-gray-300 text-gray-500 bg-gray-50";
    }
    return (
      <Badge
        variant="outline"
        className={cn("px-2 py-0.5 text-xs", colorClass)}
      >
        {p}
      </Badge>
    );
  };

  const getCostCenterName = () => {
    const cc = mr?.cost_centers;
    if (Array.isArray(cc) && cc.length > 0) return cc[0].name;
    if (cc && typeof cc === "object" && "name" in cc) return (cc as any).name;
    return "-";
  };

  if (loading) return <DetailMRSkeleton />;
  if (error || !mr)
    return <Content className="col-span-12">Data tidak ditemukan</Content>;

  const currentTurnIndex = mr.approvals.findIndex(
    (app) => app.status === "pending",
  );
  const allPreviousApproved =
    currentTurnIndex === -1
      ? false
      : currentTurnIndex === 0 ||
        mr.approvals
          .slice(0, currentTurnIndex)
          .every((app) => app.status === "approved");

  const isOwner = currentUser?.id === mr.userid;
  const canDelete =
    isOwner && (mr.status === "Pending Validation" || mr.status === "Draft");

  return (
    <>
      <div className="col-span-12">
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 mb-6">
          <div>
            <h1 className="text-3xl font-bold">{mr.kode_mr}</h1>
            <div className="flex items-center gap-2 mt-1">
              <span className="text-muted-foreground text-sm">
                Dibuat pada {formatDateFriendly(mr.created_at)}
              </span>
              {getStatusBadge(mr.status)}
            </div>
          </div>
          <div className="flex items-center gap-2">
            {canDelete && (
              <Button variant="destructive" size="sm" onClick={handleDelete}>
                Hapus MR
              </Button>
            )}
            {canEdit && !isEditing && mr.status === "Pending Approval" && (
              <Button
                variant="outline"
                size="sm"
                onClick={() => setIsEditing(true)}
              >
                <Edit className="mr-2 h-4 w-4" /> Edit Rincian
              </Button>
            )}
            {isOwner && !isEditing && mr.status === "On Hold" && (
              <Button size="sm" onClick={() => setIsEditing(true)}>
                <Edit className="mr-2 h-4 w-4" /> Perbaiki & Submit Ulang
              </Button>
            )}
            {isEditing && (
              <>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => {
                    setIsEditing(false);
                    fetchMrData();
                  }}
                  disabled={actionLoading}
                >
                  Batal
                </Button>
                {mr.status === "On Hold" ? (
                  <Button
                    size="sm"
                    onClick={handleResubmit}
                    disabled={actionLoading}
                  >
                    {actionLoading ? (
                      <Loader2 className="animate-spin" />
                    ) : (
                      <Save className="mr-2 h-4 w-4" />
                    )}{" "}
                    Submit Ulang
                  </Button>
                ) : (
                  <Button
                    size="sm"
                    onClick={handleSaveChanges}
                    disabled={actionLoading}
                  >
                    {actionLoading ? (
                      <Loader2 className="animate-spin" />
                    ) : (
                      <Save className="mr-2 h-4 w-4" />
                    )}{" "}
                    Simpan
                  </Button>
                )}
              </>
            )}
            <Badge variant="outline">{mr.level || "OPEN 1"}</Badge>
          </div>
        </div>
      </div>

      <div className="col-span-12 lg:col-span-8 space-y-6">
        <Content title="Informasi Utama">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-x-6 gap-y-4">
            {/* 1. PEMBUAT (Selalu Read-Only) */}
            <div className="space-y-1">
              <Label>Pembuat</Label>
              <div className="flex items-center gap-2">
                <CircleUser className="w-4 h-4 text-muted-foreground" />
                {/* Kotak mirip input tapi bukan input */}
                <div className="flex h-10 w-full items-center rounded-md border border-input bg-transparent px-3 py-2 text-sm">
                  {(mr as any).users_with_profiles?.nama || "N/A"}
                </div>
              </div>
            </div>

            {/* 2. DEPARTEMEN (Selalu Read-Only) */}
            <div className="space-y-1">
              <Label>Departemen</Label>
              <div className="flex items-center gap-2">
                <Building className="w-4 h-4 text-muted-foreground" />
                <div className="flex h-10 w-full items-center rounded-md border border-input bg-transparent px-3 py-2 text-sm">
                  {mr.department}
                </div>
              </div>
            </div>

            {/* 3. KATEGORI */}
            <div className="space-y-1">
              <Label>Kategori</Label>
              <div className="flex items-center gap-2">
                <Tag className="w-4 h-4 text-muted-foreground" />
                <div className="w-full">
                  {isEditing ? (
                    <Combobox
                      data={kategoriData}
                      onChange={(v) => setMr({ ...mr, kategori: v })}
                      defaultValue={mr.kategori}
                      disabled={actionLoading}
                      placeholder="Pilih Kategori"
                    />
                  ) : (
                    <div className="flex h-10 w-full items-center rounded-md border border-input bg-transparent px-3 py-2 text-sm">
                      {mr.kategori}
                    </div>
                  )}
                </div>
              </div>
            </div>

            {/* 4. TANGGAL DIBUAT */}
            <div className="space-y-1">
              <Label>Tanggal Dibuat</Label>
              <div className="flex items-center gap-2">
                <Calendar className="w-4 h-4 text-muted-foreground" />
                <div className="flex h-10 w-full items-center rounded-md border border-input bg-transparent px-3 py-2 text-sm">
                  {formatDateFriendly(mr.created_at)}
                </div>
              </div>
            </div>

            {/* 5. DUE DATE */}
            <div className="space-y-1">
              <Label>Due Date (Target)</Label>
              <div className="flex items-center gap-2">
                <CalendarIcon className="w-4 h-4 text-muted-foreground" />
                {isEditing ? (
                  <Popover
                    open={isDatePopoverOpen}
                    onOpenChange={setIsDatePopoverOpen}
                  >
                    <PopoverTrigger asChild>
                      <Button
                        variant="outline"
                        className={cn(
                          "w-full justify-start text-left font-normal bg-background",
                          !mr.due_date && "text-muted-foreground",
                        )}
                      >
                        {mr.due_date ? (
                          format(new Date(mr.due_date), "PPP")
                        ) : (
                          <span>Pilih tanggal...</span>
                        )}
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-auto p-0">
                      <CalendarComponent
                        mode="single"
                        selected={
                          mr.due_date ? new Date(mr.due_date) : undefined
                        }
                        onSelect={(date) => {
                          const newPriority = date
                            ? (calculatePriority(date) as any)
                            : mr.prioritas;
                          setMr({
                            ...mr,
                            due_date: date,
                            prioritas: newPriority,
                          });
                          setIsDatePopoverOpen(false);
                        }}
                        initialFocus
                      />
                    </PopoverContent>
                  </Popover>
                ) : (
                  <div className="flex h-10 w-full items-center rounded-md border border-input bg-transparent px-3 py-2 text-sm">
                    {formatDateFriendly(mr.due_date)}
                  </div>
                )}
              </div>
            </div>

            {/* 6. PRIORITAS */}
            <div className="space-y-1">
              <Label>Prioritas</Label>
              <div className="flex items-center gap-2">
                <AlertCircle className="w-4 h-4 text-muted-foreground" />
                <div className="flex h-10 w-full items-center rounded-md border border-input bg-transparent px-3 py-2 text-sm">
                  {getPriorityBadge(mr.prioritas)}
                  {isEditing && (
                    <span className="ml-2 text-[10px] text-muted-foreground">
                      *Ditentukan berdasarkan due date dan tanggal MR
                    </span>
                  )}
                </div>
              </div>
            </div>

            {/* 7. LEVEL */}
            <div className="space-y-1">
              <div className="flex items-center justify-between">
                <Label>Level</Label>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-4 w-4"
                  onClick={() => setIsLevelInfoOpen(true)}
                >
                  <HelpCircle className="h-3 w-3 text-muted-foreground" />
                </Button>
              </div>
              <div className="flex items-center gap-2">
                <Layers className="w-4 h-4 text-muted-foreground" />
                {isEditing ? (
                  <Select
                    onValueChange={(v) => setMr({ ...mr, level: v as any })}
                    value={mr.level || ""}
                    disabled={actionLoading}
                  >
                    <SelectTrigger className="w-full bg-background">
                      <SelectValue placeholder="Pilih level..." />
                    </SelectTrigger>
                    <SelectContent>
                      {MR_LEVELS.map((lvl) => (
                        <SelectItem key={lvl.value} value={lvl.value}>
                          {lvl.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                ) : (
                  <div className="flex h-10 w-full items-center rounded-md border border-input bg-transparent px-3 py-2 text-sm">
                    {mr.level || "N/A"}
                  </div>
                )}
              </div>
            </div>

            {/* 8. COST CENTER */}
            <div className="space-y-1">
              <Label>Cost Center</Label>
              <div className="flex items-center gap-2">
                <Building2 className="w-4 h-4 text-muted-foreground" />
                <div className="flex h-10 w-full items-center rounded-md border border-input bg-transparent px-3 py-2 text-sm">
                  {costCenterName
                    ? userProfile?.role === "requester"
                      ? costCenterName
                      : `${costCenterName} (Sisa: ${formatCurrency(
                          costCenterBudget ?? 0,
                        )})`
                    : "Belum Ditentukan GA"}
                </div>
              </div>
            </div>

            {/* 9. TUJUAN SITE */}
            <div className="space-y-1">
              <Label>Tujuan (Site)</Label>
              <div className="flex items-center gap-2">
                <Truck className="w-4 h-4 text-muted-foreground" />
                <div className="w-full">
                  {isEditing ? (
                    <Combobox
                      data={dataLokasi}
                      onChange={(v) => setMr({ ...mr, tujuan_site: v })}
                      defaultValue={mr.tujuan_site}
                      disabled={actionLoading}
                      placeholder="Pilih Site"
                    />
                  ) : (
                    <div className="flex h-10 w-full items-center rounded-md border border-input bg-transparent px-3 py-2 text-sm">
                      {mr.tujuan_site || "N/A"}
                    </div>
                  )}
                </div>
              </div>
            </div>

            {/* 10. TOTAL ESTIMASI */}
            <div className="space-y-1">
              <Label>Total Estimasi Biaya</Label>
              <div className="flex items-center gap-2">
                <DollarSign className="w-4 h-4 text-muted-foreground" />
                <div className="flex h-10 w-full items-center rounded-md border border-input bg-transparent px-3 py-2 text-sm font-bold">
                  {formattedCost}
                </div>
              </div>
            </div>

            {/* 11. REMARKS (Full Width) */}
            <div className="md:col-span-2 space-y-1">
              <Label>Remarks</Label>
              {isEditing ? (
                <Textarea
                  value={mr.remarks}
                  onChange={(e) => setMr({ ...mr, remarks: e.target.value })}
                  disabled={actionLoading}
                  rows={3}
                  className="bg-background resize-none"
                />
              ) : (
                <div className="w-full rounded-md border border-input bg-transparent px-3 py-2 text-sm min-h-[80px] whitespace-pre-wrap">
                  {mr.remarks || "-"}
                </div>
              )}
            </div>
          </div>
        </Content>

        {/* --- ORDER ITEMS SECTION --- */}
        <Content
          title="Daftar Barang (Item Request)"
          cardAction={
            isEditing && (
              <Button
                variant="outline"
                onClick={handleOpenAddItemDialog}
                disabled={actionLoading}
              >
                <Plus className="mr-2 h-4 w-4" /> Tambah Item
              </Button>
            )
          }
        >
          <div className="rounded-md border overflow-x-auto">
            <Table className="min-w-[1000px]">
              <TableHeader>
                <TableRow>
                  <TableHead className="w-[30%]">Nama Barang</TableHead>
                  <TableHead className="w-[80px]">Qty</TableHead>
                  <TableHead className="w-[120px]">UoM</TableHead>
                  <TableHead>Estimasi Harga</TableHead>
                  <TableHead>Total Estimasi</TableHead>
                  <TableHead>Link</TableHead>
                  <TableHead className="w-[200px]">Status & Tracking</TableHead>
                  {isEditing && (
                    <TableHead className="w-[100px]">Aksi</TableHead>
                  )}
                </TableRow>
              </TableHeader>
              <TableBody>
                {mr.orders && mr.orders.length > 0 ? (
                  mr.orders.map((item, index) => {
                    const statusColor =
                      MR_ITEM_STATUS_COLORS[item.status || "Pending"] ||
                      "bg-gray-100";
                    const statusLabel =
                      MR_ITEM_STATUS_LABELS[item.status || "Pending"] ||
                      item.status;

                    return (
                      <TableRow key={index}>
                        <TableCell>
                          {isEditing ? (
                            <div className="space-y-1">
                              <Input
                                value={item.name}
                                onChange={(e) =>
                                  handleItemChange(
                                    index,
                                    "name",
                                    e.target.value,
                                  )
                                }
                                disabled={actionLoading}
                                placeholder="Nama Item"
                              />
                              <Input
                                value={item.part_number || ""}
                                onChange={(e) =>
                                  handleItemChange(
                                    index,
                                    "part_number",
                                    e.target.value,
                                  )
                                }
                                disabled={actionLoading}
                                placeholder="Part Number (Opsional)"
                                className="text-xs h-8"
                              />
                            </div>
                          ) : (
                            <div>
                              <div className="font-medium flex items-center gap-2">
                                {item.name}
                                <AssetGoodsBadge
                                  isAsset={
                                    !!(
                                      item.barang_id &&
                                      barangAssetMap[item.barang_id]
                                    )
                                  }
                                />
                                <ItemLevelBadge level={item.level} />
                              </div>
                              {item.part_number && (
                                <div className="text-xs text-muted-foreground font-mono mt-0.5">
                                  PN: {item.part_number}
                                </div>
                              )}
                              {item.note && (
                                <div className="text-xs text-muted-foreground mt-1 italic">
                                  &quot;{item.note}&quot;
                                </div>
                              )}
                              {item.status_note && (
                                <div className="text-xs text-amber-600 mt-1 italic flex items-start gap-1">
                                  <Info className="w-3 h-3 mt-0.5" />
                                  {item.status_note}
                                </div>
                              )}
                            </div>
                          )}
                        </TableCell>
                        <TableCell>
                          {isEditing ? (
                            <Input
                              value={item.qty}
                              onChange={(e) =>
                                handleItemChange(index, "qty", e.target.value)
                              }
                              className="w-20"
                              type="number"
                              disabled={actionLoading}
                            />
                          ) : (
                            item.qty
                          )}
                        </TableCell>
                        <TableCell>
                          {isEditing ? (
                            <Input
                              value={item.uom}
                              onChange={(e) =>
                                handleItemChange(index, "uom", e.target.value)
                              }
                              className="w-24"
                              disabled={actionLoading}
                            />
                          ) : (
                            item.uom
                          )}
                        </TableCell>
                        <TableCell className="text-right">
                          {isEditing ? (
                            <CurrencyInput
                              value={item.estimasi_harga}
                              onValueChange={(value) =>
                                handleItemChange(index, "estimasi_harga", value)
                              }
                              disabled={actionLoading}
                              className="w-32"
                            />
                          ) : (
                            formatCurrency(item.estimasi_harga)
                          )}
                        </TableCell>
                        <TableCell className="text-right font-medium">
                          {formatCurrency(
                            Number(item.qty) * item.estimasi_harga,
                          )}
                        </TableCell>
                        <TableCell>
                          {isEditing ? (
                            <Input
                              value={item.url}
                              onChange={(e) =>
                                handleItemChange(index, "url", e.target.value)
                              }
                              disabled={actionLoading}
                              type="url"
                              placeholder="URL Link"
                            />
                          ) : (
                            item.url && (
                              <Button asChild variant={"outline"} size="sm">
                                <Link
                                  href={item.url}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                >
                                  <LinkIcon className="h-3 w-3" />
                                </Link>
                              </Button>
                            )
                          )}
                        </TableCell>

                        <TableCell>
                          <div className="flex flex-col items-start gap-2">
                            <div className="flex items-center gap-1">
                              <Badge
                                variant="outline"
                                className={cn(
                                  "capitalize font-normal",
                                  statusColor,
                                )}
                              >
                                {statusLabel}
                              </Badge>
                              {isPurchasing && item.part_number && (
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  className="h-6 w-6"
                                  onClick={() =>
                                    handleOpenItemStatusDialog(item)
                                  }
                                  title="Kelola status & PO"
                                >
                                  <Pencil className="h-3 w-3" />
                                </Button>
                              )}
                            </div>

                            {(() => {
                              const linkedPos = item.part_number
                                ? poBreakdown[item.part_number] || []
                                : [];
                              if (linkedPos.length === 0) return null;
                              const cumulativeQty = linkedPos.reduce(
                                (sum, entry) => sum + (entry.qty || 0),
                                0,
                              );
                              const requestedQty = Number(item.qty) || 0;
                              return (
                                <div className="flex flex-col gap-1">
                                  <div className="flex flex-wrap gap-1">
                                    {linkedPos.map((entry, idx) => (
                                      <Link
                                        key={idx}
                                        href={`/purchase-order?search=${encodeURIComponent(
                                          entry.kode_po,
                                        )}`}
                                        className="text-[10px] bg-secondary text-secondary-foreground px-2 py-0.5 rounded-sm hover:underline flex items-center gap-1"
                                        target="_blank"
                                      >
                                        <LinkIcon className="w-3 h-3" />
                                        {entry.kode_po} ({entry.qty})
                                      </Link>
                                    ))}
                                  </div>
                                  <span
                                    className={cn(
                                      "text-[10px]",
                                      cumulativeQty >= requestedQty
                                        ? "text-emerald-600"
                                        : "text-amber-600",
                                    )}
                                  >
                                    Qty ter-PO: {cumulativeQty} /{" "}
                                    {requestedQty} {item.uom}
                                  </span>
                                </div>
                              );
                            })()}

                            {isOwner &&
                              item.status === "Pending BAST" &&
                              item.part_number && (
                                <Button
                                  size="sm"
                                  variant="outline"
                                  className="h-7 text-xs"
                                  onClick={() => handleOpenBastUpload(item)}
                                >
                                  <Upload className="mr-1 h-3 w-3" /> Upload
                                  BAST
                                </Button>
                              )}

                            {item.bast_attachments &&
                              item.bast_attachments.length > 0 && (
                                <div className="flex flex-wrap gap-1">
                                  {item.bast_attachments.map((att, idx) => (
                                    <div
                                      key={idx}
                                      className="text-[10px] bg-emerald-50 text-emerald-700 pl-2 pr-1 py-0.5 rounded-sm flex items-center gap-1"
                                    >
                                      <Link
                                        href={resolveAttachmentUrl(att.url)}
                                        target="_blank"
                                        className="hover:underline flex items-center gap-1"
                                      >
                                        <FileText className="w-3 h-3" />
                                        {att.name}
                                      </Link>
                                      {isOwner && (
                                        <button
                                          type="button"
                                          onClick={() =>
                                            handleRemoveItemBast(item, att.url)
                                          }
                                          className="hover:text-red-600"
                                          title="Hapus lampiran"
                                        >
                                          <X className="w-3 h-3" />
                                        </button>
                                      )}
                                    </div>
                                  ))}
                                </div>
                              )}
                          </div>
                        </TableCell>

                        {isEditing && (
                          <TableCell>
                            <div className="flex gap-1">
                              <Button
                                variant="outline"
                                size="icon"
                                onClick={() => handleOpenEditItemDialog(index)}
                                disabled={actionLoading}
                              >
                                <Edit className="h-4 w-4" />
                              </Button>
                              <Button
                                variant="destructive"
                                size="icon"
                                onClick={() => removeItem(index)}
                                disabled={actionLoading}
                              >
                                <Trash2 className="h-4 w-4" />
                              </Button>
                            </div>
                          </TableCell>
                        )}
                      </TableRow>
                    );
                  })
                ) : (
                  <TableRow>
                    <TableCell
                      colSpan={isEditing ? 8 : 7}
                      className="text-center text-muted-foreground h-24"
                    >
                      Tidak ada barang.
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </div>
        </Content>
      </div>

      <div className="col-span-12 lg:col-span-4 space-y-6">
        <Content title="Tindakan">
          <div className="flex flex-col gap-2">
            {!isEditing && <ApprovalActions />}
            {isEditing && (
              <p className="text-sm text-center text-muted-foreground">
                Simpan perubahan atau setujui untuk melanjutkan.
                <br />
                {isMyTurnForApproval && (
                  <strong>(Menyetujui akan menyimpan otomatis)</strong>
                )}
              </p>
            )}
          </div>
        </Content>

        <Content title="Jalur Approval">
          {mr.approvals.length > 0 ? (
            <ul className="space-y-2">
              {mr.approvals.map((approver, index) => {
                const isMyTurn =
                  currentTurnIndex === index &&
                  (currentTurnIndex === 0 || allPreviousApproved);
                return (
                  <li
                    key={index}
                    className={cn(
                      "flex items-center justify-between gap-4 p-3 rounded-md transition-all",
                      isMyTurn && "bg-primary/10 ring-2 ring-primary/50",
                    )}
                  >
                    <div>
                      <div className="font-semibold flex items-center gap-2">
                        {approver.nama}
                        <Badge variant={"outline"}>{approver.department}</Badge>
                      </div>
                      <p className="text-sm text-muted-foreground">
                        {approver.type}
                      </p>
                      {approver.status !== "pending" &&
                        approver.processed_at && (
                          <p className="text-xs text-muted-foreground italic mt-1">
                            {formatDateWithTime(approver.processed_at)}
                          </p>
                        )}
                    </div>
                    {getApprovalStatusBadge(
                      approver.status as "approved" | "rejected" | "pending",
                    )}
                  </li>
                );
              })}
            </ul>
          ) : (
            <p className="text-sm text-muted-foreground text-center">
              Jalur approval belum ditentukan oleh GA.
            </p>
          )}
        </Content>
        <Content title="Lampiran">
          {isEditing ? (
            <div className="space-y-4">
              <Label htmlFor="attachments">Tambah Lampiran</Label>
              <Input
                id="attachments"
                type="file"
                multiple
                disabled={actionLoading || isUploading}
                onChange={handleAttachmentUpload}
              />
              {isUploading && (
                <div className="flex items-center text-sm text-muted-foreground">
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />{" "}
                  Mengunggah...
                </div>
              )}
              {mr.attachments.length > 0 && (
                <ul className="space-y-2 mt-2">
                  {mr.attachments.map((file, index) => (
                    <li
                      key={index}
                      className="flex items-center justify-between text-sm p-2 bg-muted/50 rounded"
                    >
                      <div className="flex items-center gap-2 truncate min-w-0">
                        <Paperclip className="h-4 w-4 flex-shrink-0" />
                        <span className="truncate">{file.name}</span>
                      </div>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-6 w-6"
                        onClick={() => removeAttachment(index)}
                      >
                        <Trash2 className="h-4 w-4 text-destructive" />
                      </Button>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          ) : (mr.attachments || []).length > 0 ? (
            <ul className="space-y-2">
              {(mr.attachments as Attachment[]).map((file, index) => (
                <li key={index}>
                  <Link
                    href={resolveAttachmentUrl(file.url)}
                    target="_blank"
                    className="flex items-center gap-2 text-sm text-primary hover:underline"
                  >
                    <Paperclip className="h-4 w-4" />
                    <span>{file.name}</span>
                    <ExternalLink className="h-3 w-3 text-muted-foreground" />
                  </Link>
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-sm text-muted-foreground">Tidak ada lampiran.</p>
          )}
        </Content>
      </div>

      <div className="col-span-12">
        <DiscussionSection
          mrId={String(mr.id)}
          initialDiscussions={mr.discussions as Discussion[]}
        />
      </div>

      {/* Dialog Item (Updated with Part Number & Status Preservation) */}
      <Dialog open={openItemDialog} onOpenChange={setOpenItemDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {editingIndex !== null ? "Edit Order Item" : "Tambah Order Item"}
            </DialogTitle>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="grid grid-cols-4 items-center gap-4">
              <Label htmlFor="itemNameDlg" className="text-right">
                Nama Item
              </Label>
              <Input
                id="itemNameDlg"
                className="col-span-3"
                value={orderItem.name}
                onChange={(e) =>
                  setOrderItem({ ...orderItem, name: e.target.value })
                }
              />
            </div>
            <div className="grid grid-cols-4 items-center gap-4">
              <Label htmlFor="itemPnDlg" className="text-right">
                Part Number
              </Label>
              <Input
                id="itemPnDlg"
                className="col-span-3"
                value={orderItem.part_number || ""}
                onChange={(e) =>
                  setOrderItem({ ...orderItem, part_number: e.target.value })
                }
                placeholder="(Opsional)"
              />
            </div>
            <div className="grid grid-cols-4 items-center gap-4">
              <Label htmlFor="itemUomDlg" className="text-right">
                UoM
              </Label>
              <div className="col-span-3">
                <Combobox
                  data={dataUoM}
                  onChange={(v) => setOrderItem({ ...orderItem, uom: v })}
                  defaultValue={orderItem.uom}
                  placeholder="Pilih UoM..."
                />
              </div>
            </div>
            <div className="grid grid-cols-4 items-center gap-4">
              <Label htmlFor="itemQtyDlg" className="text-right">
                Quantity
              </Label>
              <Input
                id="itemQtyDlg"
                className="col-span-3"
                type="number"
                value={orderItem.qty}
                onChange={(e) =>
                  setOrderItem({ ...orderItem, qty: e.target.value })
                }
              />
            </div>
            <div className="grid grid-cols-4 items-center gap-4">
              <Label htmlFor="estimasi_harga" className="text-right">
                Estimasi Harga
              </Label>
              <CurrencyInput
                id="estimasi_harga"
                className="col-span-3"
                value={orderItem.estimasi_harga}
                onValueChange={(value) =>
                  setOrderItem({ ...orderItem, estimasi_harga: value })
                }
              />
            </div>
            <div className="grid grid-cols-4 items-center gap-4">
              <Label htmlFor="itemUrlDlg" className="text-right">
                Link Ref.
              </Label>
              <Input
                id="itemUrlDlg"
                type="url"
                className="col-span-3"
                value={orderItem.url}
                onChange={(e) =>
                  setOrderItem({ ...orderItem, url: e.target.value })
                }
                placeholder="(Opsional)"
              />
            </div>
            <div className="grid grid-cols-4 items-center gap-4">
              <Label htmlFor="itemNoteDlg" className="text-right">
                Catatan
              </Label>
              <Textarea
                id="itemNoteDlg"
                className="col-span-3"
                value={orderItem.note}
                onChange={(e) =>
                  setOrderItem({ ...orderItem, note: e.target.value })
                }
                placeholder="(Opsional)"
              />
            </div>
          </div>
          <DialogFooter>
            <Button onClick={handleSaveOrUpdateItem}>
              {editingIndex !== null ? "Simpan Perubahan" : "Tambah"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Dialog Info Level */}
      <Dialog open={isLevelInfoOpen} onOpenChange={setIsLevelInfoOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Keterangan Level Material Request</DialogTitle>
            <DialogDescription>
              Level ini melacak status fisik barang setelah MR disetujui.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4 max-h-[60vh] overflow-y-auto">
            <h4 className="font-semibold">
              Level OPEN (Barang Belum Diterima Site)
            </h4>
            <ul className="list-disc pl-5 space-y-2 text-sm">
              {MR_LEVELS.filter((l) => l.group === "OPEN").map((level) => (
                <li key={level.value}>
                  <strong>{level.value}:</strong> {level.description}
                </li>
              ))}
            </ul>
            <h4 className="font-semibold">
              Level CLOSE (Barang Sudah Diterima Site)
            </h4>
            <ul className="list-disc pl-5 space-y-2 text-sm">
              {MR_LEVELS.filter((l) => l.group === "CLOSE").map((level) => (
                <li key={level.value}>
                  <strong>{level.value}:</strong> {level.description}
                </li>
              ))}
            </ul>
          </div>
          <DialogFooter>
            <Button onClick={() => setIsLevelInfoOpen(false)}>Tutup</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Dialog Kelola Status & PO per Item */}
      <Dialog open={isItemStatusOpen} onOpenChange={setIsItemStatusOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Kelola Status & PO Barang</DialogTitle>
            <DialogDescription>
              Ubah status barang{" "}
              <strong>{selectedItemForStatus?.name}</strong> secara manual,
              atau cek PO mana saja yang sudah meng-cover item ini.
            </DialogDescription>
          </DialogHeader>

          <div className="grid gap-4 py-2">
            {selectedItemForStatus?.level && (
              <div className="flex items-center justify-between rounded-md border p-3">
                <div>
                  <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
                    Level
                  </p>
                  <ItemLevelBadge
                    level={selectedItemForStatus.level}
                    className="mt-1 text-xs px-2 py-0.5"
                  />
                </div>
                {canTogglePaymentIssue &&
                  (selectedItemForStatus.level === "Open 3A" ||
                    selectedItemForStatus.level === "Open 3B") && (
                    <Button
                      size="sm"
                      variant={
                        selectedItemForStatus.level === "Open 3B"
                          ? "destructive"
                          : "outline"
                      }
                      disabled={savingItemStatus}
                      onClick={handleTogglePaymentIssue}
                    >
                      {selectedItemForStatus.level === "Open 3B"
                        ? "Lepas Payment Issue"
                        : "Tandai Payment Issue"}
                    </Button>
                  )}
              </div>
            )}

            {selectedItemForStatus?.part_number && (
              <div className="rounded-md border p-3 space-y-2">
                <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
                  PO Terhubung
                </p>
                {(poBreakdown[selectedItemForStatus.part_number] || [])
                  .length > 0 ? (
                  <>
                    <ul className="space-y-1 text-sm">
                      {poBreakdown[selectedItemForStatus.part_number].map(
                        (entry, idx) => (
                          <li
                            key={idx}
                            className="flex items-center justify-between gap-2"
                          >
                            <Link
                              href={`/purchase-order?search=${encodeURIComponent(
                                entry.kode_po,
                              )}`}
                              className="hover:underline flex items-center gap-1"
                              target="_blank"
                            >
                              <LinkIcon className="w-3 h-3" />
                              {entry.kode_po}
                              {entry.is_manual && (
                                <Badge
                                  variant="outline"
                                  className="text-[9px] px-1 py-0 font-normal"
                                >
                                  manual
                                </Badge>
                              )}
                            </Link>
                            <span className="flex items-center gap-1 text-muted-foreground">
                              {entry.qty} {selectedItemForStatus.uom} •{" "}
                              {entry.po_status}
                              {entry.is_manual && (
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  className="h-5 w-5"
                                  disabled={savingManualLink}
                                  onClick={() =>
                                    handleRemoveManualLink(entry.kode_po)
                                  }
                                  title="Hapus link manual ini"
                                >
                                  <X className="h-3 w-3 text-destructive" />
                                </Button>
                              )}
                            </span>
                          </li>
                        ),
                      )}
                    </ul>
                    <p className="text-xs text-muted-foreground pt-1 border-t">
                      Total ter-PO:{" "}
                      {poBreakdown[selectedItemForStatus.part_number].reduce(
                        (sum, entry) => sum + (entry.qty || 0),
                        0,
                      )}{" "}
                      / {Number(selectedItemForStatus.qty) || 0}{" "}
                      {selectedItemForStatus.uom}
                    </p>
                  </>
                ) : (
                  <p className="text-sm text-muted-foreground">
                    Belum ada PO yang meng-cover item ini.
                  </p>
                )}
              </div>
            )}

            {selectedItemForStatus?.part_number && (
              <div className="rounded-md border p-3 space-y-2">
                <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
                  Link Manual ke PO
                </p>
                <p className="text-xs text-muted-foreground">
                  Dipakai kalau barang yang dibeli disubstitusi/diganti pas
                  belanja (part_number PO beda dari part_number MR ini),
                  sehingga tidak ke-detect otomatis.
                </p>
                <div className="flex gap-2">
                  <Select
                    value={manualLinkPoCode}
                    onValueChange={setManualLinkPoCode}
                  >
                    <SelectTrigger className="flex-1">
                      <SelectValue placeholder="Pilih PO..." />
                    </SelectTrigger>
                    <SelectContent>
                      {posForMr.length === 0 && (
                        <div className="px-2 py-1.5 text-xs text-muted-foreground">
                          Belum ada PO di MR ini.
                        </div>
                      )}
                      {posForMr.map((po) => (
                        <SelectItem key={po.id} value={po.kode_po}>
                          {po.kode_po} ({po.status})
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <Input
                    type="number"
                    min="1"
                    placeholder="Qty"
                    className="w-24"
                    value={manualLinkQty}
                    onChange={(e) => setManualLinkQty(e.target.value)}
                  />
                  <Button
                    size="sm"
                    onClick={handleAddManualLink}
                    disabled={savingManualLink}
                  >
                    {savingManualLink ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      "Tambah"
                    )}
                  </Button>
                </div>
              </div>
            )}

            <div className="grid gap-2">
              <Label htmlFor="item-status">Status Barang</Label>
              <Select
                value={itemStatusForm.status}
                onValueChange={(val) =>
                  setItemStatusForm({ ...itemStatusForm, status: val })
                }
              >
                <SelectTrigger id="item-status">
                  <SelectValue placeholder="Pilih Status" />
                </SelectTrigger>
                <SelectContent>
                  {Object.entries(MR_ITEM_STATUS_LABELS).map(
                    ([key, label]) => (
                      <SelectItem key={key} value={key}>
                        {label}
                      </SelectItem>
                    ),
                  )}
                </SelectContent>
              </Select>
            </div>

            <div className="grid gap-2">
              <Label htmlFor="item-status-note">Catatan / Alasan</Label>
              <Textarea
                id="item-status-note"
                placeholder="Contoh: Stok habis, diganti dengan tipe X..."
                value={itemStatusForm.note}
                onChange={(e) =>
                  setItemStatusForm({
                    ...itemStatusForm,
                    note: e.target.value,
                  })
                }
              />
            </div>
          </div>

          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setIsItemStatusOpen(false)}
              disabled={savingItemStatus}
            >
              Batal
            </Button>
            <Button onClick={handleSaveItemStatus} disabled={savingItemStatus}>
              {savingItemStatus && (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              )}
              Simpan Perubahan
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Dialog Upload BAST per Item */}
      <Dialog open={isBastUploadOpen} onOpenChange={setIsBastUploadOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Upload BAST Barang</DialogTitle>
            <DialogDescription>
              Unggah Berita Acara Serah Terima (BAST) atau bukti penerimaan
              untuk <strong>{selectedItemForBast?.name}</strong>. Item ini
              akan ditandai selesai setelah bukti diunggah.
            </DialogDescription>
          </DialogHeader>
          <div className="py-4">
            <Label htmlFor="item-bast-file">File BAST / Bukti Foto</Label>
            <Input
              id="item-bast-file"
              type="file"
              multiple
              onChange={(e) => setBastFiles(e.target.files)}
              className="mt-2"
            />
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setIsBastUploadOpen(false)}
              disabled={uploadingBast}
            >
              Batal
            </Button>
            <Button onClick={handleUploadItemBast} disabled={uploadingBast}>
              {uploadingBast && (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              )}
              Upload & Selesaikan
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}

const DetailMRSkeleton = () => (
  <>
    <div className="col-span-12">
      <Skeleton className="h-12 w-1/2" />
    </div>
    <Content className="col-span-12 lg:col-span-8">
      <Skeleton className="h-64 w-full" />
    </Content>
    <Content className="col-span-12 lg:col-span-4">
      <Skeleton className="h-64 w-full" />
    </Content>
  </>
);

export default function DetailMRPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const resolvedParams = use(params);
  return (
    <Suspense fallback={<DetailMRSkeleton />}>
      <DetailMRPageContent params={resolvedParams} />
    </Suspense>
  );
}

const InfoItem = ({
  icon: Icon,
  label,
  value,
  isBlock = false,
}: {
  icon: React.ElementType;
  label: string;
  value: React.ReactNode;
  isBlock?: boolean;
}) => (
  <div
    className={cn(
      isBlock ? "flex flex-col gap-1" : "grid grid-cols-3 gap-x-2 items-start",
    )}
  >
    <div className="text-sm text-muted-foreground col-span-1 flex items-center gap-2 mt-0.5">
      <Icon className="h-4 w-4 flex-shrink-0" />
      {label}
    </div>
    <div className="text-sm font-semibold col-span-2 whitespace-pre-wrap break-words">
      {value}
    </div>
  </div>
);
