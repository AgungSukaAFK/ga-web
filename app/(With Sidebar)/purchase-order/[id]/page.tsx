// src/app/(With Sidebar)/purchase-order/[id]/page.tsx

"use client";

import { use, useEffect, useRef, useState, Suspense } from "react";
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
  QrCode,
  Download,
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
  DeliveryType,
  POItem,
} from "@/type";
import {
  formatCurrency,
  formatDateFriendly,
  cn,
  formatDateWithTime,
  formatAge,
} from "@/lib/utils";
import {
  fetchPurchaseOrderById,
  submitReceiveRecord,
  deriveReceiveDrivenStatus,
  fetchBarangAssetFlags,
  getFullReceivedStamp,
} from "@/services/purchaseOrderService";
import { ReceiveGoodsDialog } from "./ReceiveGoodsDialog";
import { PaginatedPrintDocument } from "./PaginatedPrintDocument";
import {
  updateMrItemStatus, // Pastikan ini sudah ada dari Langkah 2
  normalizeMrOrders, // Pastikan ini sudah ada dari Langkah 1
  recalculateMrStatus,
  recalculateMrLevel,
  removeBastForMrItem,
  sendItemsToRequester,
} from "@/services/mrService";
import { notifyOnPOApproval } from "@/lib/notifications/client";
import { logActivity } from "@/services/logService";
import { ensureReceiptToken } from "@/services/goodsReceiptService";
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
} from "@/components/ui/dropdown-menu";
import { ActivityLogDialog } from "@/components/activity-log-dialog";
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
  MR_ITEM_STATUS_COLOR_DEFAULT,
  MR_ITEM_STATUS_LABELS,
  APPROVAL_TYPE_PAYMENT_APPROVAL,
  APPROVAL_TYPE_RECEIVER,
  PO_STATUS_PENDING_RECEIVE,
  PO_STATUS_PARTIAL_RECEIVE,
  PO_STATUS_FULL_RECEIVED,
  PO_REF_STATUS_COLORS,
  PO_REF_STATUS_COLOR_DEFAULT,
  DELIVERY_TYPE_OPTIONS,
  MR_ITEM_STATUSES,
  isDpBpPaymentTerm,
  isPaymentValidatorApproval,
  VENDOR_TIPE_LABELS,
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

