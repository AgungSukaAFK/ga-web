// src/app/(With Sidebar)/purchase-order/[id]/page.tsx

"use client";

import { use, useEffect, useState, Suspense } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { uploadAttachmentVps } from "@/services/storageService";
import {
  resolveAttachmentUrl,
  getAttachmentSizeError,
  getUploadErrorMessage,
} from "@/lib/attachments";
import { isGADepartment } from "@/lib/constants/departments";
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
  Truck,
  Building2,
  AlertTriangle,
  Check,
  X,
  Loader2,
  Paperclip,
  ExternalLink,
  Wallet,
  Eye,
  Edit as EditIcon,
  Printer,
  Zap,
  Layers,
  HelpCircle,
  PackageCheck,
  ArrowRightLeft,
  Pencil,
  FileText,
} from "lucide-react";
import Link from "next/link";
import { Skeleton } from "@/components/ui/skeleton";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { User as AuthUser } from "@supabase/supabase-js";
import {
  PurchaseOrderDetail,
  Approval,
  Profile,
  Discussion,
  Order,
  Attachment,
  ReceiveRecord,
} from "@/type";
import {
  formatCurrency,
  formatDateFriendly,
  cn,
  formatDateWithTime,
} from "@/lib/utils";
import {
  fetchPurchaseOrderById,
  submitReceiveRecord,
  deriveReceiveDrivenStatus,
  fetchBarangAssetFlags,
} from "@/services/purchaseOrderService";
import { ReceiveGoodsDialog } from "./ReceiveGoodsDialog";
import {
  updateMrItemStatus, // Pastikan ini sudah ada dari Langkah 2
  normalizeMrOrders, // Pastikan ini sudah ada dari Langkah 1
  recalculateMrStatus,
  recalculateMrLevel,
  removeBastForMrItem,
} from "@/services/mrService";
import { notifyOnPOApproval } from "@/lib/notifications/client";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { DiscussionSection } from "../../material-request/[id]/discussion-component";
import { QRCodeCanvas } from "qrcode.react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { differenceInCalendarDays } from "date-fns";
import {
  MR_LEVELS,
  MR_ITEM_STATUS_COLORS,
  MR_ITEM_STATUS_LABELS,
  APPROVAL_TYPE_PAYMENT_APPROVAL,
  APPROVAL_TYPE_PAYMENT_VALIDATOR,
  APPROVAL_TYPE_RECEIVER,
  PO_STATUS_PENDING_RECEIVE,
  PO_STATUS_PARTIAL_RECEIVE,
  PO_STATUS_FULL_RECEIVED,
  PO_REF_STATUS_COLORS,
  PO_REF_STATUS_COLOR_DEFAULT,
  isDpBpPaymentTerm,
  isPaymentValidatorApproval,
} from "@/type/enum";
import { ItemLevelBadge } from "@/components/item-level-badge";
import { AssetGoodsBadge } from "@/components/asset-goods-badge";

const PPH_LABELS: Record<string, string> = {
  pph21_npwp: "PPH 21 — Dengan NPWP",
  pph21_non_npwp: "PPH 21 — Tanpa NPWP",
  pph23_npwp: "PPH 23 — Dengan NPWP",
  pph23_non_npwp: "PPH 23 — Tanpa NPWP",
};

const COMPANY_DETAILS = {
  GMI: {
    name: "PT. Garuda Mart Indonesia",
    logo: "/gmi-logo.webp",
    address: "Sakura Regency Blok J5-8A, Jatiasih, Bekasi 17423 - Indonesia",
    phone: "(021) 824-073-09",
    email: "info@garudamart.com",
  },
  GIS: {
    name: "PT. Global Inti Sejati",
    logo: "/gis-logo.webp",
    address:
      "Jl. Wibawa Mukti II No.88, RT.003/RW.001, Jatiluhur, Kec. Jatiasih, Kota Bks, Jawa Barat 17425",
    phone: "(021) 82-741-900 ",
    email: "info@globalinti.com",
  },
  LOURDES: {
    name: "Lourdes Auto Parts",
    logo: "/lourdes-logo.webp",
    address: "Sakura Regency J5-8A, Jati Asih, Bekasi 17423",
    phone: "(+021) 82407309",
    email: "info@garudamart.com",
  },
  DEFAULT: {
    name: "Nama Perusahaan Default",
    logo: "/lourdes-logo.webp",
    address: "Alamat Default",
    phone: "Telepon Default",
    email: "email@default.com",
  },
};

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
    className={cn(isBlock ? "flex flex-col gap-1" : "grid grid-cols-3 gap-x-2")}
  >
    <dt className="text-sm text-muted-foreground col-span-1 flex items-center gap-2">
      <Icon className="h-4 w-4" />
      {label}
    </dt>
    <dd className="text-sm font-semibold col-span-2 whitespace-pre-wrap">
      {value}
    </dd>
  </div>
);

const DetailPOSkeleton = () => (
  <>
    <div className="col-span-12">
      <Skeleton className="h-12 w-1/2" />
    </div>
    <Content className="col-span-12 lg:col-span-8">
      <Skeleton className="h-96 w-full" />
    </Content>
    <Content className="col-span-12 lg:col-span-4">
      <Skeleton className="h-96 w-full" />
    </Content>
  </>
);

