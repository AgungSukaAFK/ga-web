// src/app/(With Sidebar)/purchase-order/edit/PoEditForm.tsx
//
// Form edit PO yang dipakai bersama oleh:
// - mode "user"  -> purchase-order/edit/[id] (dibuka dari detail PO)
// - mode "admin" -> po-management/edit/[id] (Manajemen PO)
// Fitur & perhitungan (PPN/PPH/DP, lampiran, PO Aset) sama persis di kedua
// mode; mode admin cuma menambah kontrol khusus admin: ubah Status PO, ubah
// status Jalur Approval, dan edit bebas nama/UoM item.

"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Content } from "@/components/content";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  RichMentionEditor,
  RichMentionEditorHandle,
} from "@/components/rich-mention-editor";
import { parseRichValue, stringifyRichContent } from "@/lib/rich-content";
import { RichContentView } from "@/components/rich-content-view";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  SearchableSelect,
  SearchableSelectTrigger,
  SearchableSelectValue,
  SearchableSelectContent,
  SearchableSelectItem,
} from "@/components/ui/searchable-select";
import { Skeleton } from "@/components/ui/skeleton";
import { toast } from "sonner";
import {
  fetchPurchaseOrderById,
  updatePurchaseOrder,
} from "@/services/purchaseOrderService";
import { formatCurrency } from "@/lib/utils";
import { withAssetMarker } from "@/lib/poAssetMarker";
import {
  AlertTriangle,
  Loader2,
  Save,
  Trash2,
  CircleUser,
  Building,
  Tag,
  DollarSign,
  Info,
  Truck,
  Building2,
  Link as LinkIcon,
  Paperclip,
  ChevronsUpDown,
  Plus,
  Eye,
  RefreshCcw,
  FileText,
  Edit as EditIcon,
  ExternalLink,
} from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { User } from "@supabase/supabase-js";
import { logActivity } from "@/services/logService";
import { removeAttachmentVps } from "@/services/storageService";
import { uploadAttachmentDirect } from "@/lib/uploadDirect";
import {
  resolveAttachmentUrl,
  getAttachmentSizeError,
  getUploadErrorMessage,
} from "@/lib/attachments";
import { BarangSearchCombobox } from "../BarangSearchCombobox";
import {
  PurchaseOrderDetail,
  POItem,
  Barang,
  PurchaseOrderPayload,
  Attachment,
  Approval,
  Order,
  Vendor,
  StoredVendorDetails,
} from "@/type";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import Link from "next/link";
import { Checkbox } from "@/components/ui/checkbox";
import { CurrencyInput } from "@/components/ui/currency-input";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogDescription,
} from "@/components/ui/dialog";
import { Combobox, ComboboxData } from "@/components/combobox";
import { searchVendors } from "@/services/vendorService";
import { isMarketplaceVendor } from "@/type/enum";
import { UserAvatar } from "@/components/user-avatar";
import {
  FormSummaryLayout,
  useUnsavedChanges,
  type FormSummaryCheck,
} from "@/components/form-summary-panel";

export type PoEditMode = "user" | "admin";

// --- KONFIGURASI PPH ---
const PPH_OPTIONS = [
  { label: "Tidak Ada PPH", value: "none", rate: 0 },
  { label: "PPH 21 (NPWP) - 1%", value: "pph21_npwp", rate: 1.0 },
  { label: "PPH 21 (Tanpa NPWP) - 1.5%", value: "pph21_non_npwp", rate: 1.5 },
  { label: "PPH 23 (NPWP) - 2%", value: "pph23_npwp", rate: 2.0 },
  { label: "PPH 23 (Tanpa NPWP) - 4%", value: "pph23_non_npwp", rate: 4.0 },
];

// --- Khusus mode admin ---
const dataUoM: ComboboxData = [
  { label: "Pcs", value: "Pcs" },
  { label: "Unit", value: "Unit" },
  { label: "Set", value: "Set" },
  { label: "Box", value: "Box" },
  { label: "Rim", value: "Rim" },
  { label: "Roll", value: "Roll" },
];

const PO_STATUS_OPTIONS: PurchaseOrderPayload["status"][] = [
  "Pending Validation",
  "Pending Approval",
  "Pending Payment",
  "Pending Receive",
  "Partial Receive",
  "Full Received",
  "Rejected",
  "Draft",
  "Ordered",
];
const APPROVAL_STATUS_OPTIONS: Approval["status"][] = [
  "pending",
  "approved",
  "rejected",
];

type DpBpShippingType = "ship_after_dp" | "ship_after_full_payment";

// Komponen helper kecil untuk menampilkan info
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
    className={
      isBlock
        ? "flex flex-col gap-1"
        : "grid grid-cols-[max-content_1fr] gap-x-3 items-start"
    }
  >
    <dt className="text-sm text-muted-foreground flex items-center gap-2 mt-0.5 whitespace-nowrap">
      <Icon className="h-4 w-4 flex-shrink-0" />
      {label}
    </dt>
    <dd className="min-w-0 text-sm font-semibold [overflow-wrap:anywhere]">{value}</dd>
  </div>
);