// Tunggu logo benar-benar selesai di-decode browser sebelum window.print()
// dipanggil - preload di mount cuma menjamin BYTE-nya sudah di-cache, bukan
// berarti <img> yang baru di-mount di dokumen cetak sudah selesai decode +
// paint (itu proses async terpisah). Kalau window.print() kepanggil duluan,
// logo bisa nge-print blank/kosong. img.decode() resolve begitu bitmap-nya
// beneran siap ditampilkan, jadi jauh lebih pasti dibanding nebak jumlah
// frame (requestAnimationFrame) yang cukup.
async function waitForLogoReady(src: string) {
  try {
    const img = new window.Image();
    img.src = src;
    if (img.decode) {
      await img.decode();
    } else if (!img.complete) {
      await new Promise<void>((resolve) => {
        img.onload = () => resolve();
        img.onerror = () => resolve();
      });
    }
  } catch {
    // Gagal decode (mis. src rusak) - biarkan window.print() tetap jalan,
    // lebih baik cetak tanpa logo daripada macet total.
  }
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

  // State upload lampiran (PO/Finance/Purchasing) langsung dari halaman detail
  const [isUploadingPO, setIsUploadingPO] = useState(false);
  const [isUploadingFinance, setIsUploadingFinance] = useState(false);
  const [isUploadingPurchasing, setIsUploadingPurchasing] = useState(false);
  // Jenis lampiran yang mau diupload ke "Lampiran Purchasing" - wajib
  // dipilih dulu (Quotation/Invoice) sebelum file bisa diunggah.
  const [purchasingAttachmentType, setPurchasingAttachmentType] = useState<
    "quotation" | "invoice" | ""
  >("");

  // State Dialogs
  const [isBudgetDialogOpen, setIsBudgetDialogOpen] = useState(false);
  const [isLevelInfoOpen, setIsLevelInfoOpen] = useState(false);

  // --- STATE UNTUK EDIT STATUS MR ITEM (BARU) ---
  const [isEditStatusOpen, setIsEditStatusOpen] = useState(false);
  const [selectedItemToEdit, setSelectedItemToEdit] = useState<Order | null>(
    null,
  );
  // Fallback identifier kalau item ini anomali (gak punya part_number) - lihat
  // komentar di updateMrItemStatus (mrService.ts).
  const [selectedItemIndexToEdit, setSelectedItemIndexToEdit] = useState<
    number | null
  >(null);
  const [deliveryDetailItem, setDeliveryDetailItem] = useState<Order | null>(
    null,
  );
  const [editForm, setEditForm] = useState({
    status: "",
    note: "",
  });
  // ----------------------------------------------

  const [qrUrl, setQrUrl] = useState("");

  // Cetak BAST - dokumen fisik yang ditempel ke paket, isinya QR yang
  // mengarah ke halaman publik /goods-receipt/[token] (scan utk konfirmasi
  // penerimaan barang, lihat services/goodsReceiptService.ts). Sama pola
  // print-nya dengan isPrintingReceive/printCompany di bawah (double rAF +
  // window.print()).
  const [isPrintingBast, setIsPrintingBast] = useState(false);
  const [bastPrintCompany, setBastPrintCompany] = useState<
    "GMI" | "GIS" | "LOURDES" | null
  >(null);

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
  // Bukti pembayaran - wajib dilampirkan tiap kali Payment Validator approve
  // (berlaku untuk semua metode pembayaran: Cash, Termin, maupun DP/BP).
  // File-nya otomatis ikut tersimpan sebagai lampiran Finance di PO ini.
  const [paymentProofFile, setPaymentProofFile] = useState<File | null>(null);

  // State modal checklist penerimaan barang (Receiver) - dipakai dari step
  // approval "Receiver" maupun tombol "Terima Barang" manual.
  const [isReceiveDialogOpen, setIsReceiveDialogOpen] = useState(false);
  const [isPrintingReceive, setIsPrintingReceive] = useState(false);

  // State dialog "Kirim ke Requester" (GA kirim barang yg sudah "Diterima
  // GA" ke requester) - multi-select barang + qty per barang, form
  // pengiriman (jenis/ekspedisi/resi/catatan) & lampiran dibagi bareng utk
  // semua barang terpilih.
  const [isDeliverDialogOpen, setIsDeliverDialogOpen] = useState(false);
  const [selectedPartNumbersForDelivery, setSelectedPartNumbersForDelivery] =
    useState<Set<string>>(new Set());
  const [deliveryQtyByPartNumber, setDeliveryQtyByPartNumber] = useState<
    Record<string, string>
  >({});
  const [deliveryType, setDeliveryType] = useState<DeliveryType>(
    DELIVERY_TYPE_OPTIONS[0],
  );
  const [deliveryCourier, setDeliveryCourier] = useState("");
  const [deliveryTrackingNumber, setDeliveryTrackingNumber] = useState("");
  const [deliveryNote, setDeliveryNote] = useState("");
  const [deliveryFiles, setDeliveryFiles] = useState<FileList | null>(null);
  const [sendingDelivery, setSendingDelivery] = useState(false);

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
        tipeVendor: "",
      };

    return {
      name: details.nama_vendor || details.name || "N/A",
      address: details.alamat || details.address || "N/A",
      contact: details.contact_person || details.cp || details.contact || "N/A",
      email: details.email || "N/A",
      code: details.kode_vendor || "",
      tipeVendor: details.tipe_vendor || "",
    };
  };

  const isMrItemInPO = (mrItem: any) => {
    if (!po?.items) return false;
    // Strict Part Number check
    if (!mrItem.part_number) return false;
    return po.items.some((poItem) => poItem.part_number === mrItem.part_number);
  };

  // Barang yg sudah "Diterima GA" lewat PO ini, belum dikirim ke requester.
  const deliverEligibleItems = (po?.material_requests?.orders || []).filter(
    (item: Order) =>
      item.status === MR_ITEM_STATUSES.DITERIMA_GA && isMrItemInPO(item),
  );

  // "Cetak BAST" tersedia begitu PO ada (selama belum Rejected) - GA/
  // Purchasing perlu bisa cetak & tempel BAST ke paket SEBELUM barang
  // dikirim (QR di dalamnya baru berarti setelah discan pas barang sampai),
  // jadi sengaja TIDAK digantung status pengiriman.
  const canPrintBast = po?.status !== "Rejected";

  const handlePrintBast = async (company: "GMI" | "GIS" | "LOURDES") => {
    if (!po) return;
    try {
      let token = po.receipt_token;
      if (!token) {
        token = await ensureReceiptToken(po.id);
        setPo((prev) => (prev ? { ...prev, receipt_token: token! } : prev));
      }
      setBastPrintCompany(company);
      setIsPrintingBast(true);
    } catch (err: any) {
      toast.error("Gagal menyiapkan BAST", { description: err.message });
    }
  };

  const handleOpenDeliverDialog = () => {
    setSelectedPartNumbersForDelivery(new Set());
    setDeliveryQtyByPartNumber(
      Object.fromEntries(
        deliverEligibleItems.map((item) => [
          item.part_number as string,
          String(item.qty),
        ]),
      ),
    );
    setDeliveryType(DELIVERY_TYPE_OPTIONS[0]);
    setDeliveryCourier("");
    setDeliveryTrackingNumber("");
    setDeliveryNote("");
    setDeliveryFiles(null);
    setIsDeliverDialogOpen(true);
  };

  const toggleDeliveryItemSelection = (partNumber: string) => {
    setSelectedPartNumbersForDelivery((prev) => {
      const next = new Set(prev);
      if (next.has(partNumber)) next.delete(partNumber);
      else next.add(partNumber);
      return next;
    });
  };

  // Cerminkan aksi PO ini ke log MR terkait (kalau ada) - biar requester yang
  // cuma buka halaman MR-nya juga lihat progress PO-nya, bukan cuma yang buka
  // halaman PO.
  const logMrActivity = async (
    actionType: string,
    description: string,
    metadata?: any,
  ) => {
    if (!currentUser || !po?.mr_id) return;
    await logActivity(
      currentUser.id,
      actionType,
      "material_request",
      String(po.mr_id),
      description,
      metadata,
    );
  };

  const handleSendToRequester = async () => {
    if (!po?.mr_id || !currentUser) {
      toast.error("Sesi tidak valid, silakan muat ulang halaman");
      return;
    }
    const selectedItems = deliverEligibleItems.filter(
      (item) =>
        item.part_number &&
        selectedPartNumbersForDelivery.has(item.part_number),
    );
    if (selectedItems.length === 0) {
      toast.error("Pilih minimal satu barang");
      return;
    }
    if (deliveryType === "Kurir/Ekspedisi Eksternal" && !deliveryCourier.trim()) {
      toast.error("Isi nama ekspedisi");
      return;
    }
    for (const item of selectedItems) {
      const qty = Number(deliveryQtyByPartNumber[item.part_number as string]);
      if (!qty || qty <= 0) {
        toast.error(`Isi qty terkirim untuk ${item.name}`);
        return;
      }
    }
    if (!deliveryFiles || deliveryFiles.length === 0) {
      toast.error("Lampirkan bukti pengiriman terlebih dahulu");
      return;
    }
    for (const file of deliveryFiles) {
      const sizeError = getAttachmentSizeError(file);
      if (sizeError) {
        toast.error("Ukuran file terlalu besar", { description: sizeError });
        return;
      }
    }

    setSendingDelivery(true);
    try {
      // Upload lampiran SEKALI - dibagi bareng semua barang terpilih (1
      // pengiriman fisik yg sama), sama pola dgn Upload BAST massal.
      const kodeMr = po.material_requests?.kode_mr?.replace(/\//g, "-") || "mr";
      const pathSegment =
        selectedItems.length === 1
          ? selectedItems[0].part_number
          : "multi-item";
      const uploadedAttachments: Attachment[] = [];
      for (let i = 0; i < deliveryFiles.length; i++) {
        const file = deliveryFiles[i];
        const filePath = `${kodeMr}/delivery/${pathSegment}/${Date.now()}_${file.name}`;
        const formData = new FormData();
        formData.append("file", file);
        const result = await uploadAttachmentVps(formData, filePath);
        if (!result.success) throw new Error(result.message);
        uploadedAttachments.push({
          name: file.name,
          url: result.url,
          type: "delivery",
        });
      }

      await sendItemsToRequester(
        po.mr_id,
        selectedItems.map((item) => ({
          partNumber: item.part_number as string,
          qtySent: Number(deliveryQtyByPartNumber[item.part_number as string]),
        })),
        {
          delivery_type: deliveryType,
          courier: deliveryCourier.trim() || undefined,
          tracking_number: deliveryTrackingNumber.trim() || undefined,
          note: deliveryNote.trim() || undefined,
          attachments: uploadedAttachments,
        },
        currentUser.id,
      );

      await logActivity(
        currentUser.id,
        "SEND_TO_REQUESTER",
        "purchase_order",
        String(po.id),
        `${userProfile?.nama || currentUser.email || "Unknown"} mengirim ${selectedItems.length} barang dari PO ${po.kode_po} ke requester`,
        {
          delivery_type: deliveryType,
          courier: deliveryCourier.trim() || null,
          tracking_number: deliveryTrackingNumber.trim() || null,
          part_numbers: selectedItems.map((item) => item.part_number),
        },
      );
      await logMrActivity(
        "SEND_TO_REQUESTER",
        `${userProfile?.nama || currentUser.email || "Unknown"} mengirim ${selectedItems.length} barang dari PO ${po.kode_po} ke requester`,
        { po_id: po.id, part_numbers: selectedItems.map((item) => item.part_number) },
      );

      toast.success(
        `${selectedItems.length} barang ditandai dalam pengiriman ke requester`,
      );
      setIsDeliverDialogOpen(false);
      await fetchPoData();
    } catch (err: any) {
      toast.error("Gagal kirim barang ke requester", {
        description: getUploadErrorMessage(err),
      });
    } finally {
      setSendingDelivery(false);
    }
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

  // Vendor tipe Site kirim langsung ke site tanpa lewat GA sama sekali -
  // jadi requester sendiri (bukan GA) yang isi checklist konfirmasi terima.
  const isSiteVendorPO = po?.vendor_details?.tipe_vendor === "Site";
  const isMrRequesterForThisPO =
    !!currentUser && currentUser.id === po?.material_requests?.userid;

  // Tombol "Terima Barang" manual - dipakai kalau template PO ini tidak
  // punya step approval "Receiver" (atau receiver-nya mau delegasikan ke GA).
  // Muncul begitu status sudah "Pending Receive" (mulai) atau "Partial
  // Receive" (edit checklist sampai sesuai). Begitu "Full Received", tombol
  // ini hilang, diganti tombol cetak riwayat. Untuk vendor Site, yang boleh
  // klik ini requester-nya sendiri (bukan GA) - lihat isSiteVendorPO di atas.
  const canManuallyReceiveGoods =
    userProfile?.role === "admin" ||
    (isSiteVendorPO ? isMrRequesterForThisPO : isGA);
  const showManualReceiveButton =
    canManuallyReceiveGoods &&
    (po?.status === PO_STATUS_PENDING_RECEIVE ||
      po?.status === PO_STATUS_PARTIAL_RECEIVE);

  // PO dp&bp - orang yang megang step Payment Validator di PO ini (atau
  // admin) selalu bisa buka dialog buat edit dp_paid/bp_paid, kapan pun,
  // tidak digantung status/turn approval tertentu (mis. buat benerin salah
  // input belakangan).
  const isPaymentValidatorForThisPO = po?.approvals?.some(
    (a) => isPaymentValidatorApproval(a) && a.userid === currentUser?.id,
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

  // Payment Validator baru approve (via approval turn ATAU edit DP/BP di
  // luar turn - keduanya bisa jadi titik "pembayaran baru lunas") - barang
  // mulai dikirim vendor. Naikkan level item yang di-cover PO ini ke
  // "Open 4" + tandai status "Dikirim Vendor" biar jelas beda sama
  // "Processing" biasa (yang ambigu - bisa berarti "belum di-PO-kan sama
  // sekali" ATAU "sudah di-PO-kan tapi belum dibayar"). Item yang sudah
  // lebih maju (level Open 5/Close, atau status sudah lewat Processing -
  // dari PO lain yang juga meng-cover part_number yang sama) dilewati,
  // tidak dimundurkan.
  const markItemsShippedByVendor = async (mrId: number, poItems: POItem[]) => {
    if (!currentUser) return;
    const { data: mrRow } = await supabase
      .from("material_requests")
      .select("orders")
      .eq("id", mrId)
      .single();
    const orders = normalizeMrOrders((mrRow?.orders as any[]) || []);
    for (const item of poItems) {
      if (!item.part_number) continue;
      const order = orders.find((o) => o.part_number === item.part_number);
      if (
        !order ||
        order.level === "Open 5" ||
        order.level === "Close" ||
        order.status !== MR_ITEM_STATUSES.PROCESSING
      ) {
        continue;
      }
      try {
        await updateMrItemStatus(
          mrId,
          item.part_number,
          { level: "Open 4", status: MR_ITEM_STATUSES.SHIPPED_BY_VENDOR },
          currentUser.id,
        );
      } catch (err) {
        console.error(
          `Gagal update status item MR (Dikirim Vendor) untuk Part ${item.part_number}:`,
          err,
        );
      }
    }
    await recalculateMrLevel(mrId);
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

      const pvIndex = (po.approvals || []).findIndex((a) =>
        isPaymentValidatorApproval(a),
      );
      const pvApproval = pvIndex !== -1 ? po.approvals![pvIndex] : null;
      const requiresFullPayment = po.dp_bp_shipping_type !== "ship_after_dp";
      const nowSettled = requiresFullPayment
        ? dpChecked && bpChecked
        : dpChecked;

      let updatedApprovals = po.approvals;
      let paymentJustSettledViaDpBp = false;
      if (pvApproval && pvApproval.status === "pending" && nowSettled) {
        paymentJustSettledViaDpBp = true;
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
        Object.assign(
          updatePayload,
          getFullReceivedStamp(po.status, updatePayload.status),
        );
      }

      const { error } = await supabase
        .from("purchase_orders")
        .update(updatePayload)
        .eq("id", po.id);
      if (error) throw error;

      if (paymentJustSettledViaDpBp && po.mr_id) {
        await markItemsShippedByVendor(po.mr_id, po.items);
      }

      await logActivity(
        currentUser.id,
        "UPDATE_PAYMENT_DP_BP",
        "purchase_order",
        String(po.id),
        `${userProfile?.nama || currentUser.email || "Unknown"} memperbarui progress pembayaran PO ${po.kode_po} (DP: ${dpChecked ? "lunas" : "belum"}, Pelunasan: ${bpChecked ? "lunas" : "belum"})`,
        { dp_paid: dpChecked, bp_paid: bpChecked },
      );
      await logMrActivity(
        "UPDATE_PAYMENT_DP_BP",
        `${userProfile?.nama || currentUser.email || "Unknown"} memperbarui progress pembayaran PO ${po.kode_po} (DP: ${dpChecked ? "lunas" : "belum"}, Pelunasan: ${bpChecked ? "lunas" : "belum"})`,
        { po_id: po.id, dp_paid: dpChecked, bp_paid: bpChecked },
      );

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

      await logActivity(
        currentUser.id,
        "RECEIVE_GOODS",
        "purchase_order",
        String(po.id),
        `${userProfile?.nama || currentUser.email || "Unknown"} mencatat penerimaan barang PO ${po.kode_po} (${receiveRecord.is_full_match ? "lengkap sesuai PO" : "sebagian / qty tidak sesuai"})`,
        {
          is_full_match: receiveRecord.is_full_match,
          received_qty: receivedQtyByPartNumber,
        },
      );
      await logMrActivity(
        "RECEIVE_GOODS",
        `${userProfile?.nama || currentUser.email || "Unknown"} mencatat penerimaan barang PO ${po.kode_po} (${receiveRecord.is_full_match ? "lengkap sesuai PO" : "sebagian / qty tidak sesuai"})`,
        { po_id: po.id, is_full_match: receiveRecord.is_full_match },
      );

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
    type: "po" | "finance" | "invoice" | "quotation",
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
          : setIsUploadingPurchasing;
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

      // File sudah tersimpan di storage begitu sampai sini - kegagalan
      // SETELAH titik ini (simpan metadata ke DB) bukan berarti upload-nya
      // gagal, jadi ditangani & dikasih pesan terpisah (lihat di bawah),
      // BUKAN ditimpakan ke catch generik "Gagal mengunggah file" supaya
      // user tidak mengira filenya hilang lalu upload ulang jadi duplikat.
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

      if (updateError) {
        toast.error("File terunggah, tapi gagal menyimpan info lampiran", {
          id: toastId,
          description: `${updateError.message} - muat ulang halaman untuk memastikan lampiran tersimpan.`,
        });
        return;
      }

      // Update state lokal langsung (bukan fetchPoData() yang fetch ulang
      // SELURUH data PO) supaya lampiran langsung muncul tanpa gantung ke
      // request tambahan yang berat & rawan gangguan jaringan sesaat.
      setPo((prev) =>
        prev ? { ...prev, attachments: updatedAttachments } : prev,
      );
      toast.success(`Lampiran ${type.toUpperCase()} berhasil diunggah!`, {
        id: toastId,
      });

      if (currentUser) {
        await logActivity(
          currentUser.id,
          "UPLOAD_ATTACHMENT_PO",
          "purchase_order",
          String(po.id),
          `${userProfile?.nama || currentUser.email || "Unknown"} mengunggah lampiran ${type.toUpperCase()} (${file.name}) pada PO ${po.kode_po}`,
          { attachment_type: type, file_name: file.name },
        );
        await logMrActivity(
          "UPLOAD_ATTACHMENT_PO",
          `${userProfile?.nama || currentUser.email || "Unknown"} mengunggah lampiran ${type.toUpperCase()} (${file.name}) pada PO ${po.kode_po}`,
          { po_id: po.id, attachment_type: type, file_name: file.name },
        );
      }
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

  // Wrapper khusus "Lampiran Purchasing" - jenis lampirannya (Quotation/
  // Invoice) wajib dipilih dulu lewat Select sebelum file bisa diunggah.
  const handlePurchasingAttachmentUpload = (
    e: React.ChangeEvent<HTMLInputElement>,
  ) => {
    if (!purchasingAttachmentType) {
      toast.error("Pilih jenis lampiran (Quotation/Invoice) terlebih dahulu.");
      e.target.value = "";
      return;
    }
    handleAttachmentUpload(e, purchasingAttachmentType);
  };

  const handleApprovalAction = async (
    decision: "approved" | "rejected",
    paymentProgress?: { dp_paid: boolean; bp_paid: boolean },
    proofFile?: File,
  ) => {
    if (!po || !currentUser || myApprovalIndex === -1) return;

    setActionLoading(true);

    let updatedAttachments = po.attachments || [];
    if (proofFile) {
      const sizeError = getAttachmentSizeError(proofFile);
      if (sizeError) {
        toast.error("Ukuran file bukti pembayaran terlalu besar", {
          description: sizeError,
        });
        setActionLoading(false);
        return;
      }
      const filePath = `po/${po.kode_po}/finance/${Date.now()}_${proofFile.name}`;
      const formData = new FormData();
      formData.append("file", proofFile);
      const uploadResult = await uploadAttachmentVps(formData, filePath);
      if (!uploadResult.success) {
        toast.error("Gagal mengunggah bukti pembayaran", {
          description: uploadResult.message,
        });
        setActionLoading(false);
        return;
      }
      const newAttachment: Attachment = {
        name: proofFile.name,
        url: uploadResult.url,
        type: "finance",
      };
      updatedAttachments = [...updatedAttachments, newAttachment];
    }

    const updatedApprovals = JSON.parse(JSON.stringify(po.approvals));
    const updatePayload: Record<string, any> = {};
    if (proofFile) updatePayload.attachments = updatedAttachments;

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
        const justApprovedApproval = updatedApprovals[myApprovalIndex];
        const justApprovedType = justApprovedApproval.type;
        const isLastApproval = updatedApprovals.every(
          (app: Approval) => app.status === "approved",
        );

        if (isPaymentValidatorApproval(justApprovedApproval)) {
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
      Object.assign(updatePayload, getFullReceivedStamp(po.status, newPoStatus));
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

    if (proofFile) {
      await logActivity(
        currentUser.id,
        "UPLOAD_ATTACHMENT_PO",
        "purchase_order",
        String(po.id),
        `${userProfile?.nama || currentUser.email || "Unknown"} mengunggah bukti pembayaran (${proofFile.name}) sebagai lampiran Finance pada PO ${po.kode_po}`,
        { attachment_type: "finance", file_name: proofFile.name },
      );
      await logMrActivity(
        "UPLOAD_ATTACHMENT_PO",
        `${userProfile?.nama || currentUser.email || "Unknown"} mengunggah bukti pembayaran (${proofFile.name}) sebagai lampiran Finance pada PO ${po.kode_po}`,
        { po_id: po.id, attachment_type: "finance", file_name: proofFile.name },
      );
    }

    // Payment Validator baru approve => tandai item-item yang di-cover PO
    // ini "Dikirim Vendor" + level "Open 4" (lihat markItemsShippedByVendor).
    if (paymentValidatorJustApproved && po.mr_id) {
      await markItemsShippedByVendor(po.mr_id, po.items);
    }

    if (isPartialPayment) {
      await logActivity(
        currentUser.id,
        "UPDATE_PAYMENT_DP_BP",
        "purchase_order",
        String(po.id),
        `${userProfile?.nama || currentUser.email || "Unknown"} menyimpan progress pembayaran PO ${po.kode_po} (DP: ${paymentProgress?.dp_paid ? "lunas" : "belum"}, Pelunasan: ${paymentProgress?.bp_paid ? "lunas" : "belum"})`,
        {
          dp_paid: paymentProgress?.dp_paid,
          bp_paid: paymentProgress?.bp_paid,
        },
      );
      await logMrActivity(
        "UPDATE_PAYMENT_DP_BP",
        `${userProfile?.nama || currentUser.email || "Unknown"} menyimpan progress pembayaran PO ${po.kode_po} (DP: ${paymentProgress?.dp_paid ? "lunas" : "belum"}, Pelunasan: ${paymentProgress?.bp_paid ? "lunas" : "belum"})`,
        { po_id: po.id, dp_paid: paymentProgress?.dp_paid, bp_paid: paymentProgress?.bp_paid },
      );
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

    await logActivity(
      currentUser.id,
      decision === "approved" ? "APPROVE_PO" : "REJECT_PO",
      "purchase_order",
      String(po.id),
      `${userProfile?.nama || currentUser.email || "Unknown"} ${decision === "approved" ? "menyetujui" : "menolak"} PO ${po.kode_po} pada tahap ${updatedApprovals[myApprovalIndex]?.type || "approval"}`,
      {
        approval_type: updatedApprovals[myApprovalIndex]?.type,
        new_status: newPoStatus,
      },
    );
    await logMrActivity(
      decision === "approved" ? "APPROVE_PO" : "REJECT_PO",
      `${userProfile?.nama || currentUser.email || "Unknown"} ${decision === "approved" ? "menyetujui" : "menolak"} PO ${po.kode_po} pada tahap ${updatedApprovals[myApprovalIndex]?.type || "approval"}`,
      { po_id: po.id, approval_type: updatedApprovals[myApprovalIndex]?.type, new_status: newPoStatus },
    );

    toast.success(
      `PO berhasil di-${decision === "approved" ? "setujui" : "tolak"}`,
    );
    setIsDpBpDialogOpen(false);
    await fetchPoData();
    setActionLoading(false);
  };

  // --- LOGIC EDIT STATUS MR ITEM ---
  const handleOpenEditStatus = (item: Order, index: number) => {
    setSelectedItemToEdit(item);
    setSelectedItemIndexToEdit(index);
    setEditForm({
      status: item.status || "Pending",
      note: item.status_note || "",
    });
    setIsEditStatusOpen(true);
  };

  const handleSaveStatusUpdate = async () => {
    if (
      !po?.mr_id ||
      !selectedItemToEdit ||
      selectedItemIndexToEdit === null ||
      !currentUser
    )
      return;

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
        selectedItemIndexToEdit,
      );
      await recalculateMrStatus(po.mr_id);

      await logActivity(
        currentUser.id,
        "UPDATE_ITEM_STATUS",
        "purchase_order",
        String(po.id),
        `${userProfile?.nama || currentUser.email || "Unknown"} mengubah status barang ${selectedItemToEdit.name} pada PO ${po.kode_po} menjadi ${editForm.status}`,
        {
          part_number: selectedItemToEdit.part_number,
          status: editForm.status,
          note: editForm.note,
        },
      );
      await logMrActivity(
        "UPDATE_ITEM_STATUS",
        `${userProfile?.nama || currentUser.email || "Unknown"} mengubah status barang ${selectedItemToEdit.name} menjadi ${editForm.status} (lewat PO ${po.kode_po})`,
        { po_id: po.id, part_number: selectedItemToEdit.part_number, status: editForm.status, note: editForm.note },
      );

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
      await logActivity(
        currentUser.id,
        "REMOVE_ITEM_BAST",
        "purchase_order",
        String(po.id),
        `${userProfile?.nama || currentUser.email || "Unknown"} menghapus lampiran bukti penerimaan barang ${item.name} pada PO ${po.kode_po}`,
        { part_number: item.part_number, attachment_url: attachmentUrl },
      );
      await logMrActivity(
        "REMOVE_ITEM_BAST",
        `${userProfile?.nama || currentUser.email || "Unknown"} menghapus lampiran bukti penerimaan barang ${item.name} (lewat PO ${po.kode_po})`,
        { po_id: po.id, part_number: item.part_number, attachment_url: attachmentUrl },
      );

      toast.success("Lampiran bukti penerimaan dihapus");
      fetchPoData();
    } catch (err: any) {
      toast.error("Gagal hapus lampiran bukti penerimaan", {
        description: err.message,
      });
    }
  };

  const handleClickApprove = () => {
    if (myApproval?.type === APPROVAL_TYPE_RECEIVER) {
      setIsReceiveDialogOpen(true);
      return;
    }
    if (isPaymentValidatorTurn) {
      setDpChecked(!!po?.dp_paid);
      setBpChecked(!!po?.bp_paid);
      setDpBpDialogMode("approve");
      setPaymentProofFile(null);
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
    let cancelled = false;
    let raf1 = 0;
    // Tunggu logo selesai decode, lalu 2 frame (double rAF) sebelum
    // window.print() - kasih browser kesempatan beneran repaint DOM dengan
    // logo/company info yang baru (React commit != browser sudah paint),
    // biar gak ke-print state lama / logo blank.
    waitForLogoReady(COMPANY_DETAILS[printCompany].logo).then(() => {
      if (cancelled) return;
      raf1 = requestAnimationFrame(() => {
        requestAnimationFrame(() => {
          if (!cancelled) window.print();
        });
      });
    });
    const reset = () => setPrintCompany(null);
    window.addEventListener("afterprint", reset, { once: true });
    return () => {
      cancelled = true;
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

  useEffect(() => {
    if (!isPrintingBast || !bastPrintCompany) return;
    let cancelled = false;
    let raf1 = 0;
    waitForLogoReady(COMPANY_DETAILS[bastPrintCompany].logo).then(() => {
      if (cancelled) return;
      raf1 = requestAnimationFrame(() => {
        requestAnimationFrame(() => {
          if (!cancelled) window.print();
        });
      });
    });
    const reset = () => {
      setIsPrintingBast(false);
      setBastPrintCompany(null);
    };
    window.addEventListener("afterprint", reset, { once: true });
    return () => {
      cancelled = true;
      cancelAnimationFrame(raf1);
      window.removeEventListener("afterprint", reset);
    };
  }, [isPrintingBast, bastPrintCompany]);

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
  const purchasingAttachments =
    po.attachments?.filter(
      (att) => att.type === "invoice" || att.type === "quotation",
    ) || [];
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
      <Content className="no-print">
        <div className="col-span-12 grid grid-cols-12 gap-6">
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
                <p className="text-muted-foreground">
                  Detail Purchase Order
                  <span className="ml-2 text-xs">
                    · Umur:{" "}
                    {formatAge(
                      po.created_at,
                      po.full_received_at,
                      po.status === "Full Received",
                    )}
                  </span>
                </p>
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
                <ActivityLogDialog
                  resourceType="purchase_order"
                  resourceId={String(po.id)}
                />
                {showManualReceiveButton && (
                  <Button
                    size="sm"
                    className="bg-blue-600 hover:bg-blue-700"
                    onClick={() => setIsReceiveDialogOpen(true)}
                    disabled={actionLoading}
                  >
                    <PackageCheck className="mr-2 h-4 w-4" />
                    {po.status === PO_STATUS_PARTIAL_RECEIVE
                      ? "Edit Penerimaan Barang"
                      : isSiteVendorPO
                        ? "Konfirmasi Terima Barang"
                        : "Terima Barang"}
                  </Button>
                )}
                {isGA && deliverEligibleItems.length > 0 && (
                  <Button
                    size="sm"
                    className="bg-amber-600 hover:bg-amber-700"
                    onClick={handleOpenDeliverDialog}
                    disabled={actionLoading}
                  >
                    <Truck className="mr-2 h-4 w-4" /> Kirim ke Requester
                  </Button>
                )}
                {canPrintBast && (
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button variant="outline" size="sm">
                        <QrCode className="mr-2 h-4 w-4" /> Cetak BAST
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                      <DropdownMenuItem onClick={() => handlePrintBast("GMI")}>
                        Cetak BAST (GMI)
                      </DropdownMenuItem>
                      <DropdownMenuItem onClick={() => handlePrintBast("GIS")}>
                        Cetak BAST (GIS)
                      </DropdownMenuItem>
                      <DropdownMenuItem
                        onClick={() => handlePrintBast("LOURDES")}
                      >
                        Cetak BAST (Lourdes)
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
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
                  icon={Building2}
                  label="Tipe Vendor"
                  value={
                    vendorData.tipeVendor ? (
                      <Badge variant="outline" className="w-fit">
                        {VENDOR_TIPE_LABELS[vendorData.tipeVendor] ||
                          vendorData.tipeVendor}
                      </Badge>
                    ) : (
                      "N/A"
                    )
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
                              ] || MR_ITEM_STATUS_COLOR_DEFAULT;
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
                                    {isPurchasing && (
                                      <button
                                        onClick={() =>
                                          handleOpenEditStatus(mrItem, idx)
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
                                              className="text-[10px] bg-emerald-50 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300 pl-2 pr-1 py-0.5 rounded-sm flex items-center gap-1"
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

                                  {/* Info kirim GA ke requester - dibandingin
                                      manual sama lampiran BAST di atas */}
                                  {mrItem.delivery_info && (
                                    <Button
                                      size="sm"
                                      variant="outline"
                                      className="mt-2 h-7 text-xs border-amber-200 text-amber-700 hover:text-amber-700 hover:bg-amber-50"
                                      onClick={() =>
                                        setDeliveryDetailItem(mrItem)
                                      }
                                    >
                                      <Truck className="mr-1 h-3 w-3" /> Lihat
                                      Detail Pengiriman
                                    </Button>
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

            <Content title="Lampiran Purchasing">
              <div className="space-y-3">
                {canUploadAttachment && (
                  <div>
                    <Label className="text-xs">
                      Tambah Lampiran Purchasing (Quotation/Invoice)
                    </Label>
                    <div className="mt-1 flex flex-col sm:flex-row gap-2">
                      <Select
                        value={purchasingAttachmentType}
                        onValueChange={(v) =>
                          setPurchasingAttachmentType(
                            v as "quotation" | "invoice",
                          )
                        }
                      >
                        <SelectTrigger className="w-full sm:w-40">
                          <SelectValue placeholder="Jenis lampiran" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="quotation">Quotation</SelectItem>
                          <SelectItem value="invoice">Invoice</SelectItem>
                        </SelectContent>
                      </Select>
                      <Input
                        id="purchasing-attachment-upload"
                        type="file"
                        className="flex-1"
                        onChange={handlePurchasingAttachmentUpload}
                        disabled={isUploadingPurchasing}
                      />
                    </div>
                    {isUploadingPurchasing && (
                      <Loader2 className="mt-1 h-4 w-4 animate-spin text-muted-foreground" />
                    )}
                  </div>
                )}
                <ul className="space-y-2">
                  {purchasingAttachments.length > 0 ? (
                    purchasingAttachments.map((file, index) => (
                      <li key={index} className="flex items-center gap-2">
                        <Badge variant="outline" className="text-[10px]">
                          {file.type === "invoice" ? "Invoice" : "Quotation"}
                        </Badge>
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

            <Content title="Lampiran Bukti Terima Barang">
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
                    Belum ada bukti terima barang.
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
                {dpBpDialogMode !== "approve"
                  ? "Edit Pembayaran DP & Pelunasan"
                  : isDpBpPO
                    ? "Konfirmasi Pembayaran DP & Pelunasan"
                    : "Konfirmasi Approval Pembayaran"}
              </DialogTitle>
              <DialogDescription>
                {isDpBpPO ? (
                  <>
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
                  </>
                ) : (
                  <>
                    PO ini memakai metode pembayaran &quot;{po?.payment_term}
                    &quot;. Lampirkan bukti pembayaran untuk menyelesaikan
                    approval ini.
                  </>
                )}
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-3 py-2">
              {isDpBpPO && (
                <>
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
                </>
              )}
              {dpBpDialogMode === "approve" && (
                <div>
                  <Label
                    htmlFor="payment-proof-upload"
                    className="text-xs font-medium"
                  >
                    Bukti Pembayaran (wajib)
                  </Label>
                  <Input
                    key={isDpBpDialogOpen ? "proof-open" : "proof-closed"}
                    id="payment-proof-upload"
                    type="file"
                    className="mt-1"
                    onChange={(e) =>
                      setPaymentProofFile(e.target.files?.[0] || null)
                    }
                    disabled={actionLoading}
                  />
                  <p className="mt-1 text-[11px] text-muted-foreground">
                    File ini otomatis tersimpan sebagai lampiran Finance pada
                    PO ini.
                  </p>
                </div>
              )}
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
                    handleApprovalAction(
                      "approved",
                      isDpBpPO
                        ? { dp_paid: dpChecked, bp_paid: bpChecked }
                        : undefined,
                      paymentProofFile || undefined,
                    )
                  }
                  disabled={
                    actionLoading ||
                    !paymentProofFile ||
                    (isDpBpPO && !dpChecked && !bpChecked)
                  }
                >
                  {actionLoading ? (
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  ) : (
                    <Check className="mr-2 h-4 w-4" />
                  )}
                  {(() => {
                    if (!isDpBpPO) return "Setujui Pembayaran";
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

        {/* --- DIALOG DETAIL PENGIRIMAN ITEM MR --- */}
        <Dialog
          open={!!deliveryDetailItem}
          onOpenChange={(open) => !open && setDeliveryDetailItem(null)}
        >
          <DialogContent className="sm:max-w-md">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <Truck className="h-5 w-5" /> Detail Pengiriman
              </DialogTitle>
              <DialogDescription>{deliveryDetailItem?.name}</DialogDescription>
            </DialogHeader>
            {deliveryDetailItem?.delivery_info && (
              <div className="space-y-3 text-sm">
                <div>
                  <p className="text-xs text-muted-foreground">Jenis Kirim</p>
                  <p className="font-medium">
                    {deliveryDetailItem.delivery_info.delivery_type}
                    {deliveryDetailItem.delivery_info.courier &&
                      ` - ${deliveryDetailItem.delivery_info.courier}`}
                  </p>
                </div>
                {deliveryDetailItem.delivery_info.tracking_number && (
                  <div>
                    <p className="text-xs text-muted-foreground">No. Resi</p>
                    <p className="font-medium">
                      {deliveryDetailItem.delivery_info.tracking_number}
                    </p>
                  </div>
                )}
                <div>
                  <p className="text-xs text-muted-foreground">Qty Dikirim</p>
                  <p className="font-medium">
                    {deliveryDetailItem.delivery_info.qty_sent}{" "}
                    {deliveryDetailItem.uom}
                  </p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">
                    Tanggal Kirim
                  </p>
                  <p className="font-medium">
                    {formatDateWithTime(
                      deliveryDetailItem.delivery_info.sent_at,
                    )}
                  </p>
                </div>
                {deliveryDetailItem.delivery_info.note && (
                  <div>
                    <p className="text-xs text-muted-foreground">Catatan</p>
                    <p className="italic">
                      &quot;{deliveryDetailItem.delivery_info.note}&quot;
                    </p>
                  </div>
                )}
                {deliveryDetailItem.delivery_info.attachments &&
                  deliveryDetailItem.delivery_info.attachments.length > 0 && (
                    <div>
                      <p className="text-xs text-muted-foreground mb-1">
                        Lampiran Bukti Kirim
                      </p>
                      <div className="flex flex-col gap-1">
                        {deliveryDetailItem.delivery_info.attachments.map(
                          (att, i) => (
                            <Link
                              key={i}
                              href={resolveAttachmentUrl(att.url)}
                              target="_blank"
                              className="hover:underline flex items-center gap-1 text-primary"
                            >
                              <FileText className="w-3 h-3" />
                              {att.name}
                            </Link>
                          ),
                        )}
                      </div>
                    </div>
                  )}
              </div>
            )}
            <DialogFooter>
              <Button
                variant="outline"
                onClick={() => setDeliveryDetailItem(null)}
              >
                Tutup
              </Button>
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
              {selectedItemToEdit && !selectedItemToEdit.part_number && (
                <div className="flex items-start gap-2 rounded-md border border-amber-200 bg-amber-50 p-3 text-xs text-amber-800">
                  <AlertTriangle className="h-4 w-4 flex-shrink-0 mt-0.5" />
                  <p>
                    Barang ini tidak punya Part Number - perbaiki lewat
                    halaman detail MR (&quot;Edit Rincian&quot;) kalau ini
                    seharusnya barang dari Master Data.
                  </p>
                </div>
              )}
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
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-4 p-4 bg-muted/30 rounded-lg text-sm border">
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
                  <div>
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

        {/* --- KIRIM KE REQUESTER (GA kirim barang "Diterima GA") --- */}
        <Dialog open={isDeliverDialogOpen} onOpenChange={setIsDeliverDialogOpen}>
          <DialogContent className="max-h-[85vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>Kirim Barang ke Requester</DialogTitle>
              <DialogDescription>
                Barang yang dicentang akan ditandai &quot;Dalam
                Pengiriman&quot; ke requester. Bukti pengiriman wajib
                dilampirkan.
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4 py-2">
              <div>
                <Label>
                  Barang ({selectedPartNumbersForDelivery.size} dipilih)
                </Label>
                <div className="mt-2 max-h-48 overflow-y-auto rounded-md border divide-y">
                  {deliverEligibleItems.length === 0 ? (
                    <div className="p-3 text-sm text-muted-foreground">
                      Tidak ada barang berstatus &quot;Diterima GA&quot;.
                    </div>
                  ) : (
                    deliverEligibleItems.map((item) => {
                      const partNumber = item.part_number as string;
                      const checked =
                        selectedPartNumbersForDelivery.has(partNumber);
                      return (
                        <div
                          key={partNumber}
                          className="flex items-center gap-2 p-2 text-sm"
                        >
                          <Checkbox
                            checked={checked}
                            onCheckedChange={() =>
                              toggleDeliveryItemSelection(partNumber)
                            }
                          />
                          <span className="flex-1">{item.name}</span>
                          <Input
                            type="number"
                            min={0}
                            value={deliveryQtyByPartNumber[partNumber] ?? ""}
                            onChange={(e) =>
                              setDeliveryQtyByPartNumber((prev) => ({
                                ...prev,
                                [partNumber]: e.target.value,
                              }))
                            }
                            className="h-8 w-24"
                            disabled={!checked}
                          />
                          <span className="text-xs text-muted-foreground w-10">
                            {item.uom}
                          </span>
                        </div>
                      );
                    })
                  )}
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="delivery-type">Jenis Pengiriman</Label>
                  <Select
                    value={deliveryType}
                    onValueChange={(v) => setDeliveryType(v as DeliveryType)}
                  >
                    <SelectTrigger id="delivery-type" className="mt-2">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {DELIVERY_TYPE_OPTIONS.map((opt) => (
                        <SelectItem key={opt} value={opt}>
                          {opt}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label htmlFor="delivery-courier">
                    Ekspedisi
                    {deliveryType === "Kurir/Ekspedisi Eksternal" && " *"}
                  </Label>
                  <Input
                    id="delivery-courier"
                    value={deliveryCourier}
                    onChange={(e) => setDeliveryCourier(e.target.value)}
                    placeholder="mis. JNE, J&T, Gojek"
                    className="mt-2"
                  />
                </div>
                <div>
                  <Label htmlFor="delivery-resi">No. Resi</Label>
                  <Input
                    id="delivery-resi"
                    value={deliveryTrackingNumber}
                    onChange={(e) => setDeliveryTrackingNumber(e.target.value)}
                    className="mt-2"
                  />
                </div>
                <div>
                  <Label htmlFor="delivery-file">
                    Bukti Pengiriman (wajib)
                  </Label>
                  <Input
                    id="delivery-file"
                    type="file"
                    multiple
                    onChange={(e) => setDeliveryFiles(e.target.files)}
                    className="mt-2"
                  />
                </div>
              </div>

              <div>
                <Label htmlFor="delivery-note">Catatan</Label>
                <Textarea
                  id="delivery-note"
                  value={deliveryNote}
                  onChange={(e) => setDeliveryNote(e.target.value)}
                  className="mt-2"
                  rows={2}
                />
              </div>
            </div>
            <DialogFooter>
              <Button
                variant="outline"
                onClick={() => setIsDeliverDialogOpen(false)}
                disabled={sendingDelivery}
              >
                Batal
              </Button>
              <Button
                onClick={handleSendToRequester}
                disabled={
                  sendingDelivery || selectedPartNumbersForDelivery.size === 0
                }
              >
                {sendingDelivery && (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                )}
                Kirim
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </Content>

      {/* Blok print-only SENGAJA di luar <Content> (Card) di atas - kalau
          dinest di dalamnya, border/shadow/padding Card itu ikut ke-print
          ngebungkus dokumennya (Card gak ke-hide oleh .no-print, cuma isinya
          doang). Dulu ketutupan sama posisi absolute #printable-po-a4 yang
          "kabur" dari box Card-nya - begitu absolute-nya dicabut (lihat
          globals.css, fix bug +1 halaman kosong di Safari), harus taruh
          blok ini di luar Card dari awal, bukan cuma diakalin CSS lagi. */}
      {!isPrintingReceive && !isPrintingBast && (
        <div className="print-only">
          <PrintablePO
            po={po}
            companyInfo={
              printCompany ? COMPANY_DETAILS[printCompany] : companyInfo
            }
            qrUrl={qrUrl}
            vendorData={vendorData}
            printTrigger={!!printCompany}
          />
        </div>
      )}
      {isPrintingReceive && po.receive_record && (
        <div className="print-only">
          <PrintableReceiveRecord po={po} receiveRecord={po.receive_record} />
        </div>
      )}
      {isPrintingBast && bastPrintCompany && (
        <div className="print-only">
          <PrintableBAST
            po={po}
            companyInfo={COMPANY_DETAILS[bastPrintCompany]}
            receiptUrl={
              po.receipt_token
                ? `${window.location.origin}/goods-receipt/${po.receipt_token}`
                : ""
            }
            printTrigger={isPrintingBast}
          />
        </div>
      )}
    </>
  );
}

const PrintablePO = ({
  po,
  companyInfo,
  qrUrl,
  vendorData,
  printTrigger,
}: {
  po: PurchaseOrderDetail;
  companyInfo: (typeof COMPANY_DETAILS)["DEFAULT"];
  qrUrl: string;
  vendorData: { name: string; address: string; contact: string; code: string };
  printTrigger: boolean;
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

  const renderHeader = () => (
    <header className="flex justify-between items-start border-b-2 border-black pb-6 mb-6">
      <div className="flex items-center gap-6 w-2/3">
        <div className="w-[120px] h-[70px] relative flex-shrink-0 flex items-center">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={companyInfo.logo}
            alt="Logo"
            className="w-full h-full object-contain object-left"
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
  );

  const renderIntro = () => (
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
  );

  const renderTableHead = () => (
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
  );

  const renderRow = (
    item: POItem,
    index: number,
    ref?: React.Ref<HTMLTableRowElement>,
  ) => (
    <tr key={index} ref={ref} className="border-b border-gray-200 last:border-0">
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
  );

  const renderOutro = () => (
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
  );

  const renderFooter = ({
    pageIndex,
    pageCount,
  }: {
    pageIndex: number;
    pageCount: number;
  }) => (
    <div className="pt-12 break-inside-avoid">
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
        <p className="text-[9px] text-gray-400">
          Halaman {pageIndex + 1} dari {pageCount}
        </p>
      </div>
    </div>
  );

  return (
    <PaginatedPrintDocument
      rows={po.items}
      renderRow={renderRow}
      renderTableHead={renderTableHead}
      renderHeader={renderHeader}
      renderFooter={renderFooter}
      renderIntro={renderIntro}
      renderOutro={renderOutro}
      enabled={printTrigger}
      tableClassName="table-fixed border-y-2 border-black"
    />
  );
};

const PrintableReceiveRecord = ({
  po,
  receiveRecord,
}: {
  po: PurchaseOrderDetail;
  receiveRecord: ReceiveRecord;
}) => {
  const renderHeader = () => (
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
  );

  const renderIntro = () => (
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
  );

  const renderTableHead = () => (
    <tr className="border-b-2 border-black">
      <th className="text-left py-2 pr-2">Nama Barang</th>
      <th className="text-right py-2 px-2 w-24">Qty PO</th>
      <th className="text-right py-2 px-2 w-24">Qty Diterima</th>
      <th className="text-center py-2 pl-2 w-24">Status</th>
    </tr>
  );

  const renderRow = (
    item: ReceiveRecord["items"][number],
    _index: number,
    ref?: React.Ref<HTMLTableRowElement>,
  ) => {
    const match = item.received_qty === item.ordered_qty;
    return (
      <tr
        key={item.part_number}
        ref={ref}
        className="border-b border-gray-300"
      >
        <td className="py-2 pr-2">{item.part_name}</td>
        <td className="text-right py-2 px-2">{item.ordered_qty}</td>
        <td className="text-right py-2 px-2">{item.received_qty}</td>
        <td className="text-center py-2 pl-2">
          {match ? "Sesuai" : "Tidak Sesuai"}
        </td>
      </tr>
    );
  };

  const renderFooter = ({
    pageIndex,
    pageCount,
  }: {
    pageIndex: number;
    pageCount: number;
  }) => (
    <div className="pt-8">
      <p className="text-[10px] text-gray-500 italic">
        Dokumen ini diterbitkan secara elektronik oleh sistem Garuda
        Procure.
      </p>
      <p className="text-[9px] text-gray-400 mt-1">
        Dicetak pada {new Date().toLocaleString("id-ID")}
      </p>
      <p className="text-[9px] text-gray-400 mt-1">
        Halaman {pageIndex + 1} dari {pageCount}
      </p>
    </div>
  );

  return (
    <PaginatedPrintDocument
      rows={receiveRecord.items}
      renderRow={renderRow}
      renderTableHead={renderTableHead}
      renderHeader={renderHeader}
      renderFooter={renderFooter}
      renderIntro={renderIntro}
      enabled
      tableClassName="table-fixed"
    />
  );
};

// BAST (Berita Acara Serah Terima) - ditempel fisik ke paket sebelum
// dikirim. QR di dalamnya mengarah ke halaman publik
// /goods-receipt/[token] (scan utk konfirmasi penerimaan, lihat
// services/goodsReceiptService.ts). Kolom "Qty Diterima"/"Foto Diterima"
// baru muncul begitu po.goods_receipt sudah terisi (hasil konfirmasi) -
// sebelum itu BAST cetak cuma 3 kolom qty (MR/PO/Dikirim). Qty & foto per
// item pakai persis logic yang sama dengan fetchGoodsReceiptView di
// services/goodsReceiptService.ts, supaya konsisten dengan yang dilihat
// requester di halaman scan.
interface BastRow {
  name: string;
  part_number: string;
  uom: string;
  qtyMr: number;
  qtyPo: number;
  qtyDikirim: number;
  fotoDikirim: Attachment[];
  qtyDiterima: number | undefined;
  fotoDiterima: Attachment[];
  isPartial: boolean;
}

const PrintableBAST = ({
  po,
  companyInfo,
  receiptUrl,
  printTrigger,
}: {
  po: PurchaseOrderDetail;
  companyInfo: (typeof COMPANY_DETAILS)["DEFAULT"];
  receiptUrl: string;
  printTrigger: boolean;
}) => {
  const poItems = po.items || [];
  const mrOrders = po.material_requests?.orders || [];
  const isSiteVendor = po.vendor_details?.tipe_vendor === "Site";
  const goodsReceipt = po.goods_receipt;
  const hasReceipt = !!goodsReceipt;

  const rows: BastRow[] = mrOrders
    .filter(
      (order) =>
        !!order.part_number &&
        poItems.some((pi) => pi.part_number === order.part_number),
    )
    .map((order) => {
      const poItem = poItems.find((pi) => pi.part_number === order.part_number);
      const receiveRecordEntry = po.receive_record?.items?.find(
        (i) => i.part_number === order.part_number,
      );
      const qtyDikirim =
        order.delivery_info?.qty_sent ??
        receiveRecordEntry?.received_qty ??
        poItem?.qty ??
        Number(order.qty) ??
        0;
      const receiptItem = goodsReceipt?.items.find(
        (i) => i.part_number === order.part_number,
      );
      return {
        name: order.name,
        part_number: order.part_number as string,
        uom: order.uom,
        qtyMr: Number(order.qty) || 0,
        qtyPo: poItem?.qty || 0,
        qtyDikirim,
        fotoDikirim: order.delivery_info?.attachments || [],
        qtyDiterima: receiptItem?.qty_received,
        fotoDiterima: receiptItem?.photos || [],
        isPartial:
          receiptItem !== undefined && receiptItem.qty_received < qtyDikirim,
      };
    });

  const renderHeader = () => (
    <header className="flex justify-between items-start border-b-2 border-black pb-6 mb-6">
      <div className="flex items-center gap-4 w-2/3">
        <div className="w-[100px] h-[60px] relative flex-shrink-0 flex items-center">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={companyInfo.logo}
            alt="Logo"
            className="w-full h-full object-contain object-left"
          />
        </div>
        <div>
          <h1 className="text-lg font-black uppercase tracking-tight text-gray-900 leading-none">
            {companyInfo.name}
          </h1>
          <p className="text-[10px] text-gray-600 mt-1 leading-snug max-w-xs">
            {companyInfo.address}
          </p>
        </div>
      </div>
      <div className="text-right w-1/3">
        <h2 className="text-base font-black text-gray-800 tracking-wide uppercase">
          Berita Acara Serah Terima Barang
        </h2>
        <p className="text-xs text-gray-700 mt-1">No. PO: {po.kode_po}</p>
        <p className="text-xs text-gray-700">
          No. MR: {po.material_requests?.kode_mr || "-"}
        </p>
        <p className="text-[10px] text-gray-500">
          Tgl: {new Date().toLocaleDateString("id-ID")}
        </p>
      </div>
    </header>
  );

  const renderIntro = () => (
    <div className="mb-6 flex gap-6 items-start border border-gray-300 rounded-sm p-3">
      <div className="flex-1">
        <p className="text-xs font-bold uppercase text-gray-700 mb-1">
          Petunjuk Penerimaan Barang
        </p>
        <p className="text-[11px] text-gray-700 leading-relaxed">
          Mohon <strong>SCAN QR code</strong> di samping{" "}
          <strong>SEBELUM membuka seluruh kemasan (unboxing)</strong> secara
          menyeluruh, untuk memverifikasi kondisi &amp; jumlah barang saat
          diterima. Setelah scan, ikuti instruksi di halaman yang muncul
          untuk mengisi jumlah &amp; foto tiap barang.
        </p>
      </div>
      {receiptUrl ? (
        <div className="p-2 border border-gray-800 rounded-md flex-shrink-0">
          <QRCodeCanvas value={receiptUrl} size={90} />
        </div>
      ) : (
        <Skeleton className="h-[90px] w-[90px] flex-shrink-0" />
      )}
    </div>
  );

  const renderTableHead = () => (
    <tr className="border-b-2 border-black">
      <th className="text-left py-2 pr-2">Nama Barang</th>
      <th className="text-right py-2 px-1 w-14">Qty MR</th>
      <th className="text-right py-2 px-1 w-14">Qty PO</th>
      <th className="text-right py-2 px-1 w-16">Qty Dikirim</th>
      {hasReceipt && (
        <th className="text-right py-2 px-1 w-16">Qty Diterima</th>
      )}
      <th className="text-center py-2 px-1 w-20">Foto Dikirim GA</th>
      {hasReceipt && (
        <th className="text-center py-2 px-1 w-20">Foto Diterima</th>
      )}
      <th className="text-center py-2 pl-1 w-20">Ket.</th>
    </tr>
  );

  const renderRow = (
    row: BastRow,
    _index: number,
    ref?: React.Ref<HTMLTableRowElement>,
  ) => (
    <tr key={row.part_number} ref={ref} className="border-b border-gray-300">
      <td className="py-2 pr-2 align-top">
        {row.name}
        <div className="text-[9px] text-gray-500 font-mono">
          {row.part_number}
        </div>
      </td>
      <td className="text-right py-2 px-1 align-top">
        {row.qtyMr} {row.uom}
      </td>
      <td className="text-right py-2 px-1 align-top">{row.qtyPo}</td>
      <td className="text-right py-2 px-1 align-top">{row.qtyDikirim}</td>
      {hasReceipt && (
        <td className="text-right py-2 px-1 align-top">
          {row.qtyDiterima ?? "-"}
        </td>
      )}
      <td className="text-center py-2 px-1 align-top">
        {isSiteVendor ? (
          <span className="text-gray-400 text-[9px] italic">
            N/A - Langsung dari Vendor
          </span>
        ) : row.fotoDikirim.length > 0 ? (
          <div className="flex flex-wrap justify-center gap-1">
            {row.fotoDikirim.map((att, i) => (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                key={i}
                src={resolveAttachmentUrl(att.url)}
                alt="Foto dikirim"
                className="h-10 w-10 object-cover border border-gray-300"
              />
            ))}
          </div>
        ) : (
          <span className="text-gray-400 text-[9px]">-</span>
        )}
      </td>
      {hasReceipt && (
        <td className="text-center py-2 px-1 align-top">
          {row.fotoDiterima.length > 0 ? (
            <div className="flex flex-wrap justify-center gap-1">
              {row.fotoDiterima.map((att, i) => (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  key={i}
                  src={resolveAttachmentUrl(att.url)}
                  alt="Foto diterima"
                  className="h-10 w-10 object-cover border border-gray-300"
                />
              ))}
            </div>
          ) : (
            <span className="text-gray-400 text-[9px]">-</span>
          )}
        </td>
      )}
      <td className="text-center py-2 pl-1 align-top">
        {row.isPartial && (
          <span className="text-[9px] font-bold text-red-600 uppercase">
            Partial Receive
          </span>
        )}
      </td>
    </tr>
  );

  // Tanda tangan Requester/Receiver SENGAJA jadi "outro" (cuma di halaman
  // TERAKHIR), bukan diulang tiap halaman kayak header/footer - tanda
  // tangannya cuma sekali, logisnya nempel di akhir dokumen.
  const renderOutro = () => (
    <div className="pt-10 flex justify-between gap-8">
      <div className="text-center w-1/3">
        <p className="text-xs font-semibold uppercase text-gray-600 mb-10">
          Requester
        </p>
        <p className="text-xs border-t border-gray-400 pt-1">
          {po.material_requests?.users_with_profiles?.nama || "-"}
        </p>
      </div>
      <div className="text-center w-1/3">
        <p className="text-xs font-semibold uppercase text-gray-600 mb-10">
          Receiver
        </p>
        <p className="text-xs border-t border-gray-400 pt-1">
          {goodsReceipt?.receiver_name || "-"}
        </p>
        {goodsReceipt?.confirmed_at && (
          <p className="text-[9px] text-gray-400 mt-0.5">
            {new Date(goodsReceipt.confirmed_at).toLocaleString("id-ID")}
          </p>
        )}
      </div>
    </div>
  );

  const renderFooter = ({
    pageIndex,
    pageCount,
  }: {
    pageIndex: number;
    pageCount: number;
  }) => (
    <div className="mt-6">
      <p className="text-[9px] text-gray-400">
        Dicetak pada {new Date().toLocaleString("id-ID")}
      </p>
      <p className="text-[9px] text-gray-400">
        Halaman {pageIndex + 1} dari {pageCount}
      </p>
    </div>
  );

  return (
    <PaginatedPrintDocument
      rows={rows}
      renderRow={renderRow}
      renderTableHead={renderTableHead}
      renderHeader={renderHeader}
      renderFooter={renderFooter}
      renderIntro={renderIntro}
      renderOutro={renderOutro}
      enabled={printTrigger}
      tableClassName="table-fixed text-[10px]"
    />
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