function DetailPOPageContent({ params }: { params: { id: string } }) {
  const poId = parseInt(params.id);
  const router = useRouter();
  const supabase = createClient();

  const [po, setPo] = useState<PurchaseOrderDetail | null>(null);
  const [currentUser, setCurrentUser] = useState<AuthUser | null>(null);
  const [userProfile, setUserProfile] = useState<Profile | null>(null);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // State upload lampiran (PO/Finance/Invoice) langsung dari halaman detail
  const [isUploadingPO, setIsUploadingPO] = useState(false);
  const [isUploadingFinance, setIsUploadingFinance] = useState(false);
  const [isUploadingInvoice, setIsUploadingInvoice] = useState(false);

  // State Dialogs
  const [isBudgetDialogOpen, setIsBudgetDialogOpen] = useState(false);
  const [isLevelInfoOpen, setIsLevelInfoOpen] = useState(false);

  // --- STATE UNTUK EDIT STATUS MR ITEM (BARU) ---
  const [isEditStatusOpen, setIsEditStatusOpen] = useState(false);
  const [selectedItemToEdit, setSelectedItemToEdit] = useState<Order | null>(
    null,
  );
  const [editForm, setEditForm] = useState({
    status: "",
    note: "",
  });
  // ----------------------------------------------

  const [qrUrl, setQrUrl] = useState("");

  // State Dialog Progress Pembayaran DP & BP (khusus Payment Validator).
  // `dpBpDialogMode` "approve" = lagi approve step Payment Validator (lewat
  // handleApprovalAction); "edit" = edit dp_paid/bp_paid kapan aja di luar
  // approval turn (lewat handleEditDpBpPayment) - dp/bp SELALU bisa diedit
  // ulang oleh Payment Validator/admin, tidak cuma sekali pas approve.
  const [isDpBpDialogOpen, setIsDpBpDialogOpen] = useState(false);
  const [dpBpDialogMode, setDpBpDialogMode] = useState<"approve" | "edit">(
    "approve",
  );
  const [dpChecked, setDpChecked] = useState(false);
  const [bpChecked, setBpChecked] = useState(false);

  // State modal checklist penerimaan barang (Receiver) - dipakai dari step
  // approval "Receiver" maupun tombol "Terima Barang" manual.
  const [isReceiveDialogOpen, setIsReceiveDialogOpen] = useState(false);
  const [isPrintingReceive, setIsPrintingReceive] = useState(false);

  // Peta barang_id -> is_asset utk badge Aset/Barang di tabel "Referensi
  // Barang dari MR" (item PO sendiri sudah punya is_asset langsung).
  const [barangAssetMap, setBarangAssetMap] = useState<Record<number, boolean>>(
    {},
  );

  // Peta kode_po -> {id, status} utk semua PO sesama-MR (termasuk yang
  // Rejected, beda dgn fetchPosForMr) - dipakai buat warna badge "Status &
  // PO Refs" dan lookup id saat badge di-klik (buka modal Quick View PO).
  const [poRefsMap, setPoRefsMap] = useState<
    Record<string, { id: number; status: string }>
  >({});
  const [poRefDialogOpen, setPoRefDialogOpen] = useState(false);
  const [poRefLoading, setPoRefLoading] = useState(false);
  const [poRefDetail, setPoRefDetail] = useState<PurchaseOrderDetail | null>(
    null,
  );

  const fetchPoData = async () => {
    if (isNaN(poId)) {
      setError("ID Purchase Order tidak valid.");
      return null;
    }

    try {
      const data = await fetchPurchaseOrderById(poId);
      if (!data) throw new Error("Data PO tidak ditemukan.");

      const initialData = {
        ...data,
        attachments: Array.isArray(data.attachments) ? data.attachments : [],
        material_requests: data.material_requests
          ? {
              ...data.material_requests,
              // GUNAKAN normalizeMrOrders AGAR FIELD STATUS AMAN
              orders: normalizeMrOrders(
                Array.isArray(data.material_requests.orders)
                  ? data.material_requests.orders
                  : [],
              ),
              discussions: Array.isArray(data.material_requests.discussions)
                ? data.material_requests.discussions
                : [],
            }
          : null,
        approvals: Array.isArray(data.approvals) ? data.approvals : [],
        items: Array.isArray(data.items) ? data.items : [],
      };
      setPo(initialData as any);
      return initialData;
    } catch (poError: any) {
      setError("Gagal memuat data PO.");
      toast.error("Gagal memuat data", { description: poError.message });
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
      await fetchPoData();
      setLoading(false);

      setQrUrl(`${window.location.origin}/approval-po/${poId}`);
    };
    initializePage();
  }, [poId]);

  useEffect(() => {
    const barangIds = (po?.material_requests?.orders || [])
      .map((o: any) => o.barang_id)
      .filter((id: any): id is number => !!id);
    if (barangIds.length === 0) return;
    fetchBarangAssetFlags(barangIds).then(setBarangAssetMap);
  }, [po?.material_requests?.orders]);

  useEffect(() => {
    if (!po?.mr_id) return;
    supabase
      .from("purchase_orders")
      .select("id, kode_po, status")
      .eq("mr_id", po.mr_id)
      .then(({ data }) => {
        if (!data) return;
        const map: Record<string, { id: number; status: string }> = {};
        for (const row of data) {
          map[row.kode_po] = { id: row.id, status: row.status };
        }
        setPoRefsMap(map);
      });
  }, [po?.mr_id]);

  const getCostCenterName = () => {
    const cc = po?.material_requests?.cost_centers;
    if (Array.isArray(cc)) return cc[0]?.name || "-";
    if (cc && typeof cc === "object") return (cc as any).name || "-";
    return "-";
  };

  const getDaysRemaining = (dueDateString?: Date | string) => {
    if (!dueDateString) return "";
    const today = new Date();
    const target = new Date(dueDateString);
    const diff = differenceInCalendarDays(target, today);

    if (diff < 0) return `(Terlewat ${Math.abs(diff)} hari)`;
    if (diff === 0) return "(Hari ini)";
    return `(${diff} hari lagi)`;
  };

  const getVendorData = () => {
    const details = po?.vendor_details as any;
    if (!details)
      return {
        name: "N/A",
        address: "N/A",
        contact: "N/A",
        email: "N/A",
        code: "",
      };

    return {
      name: details.nama_vendor || details.name || "N/A",
      address: details.alamat || details.address || "N/A",
      contact: details.contact_person || details.cp || details.contact || "N/A",
      email: details.email || "N/A",
      code: details.kode_vendor || "",
    };
  };

  const isMrItemInPO = (mrItem: any) => {
    if (!po?.items) return false;
    // Strict Part Number check
    if (!mrItem.part_number) return false;
    return po.items.some((poItem) => poItem.part_number === mrItem.part_number);
  };

  const handleOpenPoRef = async (kodePo: string) => {
    const ref = poRefsMap[kodePo];
    const id = ref?.id ?? (kodePo === po?.kode_po ? po?.id : undefined);
    if (!id) {
      toast.error("PO tidak ditemukan", { description: kodePo });
      return;
    }

    setPoRefDialogOpen(true);
    setPoRefDetail(null);

    // PO yang lagi dibuka halamannya sendiri - langsung pakai data yang
    // sudah ada, gak perlu fetch ulang.
    if (id === po?.id) {
      setPoRefDetail(po);
      return;
    }

    setPoRefLoading(true);
    try {
      const data = await fetchPurchaseOrderById(id);
      setPoRefDetail(data);
    } catch (e: any) {
      toast.error("Gagal memuat detail PO", { description: e.message });
      setPoRefDialogOpen(false);
    } finally {
      setPoRefLoading(false);
    }
  };

  const vendorData = getVendorData();
  const myApprovalIndex =
    po && currentUser && po.approvals
      ? po.approvals.findIndex(
          (a) => a.userid === currentUser.id && a.status === "pending",
        )
      : -1;

  const isMyTurnForApproval =
    myApprovalIndex !== -1 && po && po.approvals
      ? po.approvals
          .slice(0, myApprovalIndex)
          .every((a) => a.status === "approved")
      : false;

  // PO dengan payment_term "DP & Pelunasan" perlu konfirmasi progress DP/BP
  // saat approver bertipe "Payment Validator" akan menyetujui.
  const myApproval =
    myApprovalIndex !== -1 && po?.approvals
      ? po.approvals[myApprovalIndex]
      : null;
  const isPaymentValidatorTurn = isPaymentValidatorApproval(myApproval);
  const isDpBpPO = isDpBpPaymentTerm(po?.payment_term);
  // Skema pengiriman DP&BP PO ini - "ship_after_dp" berarti vendor boleh
  // kirim & GA boleh terima barang begitu DP lunas (BP nyusul belakangan).
  // Selain itu (termasuk null/default) berarti barang baru dikirim & diterima
  // setelah DP dan BP sama-sama lunas. Dipakai buat bikin dialog approval
  // Payment Validator & info di halaman ini konsisten dengan logic di
  // handleApprovalAction.
  const dpBpRequiresFullPayment = po?.dp_bp_shipping_type !== "ship_after_dp";

  const canEditPO =
    userProfile?.role === "approver" || userProfile?.role === "admin";

  // Siapa saja yang boleh upload lampiran PO/Finance/Invoice kapan pun
  // (ga dibatasi status PO): approver dari company yang sama dengan PO ini,
  // atau requester dari MR yang direferensikan PO ini. Admin tetap boleh
  // juga, konsisten dengan hak akses admin di tempat lain di halaman ini.
  const canUploadAttachment =
    userProfile?.role === "admin" ||
    (userProfile?.role === "approver" &&
      userProfile?.company === po?.company_code) ||
    currentUser?.id === po?.material_requests?.userid;

  // --- CEK ROLE PURCHASING (Untuk fitur edit status MR Item) ---
  const isPurchasing =
    userProfile?.department === "Purchasing" ||
    userProfile?.department === "Procurement" ||
    userProfile?.role === "admin";
  // -------------------------------------------------------------

  const isGA =
    isGADepartment(userProfile?.department) || userProfile?.role === "admin";

  // Tombol "Terima Barang" manual - dipakai kalau template PO ini tidak
  // punya step approval "Receiver" (atau receiver-nya mau delegasikan ke GA).
  // Muncul begitu status sudah "Pending Receive" (mulai) atau "Partial
  // Receive" (edit checklist sampai sesuai). Begitu "Full Received", tombol
  // ini hilang, diganti tombol cetak riwayat.
  const showGAReceiveButton =
    isGA &&
    (po?.status === PO_STATUS_PENDING_RECEIVE ||
      po?.status === PO_STATUS_PARTIAL_RECEIVE);

  // PO dp&bp - orang yang megang step Payment Validator di PO ini (atau
  // admin) selalu bisa buka dialog buat edit dp_paid/bp_paid, kapan pun,
  // tidak digantung status/turn approval tertentu (mis. buat benerin salah
  // input belakangan).
  const isPaymentValidatorForThisPO = po?.approvals?.some(
    (a) =>
      a.type === APPROVAL_TYPE_PAYMENT_VALIDATOR &&
      a.userid === currentUser?.id,
  );
  const showEditDpBpButton =
    isDpBpPaymentTerm(po?.payment_term) &&
    (isPaymentValidatorForThisPO || userProfile?.role === "admin");

  const handleOpenEditDpBp = () => {
    setDpChecked(!!po?.dp_paid);
    setBpChecked(!!po?.bp_paid);
    setDpBpDialogMode("edit");
    setIsDpBpDialogOpen(true);
  };

  // Edit dp_paid/bp_paid di luar approval turn (row Payment Validator sudah
  // "approved" sebelumnya). Kalau edit ini bikin syarat lunas baru
  // terpenuhi, ikut jalanin status engine yang sama seperti approve normal
  // (subsume alur "Tandai BP Lunas" yang lama). Kalau row belum approved
  // sama sekali, edit ini cuma koreksi nilai - approval-nya sendiri tetap
  // harus lewat tombol Setujui PO seperti biasa.
  const handleEditDpBpPayment = async () => {
    if (!po || !currentUser) return;
    setActionLoading(true);
    try {
      const updatePayload: Record<string, any> = {
        dp_paid: dpChecked,
        bp_paid: bpChecked,
      };

      const pvIndex = (po.approvals || []).findIndex(
        (a) => a.type === APPROVAL_TYPE_PAYMENT_VALIDATOR,
      );
      const pvApproval = pvIndex !== -1 ? po.approvals![pvIndex] : null;
      const requiresFullPayment = po.dp_bp_shipping_type !== "ship_after_dp";
      const nowSettled = requiresFullPayment
        ? dpChecked && bpChecked
        : dpChecked;

      let updatedApprovals = po.approvals;
      if (pvApproval && pvApproval.status === "pending" && nowSettled) {
        updatedApprovals = JSON.parse(
          JSON.stringify(po.approvals),
        ) as Approval[];
        updatedApprovals[pvIndex].status = "approved";
        updatedApprovals[pvIndex].processed_at = new Date().toISOString();
        updatePayload.approvals = updatedApprovals;
        updatePayload.status = deriveReceiveDrivenStatus(
          updatedApprovals,
          true,
          po.receive_record?.is_full_match,
          { paymentJustSettled: true },
        );
      }

      const { error } = await supabase
        .from("purchase_orders")
        .update(updatePayload)
        .eq("id", po.id);
      if (error) throw error;
      toast.success("Progress pembayaran DP/BP disimpan.");
      setIsDpBpDialogOpen(false);
      await fetchPoData();
    } catch (err: any) {
      toast.error("Gagal update pembayaran DP/BP", {
        description: err.message,
      });
    } finally {
      setActionLoading(false);
    }
  };

  // Submit checklist penerimaan barang - dipakai dari 2 entry point (approve
  // step "Receiver" & tombol "Terima Barang" manual), lihat handleClickApprove
  // & tombol GA Receive. Kalau lagi giliran approval step Receiver, sekalian
  // approve row-nya (approval lanjut ke step berikutnya) sebelum menghitung
  // status - kalau bukan (tombol manual/template tanpa step Receiver),
  // approvals dibiarkan apa adanya.
  const handleSubmitReceive = async (
    receivedQtyByPartNumber: Record<string, number>,
  ) => {
    if (!po || !currentUser) return;
    setActionLoading(true);
    try {
      const isReceiverTurn =
        myApprovalIndex !== -1 &&
        po.approvals?.[myApprovalIndex]?.type === APPROVAL_TYPE_RECEIVER;

      let updatedApprovals = po.approvals;
      if (isReceiverTurn) {
        updatedApprovals = JSON.parse(
          JSON.stringify(po.approvals),
        ) as Approval[];
        updatedApprovals[myApprovalIndex].status = "approved";
        updatedApprovals[myApprovalIndex].processed_at =
          new Date().toISOString();
        const { error: approvalError } = await supabase
          .from("purchase_orders")
          .update({ approvals: updatedApprovals })
          .eq("id", po.id);
        if (approvalError) throw approvalError;
      }

      const receiveRecord = await submitReceiveRecord(
        { ...po, approvals: updatedApprovals },
        currentUser.id,
        userProfile?.nama || currentUser.email || "Unknown",
        receivedQtyByPartNumber,
      );

      if (isReceiverTurn) {
        const nextApprover = updatedApprovals?.find(
          (app, i) => i > myApprovalIndex && app.status === "pending",
        );
        notifyOnPOApproval({
          actorId: currentUser.id,
          creatorId: (po as any).user_id,
          nextApproverId: nextApprover?.userid,
          decision: "approved",
          kodePO: po.kode_po,
          poId: po.id,
        });
      }

      toast.success(
        receiveRecord.is_full_match
          ? "Barang diterima lengkap sesuai PO. Status jadi Full Received."
          : "Ada barang yang tidak sesuai qty PO. Status jadi Partial Receive - checklist ini bisa diedit lagi nanti.",
      );
      setIsReceiveDialogOpen(false);
      await fetchPoData();
    } catch (err: any) {
      toast.error("Gagal submit penerimaan barang", {
        description: err.message,
      });
    } finally {
      setActionLoading(false);
    }
  };

  // Upload lampiran (PO/Finance/Invoice) - langsung tersimpan ke DB, bisa
  // dilakukan kapan pun (ga dibatasi status PO) oleh approver company yang
  // sama atau requester MR terkait (lihat canUploadAttachment).
  const handleAttachmentUpload = async (
    e: React.ChangeEvent<HTMLInputElement>,
    type: "po" | "finance" | "invoice",
  ) => {
    const file = e.target.files?.[0];
    if (!file || !po) return;

    const sizeError = getAttachmentSizeError(file);
    if (sizeError) {
      toast.error("Ukuran file terlalu besar", { description: sizeError });
      e.target.value = "";
      return;
    }

    const setIsLoading =
      type === "po"
        ? setIsUploadingPO
        : type === "finance"
          ? setIsUploadingFinance
          : setIsUploadingInvoice;
    setIsLoading(true);

    const toastId = toast.loading(
      `Mengunggah lampiran ${type.toUpperCase()}...`,
    );
    try {
      const filePath = `po/${po.kode_po}/${type}/${Date.now()}_${file.name}`;
      const formData = new FormData();
      formData.append("file", file);
      const uploadResult = await uploadAttachmentVps(formData, filePath);

      if (!uploadResult.success) {
        toast.error(`Gagal mengunggah file ${type.toUpperCase()}`, {
          id: toastId,
          description: uploadResult.message,
        });
        return;
      }

      const newAttachment: Attachment = {
        name: file.name,
        url: uploadResult.url,
        type,
      };
      const updatedAttachments = [...(po.attachments || []), newAttachment];

      const { error: updateError } = await supabase
        .from("purchase_orders")
        .update({ attachments: updatedAttachments })
        .eq("id", po.id);

      if (updateError) throw updateError;

      toast.success(`Lampiran ${type.toUpperCase()} berhasil diunggah!`, {
        id: toastId,
      });
      await fetchPoData();
    } catch (err: any) {
      toast.error(`Gagal mengunggah file ${type.toUpperCase()}`, {
        id: toastId,
        description: getUploadErrorMessage(err),
      });
    } finally {
      setIsLoading(false);
      e.target.value = "";
    }
  };

  const handleApprovalAction = async (
    decision: "approved" | "rejected",
    paymentProgress?: { dp_paid: boolean; bp_paid: boolean },
  ) => {
    if (!po || !currentUser || myApprovalIndex === -1) return;

    setActionLoading(true);

    const updatedApprovals = JSON.parse(JSON.stringify(po.approvals));
    const updatePayload: Record<string, any> = {};

    if (paymentProgress) {
      updatePayload.dp_paid = paymentProgress.dp_paid;
      updatePayload.bp_paid = paymentProgress.bp_paid;
    }

    // Kalau PO ini DP & Pelunasan varian "ship_after_dp", approval Payment
    // Validator boleh selesai begitu DP aja udah lunas (BP nyusul belakangan).
    // Varian lain (termasuk "ship_after_full_payment"/default) tetap butuh
    // DP dan BP sama-sama lunas dulu baru approval-nya bisa selesai.
    const requiresFullPayment = po.dp_bp_shipping_type !== "ship_after_dp";
    const isPartialPayment =
      decision === "approved" &&
      paymentProgress !== undefined &&
      (requiresFullPayment
        ? !(paymentProgress.dp_paid && paymentProgress.bp_paid)
        : !paymentProgress.dp_paid);

    let newPoStatus = po.status;
    let paymentValidatorJustApproved = false;

    if (!isPartialPayment) {
      updatedApprovals[myApprovalIndex].status = decision;
      updatedApprovals[myApprovalIndex].processed_at = new Date().toISOString();
      updatePayload.approvals = updatedApprovals;

      if (decision === "rejected") {
        newPoStatus = "Rejected";
      } else if (decision === "approved") {
        const justApprovedType = updatedApprovals[myApprovalIndex].type;
        const isLastApproval = updatedApprovals.every(
          (app: Approval) => app.status === "approved",
        );

        if (justApprovedType === APPROVAL_TYPE_PAYMENT_VALIDATOR) {
          paymentValidatorJustApproved = true;
          // Status berikutnya tergantung apakah step Receiver di template
          // ini sudah lebih dulu jalan (Termin/DP&BP-setelah-DP) atau belum
          // (Cash/DP&BP-setelah-lunas) - lihat deriveReceiveDrivenStatus.
          newPoStatus = deriveReceiveDrivenStatus(
            updatedApprovals,
            true,
            po.receive_record?.is_full_match,
            { paymentJustSettled: true },
          );
        } else if (justApprovedType === APPROVAL_TYPE_PAYMENT_APPROVAL) {
          // Payment Approval approve => menunggu validasi pembayaran.
          newPoStatus = "Pending Payment";
        } else if (isLastApproval) {
          // Template tanpa step Payment Validator: semua approve => siap
          // diterima (tombol "Terima Barang" manual yang lanjutin).
          newPoStatus = PO_STATUS_PENDING_RECEIVE;
        }
      }
      updatePayload.status = newPoStatus;
    }

    // Catatan: progress approval hanya mengubah status PO ini sendiri.
    // Status MR bersifat turunan dari agregat status semua item (lihat
    // recalculateMrStatus), jadi tidak ditimpa di sini lagi — MR bisa saja
    // masih punya item lain yang belum dibuatkan PO.
    const { error: poError } = await supabase
      .from("purchase_orders")
      .update(updatePayload)
      .eq("id", po.id);

    if (poError) {
      toast.error("Aksi PO gagal", { description: poError.message });
      setActionLoading(false);
      return;
    }

    // Payment Validator baru approve => naikkan level item-item yang
    // di-cover PO ini ke "Open 4" (kecuali yang udah lanjut - Open 5/Close -
    // dari PO lain yang juga meng-cover part_number yang sama).
    if (paymentValidatorJustApproved && po.mr_id) {
      const { data: mrRow } = await supabase
        .from("material_requests")
        .select("orders")
        .eq("id", po.mr_id)
        .single();
      const orders = normalizeMrOrders((mrRow?.orders as any[]) || []);
      for (const item of po.items) {
        if (!item.part_number) continue;
        const order = orders.find((o) => o.part_number === item.part_number);
        if (!order || order.level === "Open 5" || order.level === "Close") {
          continue;
        }
        try {
          await updateMrItemStatus(
            po.mr_id,
            item.part_number,
            { level: "Open 4" },
            currentUser.id,
          );
        } catch (err) {
          console.error(
            `Gagal update level item MR (Open 4) untuk Part ${item.part_number}:`,
            err,
          );
        }
      }
      await recalculateMrLevel(po.mr_id);
    }

    if (isPartialPayment) {
      toast.success(
        "Progress pembayaran disimpan. Approval selesai setelah DP & BP lunas.",
      );
      setIsDpBpDialogOpen(false);
      await fetchPoData();
      setActionLoading(false);
      return;
    }

    // Notify next approver (if any) or PO creator
    const nextApprover =
      decision === "approved"
        ? updatedApprovals.find(
            (app: Approval, i: number) =>
              i > myApprovalIndex && app.status === "pending",
          )
        : undefined;
    notifyOnPOApproval({
      actorId: currentUser.id,
      creatorId: (po as any).user_id,
      nextApproverId: nextApprover?.userid,
      decision,
      kodePO: po.kode_po,
      poId: po.id,
    });

    toast.success(
      `PO berhasil di-${decision === "approved" ? "setujui" : "tolak"}`,
    );
    setIsDpBpDialogOpen(false);
    await fetchPoData();
    setActionLoading(false);
  };

  // --- LOGIC EDIT STATUS MR ITEM ---
  const handleOpenEditStatus = (item: Order) => {
    setSelectedItemToEdit(item);
    setEditForm({
      status: item.status || "Pending",
      note: item.status_note || "",
    });
    setIsEditStatusOpen(true);
  };

  const handleSaveStatusUpdate = async () => {
    if (!po?.mr_id || !selectedItemToEdit?.part_number || !currentUser) return;

    setActionLoading(true);
    try {
      await updateMrItemStatus(
        po.mr_id,
        selectedItemToEdit.part_number,
        {
          status: editForm.status,
          note: editForm.note,
        },
        currentUser.id,
      );
      await recalculateMrStatus(po.mr_id);
      toast.success("Status barang berhasil diperbarui");
      setIsEditStatusOpen(false);
      fetchPoData(); // Refresh data
    } catch (err: any) {
      toast.error("Gagal update status", { description: err.message });
    } finally {
      setActionLoading(false);
    }
  };
  // ---------------------------------

  const handleRemoveItemBast = async (item: Order, attachmentUrl: string) => {
    if (!po?.mr_id || !item.part_number || !currentUser) return;
    try {
      await removeBastForMrItem(
        po.mr_id,
        item.part_number,
        attachmentUrl,
        currentUser.id,
      );
      toast.success("Lampiran BAST dihapus");
      fetchPoData();
    } catch (err: any) {
      toast.error("Gagal hapus lampiran BAST", { description: err.message });
    }
  };

  const handleClickApprove = () => {
    if (myApproval?.type === APPROVAL_TYPE_RECEIVER) {
      setIsReceiveDialogOpen(true);
      return;
    }
    if (isPaymentValidatorTurn && isDpBpPO) {
      setDpChecked(!!po?.dp_paid);
      setBpChecked(!!po?.bp_paid);
      setDpBpDialogMode("approve");
      setIsDpBpDialogOpen(true);
      return;
    }
    handleApprovalAction("approved");
  };

  const ApprovalActions = () => {
    if (
      !po ||
      !currentUser ||
      (po.status !== "Pending Approval" &&
        po.status !== "Pending Payment" &&
        po.status !== PO_STATUS_PENDING_RECEIVE &&
        po.status !== PO_STATUS_PARTIAL_RECEIVE)
    )
      return null;
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
          onClick={handleClickApprove}
          disabled={actionLoading}
        >
          {actionLoading ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <Check className="mr-2 h-4 w-4" />
          )}{" "}
          Setujui PO
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
          Tolak PO
        </Button>
      </div>
    );
  };

  const getStatusBadge = (status: string) => {
    switch (status?.toLowerCase()) {
      case "pending approval":
        return <Badge variant="secondary">Pending Approval</Badge>;
      case "pending validation":
        return <Badge variant="secondary">Pending Validation</Badge>;
      case "pending payment":
        return (
          <Badge className="bg-orange-500 text-white">Pending Payment</Badge>
        );
      case "pending receive":
        return (
          <Badge className="bg-yellow-500 text-white">Pending Receive</Badge>
        );
      case "partial receive":
        return (
          <Badge className="bg-amber-600 text-white">Partial Receive</Badge>
        );
      case "full received":
        return (
          <Badge className="bg-green-500 text-white">Full Received</Badge>
        );
      case "rejected":
        return <Badge variant="destructive">Rejected</Badge>;
      default:
        return <Badge>{status || "N/A"}</Badge>;
    }
  };

  const getApprovalStatusBadge = (
    status: "pending" | "approved" | "rejected",
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

  const [printCompany, setPrintCompany] = useState<"GMI" | "GIS" | null>(null);

  // Preload semua logo perusahaan begitu halaman dibuka - tanpa ini, ganti
  // `src` logo pas klik "Cetak GMI"/"Cetak GIS" baru mulai fetch dari
  // network, dan window.print() (dipanggil sesaat sesudahnya) bisa nge-capture
  // sebelum logo baru selesai load/decode, jadi kepakenya logo dari print
  // sebelumnya (ketuker). Sekali di-preload, ganti src jadi instan dari cache.
  useEffect(() => {
    const uniqueLogos = Array.from(
      new Set(Object.values(COMPANY_DETAILS).map((c) => c.logo)),
    );
    uniqueLogos.forEach((src) => {
      const img = new window.Image();
      img.src = src;
    });
  }, []);

  const handlePrint = (company: "GMI" | "GIS") => {
    setPrintCompany(company);
  };

  useEffect(() => {
    if (!printCompany) return;
    // Tunggu 2 frame (double rAF) sebelum window.print() - kasih browser
    // kesempatan beneran repaint DOM dengan logo/company info yang baru
    // (React commit != browser sudah paint), biar gak ke-print state lama.
    const raf1 = requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        window.print();
      });
    });
    const reset = () => setPrintCompany(null);
    window.addEventListener("afterprint", reset, { once: true });
    return () => {
      cancelAnimationFrame(raf1);
      window.removeEventListener("afterprint", reset);
    };
  }, [printCompany]);

  useEffect(() => {
    if (!isPrintingReceive) return;
    const raf1 = requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        window.print();
      });
    });
    const reset = () => setIsPrintingReceive(false);
    window.addEventListener("afterprint", reset, { once: true });
    return () => {
      cancelAnimationFrame(raf1);
      window.removeEventListener("afterprint", reset);
    };
  }, [isPrintingReceive]);

  if (loading) return <DetailPOSkeleton />;

  if (error || !po)
    return (
      <Content className="col-span-12">
        <div className="flex flex-col items-center justify-center h-96 text-center">
          <AlertTriangle className="w-16 h-16 text-destructive mb-4" />
          <h1 className="text-2xl font-bold">Data Tidak Ditemukan</h1>
          <p className="text-muted-foreground">{error}</p>
          <Button asChild variant="outline" className="mt-6">
            <Link href="/purchase-order">Kembali ke Daftar PO</Link>
          </Button>
        </div>
      </Content>
    );

  const poAttachments =
    po.attachments?.filter((att) => !att.type || att.type === "po") || [];
  const financeAttachments =
    po.attachments?.filter((att) => att.type === "finance") || [];
  const invoiceAttachments =
    po.attachments?.filter((att) => att.type === "invoice") || [];
  // BAST bukan lampiran milik PO sendiri - sumbernya `bast_attachments` per
  // item MR (satu-satunya sumber data BAST di seluruh app, lihat
  // removeBastForMrItem di services/mrService.ts), difilter ke item yang
  // di-cover PO ini saja (isMrItemInPO).
  const bastAttachmentEntries: { item: Order; att: Attachment }[] = (
    po.material_requests?.orders || []
  )
    .filter(
      (mrItem) => isMrItemInPO(mrItem) && (mrItem.bast_attachments?.length ?? 0) > 0,
    )
    .flatMap((mrItem) =>
      (mrItem.bast_attachments || []).map((att) => ({ item: mrItem, att })),
    );
  const currentTurnIndex = po.approvals?.findIndex(
    (app) => app.status === "pending",
  );
  const allPreviousApproved =
    currentTurnIndex === -1
      ? false
      : currentTurnIndex === 0 ||
        (po.approvals &&
          po.approvals.length > 0 &&
          po.approvals
            .slice(0, currentTurnIndex)
            .every((app) => app.status === "approved"));

  const subtotal = po.items.reduce(
    (acc, item) => acc + item.price * item.qty,
    0,
  );
  const dpp = subtotal - (po.discount || 0);
  // PO baru nyimpen ppn_rate beneran (lihat tax_included/ppn_rate di
  // type/index.ts) - PO lama (sebelum field ini ada) masih ditebak dari
  // tax/dpp seperti sebelumnya.
  const displayPpnRate =
    po.ppn_rate != null
      ? po.ppn_rate
      : dpp > 0 && po.tax > 0
        ? Math.round((po.tax / dpp) * 100)
        : null;
  // Info PPN yang SUDAH termasuk harga item (subtotal x rate) - sekadar
  // informasi, TIDAK ditambahkan ke total (harga item udah termasuk ini).
  const includedTaxInfo =
    po.tax_included && displayPpnRate != null
      ? subtotal * (displayPpnRate / 100)
      : null;

  const companyKey = (po.company_code ||
    "DEFAULT") as keyof typeof COMPANY_DETAILS;
  const companyInfo = COMPANY_DETAILS[companyKey] || COMPANY_DETAILS.DEFAULT;
  const priorityText = getDaysRemaining(po.material_requests?.due_date);

  return (
    <>
      <Content>
        <div className="col-span-12 grid grid-cols-12 gap-6 no-print">
          <div className="col-span-12">
            <div className="flex flex-wrap justify-between items-center gap-4 mb-6">
              <div>
                <div className="flex items-center gap-2">
                  <h1 className="text-3xl font-bold">{po.kode_po}</h1>
                  {po.is_asset && (
                    <Badge className="bg-purple-600 hover:bg-purple-600 text-white">
                      PO Asset
                    </Badge>
                  )}
                </div>
                <p className="text-muted-foreground">Detail Purchase Order</p>
              </div>
              <div className="flex items-center gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => handlePrint("GMI")}
                >
                  <Printer className="mr-2 h-4 w-4" /> Cetak GMI
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => handlePrint("GIS")}
                >
                  <Printer className="mr-2 h-4 w-4" /> Cetak GIS
                </Button>
                {po.receive_record && (
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setIsPrintingReceive(true)}
                  >
                    <Printer className="mr-2 h-4 w-4" /> Cetak Riwayat Receive
                  </Button>
                )}
                {showGAReceiveButton && (
                  <Button
                    size="sm"
                    className="bg-blue-600 hover:bg-blue-700"
                    onClick={() => setIsReceiveDialogOpen(true)}
                    disabled={actionLoading}
                  >
                    <PackageCheck className="mr-2 h-4 w-4" />
                    {po.status === PO_STATUS_PARTIAL_RECEIVE
                      ? "Edit Penerimaan Barang"
                      : "Terima Barang"}
                  </Button>
                )}
                {showEditDpBpButton && (
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={handleOpenEditDpBp}
                    disabled={actionLoading}
                  >
                    <Wallet className="mr-2 h-4 w-4" /> Edit DP/BP
                  </Button>
                )}
                {canEditPO &&
                  po.status !== PO_STATUS_FULL_RECEIVED &&
                  po.status !== "Rejected" && (
                    <Button asChild variant="outline" size="sm">
                      <Link href={`/purchase-order/edit/${po.id}`}>
                        <EditIcon className="mr-2 h-4 w-4" /> Edit PO
                      </Link>
                    </Button>
                  )}
                {getStatusBadge(po.status)}
              </div>
            </div>
          </div>

          <div className="col-span-12 lg:col-span-8 space-y-6">
            <Content title="Informasi Utama">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-x-6 gap-y-4">
                <InfoItem
                  icon={CircleUser}
                  label="Pembuat PO"
                  value={po.users_with_profiles?.nama || "N/A"}
                />
                <InfoItem
                  icon={Building}
                  label="Perusahaan"
                  value={po.company_code}
                />
                <InfoItem
                  icon={Calendar}
                  label="Tanggal Dibuat"
                  value={formatDateFriendly(po.created_at)}
                />
                <InfoItem
                  icon={DollarSign}
                  label="Grand Total"
                  value={
                    <div className="flex items-center gap-2">
                      <span className="font-semibold">
                        {formatCurrency(po.total_price)}
                      </span>
                      <Button
                        variant="outline"
                        size="icon"
                        className="h-7 w-7"
                        onClick={() => setIsBudgetDialogOpen(true)}
                      >
                        <Eye className="h-4 w-4" />
                      </Button>
                    </div>
                  }
                />
                <InfoItem
                  icon={Tag}
                  label="Ref. MR"
                  value={
                    po.material_requests ? (
                      <Link
                        href={`/material-request/${po.material_requests.id}`}
                        className="text-primary hover:underline flex items-center gap-1"
                        target="_blank"
                      >
                        {po.material_requests.kode_mr}
                        <ExternalLink className="h-3 w-3" />
                      </Link>
                    ) : (
                      "Tidak ada"
                    )
                  }
                />
                <InfoItem
                  icon={Wallet}
                  label="Payment Term"
                  value={po.payment_term}
                />
                {isDpBpPO && (
                  <InfoItem
                    icon={Wallet}
                    label="Progress DP & BP"
                    value={
                      <div className="flex flex-col gap-1">
                        <div className="flex flex-wrap items-center gap-2">
                          <Badge
                            className={cn(
                              "w-fit",
                              po.dp_paid
                                ? "bg-green-500 text-white"
                                : "bg-secondary text-secondary-foreground",
                            )}
                          >
                            DP {po.dp_paid ? "Lunas" : "Belum"}
                          </Badge>
                          <Badge
                            className={cn(
                              "w-fit",
                              po.bp_paid
                                ? "bg-green-500 text-white"
                                : "bg-secondary text-secondary-foreground",
                            )}
                          >
                            BP {po.bp_paid ? "Lunas" : "Belum"}
                          </Badge>
                          <Badge variant="outline" className="w-fit">
                            {dpBpRequiresFullPayment
                              ? "Kirim Setelah Pelunasan"
                              : "Kirim Setelah DP"}
                          </Badge>
                        </div>
                      </div>
                    }
                  />
                )}
                <InfoItem
                  icon={Truck}
                  label="Alamat Pengiriman"
                  value={po.shipping_address}
                />
                <div className="md:col-span-2">
                  <InfoItem
                    icon={Info}
                    label="Catatan PO"
                    value={po.notes || "N/A"}
                    isBlock
                  />
                </div>
                <hr className="md:col-span-2" />
                <InfoItem
                  icon={CircleUser}
                  label="Vendor"
                  value={
                    <div>
                      <span className="block font-medium">
                        {vendorData.name}
                      </span>
                      {vendorData.code && (
                        <span className="text-xs text-muted-foreground font-mono">
                          {vendorData.code}
                        </span>
                      )}
                    </div>
                  }
                />
                <InfoItem
                  icon={Info}
                  label="Kontak Vendor"
                  value={
                    <div>
                      <div>{vendorData.contact}</div>
                      <div className="text-xs text-muted-foreground font-normal">
                        {vendorData.email}
                      </div>
                    </div>
                  }
                />
                <div className="md:col-span-2">
                  <InfoItem
                    icon={Building2}
                    label="Alamat Vendor"
                    value={vendorData.address}
                    isBlock
                  />
                </div>
              </div>
            </Content>

            <Content title="Order Items (PO)">
              <div className="rounded-md border overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Nama Item</TableHead>
                      <TableHead>Part Number</TableHead>
                      <TableHead>Qty</TableHead>
                      <TableHead className="text-right">Harga Satuan</TableHead>
                      <TableHead className="text-right">Total Harga</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {po.items.map((item, index) => (
                      <TableRow key={index}>
                        <TableCell className="font-medium">
                          <div className="flex items-center gap-2">
                            {item.name}
                            <AssetGoodsBadge isAsset={item.is_asset} />
                          </div>
                        </TableCell>
                        <TableCell className="font-mono text-xs">
                          {item.part_number}
                        </TableCell>
                        <TableCell>
                          {item.qty} {item.uom}
                        </TableCell>
                        <TableCell className="text-right">
                          {formatCurrency(item.price)}
                        </TableCell>
                        <TableCell className="text-right font-medium">
                          {formatCurrency(
                            item.total_price || item.price * item.qty,
                          )}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            </Content>

            {/* --- BAGIAN REVISI: TABEL REFERENSI MR DENGAN FITUR EDIT --- */}
            {po.material_requests &&
              po.material_requests.orders &&
              po.material_requests.orders.length > 0 && (
                <Content title="Referensi Barang dari MR (Tracking Status)">
                  <div className="rounded-md border overflow-x-auto">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead className="w-[30%]">
                            Nama Item (MR)
                          </TableHead>
                          <TableHead>Part Number</TableHead>
                          <TableHead>Status & PO Refs</TableHead>
                          <TableHead>Tracking PO Ini</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {po.material_requests.orders.map(
                          (mrItem: Order, idx: number) => {
                            const isInPO = isMrItemInPO(mrItem);
                            const statusColor =
                              MR_ITEM_STATUS_COLORS[
                                mrItem.status || "Pending"
                              ] || "bg-gray-100";
                            const statusLabel =
                              MR_ITEM_STATUS_LABELS[
                                mrItem.status || "Pending"
                              ] || mrItem.status;

                            const mrItemIsAsset = mrItem.barang_id
                              ? !!barangAssetMap[mrItem.barang_id]
                              : false;

                            return (
                              <TableRow key={idx}>
                                <TableCell>
                                  <div className="font-medium">{mrItem.name}</div>
                                  <div className="mt-1 flex items-center gap-1 flex-wrap">
                                    <AssetGoodsBadge isAsset={mrItemIsAsset} />
                                    <ItemLevelBadge level={mrItem.level} />
                                  </div>
                                  {mrItem.status_note && (
                                    <div className="text-xs text-muted-foreground mt-1 flex items-start gap-1">
                                      <FileText className="w-3 h-3 mt-0.5" />
                                      <span className="italic">
                                        {mrItem.status_note}
                                      </span>
                                    </div>
                                  )}
                                </TableCell>
                                <TableCell className="font-mono text-xs">
                                  {mrItem.part_number || "-"}
                                </TableCell>
                                <TableCell>
                                  <div className="flex items-center gap-2 flex-wrap">
                                    {/* Badge Status Utama */}
                                    <Badge
                                      variant="outline"
                                      className={cn("capitalize", statusColor)}
                                    >
                                      {statusLabel}
                                    </Badge>

                                    {/* Tombol Edit (Hanya untuk Purchasing/Admin) */}
                                    {isPurchasing && mrItem.part_number && (
                                      <button
                                        onClick={() =>
                                          handleOpenEditStatus(mrItem)
                                        }
                                        className="p-1 rounded-full hover:bg-gray-100 text-gray-500 transition-colors"
                                        title="Edit Status Barang"
                                      >
                                        <Pencil className="w-3 h-3" />
                                      </button>
                                    )}
                                  </div>

                                  {/* List PO References - klik utk quick view PO */}
                                  {mrItem.po_refs &&
                                    mrItem.po_refs.length > 0 && (
                                      <div className="mt-2 flex flex-wrap gap-1">
                                        {mrItem.po_refs.map((ref, i) => (
                                          <button
                                            key={i}
                                            type="button"
                                            onClick={() => handleOpenPoRef(ref)}
                                          >
                                            <Badge
                                              variant="outline"
                                              className={cn(
                                                "text-[10px] h-5 px-1.5 font-mono cursor-pointer hover:opacity-75 transition-opacity",
                                                PO_REF_STATUS_COLORS[
                                                  poRefsMap[ref]?.status ?? ""
                                                ] || PO_REF_STATUS_COLOR_DEFAULT,
                                              )}
                                            >
                                              {ref}
                                            </Badge>
                                          </button>
                                        ))}
                                      </div>
                                    )}

                                  {/* Lampiran BAST (sumber sama dgn Lampiran BAST/list item MR) */}
                                  {mrItem.bast_attachments &&
                                    mrItem.bast_attachments.length > 0 && (
                                      <div className="mt-2 flex flex-wrap gap-1">
                                        {mrItem.bast_attachments.map(
                                          (att, i) => (
                                            <div
                                              key={i}
                                              className="text-[10px] bg-emerald-50 text-emerald-700 pl-2 pr-1 py-0.5 rounded-sm flex items-center gap-1"
                                            >
                                              <Link
                                                href={resolveAttachmentUrl(
                                                  att.url,
                                                )}
                                                target="_blank"
                                                className="hover:underline flex items-center gap-1"
                                              >
                                                <FileText className="w-3 h-3" />
                                                {att.name}
                                              </Link>
                                              {canUploadAttachment && (
                                                <button
                                                  type="button"
                                                  onClick={() =>
                                                    handleRemoveItemBast(
                                                      mrItem,
                                                      att.url,
                                                    )
                                                  }
                                                  className="hover:text-red-600"
                                                  title="Hapus lampiran"
                                                >
                                                  <X className="w-3 h-3" />
                                                </button>
                                              )}
                                            </div>
                                          ),
                                        )}
                                      </div>
                                    )}
                                </TableCell>
                                <TableCell>
                                  {isInPO ? (
                                    <Badge className="bg-green-600 hover:bg-green-700">
                                      <Check className="w-3 h-3 mr-1" /> Termuat
                                    </Badge>
                                  ) : (
                                    <Badge
                                      variant="outline"
                                      className="text-muted-foreground"
                                    >
                                      -
                                    </Badge>
                                  )}
                                </TableCell>
                              </TableRow>
                            );
                          },
                        )}
                      </TableBody>
                    </Table>
                  </div>
                </Content>
              )}
            {/* ---------------------------------------------------------------------- */}

            {/* --- Info Referensi MR --- */}
            {po.material_requests && (
              <Content
                title={`Detail Referensi dari ${po.material_requests.kode_mr}`}
              >
                <div className="grid grid-cols-1 md:grid-cols-2 gap-x-6 gap-y-4">
                  <InfoItem
                    icon={CircleUser}
                    label="Pembuat MR"
                    value={
                      po.material_requests.users_with_profiles?.nama || "N/A"
                    }
                  />
                  <InfoItem
                    icon={Building}
                    label="Departemen MR"
                    value={po.material_requests.department}
                  />
                  <InfoItem
                    icon={Tag}
                    label="Kategori MR"
                    value={po.material_requests.kategori}
                  />
                  <InfoItem
                    icon={DollarSign}
                    label="Estimasi Biaya MR"
                    value={formatCurrency(po.material_requests.cost_estimation)}
                  />
                  <InfoItem
                    icon={Building2}
                    label="Cost Center"
                    value={getCostCenterName()}
                  />
                  <InfoItem
                    icon={Truck}
                    label="Tujuan Site (MR)"
                    value={po.material_requests.tujuan_site || "N/A"}
                  />
                  <InfoItem
                    icon={Zap}
                    label="Prioritas MR"
                    value={
                      <div className="flex items-center gap-2">
                        <span>{po.material_requests.prioritas || "N/A"}</span>
                        {priorityText && (
                          <span className="text-xs font-normal text-muted-foreground">
                            {priorityText}
                          </span>
                        )}
                      </div>
                    }
                  />
                  <div className="grid grid-cols-3 gap-x-2">
                    <dt className="text-sm text-muted-foreground col-span-1 flex items-center gap-2">
                      <Layers className="h-4 w-4" />
                      Level MR{" "}
                      <button
                        onClick={() => setIsLevelInfoOpen(true)}
                        className="text-muted-foreground hover:text-primary transition-colors"
                        title="Lihat Definisi Level"
                      >
                        <HelpCircle className="h-3 w-3" />
                      </button>
                    </dt>
                    <dd className="text-sm font-semibold col-span-2 whitespace-pre-wrap">
                      {po.material_requests.level || "N/A"}
                    </dd>
                  </div>
                  <div className="md:col-span-2">
                    <InfoItem
                      icon={Info}
                      label="Remarks MR"
                      value={po.material_requests.remarks}
                      isBlock
                    />
                  </div>
                </div>
              </Content>
            )}
          </div>

          <div className="col-span-12 lg:col-span-4 space-y-6">
            <Content title="Tindakan">
              <ApprovalActions />
              {po.status === PO_STATUS_FULL_RECEIVED && (
                <div className="mt-2">
                  <p className="text-sm text-green-600 font-medium mb-2 flex items-center gap-2">
                    <Check className="h-4 w-4" /> PO Selesai (Full Received)
                  </p>
                </div>
              )}
            </Content>

            <Content title="Jalur Approval">
              {po.approvals && po.approvals.length > 0 ? (
                <ul className="space-y-2">
                  {po.approvals.map((approver, index) => {
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
                          <div className="font-semibold flex items-center">
                            {approver.nama}{" "}
                            <span className="ml-2">
                              <Badge variant={"outline"}>
                                {approver.department}
                              </Badge>
                            </span>
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
                          approver.status as
                            | "approved"
                            | "rejected"
                            | "pending",
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

            <Content title="Lampiran PO">
              <div className="space-y-3">
                {canUploadAttachment && (
                  <div>
                    <Label htmlFor="po-attachment-upload" className="text-xs">
                      Tambah Lampiran PO
                    </Label>
                    <Input
                      id="po-attachment-upload"
                      type="file"
                      className="mt-1"
                      onChange={(e) => handleAttachmentUpload(e, "po")}
                      disabled={isUploadingPO}
                    />
                    {isUploadingPO && (
                      <Loader2 className="mt-1 h-4 w-4 animate-spin text-muted-foreground" />
                    )}
                  </div>
                )}
                <ul className="space-y-2">
                  {poAttachments.length > 0 ? (
                    poAttachments.map((file, index) => (
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
                    ))
                  ) : (
                    <p className="text-sm text-muted-foreground">
                      Tidak ada lampiran.
                    </p>
                  )}
                </ul>
              </div>
            </Content>

            <Content title="Lampiran Finance">
              <div className="space-y-3">
                {canUploadAttachment && (
                  <div>
                    <Label
                      htmlFor="finance-attachment-upload"
                      className="text-xs"
                    >
                      Tambah Lampiran Finance
                    </Label>
                    <Input
                      id="finance-attachment-upload"
                      type="file"
                      className="mt-1"
                      onChange={(e) => handleAttachmentUpload(e, "finance")}
                      disabled={isUploadingFinance}
                    />
                    {isUploadingFinance && (
                      <Loader2 className="mt-1 h-4 w-4 animate-spin text-muted-foreground" />
                    )}
                  </div>
                )}
                <ul className="space-y-2">
                  {financeAttachments.length > 0 ? (
                    financeAttachments.map((file, index) => (
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
                    ))
                  ) : (
                    <p className="text-sm text-muted-foreground">
                      Tidak ada lampiran.
                    </p>
                  )}
                </ul>
              </div>
            </Content>

            <Content title="Lampiran Invoice">
              <div className="space-y-3">
                {canUploadAttachment && (
                  <div>
                    <Label
                      htmlFor="invoice-attachment-upload"
                      className="text-xs"
                    >
                      Tambah Lampiran Invoice
                    </Label>
                    <Input
                      id="invoice-attachment-upload"
                      type="file"
                      className="mt-1"
                      onChange={(e) => handleAttachmentUpload(e, "invoice")}
                      disabled={isUploadingInvoice}
                    />
                    {isUploadingInvoice && (
                      <Loader2 className="mt-1 h-4 w-4 animate-spin text-muted-foreground" />
                    )}
                  </div>
                )}
                <ul className="space-y-2">
                  {invoiceAttachments.length > 0 ? (
                    invoiceAttachments.map((file, index) => (
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
                    ))
                  ) : (
                    <p className="text-sm text-muted-foreground">
                      Tidak ada lampiran.
                    </p>
                  )}
                </ul>
              </div>
            </Content>

            <Content title="Lampiran BAST / Bukti Terima">
              <ul className="space-y-2">
                {bastAttachmentEntries.length > 0 ? (
                  bastAttachmentEntries.map(({ item, att }, index) => (
                    <li
                      key={index}
                      className="flex items-center justify-between gap-2"
                    >
                      <Link
                        href={resolveAttachmentUrl(att.url)}
                        target="_blank"
                        className="flex items-center gap-2 text-sm text-primary hover:underline"
                      >
                        <Check className="h-4 w-4 text-green-600" />
                        <span>{att.name}</span>
                        <span className="text-xs text-muted-foreground font-normal">
                          ({item.name})
                        </span>
                        <ExternalLink className="h-3 w-3 text-muted-foreground" />
                      </Link>
                      {canUploadAttachment && (
                        <button
                          type="button"
                          onClick={() => handleRemoveItemBast(item, att.url)}
                          className="text-muted-foreground hover:text-red-600"
                          title="Hapus lampiran"
                        >
                          <X className="h-3.5 w-3.5" />
                        </button>
                      )}
                    </li>
                  ))
                ) : (
                  <p className="text-sm text-muted-foreground">
                    Belum ada BAST.
                  </p>
                )}
              </ul>
            </Content>
          </div>

          <div className="col-span-12">
            {po.material_requests ? (
              <DiscussionSection
                mrId={String(po.material_requests.id)}
                initialDiscussions={
                  po.material_requests.discussions as Discussion[]
                }
              />
            ) : (
              <Content title="Diskusi">
                <p className="text-sm text-muted-foreground text-center">
                  Diskusi hanya tersedia untuk PO yang terhubung ke Material
                  Request.
                </p>
              </Content>
            )}
          </div>
        </div>

        <Dialog open={isBudgetDialogOpen} onOpenChange={setIsBudgetDialogOpen}>
          <DialogContent className="sm:max-w-md">
            <DialogHeader>
              <DialogTitle>Rincian Biaya &amp; Pembayaran</DialogTitle>
              <DialogDescription>{po.kode_po}</DialogDescription>
            </DialogHeader>
            <div className="space-y-4 py-2">
              {/* Info strip */}
              <div className="flex flex-wrap gap-x-3 gap-y-1 rounded-md bg-muted px-3 py-2 text-xs">
                <span>
                  Mata Uang:{" "}
                  <strong className="text-foreground">
                    {po.currency || "IDR"}
                  </strong>
                </span>
                <span className="text-muted-foreground">·</span>
                <span>
                  Payment Term:{" "}
                  <strong className="text-foreground">
                    {po.payment_term || "N/A"}
                  </strong>
                </span>
              </div>

              {/* Komponen Harga */}
              <div className="space-y-1.5">
                <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
                  Komponen Harga
                </p>
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">
                    Subtotal ({po.items.length} item)
                  </span>
                  <span className="font-medium">
                    {formatCurrency(subtotal)}
                  </span>
                </div>
                {po.discount > 0 && (
                  <div className="flex justify-between text-sm text-red-600">
                    <span>Diskon</span>
                    <span>- {formatCurrency(po.discount)}</span>
                  </div>
                )}
                {po.discount > 0 && (
                  <>
                    <hr className="border-dashed" />
                    <div className="flex justify-between text-sm font-semibold">
                      <span>DPP (Dasar Pengenaan Pajak)</span>
                      <span>{formatCurrency(dpp)}</span>
                    </div>
                  </>
                )}
              </div>

              {/* Pajak */}
              <div className="space-y-2">
                <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
                  Pajak
                </p>

                {/* PPN */}
                <div className="flex justify-between items-start text-sm gap-2">
                  {po.tax > 0 ? (
                    <>
                      <div>
                        <span className="font-medium text-blue-600">
                          PPN{displayPpnRate ? ` ${displayPpnRate}%` : ""}
                        </span>
                        <p className="text-xs text-muted-foreground">
                          Di luar harga item (eksklusif)
                        </p>
                      </div>
                      <span className="font-medium text-blue-600 whitespace-nowrap">
                        + {formatCurrency(po.tax)}
                      </span>
                    </>
                  ) : po.tax_included ? (
                    <>
                      <div>
                        <span className="font-medium text-muted-foreground">
                          PPN{displayPpnRate != null ? ` ${displayPpnRate}%` : ""}{" "}
                          <span className="italic">(info)</span>
                        </span>
                        <p className="text-xs text-muted-foreground">
                          Sudah termasuk harga item - bukan tambahan ke total
                        </p>
                      </div>
                      <span className="font-medium text-muted-foreground whitespace-nowrap">
                        {includedTaxInfo != null
                          ? formatCurrency(includedTaxInfo)
                          : "—"}
                      </span>
                    </>
                  ) : po.ppn_rate === 0 ? (
                    <>
                      <div>
                        <span className="text-muted-foreground">PPN</span>
                        <p className="text-xs text-muted-foreground">
                          Tidak ada PPN (pembelian marketplace)
                        </p>
                      </div>
                      <span className="text-muted-foreground text-xs">—</span>
                    </>
                  ) : (
                    <>
                      <div>
                        <span className="text-muted-foreground">PPN</span>
                        <p className="text-xs text-muted-foreground">
                          Tidak ada / sudah termasuk dalam harga item
                        </p>
                      </div>
                      <span className="text-muted-foreground text-xs">—</span>
                    </>
                  )}
                </div>

                {/* PPH */}
                {po.pph_type ? (
                  <div className="rounded-md bg-orange-50 border border-orange-200 p-3 space-y-1">
                    <div className="flex justify-between items-center text-sm gap-2">
                      <div>
                        <span className="font-semibold text-orange-900">
                          {PPH_LABELS[po.pph_type] || po.pph_type}
                        </span>
                        <span className="ml-1.5 text-xs text-orange-700">
                          ({po.pph_rate}%)
                        </span>
                      </div>
                      <span className="font-semibold text-orange-900 whitespace-nowrap">
                        - {formatCurrency(po.pph_amount || 0)}
                      </span>
                    </div>
                    <p className="text-xs text-orange-700 leading-relaxed">
                      Dipotong dari pembayaran vendor &amp; disetor ke KPP oleh
                      perusahaan.
                    </p>
                  </div>
                ) : (
                  <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground">PPH</span>
                    <span className="text-muted-foreground text-xs">
                      Tidak ada
                    </span>
                  </div>
                )}
              </div>

              {/* Ongkos Kirim */}
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">Ongkos Kirim</span>
                {po.postage > 0 ? (
                  <span className="font-medium text-blue-600">
                    + {formatCurrency(po.postage)}
                  </span>
                ) : (
                  <span className="text-muted-foreground text-xs">—</span>
                )}
              </div>

              <hr />

              {/* Grand Total */}
              <div className="flex justify-between items-center text-lg font-bold">
                <span>Grand Total</span>
                <span>{formatCurrency(po.total_price)}</span>
              </div>

              {/* Ringkasan pembayaran jika ada PPH */}
              {(po.pph_amount || 0) > 0 && (
                <div className="rounded-md bg-muted p-3 space-y-2 text-sm">
                  <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
                    Ringkasan Pembayaran
                  </p>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">
                      Dibayarkan ke Vendor
                    </span>
                    <span className="font-medium">
                      {formatCurrency(po.total_price)}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">
                      PPH disetor ke KPP
                    </span>
                    <span className="font-medium text-orange-700">
                      + {formatCurrency(po.pph_amount || 0)}
                    </span>
                  </div>
                  <hr className="border-dashed" />
                  <div className="flex justify-between font-semibold">
                    <span>Total Pengeluaran Perusahaan</span>
                    <span>
                      {formatCurrency(po.total_price + (po.pph_amount || 0))}
                    </span>
                  </div>
                </div>
              )}
            </div>
          </DialogContent>
        </Dialog>

        {/* --- DIALOG PROGRESS PEMBAYARAN DP & BP --- */}
        <Dialog open={isDpBpDialogOpen} onOpenChange={setIsDpBpDialogOpen}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>
                {dpBpDialogMode === "approve"
                  ? "Konfirmasi Pembayaran DP & Pelunasan"
                  : "Edit Pembayaran DP & Pelunasan"}
              </DialogTitle>
              <DialogDescription>
                PO ini memakai metode pembayaran &quot;{po?.payment_term}
                &quot; dengan skema{" "}
                <strong>
                  {dpBpRequiresFullPayment
                    ? "Kirim Setelah Pelunasan"
                    : "Kirim Setelah DP"}
                </strong>
                .{" "}
                {dpBpDialogMode === "approve"
                  ? dpBpRequiresFullPayment
                    ? "DP dan BP (pelunasan) harus sama-sama lunas dulu untuk menyelesaikan approval ini."
                    : 'Approval ini bisa selesai cukup dengan DP dicentang - barang sudah bisa diterima. BP boleh menyusul belakangan, dan progress ini tetap bisa diedit lagi kapan pun lewat tombol "Edit DP/BP" di halaman ini.'
                  : "Progress DP/BP bisa diedit kapan pun oleh Payment Validator PO ini atau admin - dipakai untuk koreksi kalau ada salah input."}
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-3 py-2">
              <div className="flex items-center gap-2">
                <Checkbox
                  id="dp-paid"
                  checked={dpChecked}
                  onCheckedChange={(v) => setDpChecked(!!v)}
                />
                <Label htmlFor="dp-paid" className="cursor-pointer">
                  DP (Down Payment) sudah dibayar
                </Label>
              </div>
              <div className="flex items-center gap-2">
                <Checkbox
                  id="bp-paid"
                  checked={bpChecked}
                  onCheckedChange={(v) => setBpChecked(!!v)}
                />
                <Label htmlFor="bp-paid" className="cursor-pointer">
                  BP / Pelunasan sudah dibayar
                </Label>
              </div>
              {dpBpDialogMode === "approve" &&
                (() => {
                  const approvalWillComplete = dpBpRequiresFullPayment
                    ? dpChecked && bpChecked
                    : dpChecked;
                  if (approvalWillComplete) {
                    return (
                      <p className="text-xs text-green-600">
                        {dpChecked && bpChecked
                          ? "DP & BP sudah lunas — approval selesai."
                          : "DP sudah dicentang — approval selesai, barang sudah bisa diterima. BP menyusul belakangan."}
                      </p>
                    );
                  }
                  return (
                    <p className="text-xs text-muted-foreground">
                      {dpBpRequiresFullPayment
                        ? 'Belum lunas — PO akan tetap "Pending Approval" sampai DP & BP sama-sama dicentang.'
                        : 'DP belum dicentang — PO akan tetap "Pending Approval" sampai DP dicentang.'}
                    </p>
                  );
                })()}
            </div>
            <DialogFooter>
              <Button
                variant="outline"
                onClick={() => setIsDpBpDialogOpen(false)}
                disabled={actionLoading}
              >
                Batal
              </Button>
              {dpBpDialogMode === "approve" ? (
                <Button
                  onClick={() =>
                    handleApprovalAction("approved", {
                      dp_paid: dpChecked,
                      bp_paid: bpChecked,
                    })
                  }
                  disabled={actionLoading || (!dpChecked && !bpChecked)}
                >
                  {actionLoading ? (
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  ) : (
                    <Check className="mr-2 h-4 w-4" />
                  )}
                  {(() => {
                    const approvalWillComplete = dpBpRequiresFullPayment
                      ? dpChecked && bpChecked
                      : dpChecked;
                    if (!approvalWillComplete) return "Simpan Progress";
                    return dpChecked && bpChecked
                      ? "Setujui & Tandai Lunas"
                      : "Setujui (BP Menyusul)";
                  })()}
                </Button>
              ) : (
                <Button onClick={handleEditDpBpPayment} disabled={actionLoading}>
                  {actionLoading ? (
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  ) : (
                    <Check className="mr-2 h-4 w-4" />
                  )}
                  Simpan Perubahan
                </Button>
              )}
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* --- DIALOG EDIT STATUS BARANG MR --- */}
        <Dialog open={isEditStatusOpen} onOpenChange={setIsEditStatusOpen}>
          <DialogContent className="sm:max-w-md">
            <DialogHeader>
              <DialogTitle>Update Status Barang MR</DialogTitle>
              <DialogDescription>
                Ubah status barang <strong>{selectedItemToEdit?.name}</strong>{" "}
                secara manual.
              </DialogDescription>
            </DialogHeader>

            <div className="grid gap-4 py-4">
              <div className="grid gap-2">
                <Label htmlFor="status">Status Barang</Label>
                <Select
                  value={editForm.status}
                  onValueChange={(val) =>
                    setEditForm({ ...editForm, status: val })
                  }
                >
                  <SelectTrigger>
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
                <Label htmlFor="note">Catatan / Alasan</Label>
                <Textarea
                  id="note"
                  placeholder="Contoh: Stok habis, diganti dengan tipe X..."
                  value={editForm.note}
                  onChange={(e) =>
                    setEditForm({ ...editForm, note: e.target.value })
                  }
                />
              </div>
            </div>

            <DialogFooter>
              <Button
                variant="outline"
                onClick={() => setIsEditStatusOpen(false)}
              >
                Batal
              </Button>
              <Button onClick={handleSaveStatusUpdate} disabled={actionLoading}>
                {actionLoading && (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                )}
                Simpan Perubahan
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
        {/* -------------------------------------- */}

        <Dialog open={isLevelInfoOpen} onOpenChange={setIsLevelInfoOpen}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Definisi Level MR</DialogTitle>
              <DialogDescription>
                Penjelasan status level Material Request.
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4 py-2 max-h-[60vh] overflow-y-auto">
              <div>
                <h4 className="font-semibold mb-2">OPEN</h4>
                <ul className="list-disc pl-5 space-y-1 text-sm">
                  {MR_LEVELS.filter((l) => l.group === "OPEN").map((l) => (
                    <li key={l.value}>
                      <span className="font-semibold">{l.value}:</span>{" "}
                      {l.description}
                    </li>
                  ))}
                </ul>
              </div>
              <div>
                <h4 className="font-semibold mb-2">CLOSE</h4>
                <ul className="list-disc pl-5 space-y-1 text-sm">
                  {MR_LEVELS.filter((l) => l.group === "CLOSE").map((l) => (
                    <li key={l.value}>
                      <span className="font-semibold">{l.value}:</span>{" "}
                      {l.description}
                    </li>
                  ))}
                </ul>
              </div>
            </div>
            <DialogFooter>
              <Button onClick={() => setIsLevelInfoOpen(false)}>Tutup</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* --- QUICK VIEW PO REF (klik badge PO Refs di tabel tracking) --- */}
        <Dialog open={poRefDialogOpen} onOpenChange={setPoRefDialogOpen}>
          <DialogContent className="max-w-4xl max-h-[80vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle className="text-xl flex items-center gap-2 flex-wrap pr-6">
                <FileText className="h-5 w-5 shrink-0" />
                <span>Ringkasan PO: {poRefDetail?.kode_po ?? "..."}</span>
                {poRefDetail?.is_asset && (
                  <Badge className="bg-purple-600 hover:bg-purple-600 text-white shrink-0">
                    PO Asset
                  </Badge>
                )}
              </DialogTitle>
              <DialogDescription>
                Informasi singkat dan daftar barang.
              </DialogDescription>
            </DialogHeader>

            {poRefLoading && (
              <div className="flex justify-center items-center h-40">
                <Loader2 className="h-6 w-6 animate-spin" />
              </div>
            )}

            {!poRefLoading && poRefDetail && (
              <div className="space-y-6">
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4 p-4 bg-muted/30 rounded-lg text-sm border">
                  <div>
                    <p className="text-muted-foreground text-xs flex items-center gap-1">
                      <Building2 className="h-3 w-3" /> Vendor
                    </p>
                    <p className="font-medium">
                      {poRefDetail.vendor_details?.nama_vendor || "-"}
                    </p>
                  </div>
                  <div>
                    <p className="text-muted-foreground text-xs flex items-center gap-1">
                      <CircleUser className="h-3 w-3" /> Pembuat PO
                    </p>
                    <p className="font-medium">
                      {poRefDetail.users_with_profiles?.nama || "-"}
                    </p>
                  </div>
                  <div>
                    <p className="text-muted-foreground text-xs flex items-center gap-1">
                      <Tag className="h-3 w-3" /> Status
                    </p>
                    <Badge
                      variant="outline"
                      className={cn(
                        PO_REF_STATUS_COLORS[poRefDetail.status ?? ""] ||
                          PO_REF_STATUS_COLOR_DEFAULT,
                      )}
                    >
                      {poRefDetail.status}
                    </Badge>
                  </div>
                  <div>
                    <p className="text-muted-foreground text-xs flex items-center gap-1">
                      <Calendar className="h-3 w-3" /> Dibuat
                    </p>
                    <p className="font-medium">
                      {formatDateFriendly(poRefDetail.created_at)}
                    </p>
                  </div>
                  <div>
                    <p className="text-muted-foreground text-xs flex items-center gap-1">
                      Ref. MR
                    </p>
                    <p className="font-medium">
                      {poRefDetail.material_requests?.kode_mr || "N/A"}
                    </p>
                  </div>
                  <div className="col-span-2">
                    <p className="text-muted-foreground text-xs flex items-center gap-1">
                      <DollarSign className="h-3 w-3" /> Total Harga
                    </p>
                    <p className="font-bold text-lg">
                      {formatCurrency(poRefDetail.total_price)}
                    </p>
                  </div>
                </div>

                <div>
                  <h4 className="font-semibold mb-2 flex items-center gap-2">
                    <Layers className="h-4 w-4" /> Daftar Barang
                  </h4>
                  <div className="border rounded-md overflow-hidden">
                    <Table>
                      <TableHeader className="bg-muted/50">
                        <TableRow>
                          <TableHead>Nama Barang</TableHead>
                          <TableHead>Qty</TableHead>
                          <TableHead>Harga Satuan</TableHead>
                          <TableHead>Total</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {poRefDetail.items && poRefDetail.items.length > 0 ? (
                          poRefDetail.items.map((item, i) => (
                            <TableRow key={i}>
                              <TableCell className="font-medium">
                                <div className="flex items-center gap-2">
                                  {item.name}
                                  <AssetGoodsBadge isAsset={item.is_asset} />
                                </div>
                              </TableCell>
                              <TableCell>
                                {item.qty} {item.uom}
                              </TableCell>
                              <TableCell>{formatCurrency(item.price)}</TableCell>
                              <TableCell>
                                {formatCurrency(
                                  item.total_price || item.price * item.qty,
                                )}
                              </TableCell>
                            </TableRow>
                          ))
                        ) : (
                          <TableRow>
                            <TableCell
                              colSpan={4}
                              className="text-center text-muted-foreground h-16"
                            >
                              Tidak ada barang.
                            </TableCell>
                          </TableRow>
                        )}
                      </TableBody>
                    </Table>
                  </div>
                </div>
              </div>
            )}

            <DialogFooter>
              <Button
                variant="outline"
                onClick={() => setPoRefDialogOpen(false)}
              >
                Tutup
              </Button>
              {poRefDetail && (
                <Button asChild>
                  <Link href={`/purchase-order/${poRefDetail.id}`}>
                    <Eye className="mr-2 h-4 w-4" /> Lihat PO Lengkap
                  </Link>
                </Button>
              )}
            </DialogFooter>
          </DialogContent>
        </Dialog>

        <ReceiveGoodsDialog
          open={isReceiveDialogOpen}
          onOpenChange={setIsReceiveDialogOpen}
          items={po.items || []}
          receiveRecord={po.receive_record}
          onSubmit={handleSubmitReceive}
          isSubmitting={actionLoading}
        />

        {!isPrintingReceive && (
          <div className="print-only">
            <PrintablePO
              po={po}
              companyInfo={
                printCompany ? COMPANY_DETAILS[printCompany] : companyInfo
              }
              qrUrl={qrUrl}
              vendorData={vendorData}
            />
          </div>
        )}
        {isPrintingReceive && po.receive_record && (
          <div className="print-only">
            <PrintableReceiveRecord po={po} receiveRecord={po.receive_record} />
          </div>
        )}
      </Content>
    </>
  );
}

const PrintablePO = ({
  po,
  companyInfo,
  qrUrl,
  vendorData,
}: {
  po: PurchaseOrderDetail;
  companyInfo: (typeof COMPANY_DETAILS)["DEFAULT"];
  qrUrl: string;
  vendorData: { name: string; address: string; contact: string; code: string };
}) => {
  const printSubtotal = po.items.reduce(
    (acc, item) => acc + item.price * item.qty,
    0,
  );
  const printDpp = printSubtotal - (po.discount || 0);
  const printPpnRate =
    po.ppn_rate != null
      ? po.ppn_rate
      : printDpp > 0 && po.tax > 0
        ? Math.round((po.tax / printDpp) * 100)
        : null;
  // Info PPN yang sudah termasuk harga item - sekadar informasi di cetak,
  // TIDAK ditambahkan ke Grand Total (lihat catatan sama di halaman detail).
  const printIncludedTaxInfo =
    po.tax_included && printPpnRate != null
      ? printSubtotal * (printPpnRate / 100)
      : null;

  return (
    <div
      id="printable-po-a4"
      className="p-8 bg-white text-black font-sans text-sm leading-normal min-h-[29.7cm] flex flex-col relative"
    >
      <header className="flex justify-between items-start border-b-2 border-black pb-6 mb-6">
        <div className="flex items-center gap-6 w-2/3">
          <div className="w-[120px] relative flex-shrink-0 flex items-center">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={companyInfo.logo}
              alt="Logo"
              className="object-contain max-w-full max-h-full object-left"
            />
          </div>
          <div>
            <h1 className="text-xl font-black uppercase tracking-tight text-gray-900 leading-none">
              {companyInfo.name}
            </h1>
            <p className="text-xs text-gray-600 mt-1.5 leading-snug max-w-sm">
              {companyInfo.address}
            </p>
            <p className="text-xs font-medium text-gray-800 mt-1">
              {companyInfo.email} | {companyInfo.phone}
            </p>
          </div>
        </div>
        <div className="text-right w-1/3">
          <h2 className="text-xl font-black text-gray-800 tracking-wide uppercase">
            Purchase Order
          </h2>
          <div className="mt-2">
            <p className="text-base font-bold text-gray-900">{po.kode_po}</p>
            <p className="text-xs text-gray-500">
              Tgl: {formatDateFriendly(po.created_at)}
            </p>
          </div>
        </div>
      </header>

      <section className="flex gap-6 mb-8">
        <div className="w-1/2 border border-gray-300 rounded-sm">
          <div className="bg-gray-100 px-3 py-1.5 border-b border-gray-300">
            <h3 className="font-bold text-[10px] uppercase tracking-wider text-gray-600">
              Vendor (Supplier)
            </h3>
          </div>
          <div className="p-3">
            <p className="font-bold text-base text-gray-900">
              {vendorData.name}
            </p>
            {vendorData.code && (
              <p className="text-[10px] font-mono text-gray-500 mb-1">
                ID: {vendorData.code}
              </p>
            )}
            <p className="text-xs mt-1 text-gray-700 leading-relaxed whitespace-pre-line">
              {vendorData.address}
            </p>
            <div className="mt-3 pt-2 border-t border-dashed border-gray-200 flex flex-col gap-0.5">
              <p className="text-xs">
                <span className="text-gray-500">UP:</span> {vendorData.contact}
              </p>
            </div>
          </div>
        </div>
        <div className="w-1/2 border border-gray-300 rounded-sm">
          <div className="bg-gray-100 px-3 py-1.5 border-b border-gray-300">
            <h3 className="font-bold text-[10px] uppercase tracking-wider text-gray-600">
              Kirim Ke (Ship To)
            </h3>
          </div>
          <div className="p-3">
            <p className="font-bold text-base text-gray-900">
              {companyInfo.name}
            </p>
            <p className="text-xs mt-1 text-gray-700 leading-relaxed whitespace-pre-line">
              {po.shipping_address}
            </p>
            <div className="mt-3 pt-2 border-t border-dashed border-gray-200">
              <p className="text-xs font-mono text-gray-500">
                Ref MR: {po.material_requests?.kode_mr || "-"}
              </p>
            </div>
          </div>
        </div>
      </section>

      <section className="mb-6">
        <table className="w-full border-collapse border-y-2 border-black table-fixed text-xs">
          <thead>
            <tr className="bg-gray-50">
              <th className="py-2 px-2 text-left font-bold text-gray-700 w-[5%] border-b border-gray-300 whitespace-nowrap">
                No
              </th>
              <th className="py-2 px-2 text-left font-bold text-gray-700 w-[30%] border-b border-gray-300 whitespace-nowrap">
                Deskripsi Barang
              </th>
              <th className="py-2 px-2 text-left font-bold text-gray-700 w-[17%] border-b border-gray-300 whitespace-nowrap">
                Part Number
              </th>
              <th className="py-2 px-2 text-center font-bold text-gray-700 w-[8%] border-b border-gray-300 whitespace-nowrap">
                Qty
              </th>
              <th className="py-2 px-2 text-center font-bold text-gray-700 w-[10%] border-b border-gray-300 whitespace-nowrap">
                Satuan
              </th>
              <th className="py-2 px-2 text-right font-bold text-gray-700 w-[15%] border-b border-gray-300 whitespace-nowrap">
                Harga (@)
              </th>
              <th className="py-2 px-2 text-right font-bold text-gray-700 w-[15%] border-b border-gray-300 whitespace-nowrap">
                Total
              </th>
            </tr>
          </thead>
          <tbody>
            {po.items.map((item, index) => (
              <tr
                key={index}
                className="border-b border-gray-200 last:border-0"
              >
                <td className="py-3 px-2 text-left align-top text-gray-600">
                  {index + 1}
                </td>
                <td className="py-3 px-2 text-left align-top font-medium text-gray-900 break-words whitespace-normal">
                  {item.name}
                </td>
                <td className="py-3 px-2 text-left align-top font-mono text-[10px] text-gray-600 break-all">
                  {item.part_number}
                </td>
                <td className="py-3 px-2 text-center align-top text-gray-900">
                  {item.qty}
                </td>
                <td className="py-3 px-2 text-center align-top text-gray-600">
                  {item.uom}
                </td>
                <td className="py-3 px-2 text-right align-top whitespace-nowrap text-gray-900">
                  {formatCurrency(item.price)}
                </td>
                <td className="py-3 px-2 text-right align-top whitespace-nowrap font-semibold text-gray-900 bg-gray-50">
                  {formatCurrency(item.total_price || item.price * item.qty)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>

      <section className="flex gap-10 break-inside-avoid items-start">
        <div className="flex-1 space-y-4">
          <div className="space-y-1">
            <h4 className="font-bold text-xs text-gray-900 uppercase border-b border-gray-300 pb-1 inline-block">
              Catatan / Notes:
            </h4>
            <p className="text-xs italic text-gray-600 whitespace-pre-wrap leading-relaxed pt-1">
              {po.notes || "Tidak ada catatan khusus."}
            </p>
          </div>
          <div className="space-y-1">
            <h4 className="font-bold text-xs text-gray-900 uppercase border-b border-gray-300 pb-1 inline-block">
              Syarat Pembayaran:
            </h4>
            <p className="text-xs font-medium text-gray-800 pt-1">
              {po.payment_term}
            </p>
          </div>
        </div>
        <div className="w-[40%]">
          <div className="space-y-2">
            <div className="flex justify-between text-xs">
              <span className="text-gray-600">Subtotal</span>
              <span className="font-medium text-gray-900">
                {formatCurrency(printSubtotal)}
              </span>
            </div>
            {po.discount > 0 && (
              <div className="flex justify-between text-xs text-red-600">
                <span>Diskon</span>
                <span>- {formatCurrency(po.discount)}</span>
              </div>
            )}
            {(po.pph_amount || 0) > 0 && (
              <div className="flex justify-between text-xs text-red-600">
                <span>PPH ({po.pph_rate}%)</span>
                <span>- {formatCurrency(po.pph_amount || 0)}</span>
              </div>
            )}
            {po.tax > 0 && (
              <div className="flex justify-between text-xs">
                <span className="text-gray-600">
                  Pajak (PPN{printPpnRate ? ` ${printPpnRate}%` : ""})
                </span>
                <span className="font-medium text-gray-900">
                  + {formatCurrency(po.tax)}
                </span>
              </div>
            )}
            {po.tax === 0 && po.tax_included && (
              <div className="flex justify-between text-xs">
                <span className="text-gray-600">
                  PPN
                  {printPpnRate != null ? ` ${printPpnRate}%` : ""} (sudah
                  termasuk harga)
                </span>
                <span className="font-medium text-gray-900">
                  {printIncludedTaxInfo != null
                    ? formatCurrency(printIncludedTaxInfo)
                    : "-"}
                </span>
              </div>
            )}
            {po.tax === 0 && !po.tax_included && po.ppn_rate === 0 && (
              <div className="flex justify-between text-xs">
                <span className="text-gray-600">PPN</span>
                <span className="text-gray-600">
                  Tidak ada (pembelian marketplace)
                </span>
              </div>
            )}
            <div className="flex justify-between text-xs pb-2 border-b border-gray-300">
              <span className="text-gray-600">Ongkos Kirim</span>
              <span className="font-medium text-gray-900">
                + {formatCurrency(po.postage)}
              </span>
            </div>
            <div className="flex justify-between items-center bg-gray-900 text-white px-3 py-2 rounded-sm mt-1 print:bg-gray-200 print:text-black print:border print:border-black">
              <span className="font-bold text-xs uppercase tracking-wider">
                Grand Total
              </span>
              <span className="font-black text-base">
                {formatCurrency(po.total_price)}
              </span>
            </div>
          </div>
        </div>
      </section>

      <div className="mt-auto pt-12 break-inside-avoid">
        <div className="border-t-2 border-black pt-4 flex flex-col items-center text-center">
          <div className="flex items-center gap-4 mb-2">
            <div className="text-right">
              <p className="text-[10px] font-bold uppercase text-gray-400 tracking-widest">
                Digital Validation
              </p>
              <p className="text-[9px] text-gray-400">Scan to verify</p>
            </div>
            {qrUrl ? (
              <div className="p-1 border border-gray-800 rounded-md">
                <QRCodeCanvas value={qrUrl} size={60} />
              </div>
            ) : (
              <Skeleton className="h-[60px] w-[60px]" />
            )}
            <div className="text-left">
              <p className="text-[10px] font-bold uppercase text-gray-400 tracking-widest">
                Approved By System
              </p>
              <p className="text-[9px] text-gray-400">Garuda Procure System</p>
            </div>
          </div>
          <p className="text-[10px] text-gray-500 italic max-w-xl leading-tight">
            Dokumen ini diterbitkan secara elektronik oleh sistem Garuda Procure
            dan sah tanpa tanda tangan basah. Status persetujuan dapat
            diverifikasi melalui pemindaian kode QR di atas.
          </p>
          <p className="text-[9px] text-gray-400 mt-1">
            Dicetak oleh {po.users_with_profiles?.nama || "System"} pada{" "}
            {new Date().toLocaleString("id-ID")}
          </p>
        </div>
      </div>
    </div>
  );
};

const PrintableReceiveRecord = ({
  po,
  receiveRecord,
}: {
  po: PurchaseOrderDetail;
  receiveRecord: ReceiveRecord;
}) => {
  return (
    <div
      id="printable-po-a4"
      className="p-8 bg-white text-black font-sans text-sm leading-normal min-h-[29.7cm] flex flex-col relative"
    >
      <header className="flex justify-between items-start border-b-2 border-black pb-6 mb-6">
        <div>
          <h1 className="text-xl font-black uppercase tracking-tight text-gray-900 leading-none">
            Riwayat Penerimaan Barang
          </h1>
          <p className="text-xs text-gray-600 mt-1.5">PO: {po.kode_po}</p>
        </div>
        <div className="text-right">
          <h2 className="text-lg font-black text-gray-800 tracking-wide uppercase">
            {receiveRecord.is_full_match ? "Full Received" : "Partial Receive"}
          </h2>
        </div>
      </header>

      <div className="mb-6 text-xs space-y-1">
        <p>
          <span className="font-semibold">Diterima oleh:</span>{" "}
          {receiveRecord.received_by_name}
        </p>
        <p>
          <span className="font-semibold">Waktu:</span>{" "}
          {new Date(receiveRecord.received_at).toLocaleString("id-ID")}
        </p>
      </div>

      <table className="w-full border-collapse text-xs">
        <thead>
          <tr className="border-b-2 border-black">
            <th className="text-left py-2 pr-2">Nama Barang</th>
            <th className="text-right py-2 px-2 w-24">Qty PO</th>
            <th className="text-right py-2 px-2 w-24">Qty Diterima</th>
            <th className="text-center py-2 pl-2 w-24">Status</th>
          </tr>
        </thead>
        <tbody>
          {receiveRecord.items.map((item) => {
            const match = item.received_qty === item.ordered_qty;
            return (
              <tr key={item.part_number} className="border-b border-gray-300">
                <td className="py-2 pr-2">{item.part_name}</td>
                <td className="text-right py-2 px-2">{item.ordered_qty}</td>
                <td className="text-right py-2 px-2">{item.received_qty}</td>
                <td className="text-center py-2 pl-2">
                  {match ? "Sesuai" : "Tidak Sesuai"}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>

      <div className="mt-auto pt-8">
        <p className="text-[10px] text-gray-500 italic">
          Dokumen ini diterbitkan secara elektronik oleh sistem Garuda
          Procure.
        </p>
        <p className="text-[9px] text-gray-400 mt-1">
          Dicetak pada {new Date().toLocaleString("id-ID")}
        </p>
      </div>
    </div>
  );
};

export default function DetailPOPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const resolvedParams = use(params);
  return (
    <Suspense fallback={<DetailPOSkeleton />}>
      <DetailPOPageContent params={resolvedParams} />
    </Suspense>
  );
}