// --- Vendor Search Component ---
function VendorSearchCombobox({
  poForm,
  setPoForm,
  onVendorSelected,
}: {
  poForm: any;
  setPoForm: React.Dispatch<React.SetStateAction<any>>;
  // Dipanggil begitu user MEMILIH vendor (bukan pas initial load) - dipakai
  // parent buat auto-set default PPN (marketplace = 0%, lainnya = inclusive
  // 11%). Taruh di sini (bukan useEffect watching vendor_id) supaya gak
  // ke-trigger pas data lama di-load ulang.
  onVendorSelected?: (vendor: Vendor) => void;
}) {
  const [open, setOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [results, setResults] = useState<Vendor[]>([]);

  useEffect(() => {
    const handler = setTimeout(() => {
      searchVendors(searchQuery).then(setResults);
    }, 300);
    return () => clearTimeout(handler);
  }, [searchQuery]);

  const handleSelect = (vendor: Vendor) => {
    const newVendorDetails: StoredVendorDetails = {
      vendor_id: vendor.id,
      kode_vendor: vendor.kode_vendor,
      nama_vendor: vendor.nama_vendor,
      alamat: vendor.alamat || "",
      contact_person: vendor.pic_contact_person || "",
      email: vendor.email || "",
      tipe_vendor: vendor.tipe_vendor,
    };
    setPoForm((prev: any) => ({
      ...prev,
      vendor_details: newVendorDetails,
    }));
    onVendorSelected?.(vendor);
    setOpen(false);
    setSearchQuery("");
  };

  return (
    <div className="space-y-1">
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <Button
            variant="outline"
            role="combobox"
            aria-expanded={open}
            className="w-full justify-between"
            title={poForm.vendor_details?.nama_vendor}
          >
            <span className="min-w-0 truncate">
              {poForm.vendor_details?.nama_vendor ||
                "Cari Nama atau Kode Vendor..."}
            </span>
            <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
          </Button>
        </PopoverTrigger>
        <PopoverContent
          className="w-[min(400px,calc(100vw-2rem))] p-0"
          align="start"
        >
          <Command shouldFilter={false}>
            <CommandInput
              placeholder="Ketik untuk mencari vendor..."
              value={searchQuery}
              onValueChange={setSearchQuery}
            />
            <CommandList>
              {results.length === 0 && searchQuery.length > 0 && (
                <CommandEmpty>Vendor tidak ditemukan.</CommandEmpty>
              )}
              <CommandGroup>
                {results.map((vendor) => (
                  <CommandItem
                    key={vendor.id}
                    value={String(vendor.id)}
                    onSelect={() => handleSelect(vendor)}
                  >
                    <div className="flex flex-col">
                      <span className="font-semibold [overflow-wrap:anywhere]">
                        {vendor.nama_vendor}
                      </span>
                      <span className="text-xs text-muted-foreground">
                        {vendor.kode_vendor}
                      </span>
                    </div>
                  </CommandItem>
                ))}
              </CommandGroup>
            </CommandList>
          </Command>
        </PopoverContent>
      </Popover>
      {poForm.vendor_details && !poForm.vendor_details.tipe_vendor && (
        <p className="text-xs font-medium text-red-600 dark:text-red-400">
          Vendor ini belum diset Tipe Vendor-nya (HO/Branch/Site) - lengkapi
          dulu di Manajemen Vendor sebelum PO ini bisa diajukan.
        </p>
      )}
    </div>
  );
}

// Daftar lampiran satu jenis (dipakai Lampiran PO / Finance / Purchasing).
function AttachmentList({
  items,
  allAttachments,
  emptyText,
  disabled,
  onRemove,
  showTypeBadge = false,
}: {
  items: Attachment[];
  allAttachments: Attachment[];
  emptyText: string;
  disabled: boolean;
  onRemove: (index: number) => void;
  showTypeBadge?: boolean;
}) {
  if (items.length === 0) {
    return (
      <p className="text-sm text-muted-foreground text-center pt-2">
        {emptyText}
      </p>
    );
  }
  return (
    <ul className="space-y-2 mt-2">
      {items.map((att) => {
        const originalIndex = allAttachments.findIndex((a) => a.url === att.url);
        if (originalIndex === -1) return null;
        return (
          <li
            key={originalIndex}
            className="flex items-center justify-between gap-2 text-sm p-2 bg-muted/50 rounded"
          >
            <div className="flex min-w-0 items-center gap-2">
              {showTypeBadge && (
                <Badge variant="outline" className="shrink-0 text-[10px]">
                  {att.type === "invoice" ? "Invoice" : "Quotation"}
                </Badge>
              )}
              <a
                href={resolveAttachmentUrl(att.url)}
                target="_blank"
                rel="noopener noreferrer"
                className="flex min-w-0 items-center gap-2 hover:underline text-primary"
              >
                <Paperclip className="h-4 w-4 flex-shrink-0" />
                <span className="truncate">{att.name}</span>
              </a>
            </div>
            <Button
              variant="ghost"
              size="icon"
              className="h-6 w-6 flex-shrink-0"
              onClick={() => onRemove(originalIndex)}
              disabled={disabled}
            >
              <Trash2 className="h-4 w-4 text-destructive" />
            </Button>
          </li>
        );
      })}
    </ul>
  );
}

export function PoEditForm({ poId, mode }: { poId: number; mode: PoEditMode }) {
  const router = useRouter();
  const isAdmin = mode === "admin";
  const notesEditorRef = useRef<RichMentionEditorHandle>(null);

  const [poForm, setPoForm] = useState<PurchaseOrderDetail | null>(null);
  // Snapshot jenis PO (Aset/Biasa) + kode_po saat halaman dimuat, buat dicatat
  // ke riwayat aktivitas kalau jenisnya diubah di halaman ini.
  const originalAssetRef = useRef<{ is_asset: boolean; kode_po: string } | null>(
    null,
  );
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [userProfile, setUserProfile] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [isUploadingPO, setIsUploadingPO] = useState(false);
  const [isUploadingFinance, setIsUploadingFinance] = useState(false);
  const [isUploadingPurchasing, setIsUploadingPurchasing] = useState(false);
  // Jenis lampiran yang mau diupload ke "Lampiran Purchasing" - wajib
  // dipilih dulu (Quotation/Invoice) sebelum file bisa diunggah.
  const [purchasingAttachmentType, setPurchasingAttachmentType] = useState<
    "quotation" | "invoice" | ""
  >("");
  const [actionLoading, setActionLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Dialog States
  const [isReplaceDialogOpen, setIsReplaceDialogOpen] = useState(false);
  const [replacingIndex, setReplacingIndex] = useState<number | null>(null);
  const [isAddItemDialogOpen, setIsAddItemDialogOpen] = useState(false);
  const [isViewItemOpen, setIsViewItemOpen] = useState(false);
  const [viewItemIndex, setViewItemIndex] = useState<number | null>(null);
  // Edit bebas nama/UoM/qty/harga item (khusus admin)
  const [editingItemIndex, setEditingItemIndex] = useState<number | null>(null);
  const [itemFormData, setItemFormData] = useState<POItem>({
    barang_id: 0,
    part_number: "",
    name: "",
    qty: 1,
    uom: "Pcs",
    price: 0,
    total_price: 0,
    vendor_name: "",
  });

  // Payment Term Logic
  const [paymentTermType, setPaymentTermType] = useState("Termin");
  const [paymentTermDays, setPaymentTermDays] = useState("30");
  const [dpPercentage, setDpPercentage] = useState<number>(30);
  // Varian pengiriman khusus DP & Pelunasan. PO lama yang belum punya nilai
  // (null) diperlakukan "kirim setelah pelunasan" - sama dengan tafsiran di
  // purchase-order/[id]/page.tsx.
  const [dpBpShippingType, setDpBpShippingType] = useState<DpBpShippingType>(
    "ship_after_full_payment",
  );

  // Tax States
  const [taxMode, setTaxMode] = useState<"percentage" | "manual">("percentage");
  const [taxPercentage, setTaxPercentage] = useState<number>(11);
  const [isTaxIncluded, setIsTaxIncluded] = useState<boolean>(false);

  // PPH State
  const [pphType, setPphType] = useState<string>("none");

  const { dirty } = useUnsavedChanges(poForm, !loading && !!poForm);

  // Helper Cost Center Name
  const getCostCenterName = (mrData: any) => {
    if (!mrData) return "N/A";
    const cc = mrData.cost_centers;
    if (cc && typeof cc === "object" && "name" in cc) {
      return cc.name;
    }
    if (Array.isArray(cc) && cc.length > 0) {
      return cc[0].name;
    }
    return (
      mrData.cost_center ||
      `ID: ${mrData.cost_center_id} (Data tidak ditemukan)`
    );
  };

  useEffect(() => {
    const loadUser = async () => {
      const supabase = createClient();
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) {
        if (isAdmin) router.push("/auth/login");
        return;
      }
      setCurrentUser(user);
      const { data: profile } = await supabase
        .from("profiles")
        .select("*")
        .eq("id", user.id)
        .single();
      if (isAdmin && (!profile || profile.role !== "admin")) {
        toast.error("Akses ditolak.");
        router.push("/dashboard");
        return;
      }
      setUserProfile(profile);
    };
    loadUser();
  }, [isAdmin, router]);

  useEffect(() => {
    if (isNaN(poId)) {
      setError("ID Purchase Order tidak valid.");
      setLoading(false);
      return;
    }

    fetchPurchaseOrderById(poId)
      .then((data) => {
        if (!data) {
          setError("Data PO tidak ditemukan.");
          setLoading(false);
          return;
        }
        const initialData = {
          ...data,
          attachments: Array.isArray(data.attachments) ? data.attachments : [],
          approvals: Array.isArray(data.approvals) ? data.approvals : [],
          vendor_details: data.vendor_details || {
            vendor_id: 0,
            kode_vendor: "",
            nama_vendor: "",
            alamat: "",
            contact_person: "",
            email: "",
          },
        };
        setPoForm(initialData as any);
        originalAssetRef.current = {
          is_asset: !!initialData.is_asset,
          kode_po: initialData.kode_po,
        };

        // --- Init Payment Term ---
        if (initialData.payment_term) {
          if (initialData.payment_term.toLowerCase() === "cash") {
            setPaymentTermType("Cash");
            setPaymentTermDays("");
          } else if (initialData.payment_term.startsWith("DP")) {
            // Parse "DP 30% - Pelunasan 70%"
            setPaymentTermType("DP_BP");
            const match = initialData.payment_term.match(/DP (\d+)%/);
            if (match) setDpPercentage(parseInt(match[1]));
          } else {
            setPaymentTermType("Termin");
            const days = initialData.payment_term.match(/\d+/);
            setPaymentTermDays(days ? days[0] : "30");
          }
        }
        if (initialData.dp_bp_shipping_type) {
          setDpBpShippingType(initialData.dp_bp_shipping_type);
        }

        // --- Init PPH ---
        if (initialData.pph_type) {
          setPphType(initialData.pph_type);
        }

        // --- Init PPN ---
        if (initialData.ppn_rate != null) {
          // PO ini udah disimpan pakai field tax_included/ppn_rate yang
          // beneran ke-persist (bukan PO lama) - percaya langsung, gak
          // perlu nebak2 lagi kayak di bawah.
          setIsTaxIncluded(!!initialData.tax_included);
          setTaxMode("percentage");
          setTaxPercentage(initialData.ppn_rate);
        } else if (initialData.tax === 0 && initialData.items.length > 0) {
          // PO lama (dibuat sebelum ppn_rate ada) - tax 0 tapi ada item,
          // kemungkinan besar inclusive. Tetap nebak kayak sebelumnya.
          setIsTaxIncluded(true);
          setTaxMode("manual");
        } else {
          setIsTaxIncluded(false);
          const subtotalSaatLoad = initialData.items.reduce(
            (acc, item) => acc + item.qty * item.price,
            0,
          );
          if (
            subtotalSaatLoad > 0 &&
            Math.abs((initialData.tax ?? 0) - subtotalSaatLoad * 0.11) < 1
          ) {
            setTaxMode("percentage");
            setTaxPercentage(11);
          } else {
            setTaxMode("manual");
          }
        }
      })
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false));
  }, [poId]);

  // --- Logika Kalkulasi Pajak/Total ---
  useEffect(() => {
    if (!poForm) return;

    // A. Subtotal
    const subtotal = poForm.items.reduce(
      (acc, item) => acc + item.qty * item.price,
      0,
    );

    // B. DPP
    const taxableAmount = Math.max(0, subtotal - (poForm.discount || 0));

    // C. PPN
    let calculatedTax = 0;
    if (isTaxIncluded) {
      calculatedTax = 0; // Tax 0 karena sudah include di harga item
    } else if (taxMode === "percentage") {
      calculatedTax = taxableAmount * (taxPercentage / 100);
    } else {
      calculatedTax = poForm.tax || 0;
    }

    // D. PPH
    const selectedPph =
      PPH_OPTIONS.find((opt) => opt.value === pphType) || PPH_OPTIONS[0];
    const pphAmount = (taxableAmount * selectedPph.rate) / 100;

    // E. Grand Total
    const grandTotal =
      taxableAmount - pphAmount + calculatedTax + (poForm.postage || 0);

    setPoForm((prev) => {
      if (!prev) return null;
      // Update only if changed to avoid infinite loop
      const newTax =
        taxMode !== "manual" || isTaxIncluded ? calculatedTax : prev.tax;
      const newPpnRate =
        isTaxIncluded || taxMode === "percentage" ? taxPercentage : null;

      if (
        prev.tax !== newTax ||
        prev.total_price !== grandTotal ||
        prev.pph_type !== (pphType === "none" ? null : pphType) ||
        prev.pph_amount !== pphAmount ||
        prev.tax_included !== isTaxIncluded ||
        prev.ppn_rate !== newPpnRate
      ) {
        return {
          ...prev,
          tax: newTax,
          total_price: grandTotal,
          pph_type: pphType === "none" ? null : pphType,
          pph_rate: selectedPph.rate,
          pph_amount: pphAmount,
          tax_included: isTaxIncluded,
          ppn_rate: newPpnRate,
        };
      }
      return prev;
    });
  }, [
    poForm?.items,
    poForm?.discount,
    poForm?.postage,
    taxMode,
    taxPercentage,
    isTaxIncluded,
    pphType,
  ]);

  // Handle Manual Tax Override
  useEffect(() => {
    if (!poForm || taxMode !== "manual" || isTaxIncluded) return;

    const subtotal = poForm.items.reduce(
      (acc, item) => acc + item.qty * item.price,
      0,
    );
    const taxableAmount = Math.max(0, subtotal - (poForm.discount || 0));
    const selectedPph =
      PPH_OPTIONS.find((opt) => opt.value === pphType) || PPH_OPTIONS[0];
    const pphAmount = (taxableAmount * selectedPph.rate) / 100;

    const grandTotal =
      taxableAmount - pphAmount + (poForm.tax || 0) + (poForm.postage || 0);

    if (poForm.total_price !== grandTotal) {
      setPoForm((prev) => (prev ? { ...prev, total_price: grandTotal } : null));
    }
  }, [
    poForm?.tax,
    taxMode,
    isTaxIncluded,
    pphType,
    poForm?.items,
    poForm?.discount,
    poForm?.postage,
  ]);

  // Update Payment Term String (+ varian pengiriman DP & Pelunasan)
  useEffect(() => {
    if (!poForm) return;
    let newPaymentTerm = "";
    if (paymentTermType === "Cash") {
      newPaymentTerm = "Cash";
    } else if (paymentTermType === "Termin") {
      newPaymentTerm = `Termin ${paymentTermDays} Hari`;
    } else if (paymentTermType === "DP_BP") {
      const validDp = Math.min(100, Math.max(0, dpPercentage));
      const bp = 100 - validDp;
      newPaymentTerm = `DP ${validDp}% - Pelunasan ${bp}%`;
    }
    const newShippingType =
      paymentTermType === "DP_BP" ? dpBpShippingType : null;

    if (
      poForm.payment_term !== newPaymentTerm ||
      (poForm.dp_bp_shipping_type ?? null) !== newShippingType
    ) {
      setPoForm((p) =>
        p
          ? {
              ...p,
              payment_term: newPaymentTerm,
              dp_bp_shipping_type: newShippingType,
            }
          : null,
      );
    }
  }, [
    paymentTermType,
    paymentTermDays,
    dpPercentage,
    dpBpShippingType,
    poForm?.payment_term,
    poForm?.dp_bp_shipping_type,
  ]);

  const handleItemChange = (
    index: number,
    field: keyof POItem,
    value: string | number,
  ) => {
    if (!poForm) return;
    const newItems = [...poForm.items];
    const itemToUpdate = { ...newItems[index] };

    if (field === "qty" || field === "price")
      (itemToUpdate[field] as number) = Number(value) < 0 ? 0 : Number(value);
    else (itemToUpdate[field] as string) = String(value);

    itemToUpdate.total_price = itemToUpdate.qty * itemToUpdate.price;
    newItems[index] = itemToUpdate;
    setPoForm((prev) => (prev ? { ...prev, items: newItems } : null));
  };

  // Item baru WAJIB dipilih dari database barang (konsisten dengan halaman
  // buat MR/PO) - tidak ada opsi tambah item manual/blank.
  const handleAddItemFromDB = (barang: Barang) => {
    if (!poForm) return;
    setPoForm((prev) =>
      prev
        ? {
            ...prev,
            items: [
              ...prev.items,
              {
                barang_id: barang.id,
                part_number: barang.part_number,
                name: barang.part_name || "",
                qty: 1,
                uom: barang.uom || "Pcs",
                price: barang.last_purchase_price || 0,
                total_price: barang.last_purchase_price || 0,
                vendor_name: "",
                is_asset: barang.is_asset,
              },
            ],
          }
        : null,
    );
    setIsAddItemDialogOpen(false);
    toast.success("Barang ditambahkan ke PO.");
  };

  const removeItem = (index: number) => {
    if (!poForm) return;
    setPoForm((prev) =>
      prev
        ? { ...prev, items: prev.items.filter((_, i) => i !== index) }
        : null,
    );
  };

  const handleOpenReplaceDialog = (index: number) => {
    setReplacingIndex(index);
    setIsReplaceDialogOpen(true);
  };

  const handleOpenViewItemDialog = (index: number) => {
    setViewItemIndex(index);
    setIsViewItemOpen(true);
  };

  const handleReplaceItem = (barang: Barang) => {
    if (replacingIndex === null || !poForm) return;

    const newItems = [...poForm.items];
    const item = { ...newItems[replacingIndex] };

    item.barang_id = barang.id;
    item.part_number = barang.part_number;
    item.name = barang.part_name || item.name;
    item.uom = barang.uom || item.uom;
    item.is_asset = barang.is_asset;

    if (barang.last_purchase_price && barang.last_purchase_price > 0) {
      item.price = barang.last_purchase_price;
      item.total_price = item.qty * item.price;
      toast.success("Barang diganti & harga diperbarui.");
    } else {
      toast.success("Barang diganti (Harga tetap).");
    }
    newItems[replacingIndex] = item;

    setPoForm({ ...poForm, items: newItems });
    setIsReplaceDialogOpen(false);
    setReplacingIndex(null);
  };

  // --- Edit bebas item (admin) ---
  const handleOpenEditItemDialog = (index: number) => {
    if (!poForm) return;
    setEditingItemIndex(index);
    setItemFormData(poForm.items[index]);
  };

  const handleSaveItemChanges = () => {
    if (!poForm || editingItemIndex === null) return;
    if (
      !itemFormData.name.trim() ||
      itemFormData.qty <= 0 ||
      !itemFormData.uom.trim() ||
      itemFormData.price < 0
    ) {
      toast.error("Data item tidak valid.");
      return;
    }
    const updatedItems = [...poForm.items];
    updatedItems[editingItemIndex] = {
      ...itemFormData,
      total_price: itemFormData.qty * itemFormData.price,
    };
    setPoForm({ ...poForm, items: updatedItems });
    setEditingItemIndex(null);
  };

  // --- Approval & Status (admin) ---
  const handleApprovalStatusChange = (
    index: number,
    newStatus: Approval["status"],
  ) => {
    if (!poForm || !Array.isArray(poForm.approvals)) return;
    const updatedApprovals = [...poForm.approvals];
    if (updatedApprovals[index]) {
      updatedApprovals[index] = { ...updatedApprovals[index], status: newStatus };
      setPoForm({ ...poForm, approvals: updatedApprovals });
    }
  };

  const handlePoStatusChange = (newStatus: PurchaseOrderPayload["status"]) => {
    if (!poForm) return;
    setPoForm({ ...poForm, status: newStatus });
  };

  const handleSubmit = async () => {
    if (!poForm) return;
    // Validasi Vendor Utama
    if (!poForm.vendor_details || !poForm.vendor_details.vendor_id) {
      toast.error("Vendor Utama wajib dipilih.");
      return;
    }
    if (!poForm.vendor_details.tipe_vendor) {
      toast.error(
        "Vendor ini belum diset Tipe Vendor-nya (HO/Branch/Site). Lengkapi dulu di Manajemen Vendor sebelum PO bisa disimpan.",
      );
      return;
    }

    const payload: Partial<PurchaseOrderPayload> = {
      ...poForm,
      vendor_details: poForm.vendor_details!,
      attachments: Array.isArray(poForm.attachments) ? poForm.attachments : [],
    };

    // Hapus property relasi agar tidak dikirim ke Supabase update
    delete (payload as any).material_requests;
    delete (payload as any).users_with_profiles;
    delete (payload as any).created_at;
    delete (payload as any).updated_at;
    delete (payload as any).id;

    setActionLoading(true);
    const toastId = toast.loading(`Memperbarui PO...`);
    try {
      await updatePurchaseOrder(poId, payload);

      if (currentUser) {
        const actor = `${isAdmin ? "Admin " : ""}${userProfile?.nama || currentUser.email || "Unknown"}`;
        await logActivity(
          currentUser.id,
          "UPDATE_PO",
          "purchase_order",
          String(poId),
          `${actor} memperbarui data Purchase Order ${poForm.kode_po}`,
          { updated_fields: Object.keys(payload), mode },
        );
        const original = originalAssetRef.current;
        if (original && original.is_asset !== !!poForm.is_asset) {
          const label = (isAsset: boolean) => (isAsset ? "PO Aset" : "PO Biasa");
          await logActivity(
            currentUser.id,
            "CHANGE_PO_TYPE",
            "purchase_order",
            String(poId),
            `${actor} mengubah jenis PO dari ${label(original.is_asset)} (${original.kode_po}) menjadi ${label(!!poForm.is_asset)} (${poForm.kode_po})`,
            {
              before: { is_asset: original.is_asset, kode_po: original.kode_po },
              after: { is_asset: !!poForm.is_asset, kode_po: poForm.kode_po },
            },
          );
        }
        if (poForm.mr_id) {
          await logActivity(
            currentUser.id,
            "UPDATE_PO",
            "material_request",
            String(poForm.mr_id),
            `${actor} memperbarui Purchase Order ${poForm.kode_po} yang terkait MR ini`,
            { po_id: poId, updated_fields: Object.keys(payload) },
          );
        }
      }

      toast.success("Purchase Order berhasil diperbarui!", { id: toastId });
      router.push(isAdmin ? "/po-management" : `/purchase-order/${poId}`);
      router.refresh();
    } catch (err: any) {
      toast.error("Gagal memperbarui PO", {
        id: toastId,
        description: err.message,
      });
    } finally {
      setActionLoading(false);
    }
  };

  const handleAttachmentUpload = async (
    e: React.ChangeEvent<HTMLInputElement>,
    type: "po" | "finance" | "invoice" | "quotation",
  ) => {
    const file = e.target.files?.[0];
    if (!file || !poForm) return;

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
    const filePath = `po/${poForm.kode_po}/${type}/${Date.now()}_${file.name}`;

    try {
      const uploadResult = await uploadAttachmentDirect(file, filePath);

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
        type: type,
      };

      setPoForm((prev) =>
        prev
          ? {
              ...prev,
              attachments: [
                ...(Array.isArray(prev.attachments) ? prev.attachments : []),
                newAttachment,
              ],
            }
          : null,
      );
      toast.success(`Lampiran ${type.toUpperCase()} berhasil diunggah!`, {
        id: toastId,
      });
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

  const removeAttachment = (indexToRemove: number) => {
    if (!poForm || !Array.isArray(poForm.attachments)) return;
    const attachmentToRemove = poForm.attachments?.[indexToRemove];
    if (!attachmentToRemove) return;

    setPoForm((prev) =>
      prev
        ? {
            ...prev,
            attachments: prev.attachments?.filter(
              (_, index) => index !== indexToRemove,
            ),
          }
        : null,
    );

    if (attachmentToRemove.url.startsWith("http")) {
      removeAttachmentVps(attachmentToRemove.url);
    } else {
      const supabase = createClient();
      supabase.storage.from("mr").remove([attachmentToRemove.url]);
    }

    toast.info(
      `Lampiran "${attachmentToRemove.name}" dihapus. Perubahan akan tersimpan saat Anda menekan 'Simpan Perubahan'.`,
    );
  };

  if (loading)
    return (
      <div className="col-span-12">
        <Skeleton className="h-[80vh] w-full" />
      </div>
    );
  if (error || !poForm)
    return (
      <Content className="col-span-12">
        <div className="flex flex-col items-center justify-center h-96 text-center">
          <AlertTriangle className="w-16 h-16 text-destructive mb-4" />
          <h1 className="text-2xl font-bold">Data Tidak Ditemukan</h1>
          <p className="text-muted-foreground">
            {error || "Data PO tidak ditemukan."}
          </p>
          <Button asChild variant="outline" className="mt-6">
            <Link href={isAdmin ? "/po-management" : "/purchase-order"}>
              Kembali ke Daftar PO
            </Link>
          </Button>
        </div>
      </Content>
    );

  const allAttachments = Array.isArray(poForm.attachments)
    ? poForm.attachments
    : [];
  const poAttachments = allAttachments.filter(
    (att) => !att.type || att.type === "po",
  );
  const financeAttachments = allAttachments.filter(
    (att) => att.type === "finance",
  );
  const purchasingAttachments = allAttachments.filter(
    (att) => att.type === "invoice" || att.type === "quotation",
  );
  const approvals = Array.isArray(poForm.approvals) ? poForm.approvals : [];

  const subtotal = poForm.items.reduce(
    (acc, item) => acc + item.qty * item.price,
    0,
  );
  const isBusy =
    actionLoading || isUploadingPO || isUploadingFinance || isUploadingPurchasing;

  // --- Checklist kelengkapan (panel ringkasan) ---
  // Validasi simpan cuma mewajibkan vendor (lihat handleSubmit), jadi hanya
  // vendor yang `todo`; sisanya `suggested` - kelihatan tapi tidak memblok.
  const mrRef = poForm.material_requests;
  const hasVendor = !!poForm.vendor_details?.vendor_id;
  const vendorTypeMissing = hasVendor && !poForm.vendor_details?.tipe_vendor;
  const purchasingTypes = Array.from(
    new Set(
      purchasingAttachments.map((a) =>
        a.type === "invoice" ? "Invoice" : "Quotation",
      ),
    ),
  );
  const approvedCount = approvals.filter((a) => a.status === "approved").length;

  const summaryChecks: FormSummaryCheck[] = [
    {
      id: "source",
      label: "Referensi MR",
      status: mrRef ? "done" : "warning",
      value: mrRef ? (
        <span className="font-mono text-xs">{mrRef.kode_mr}</span>
      ) : undefined,
      hint: mrRef ? undefined : "Direct PO (tanpa MR)",
      targetId: "po-section-source",
    },
    {
      id: "items",
      label: "Item PO",
      status: poForm.items.length > 0 ? "done" : "suggested",
      value:
        poForm.items.length > 0 ? `${poForm.items.length} item` : undefined,
      hint: poForm.items.length > 0 ? undefined : "Belum ada item",
      targetId: "po-section-items",
    },
    {
      id: "vendor",
      label: "Vendor",
      status: hasVendor && !vendorTypeMissing ? "done" : "todo",
      value: hasVendor ? poForm.vendor_details?.nama_vendor : undefined,
      hint: vendorTypeMissing
        ? "Tipe vendor (HO/Branch/Site) belum diset"
        : hasVendor
          ? undefined
          : "Pilih vendor utama",
      targetId: "po-section-vendor",
    },
    {
      id: "payment",
      label: "Payment term",
      status: "done",
      value: poForm.payment_term || undefined,
      targetId: "po-section-vendor",
    },
    {
      id: "purchasing-attachment",
      label: "Quotation / Invoice",
      status: purchasingAttachments.length > 0 ? "done" : "suggested",
      value:
        purchasingAttachments.length > 0
          ? purchasingTypes.join(", ")
          : undefined,
      hint:
        purchasingAttachments.length > 0 ? undefined : "Belum ada lampiran",
      targetId: "po-section-attachments",
    },
    ...(isAdmin
      ? ([
          {
            id: "status",
            label: "Status PO",
            status: "done",
            value: poForm.status,
            targetId: "po-section-header",
          },
          {
            id: "approvals",
            label: "Jalur approval",
            status: approvals.length > 0 ? "done" : "suggested",
            value:
              approvals.length > 0
                ? `${approvedCount}/${approvals.length} approved`
                : undefined,
            hint: approvals.length > 0 ? undefined : "Belum ditentukan",
            targetId: "po-section-approvals",
          },
        ] satisfies FormSummaryCheck[])
      : []),
  ];

  return (
    <>
      <FormSummaryLayout
        summary={{
          title: "Ringkasan Perubahan PO",
          subtitle: <span className="font-mono">{poForm.kode_po}</span>,
          checks: summaryChecks,
          submitLabel: isAdmin ? "Simpan Semua Perubahan" : "Simpan Perubahan",
          submittingLabel: "Menyimpan...",
          submitIcon: <Save className="mr-2 h-4 w-4" />,
          onSubmit: handleSubmit,
          submitting: actionLoading,
          disabled: isUploadingPO || isUploadingFinance || isUploadingPurchasing,
          dirty,
          nextSteps: isAdmin ? (
            <>
              Perubahan langsung disimpan ke PO ini (termasuk Status &amp;
              Jalur Approval) dan tercatat di riwayat aktivitas.
            </>
          ) : (
            <>
              Perubahan langsung disimpan ke PO ini dan tercatat di riwayat
              aktivitas.
            </>
          ),
          children: (
            <div className="space-y-2 text-sm">
              <div className="flex justify-between">
                <span className="text-muted-foreground">
                  Subtotal ({poForm.items.length} item)
                </span>
                <span className="tabular-nums">{formatCurrency(subtotal)}</span>
              </div>

              {(poForm.discount || 0) > 0 && (
                <div className="flex justify-between text-destructive">
                  <span>- Diskon</span>
                  <span className="tabular-nums">
                    ({formatCurrency(poForm.discount)})
                  </span>
                </div>
              )}

              {(poForm.pph_amount || 0) > 0 && (
                <div className="flex justify-between text-destructive">
                  <span>
                    - PPH ({PPH_OPTIONS.find((o) => o.value === pphType)?.rate}
                    %)
                  </span>
                  <span className="tabular-nums">
                    ({formatCurrency(poForm.pph_amount || 0)})
                  </span>
                </div>
              )}

              {!isTaxIncluded && (poForm.tax || 0) > 0 && (
                <div className="flex justify-between text-primary">
                  <span>+ PPN ({taxPercentage}%)</span>
                  <span className="tabular-nums">
                    {formatCurrency(poForm.tax || 0)}
                  </span>
                </div>
              )}

              {isTaxIncluded && (
                <div className="flex justify-between gap-2 text-muted-foreground italic">
                  <span>PPN ({taxPercentage}%, sudah termasuk harga)</span>
                  <span className="tabular-nums">
                    {formatCurrency(subtotal * (taxPercentage / 100))}
                  </span>
                </div>
              )}

              {(poForm.postage || 0) > 0 && (
                <div className="flex justify-between text-primary">
                  <span>+ Ongkir</span>
                  <span className="tabular-nums">
                    {formatCurrency(poForm.postage || 0)}
                  </span>
                </div>
              )}

              <div className="border-t pt-2 mt-2">
                <div className="flex items-baseline justify-between gap-2 font-bold">
                  <span>Grand Total</span>
                  <span className="text-lg tabular-nums">
                    {formatCurrency(poForm.total_price)}
                  </span>
                </div>
                {(poForm.pph_amount || 0) > 0 && (
                  <p className="text-[10px] text-muted-foreground text-right mt-1 italic">
                    *Net Payable (setelah potong PPH)
                  </p>
                )}
              </div>
            </div>
          ),
        }}
      >
        {/* --- HEADER --- */}
        <div
          id="po-section-header"
          className="col-span-12 flex flex-wrap justify-between items-center gap-4 rounded-md"
        >
          <div>
            <h1 className="text-3xl font-bold [overflow-wrap:anywhere]">
              Edit Purchase Order{isAdmin && " (Admin)"}
            </h1>
            <p className="text-muted-foreground [overflow-wrap:anywhere]">
              PO:{" "}
              <span className="font-semibold text-primary">
                {poForm.kode_po}
              </span>
              {mrRef && (
                <>
                  {" | Ref. MR: "}
                  <Link
                    href={`/material-request/${poForm.mr_id}`}
                    className="text-primary hover:underline"
                    target="_blank"
                  >
                    {mrRef.kode_mr} <LinkIcon className="inline h-3 w-3" />
                  </Link>
                </>
              )}
            </p>
            <div className="flex flex-wrap items-center gap-2 mt-1">
              <Checkbox
                id="is-asset-po"
                checked={!!poForm.is_asset}
                onCheckedChange={(c) =>
                  setPoForm((prev) =>
                    prev
                      ? {
                          ...prev,
                          is_asset: c as boolean,
                          kode_po: withAssetMarker(prev.kode_po, c as boolean),
                        }
                      : null,
                  )
                }
              />
              <label
                htmlFor="is-asset-po"
                className="text-sm font-medium cursor-pointer select-none"
              >
                Ini adalah PO Aset
              </label>
              {poForm.is_asset && (
                <Badge className="bg-purple-600 hover:bg-purple-600 text-white">
                  PO Asset
                </Badge>
              )}
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            {isAdmin && (
              <div className="flex items-center gap-1">
                <Label className="text-sm font-medium">Status PO:</Label>
                <SearchableSelect
                  value={poForm.status}
                  onValueChange={handlePoStatusChange}
                >
                  <SearchableSelectTrigger className="w-[180px]">
                    <SearchableSelectValue placeholder="Ubah Status PO..." />
                  </SearchableSelectTrigger>
                  <SearchableSelectContent>
                    {PO_STATUS_OPTIONS.map((status) => (
                      <SearchableSelectItem key={status} value={status}>
                        {status}
                      </SearchableSelectItem>
                    ))}
                  </SearchableSelectContent>
                </SearchableSelect>
              </div>
            )}
            <Button onClick={handleSubmit} disabled={isBusy}>
              {actionLoading ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : (
                <Save className="mr-2 h-4 w-4" />
              )}
              {isAdmin ? "Simpan Semua Perubahan" : "Simpan Perubahan"}
            </Button>
          </div>
        </div>

        {/* --- REFERENSI MR / DIRECT PO --- */}
        {mrRef ? (
          <Content
            id="po-section-source"
            title={`Informasi Referensi dari ${mrRef.kode_mr}`}
          >
            <div className="grid grid-cols-1 md:grid-cols-2 gap-x-6 gap-y-4 [&>*]:min-w-0">
              <InfoItem
                icon={CircleUser}
                label="Pembuat MR"
                value={mrRef.users_with_profiles?.nama || "N/A"}
              />
              <InfoItem
                icon={Building}
                label="Departemen MR"
                value={mrRef.department}
              />
              <InfoItem icon={Tag} label="Kategori MR" value={mrRef.kategori} />
              <InfoItem
                icon={DollarSign}
                label="Estimasi Biaya MR"
                value={formatCurrency(mrRef.cost_estimation)}
              />
              <InfoItem
                icon={Building2}
                label="Cost Center"
                value={getCostCenterName(mrRef)}
              />
              <InfoItem
                icon={Truck}
                label="Tujuan Site (MR)"
                value={mrRef.tujuan_site || "N/A"}
              />
              <div className="md:col-span-2">
                <InfoItem
                  icon={Info}
                  label="Remarks MR"
                  value={
                    mrRef.remarks ? (
                      <RichContentView content={parseRichValue(mrRef.remarks)} />
                    ) : (
                      "-"
                    )
                  }
                  isBlock
                />
              </div>
              <div className="md:col-span-2 border-t pt-2 mt-2">
                <Link
                  href={`/material-request/${poForm.mr_id}`}
                  target="_blank"
                  className="text-xs text-primary hover:underline flex items-center gap-1 w-fit"
                >
                  Buka Halaman Detail MR Lengkap{" "}
                  <ExternalLink className="h-3 w-3" />
                </Link>
              </div>
            </div>
          </Content>
        ) : (
          <Content
            id="po-section-source"
            className="bg-muted/40 border-dashed border-2"
          >
            <div className="flex items-center gap-4 text-muted-foreground p-4">
              <Info className="h-8 w-8" />
              <div>
                <h4 className="font-semibold text-foreground">Direct PO</h4>
                <p className="text-sm">
                  PO ini dibuat tanpa referensi Material Request.
                </p>
              </div>
            </div>
          </Content>
        )}

        {mrRef && (
          <Content title="Item Referensi dari MR">
            <div className="rounded-md border overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Nama Item</TableHead>
                    <TableHead>Qty</TableHead>
                    <TableHead className="text-right">Estimasi Harga</TableHead>
                    <TableHead className="text-right">Total Estimasi</TableHead>
                    <TableHead>Link</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {(mrRef.orders as Order[]).map((order, index) => (
                    <TableRow key={index}>
                      <TableCell className="min-w-[160px] max-w-[320px] whitespace-normal [overflow-wrap:anywhere] font-medium">{order.name}</TableCell>
                      <TableCell>
                        {order.qty} {order.uom}
                      </TableCell>
                      <TableCell className="text-right">
                        {formatCurrency(order.estimasi_harga)}
                      </TableCell>
                      <TableCell className="text-right font-medium">
                        {formatCurrency(Number(order.qty) * order.estimasi_harga)}
                      </TableCell>
                      <TableCell>
                        {order.url && (
                          <Button asChild variant={"outline"} size="sm">
                            <Link
                              href={order.url}
                              target="_blank"
                              rel="noopener noreferrer"
                            >
                              <LinkIcon className="h-3 w-3" />
                            </Link>
                          </Button>
                        )}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </Content>
        )}

        {/* --- ITEM PO --- */}
        <Content
          id="po-section-items"
          title="Detail Item Pesanan (PO)"
          cardAction={
            <Button
              variant="outline"
              size="sm"
              onClick={() => setIsAddItemDialogOpen(true)}
            >
              <Plus className="mr-2 h-4 w-4" /> Tambah Item
            </Button>
          }
        >
          <div className="overflow-x-auto border rounded-md">
            <Table className="min-w-[700px]">
              <TableHeader>
                <TableRow>
                  <TableHead>Nama Barang</TableHead>
                  <TableHead>Qty</TableHead>
                  <TableHead>Harga</TableHead>
                  <TableHead>Total</TableHead>
                  <TableHead className="text-right">Aksi</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {poForm.items.length === 0 && (
                  <TableRow>
                    <TableCell
                      colSpan={5}
                      className="text-center h-24 text-muted-foreground"
                    >
                      Belum ada item.
                    </TableCell>
                  </TableRow>
                )}
                {poForm.items.map((item, index) => (
                  <TableRow key={index}>
                    <TableCell className="min-w-[160px] max-w-[320px] whitespace-normal [overflow-wrap:anywhere]">
                      {/* Nama bisa diedit kalau item input manual (data lama) */}
                      {item.barang_id === 0 ? (
                        <Input
                          value={item.name}
                          onChange={(e) =>
                            handleItemChange(index, "name", e.target.value)
                          }
                          placeholder="Nama Item..."
                          className="h-8 text-sm"
                        />
                      ) : (
                        <div className="font-medium">{item.name}</div>
                      )}
                      <div className="text-xs text-muted-foreground font-mono mt-1">
                        {item.part_number}
                      </div>
                      {!item.barang_id && (
                        <span className="text-[10px] text-amber-600 bg-amber-100 dark:text-amber-300 dark:bg-amber-900/40 px-1 rounded inline-block mt-1">
                          Manual Input
                        </span>
                      )}
                    </TableCell>
                    <TableCell>
                      <Input
                        type="number"
                        value={item.qty}
                        onChange={(e) =>
                          handleItemChange(index, "qty", e.target.value)
                        }
                        className="w-20"
                        min="1"
                      />
                    </TableCell>
                    <TableCell>
                      <CurrencyInput
                        value={item.price}
                        onValueChange={(numValue) =>
                          handleItemChange(index, "price", numValue)
                        }
                        placeholder="Rp 0"
                        className="w-32"
                      />
                    </TableCell>
                    <TableCell>{formatCurrency(item.total_price)}</TableCell>
                    <TableCell className="text-right">
                      <div className="flex justify-end gap-1">
                        <Button
                          variant="ghost"
                          size="icon"
                          title="Lihat Detail"
                          onClick={() => handleOpenViewItemDialog(index)}
                        >
                          <Eye className="h-4 w-4 text-muted-foreground" />
                        </Button>
                        {isAdmin && (
                          <Button
                            variant="ghost"
                            size="icon"
                            title="Edit Nama/UoM Item"
                            onClick={() => handleOpenEditItemDialog(index)}
                          >
                            <EditIcon className="h-4 w-4" />
                          </Button>
                        )}
                        <Button
                          variant="ghost"
                          size="icon"
                          title="Cari/Ganti Barang di DB"
                          onClick={() => handleOpenReplaceDialog(index)}
                        >
                          <RefreshCcw className="h-4 w-4 text-primary" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          title="Hapus Item"
                          onClick={() => removeItem(index)}
                        >
                          <Trash2 className="h-4 w-4 text-destructive" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </Content>

        {/* --- VENDOR & PEMBAYARAN --- */}
        <Content id="po-section-vendor" title="Vendor Utama & Pengiriman">
          <div className="grid gap-6 md:grid-cols-2 [&>*]:min-w-0">
            <div className="min-w-0 space-y-4">
              <div>
                <Label className="mb-1 block">Pilih Vendor Utama</Label>
                <VendorSearchCombobox
                  poForm={poForm}
                  setPoForm={setPoForm}
                  onVendorSelected={(vendor) => {
                    if (isMarketplaceVendor(vendor.nama_vendor)) {
                      setIsTaxIncluded(false);
                      setTaxMode("percentage");
                      setTaxPercentage(0);
                    } else {
                      setIsTaxIncluded(true);
                      setTaxMode("percentage");
                      setTaxPercentage(11);
                    }
                  }}
                />
              </div>
              <div className="p-3 bg-muted/50 rounded-md space-y-2 text-sm">
                <div className="flex justify-between gap-2">
                  <span className="shrink-0 text-muted-foreground">Kontak:</span>
                  <span className="min-w-0 text-right [overflow-wrap:anywhere]">
                    {poForm.vendor_details?.contact_person || "-"}
                  </span>
                </div>
                <div className="flex justify-between gap-2">
                  <span className="shrink-0 text-muted-foreground">Email:</span>
                  <span className="min-w-0 text-right [overflow-wrap:anywhere]">
                    {poForm.vendor_details?.email || "-"}
                  </span>
                </div>
                <div>
                  <span className="text-muted-foreground block mb-1">
                    Alamat:
                  </span>
                  <p className="whitespace-pre-wrap [overflow-wrap:anywhere]">
                    {poForm.vendor_details?.alamat || "-"}
                  </p>
                </div>
              </div>
            </div>

            <div className="min-w-0 space-y-4">
              <div>
                <Label className="text-sm font-medium">Payment Term</Label>
                <div className="flex flex-col gap-3 mt-1">
                  <SearchableSelect
                    value={paymentTermType}
                    onValueChange={(value) => setPaymentTermType(value)}
                  >
                    <SearchableSelectTrigger className="w-full">
                      <SearchableSelectValue placeholder="Pilih tipe..." />
                    </SearchableSelectTrigger>
                    <SearchableSelectContent>
                      <SearchableSelectItem value="Termin">
                        Termin (Jangka Waktu)
                      </SearchableSelectItem>
                      <SearchableSelectItem value="Cash">
                        Cash (Tunai)
                      </SearchableSelectItem>
                      <SearchableSelectItem value="DP_BP">
                        DP & Pelunasan (DP & Balance)
                      </SearchableSelectItem>
                    </SearchableSelectContent>
                  </SearchableSelect>

                  {paymentTermType === "Termin" && (
                    <div className="relative">
                      <Input
                        type="number"
                        value={paymentTermDays}
                        onChange={(e) => setPaymentTermDays(e.target.value)}
                        placeholder="... hari"
                        className="pr-12"
                        min="0"
                      />
                      <span className="absolute right-3 top-1/2 -translate-y-1/2 text-sm text-muted-foreground">
                        Hari
                      </span>
                    </div>
                  )}

                  {paymentTermType === "DP_BP" && (
                    <div className="space-y-3 p-3 bg-muted/30 rounded-md border">
                      <div>
                        <Label className="text-xs text-muted-foreground mb-1 block">
                          Kapan Barang Dikirim?
                        </Label>
                        <SearchableSelect
                          value={dpBpShippingType}
                          onValueChange={(v) =>
                            setDpBpShippingType(v as DpBpShippingType)
                          }
                        >
                          <SearchableSelectTrigger className="w-full">
                            <SearchableSelectValue />
                          </SearchableSelectTrigger>
                          <SearchableSelectContent>
                            <SearchableSelectItem value="ship_after_dp">
                              Kirim Setelah DP
                            </SearchableSelectItem>
                            <SearchableSelectItem value="ship_after_full_payment">
                              Kirim Setelah Pelunasan
                            </SearchableSelectItem>
                          </SearchableSelectContent>
                        </SearchableSelect>
                        <p className="text-xs text-muted-foreground mt-1">
                          {dpBpShippingType === "ship_after_dp"
                            ? "Vendor kirim barang begitu DP dibayar. Pelunasan (BP) menyusul belakangan, dilacak terpisah setelah PO berjalan."
                            : "Vendor baru kirim barang setelah DP dan Pelunasan (BP) lunas semua."}
                        </p>
                      </div>

                      <div>
                        <Label className="text-xs text-muted-foreground mb-1 block">
                          Persentase Down Payment (DP)
                        </Label>
                        <div className="relative">
                          <Input
                            type="number"
                            value={dpPercentage}
                            onChange={(e) =>
                              setDpPercentage(Number(e.target.value))
                            }
                            className="pr-8"
                            min="0"
                            max="100"
                          />
                          <span className="absolute right-3 top-1/2 -translate-y-1/2 text-sm text-muted-foreground">
                            %
                          </span>
                        </div>
                      </div>

                      <div className="text-sm space-y-1 pt-1">
                        <div className="flex justify-between">
                          <span className="text-muted-foreground">
                            Nominal DP ({dpPercentage}%):
                          </span>
                          <span className="font-medium text-primary">
                            {formatCurrency(
                              (poForm.total_price * dpPercentage) / 100,
                            )}
                          </span>
                        </div>
                        <div className="flex justify-between border-t pt-1 mt-1">
                          <span className="text-muted-foreground">
                            Pelunasan ({100 - dpPercentage}%):
                          </span>
                          <span className="font-medium text-green-600">
                            {formatCurrency(
                              poForm.total_price -
                                (poForm.total_price * dpPercentage) / 100,
                            )}
                          </span>
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              </div>
              <div>
                <Label className="text-sm font-medium">Alamat Pengiriman</Label>
                <Textarea
                  className="mt-1"
                  value={poForm.shipping_address || ""}
                  onChange={(e) =>
                    setPoForm((p) =>
                      p ? { ...p, shipping_address: e.target.value } : null,
                    )
                  }
                />
              </div>
            </div>
          </div>
        </Content>

        {/* --- PAJAK & BIAYA TAMBAHAN --- */}
        <Content
          id="po-section-costs"
          title="Pajak & Biaya Tambahan"
          description="Grand total dihitung otomatis di panel ringkasan."
        >
          <div className="grid gap-x-8 gap-y-4 md:grid-cols-2 [&>*]:min-w-0">
            <div className="min-w-0 space-y-4">
              <div className="flex justify-between items-center gap-3">
                <Label className="text-xs">Diskon (Rp)</Label>
                <CurrencyInput
                  value={poForm.discount}
                  onValueChange={(numValue) =>
                    setPoForm((p) => (p ? { ...p, discount: numValue } : null))
                  }
                  className="w-40 h-9 text-right"
                  disabled={actionLoading}
                />
              </div>
              <div className="flex justify-between items-center gap-3">
                <Label className="text-xs">Ongkir / Lain-lain</Label>
                <CurrencyInput
                  value={poForm.postage}
                  onValueChange={(numValue) =>
                    setPoForm((p) => (p ? { ...p, postage: numValue } : null))
                  }
                  className="w-40 h-9 text-right"
                  disabled={actionLoading}
                />
              </div>
              <div className="space-y-2 border-t border-dashed pt-3">
                <Label className="text-xs font-semibold">
                  PPH (Pajak Penghasilan)
                </Label>
                <SearchableSelect value={pphType} onValueChange={setPphType}>
                  <SearchableSelectTrigger className="h-9 text-xs">
                    <SearchableSelectValue placeholder="Pilih PPH..." />
                  </SearchableSelectTrigger>
                  <SearchableSelectContent>
                    {PPH_OPTIONS.map((opt) => (
                      <SearchableSelectItem key={opt.value} value={opt.value}>
                        {opt.label}
                      </SearchableSelectItem>
                    ))}
                  </SearchableSelectContent>
                </SearchableSelect>
              </div>
            </div>

            <div className="space-y-2 md:border-l md:pl-8 border-t border-dashed pt-3 md:border-t-0 md:pt-0">
              <div className="flex items-center space-x-2">
                <Checkbox
                  id="include-tax-edit"
                  checked={isTaxIncluded}
                  onCheckedChange={(c) => setIsTaxIncluded(c as boolean)}
                  disabled={actionLoading}
                />
                <Label
                  htmlFor="include-tax-edit"
                  className="text-xs font-medium leading-none cursor-pointer"
                >
                  Harga Item Sudah Termasuk PPN?
                </Label>
              </div>
              {!isTaxIncluded && (
                <div className="pl-6 space-y-3 pt-2 animate-in fade-in">
                  <div className="flex gap-2">
                    <SearchableSelect
                      value={taxMode}
                      onValueChange={(v) => setTaxMode(v as any)}
                      disabled={actionLoading}
                    >
                      <SearchableSelectTrigger className="w-full h-9 text-xs">
                        <SearchableSelectValue placeholder="Metode PPN" />
                      </SearchableSelectTrigger>
                      <SearchableSelectContent>
                        <SearchableSelectItem value="percentage">
                          Persentase (%)
                        </SearchableSelectItem>
                        <SearchableSelectItem value="manual">
                          Manual (Rp)
                        </SearchableSelectItem>
                      </SearchableSelectContent>
                    </SearchableSelect>
                    {taxMode === "percentage" && (
                      <div className="relative w-20">
                        <Input
                          type="number"
                          value={taxPercentage}
                          onChange={(e) =>
                            setTaxPercentage(Number(e.target.value) || 0)
                          }
                          className="text-right pr-6 h-9 text-xs"
                          step="0.01"
                          disabled={actionLoading}
                        />
                        <span className="absolute right-2 top-1/2 -translate-y-1/2 text-xs text-muted-foreground">
                          %
                        </span>
                      </div>
                    )}
                  </div>
                  {taxMode === "manual" && (
                    <CurrencyInput
                      value={poForm.tax}
                      onValueChange={(numValue) =>
                        setPoForm((p) => (p ? { ...p, tax: numValue } : null))
                      }
                      className="w-full h-9 text-right"
                      disabled={actionLoading}
                    />
                  )}
                </div>
              )}
              {isTaxIncluded && (
                <div className="pl-6 space-y-2 pt-2 animate-in fade-in">
                  <div className="flex items-center gap-2">
                    <Label className="text-xs text-muted-foreground">
                      Persentase PPN (info saja)
                    </Label>
                    <div className="relative w-20">
                      <Input
                        type="number"
                        value={taxPercentage}
                        onChange={(e) =>
                          setTaxPercentage(Number(e.target.value) || 0)
                        }
                        className="text-right pr-6 h-9 text-xs"
                        step="0.01"
                        disabled={actionLoading}
                      />
                      <span className="absolute right-2 top-1/2 -translate-y-1/2 text-xs text-muted-foreground">
                        %
                      </span>
                    </div>
                  </div>
                  <p className="text-[11px] text-muted-foreground italic">
                    Harga item sudah termasuk PPN - tarif ini cuma dipakai
                    buat nampilin info PPN-nya (subtotal x tarif), harga &
                    total gak berubah.
                  </p>
                </div>
              )}
            </div>
          </div>
        </Content>

        {/* --- LAMPIRAN --- */}
        <Content id="po-section-attachments" title="Lampiran">
          <div className="space-y-5">
            <div>
              <Label>Lampiran Purchasing (Quotation/Invoice)</Label>
              <div className="flex flex-col sm:flex-row gap-2 mt-2">
                <SearchableSelect
                  value={purchasingAttachmentType}
                  onValueChange={(v) =>
                    setPurchasingAttachmentType(v as "quotation" | "invoice")
                  }
                >
                  <SearchableSelectTrigger className="w-full sm:w-40">
                    <SearchableSelectValue placeholder="Jenis lampiran" />
                  </SearchableSelectTrigger>
                  <SearchableSelectContent>
                    <SearchableSelectItem value="quotation">
                      Quotation
                    </SearchableSelectItem>
                    <SearchableSelectItem value="invoice">
                      Invoice
                    </SearchableSelectItem>
                  </SearchableSelectContent>
                </SearchableSelect>
                <Input
                  id="purchasing-attachment-upload"
                  type="file"
                  className="flex-1"
                  onChange={handlePurchasingAttachmentUpload}
                  disabled={isBusy}
                />
              </div>
              {isUploadingPurchasing && (
                <div className="flex items-center text-sm text-muted-foreground mt-2">
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />{" "}
                  Mengunggah...
                </div>
              )}
              <AttachmentList
                items={purchasingAttachments}
                allAttachments={allAttachments}
                emptyText="Belum ada lampiran purchasing."
                disabled={isBusy}
                onRemove={removeAttachment}
                showTypeBadge
              />
            </div>

            <div className="grid gap-5 md:grid-cols-2 border-t pt-5 [&>*]:min-w-0">
              <div>
                <Label htmlFor="po-attachment-upload">Lampiran PO</Label>
                <Input
                  id="po-attachment-upload"
                  type="file"
                  className="mt-1"
                  onChange={(e) => handleAttachmentUpload(e, "po")}
                  disabled={isBusy}
                />
                {isUploadingPO && (
                  <div className="flex items-center text-sm text-muted-foreground mt-2">
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />{" "}
                    Mengunggah...
                  </div>
                )}
                <AttachmentList
                  items={poAttachments}
                  allAttachments={allAttachments}
                  emptyText="Belum ada lampiran PO."
                  disabled={isBusy}
                  onRemove={removeAttachment}
                />
              </div>
              <div>
                <Label htmlFor="finance-attachment-upload">
                  Lampiran Finance
                </Label>
                <Input
                  id="finance-attachment-upload"
                  type="file"
                  className="mt-1"
                  onChange={(e) => handleAttachmentUpload(e, "finance")}
                  disabled={isBusy}
                />
                {isUploadingFinance && (
                  <div className="flex items-center text-sm text-muted-foreground mt-2">
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />{" "}
                    Mengunggah...
                  </div>
                )}
                <AttachmentList
                  items={financeAttachments}
                  allAttachments={allAttachments}
                  emptyText="Belum ada lampiran finance."
                  disabled={isBusy}
                  onRemove={removeAttachment}
                />
              </div>
            </div>
          </div>
        </Content>

        {/* --- JALUR APPROVAL (admin) --- */}
        {isAdmin && (
          <Content id="po-section-approvals" title="Jalur Approval">
            {approvals.length > 0 ? (
              <div className="space-y-2">
                <Label className="text-xs text-muted-foreground">
                  Admin dapat mengubah status approval:
                </Label>
                {approvals.map((approver, index) => (
                  <div
                    key={index}
                    className="flex flex-wrap items-center justify-between gap-3 p-3 rounded-md border bg-card"
                  >
                    <UserAvatar
                      userId={approver.userid}
                      name={approver.nama}
                      className="h-9 w-9"
                      fallbackClassName="text-xs"
                    />
                    <div className="min-w-0 flex-1">
                      <p className="font-semibold break-words">
                        {approver.nama}
                      </p>
                      <p className="text-sm text-muted-foreground">
                        {approver.type} ({approver.role})
                      </p>
                    </div>
                    <SearchableSelect
                      value={approver.status}
                      onValueChange={(newStatus) =>
                        handleApprovalStatusChange(
                          index,
                          newStatus as Approval["status"],
                        )
                      }
                    >
                      <SearchableSelectTrigger className="w-[120px] flex-shrink-0 capitalize">
                        <SearchableSelectValue placeholder="Status..." />
                      </SearchableSelectTrigger>
                      <SearchableSelectContent>
                        {APPROVAL_STATUS_OPTIONS.map((opt) => (
                          <SearchableSelectItem
                            key={opt}
                            value={opt}
                            className="capitalize"
                          >
                            {opt}
                          </SearchableSelectItem>
                        ))}
                      </SearchableSelectContent>
                    </SearchableSelect>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-sm text-muted-foreground text-center">
                Jalur approval belum ditentukan/kosong.
              </p>
            )}
          </Content>
        )}

        {/* --- CATATAN --- */}
        <Content title="Catatan Internal">
          <RichMentionEditor
            ref={notesEditorRef}
            initialContent={parseRichValue(poForm.notes)}
            placeholder="Masukkan catatan internal..."
            onChange={() =>
              setPoForm((p) =>
                p
                  ? {
                      ...p,
                      notes: notesEditorRef.current?.isEmpty()
                        ? ""
                        : stringifyRichContent(
                            notesEditorRef.current?.getJSON() ?? {
                              type: "doc",
                            },
                          ),
                    }
                  : null,
              )
            }
          />
        </Content>
      </FormSummaryLayout>

      {/* --- DIALOG GANTI BARANG --- */}
      <Dialog open={isReplaceDialogOpen} onOpenChange={setIsReplaceDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Cari Barang di Master Data</DialogTitle>
          </DialogHeader>
          <div className="py-4">
            <BarangSearchCombobox onSelect={handleReplaceItem} />
            <p className="text-xs text-muted-foreground mt-2">
              Pilih barang dari database untuk menggantikan item ini. Data Part
              Number, Nama, dan UoM akan diperbarui.
            </p>
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setIsReplaceDialogOpen(false)}
            >
              Batal
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* --- DIALOG TAMBAH ITEM (wajib dari database barang) --- */}
      <Dialog open={isAddItemDialogOpen} onOpenChange={setIsAddItemDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Tambah Item ke PO</DialogTitle>
            <DialogDescription>
              Cari dan pilih barang dari database master.
            </DialogDescription>
          </DialogHeader>
          <div className="py-4">
            <BarangSearchCombobox onSelect={handleAddItemFromDB} />
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setIsAddItemDialogOpen(false)}
            >
              Batal
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* --- DIALOG EDIT ITEM (admin) --- */}
      {isAdmin && (
        <Dialog
          open={editingItemIndex !== null}
          onOpenChange={(open) => !open && setEditingItemIndex(null)}
        >
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Edit Item PO</DialogTitle>
            </DialogHeader>
            <div className="grid gap-4 py-4">
              <div className="grid grid-cols-4 items-center gap-4 [&>*]:min-w-0">
                <Label className="text-right">Part Number</Label>
                <p className="col-span-3 font-mono text-sm p-2 border rounded-md bg-muted/50">
                  {itemFormData.part_number || "-"}
                </p>
              </div>
              <div className="grid grid-cols-4 items-center gap-4 [&>*]:min-w-0">
                <Label htmlFor="itemNameDlg" className="text-right">
                  Nama Item
                </Label>
                <Input
                  id="itemNameDlg"
                  className="col-span-3"
                  value={itemFormData.name}
                  onChange={(e) =>
                    setItemFormData((prev) => ({ ...prev, name: e.target.value }))
                  }
                />
              </div>
              <div className="grid grid-cols-4 items-center gap-4 [&>*]:min-w-0">
                <Label htmlFor="itemUomDlg" className="text-right">
                  UoM
                </Label>
                <div className="col-span-3">
                  <Combobox
                    key={editingItemIndex ?? "none"}
                    data={dataUoM}
                    onChange={(v) =>
                      setItemFormData((prev) => ({ ...prev, uom: v }))
                    }
                    defaultValue={itemFormData.uom}
                    placeholder="Pilih UoM..."
                  />
                </div>
              </div>
              <div className="grid grid-cols-4 items-center gap-4 [&>*]:min-w-0">
                <Label htmlFor="itemQtyDlg" className="text-right">
                  Quantity
                </Label>
                <Input
                  id="itemQtyDlg"
                  className="col-span-3"
                  type="number"
                  value={itemFormData.qty}
                  onChange={(e) =>
                    setItemFormData((prev) => ({
                      ...prev,
                      qty: Number(e.target.value) || 0,
                    }))
                  }
                  min="1"
                />
              </div>
              <div className="grid grid-cols-4 items-center gap-4 [&>*]:min-w-0">
                <Label htmlFor="itemPriceDlg" className="text-right">
                  Harga Satuan
                </Label>
                <CurrencyInput
                  id="itemPriceDlg"
                  className="col-span-3"
                  value={itemFormData.price}
                  onValueChange={(value) =>
                    setItemFormData((prev) => ({ ...prev, price: value }))
                  }
                />
              </div>
            </div>
            <DialogFooter>
              <Button onClick={handleSaveItemChanges}>
                Simpan Perubahan Item
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      )}

      {/* --- DIALOG VIEW DETAIL ITEM --- */}
      <Dialog open={isViewItemOpen} onOpenChange={setIsViewItemOpen}>
        <DialogContent className="sm:max-w-[500px]">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <FileText className="h-5 w-5 text-primary" /> Detail Item Purchase
              Order
            </DialogTitle>
            <DialogDescription>
              Informasi lengkap mengenai item yang dipilih.
            </DialogDescription>
          </DialogHeader>

          {viewItemIndex !== null && poForm.items[viewItemIndex] && (
            <div className="py-4 space-y-4">
              <div className="grid grid-cols-2 gap-4 text-sm [&>*]:min-w-0">
                <div className="space-y-1">
                  <Label className="text-xs text-muted-foreground">
                    Nama Barang
                  </Label>
                  <div className="font-semibold">
                    {poForm.items[viewItemIndex].name}
                  </div>
                </div>
                <div className="space-y-1">
                  <Label className="text-xs text-muted-foreground">
                    Part Number
                  </Label>
                  <div className="font-mono bg-muted/50 p-1 rounded w-fit px-2">
                    {poForm.items[viewItemIndex].part_number || "-"}
                  </div>
                </div>
                <div className="space-y-1">
                  <Label className="text-xs text-muted-foreground">
                    Kuantitas & UoM
                  </Label>
                  <div>
                    {poForm.items[viewItemIndex].qty}{" "}
                    {poForm.items[viewItemIndex].uom}
                  </div>
                </div>
                <div className="space-y-1">
                  <Label className="text-xs text-muted-foreground">
                    Harga Satuan
                  </Label>
                  <div>{formatCurrency(poForm.items[viewItemIndex].price)}</div>
                </div>
                <div className="space-y-1 col-span-2 border-t pt-2 mt-1">
                  <Label className="text-xs text-muted-foreground">
                    Total Harga Item
                  </Label>
                  <div className="text-lg font-bold text-green-600">
                    {formatCurrency(poForm.items[viewItemIndex].total_price)}
                  </div>
                </div>

                <div className="space-y-1 col-span-2">
                  <Label className="text-xs text-muted-foreground">
                    Status Database
                  </Label>
                  <div className="flex items-center gap-2">
                    {poForm.items[viewItemIndex].barang_id ? (
                      <span className="text-xs bg-green-100 text-green-700 px-2 py-1 rounded-full flex items-center gap-1 w-fit border border-green-200 dark:bg-green-900/40 dark:text-green-300 dark:border-green-800">
                        <Tag className="h-3 w-3" /> Terdaftar di Master Barang
                      </span>
                    ) : (
                      <span className="text-xs bg-amber-100 text-amber-700 px-2 py-1 rounded-full flex items-center gap-1 w-fit border border-amber-200 dark:bg-amber-900/40 dark:text-amber-300 dark:border-amber-800">
                        <Info className="h-3 w-3" /> Input Manual (Belum
                        Terlink)
                      </span>
                    )}
                  </div>
                </div>
              </div>
            </div>
          )}

          <DialogFooter>
            <Button onClick={() => setIsViewItemOpen(false)}>Tutup</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
