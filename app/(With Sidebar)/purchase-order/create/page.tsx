// src/app/(With Sidebar)/purchase-order/create/page.tsx

"use client";

import { useEffect, useState, Suspense } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import { Content } from "@/components/content";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { toast } from "sonner";
import {
  createPurchaseOrder,
  fetchMaterialRequestById,
  generatePoCode,
} from "@/services/purchaseOrderService";
import { fetchAvailableMRsForPO } from "@/services/mrService";
import { formatCurrency, cn, formatDateFriendly } from "@/lib/utils";
import {
  Loader2,
  Send,
  Trash2,
  CircleUser,
  Building,
  Tag,
  DollarSign,
  Info,
  Truck,
  Building2,
  Link as LinkIcon,
  ChevronsUpDown,
  ExternalLink,
  RefreshCcw,
  Eye,
  FileText,
  Plus,
  Link2,
  AlertTriangle,
  XCircle,
  PackagePlus,
  Unlink,
  HelpCircle,
} from "lucide-react";
import { User } from "@supabase/supabase-js";
import { createClient } from "@/lib/supabase/client";
import {
  MaterialRequest,
  POItem,
  PurchaseOrderPayload,
  Vendor,
  StoredVendorDetails,
  Barang,
} from "@/type";
import { Label } from "@/components/ui/label";
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
  DialogTrigger,
} from "@/components/ui/dialog";
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
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { searchVendors } from "@/services/vendorService";
import { BarangSearchCombobox } from "../BarangSearchCombobox";
import Link from "next/link";
import { Badge } from "@/components/ui/badge";

// --- KONFIGURASI PPH ---
const PPH_OPTIONS = [
  { label: "Tidak Ada PPH", value: "none", rate: 0 },
  { label: "PPH 21 (NPWP) - 1%", value: "pph21_npwp", rate: 1.0 },
  { label: "PPH 21 (Tanpa NPWP) - 1.5%", value: "pph21_non_npwp", rate: 1.5 },
  { label: "PPH 23 (NPWP) - 2%", value: "pph23_npwp", rate: 2.0 },
  { label: "PPH 23 (Tanpa NPWP) - 4%", value: "pph23_non_npwp", rate: 4.0 },
];

// --- Vendor Search Component ---
function VendorSearchCombobox({
  poForm,
  setPoForm,
}: {
  poForm: any;
  setPoForm: React.Dispatch<React.SetStateAction<any>>;
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
    };
    setPoForm((prev: any) => ({
      ...prev,
      vendor_details: newVendorDetails,
    }));
    setOpen(false);
    setSearchQuery("");
  };

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          role="combobox"
          aria-expanded={open}
          className="w-full justify-between truncate"
          title={poForm.vendor_details?.nama_vendor}
        >
          {poForm.vendor_details?.nama_vendor ||
            "Cari Nama atau Kode Vendor..."}
          <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-[400px] p-0" align="start">
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
                  <div className="flex flex-col w-full text-left">
                    <span className="font-semibold">{vendor.nama_vendor}</span>
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
  );
}

// --- Helper Info Item ---
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
      isBlock ? "flex flex-col gap-1" : "grid grid-cols-3 gap-x-2 items-start"
    }
  >
    <dt className="text-sm text-muted-foreground col-span-1 flex items-center gap-2 mt-0.5">
      <Icon className="h-4 w-4 flex-shrink-0" />
      {label}
    </dt>
    <dd className="text-sm font-semibold col-span-2 break-words">{value}</dd>
  </div>
);

// --- Main Component ---
function CreatePOPageContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const mrIdParam = searchParams.get("mrId");
  const supabase = createClient();

  const [mrData, setMrData] = useState<MaterialRequest | null>(null);
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [userProfile, setUserProfile] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // State Dialogs & Modals
  const [isLinkMROpen, setIsLinkMROpen] = useState(false);
  const [availableMRs, setAvailableMRs] = useState<any[]>([]);
  const [isLoadingMRs, setIsLoadingMRs] = useState(false);
  const [searchMrQuery, setSearchMrQuery] = useState("");
  const [isConfirmDirectPOOpen, setIsConfirmDirectPOOpen] = useState(false);
  const [isUnlinkDialogOpen, setIsUnlinkDialogOpen] = useState(false); // New: Untuk putuskan MR

  // State Partial Selection
  const [selectedOrderIndices, setSelectedOrderIndices] = useState<number[]>(
    [],
  );

  // State Item Dialogs
  const [isReplaceDialogOpen, setIsReplaceDialogOpen] = useState(false);
  const [isAddItemDialogOpen, setIsAddItemDialogOpen] = useState(false);
  const [replacingIndex, setReplacingIndex] = useState<number | null>(null);
  const [isViewItemOpen, setIsViewItemOpen] = useState(false);
  const [viewItemIndex, setViewItemIndex] = useState<number | null>(null);

  // Upload States
  const [isUploadingPO, setIsUploadingPO] = useState(false);
  const [isUploadingFinance, setIsUploadingFinance] = useState(false);

  // Payment Term Logic
  const [paymentTermType, setPaymentTermType] = useState("Termin");
  const [paymentTermDays, setPaymentTermDays] = useState("30");
  const [dpPercentage, setDpPercentage] = useState<number>(30);

  // Form State
  const [poForm, setPoForm] = useState<
    Omit<
      PurchaseOrderPayload,
      "mr_id" | "user_id" | "status" | "approvals" | "company_code"
    > & { vendor_details: StoredVendorDetails | undefined }
  >({
    kode_po: "Generating...",
    items: [],
    currency: "IDR",
    discount: 0,
    tax: 0,
    postage: 0,
    total_price: 0,
    payment_term: "Termin 30 Hari",
    shipping_address: "Kantor Pusat GMI, Jakarta",
    notes: "",
    vendor_details: {
      vendor_id: 0,
      kode_vendor: "",
      nama_vendor: "",
      alamat: "",
      contact_person: "",
      email: "",
    },
    attachments: [],
    pph_type: null,
    pph_rate: 0,
    pph_amount: 0,
  });

  // Tax States
  const [taxMode, setTaxMode] = useState<"percentage" | "manual">("percentage");
  const [taxPercentage, setTaxPercentage] = useState<number>(11);
  const [isTaxIncluded, setIsTaxIncluded] = useState<boolean>(false);

  // PPH State
  const [pphType, setPphType] = useState<string>("none");

  const getCostCenterName = (data: any) => {
    const cc = data.cost_centers;
    if (Array.isArray(cc)) {
      return cc[0]?.name || `ID: ${data.cost_center_id} (Nama tidak ditemukan)`;
    }
    if (cc && typeof cc === "object") {
      return cc.name || `ID: ${data.cost_center_id} (Nama tidak ditemukan)`;
    }
    return `ID: ${data.cost_center_id} (Belum ditentukan)`;
  };

  useEffect(() => {
    const initializeForm = async () => {
      try {
        setLoading(true);
        const {
          data: { user },
        } = await supabase.auth.getUser();
        if (!user) throw new Error("User tidak otentikasi");
        setCurrentUser(user);

        const { data: profile } = await supabase
          .from("profiles")
          .select("department, lokasi, company")
          .eq("id", user.id)
          .single();

        if (!profile || !profile.company) {
          throw new Error("Profil Anda tidak lengkap (Company/Lokasi).");
        }
        setUserProfile(profile);

        const newPoCode = await generatePoCode(profile.company, profile.lokasi);
        setPoForm((prev) => ({ ...prev, kode_po: newPoCode }));

        if (mrIdParam) {
          await loadMRData(parseInt(mrIdParam));
        }
      } catch (err: any) {
        toast.error("Gagal memuat data", { description: err.message });
        setError(err.message);
      } finally {
        setLoading(false);
      }
    };
    initializeForm();
  }, [mrIdParam]);

  const loadMRData = async (id: number) => {
    const fetchedMr = await fetchMaterialRequestById(id);
    if (!fetchedMr) {
      toast.error("Data MR tidak ditemukan.");
      return;
    }
    setMrData(fetchedMr as any);
    setPoForm((prev) => ({
      ...prev,
      items: [],
      shipping_address: fetchedMr.tujuan_site || prev.shipping_address,
    }));

    if (fetchedMr.orders && fetchedMr.orders.length > 0) {
      setSelectedOrderIndices(fetchedMr.orders.map((_: any, i: number) => i));
    }
  };

  const handleOpenLinkMR = async () => {
    if (!userProfile?.company) return;
    setIsLinkMROpen(true);
    setIsLoadingMRs(true);
    try {
      const res = await fetchAvailableMRsForPO(
        userProfile.company,
        searchMrQuery,
      );
      setAvailableMRs(res || []);
    } catch (err) {
      console.error(err);
    } finally {
      setIsLoadingMRs(false);
    }
  };

  const handleSelectMR = async (mr: any) => {
    if (poForm.items.length > 0) {
      if (!confirm("Menautkan MR akan mereset item yang sudah ada. Lanjutkan?"))
        return;
    }
    setIsLinkMROpen(false);
    setLoading(true);
    await loadMRData(mr.id);
    setLoading(false);
    toast.success(`MR ${mr.kode_mr} berhasil dikaitkan.`);
  };

  // --- HANDLER UNLINK MR (PUTUSKAN KONEKSI) ---
  const handleUnlinkMR = () => {
    setMrData(null);
    setPoForm((prev) => ({
      ...prev,
      items: [], // Reset item untuk mencegah konflik
    }));
    setSelectedOrderIndices([]);
    setIsUnlinkDialogOpen(false);
    toast.info("Koneksi ke MR diputuskan. Mode Direct PO aktif.");
  };

  useEffect(() => {
    if (!isLinkMROpen || !userProfile?.company) return;
    const handler = setTimeout(() => {
      setIsLoadingMRs(true);
      fetchAvailableMRsForPO(userProfile.company, searchMrQuery)
        .then(setAvailableMRs)
        .finally(() => setIsLoadingMRs(false));
    }, 500);
    return () => clearTimeout(handler);
  }, [searchMrQuery, isLinkMROpen]);

  useEffect(() => {
    if (!mrData) return;
    const newItems: POItem[] = selectedOrderIndices.map((index) => {
      const order = mrData.orders[index];
      const existingItem = poForm.items.find(
        (i) => i.name === order.name && i.qty === Number(order.qty),
      );
      if (existingItem) return existingItem;
      return {
        barang_id: order.barang_id || 0,
        part_number: order.part_number || "N/A",
        name: order.name,
        qty: Number(order.qty),
        uom: order.uom,
        price: order.estimasi_harga || 0,
        total_price: Number(order.qty) * (order.estimasi_harga || 0),
        vendor_name: "",
      };
    });
    setPoForm((prev) => ({ ...prev, items: newItems }));
  }, [selectedOrderIndices, mrData]);

  useEffect(() => {
    const subtotal = poForm.items.reduce(
      (acc, item) => acc + item.qty * item.price,
      0,
    );
    const taxableAmount = Math.max(0, subtotal - (poForm.discount || 0));
    let calculatedTax = 0;
    if (!isTaxIncluded) {
      if (taxMode === "percentage")
        calculatedTax = taxableAmount * (taxPercentage / 100);
      else calculatedTax = poForm.tax || 0;
    }
    const selectedPph =
      PPH_OPTIONS.find((opt) => opt.value === pphType) || PPH_OPTIONS[0];
    const pphAmount = (taxableAmount * selectedPph.rate) / 100;
    const grandTotal =
      taxableAmount - pphAmount + calculatedTax + (poForm.postage || 0);

    setPoForm((prev) => ({
      ...prev,
      tax: taxMode !== "manual" || isTaxIncluded ? calculatedTax : prev.tax,
      total_price: grandTotal,
      pph_type: pphType === "none" ? null : pphType,
      pph_rate: selectedPph.rate,
      pph_amount: pphAmount,
    }));
  }, [
    poForm.items,
    poForm.discount,
    poForm.postage,
    taxMode,
    taxPercentage,
    isTaxIncluded,
    pphType,
  ]);

  useEffect(() => {
    let termString = "";
    if (paymentTermType === "Cash") {
      termString = "Cash";
    } else if (paymentTermType === "Termin") {
      termString = `Termin ${paymentTermDays} Hari`;
    } else if (paymentTermType === "DP_BP") {
      const validDp = Math.min(100, Math.max(0, dpPercentage));
      const bp = 100 - validDp;
      termString = `DP ${validDp}% - Pelunasan ${bp}%`;
    }
    setPoForm((p) => ({ ...p, payment_term: termString }));
  }, [paymentTermType, paymentTermDays, dpPercentage]);

  const handleItemChange = (
    index: number,
    field: keyof POItem,
    value: string | number,
  ) => {
    const newItems = [...poForm.items];
    const itemToUpdate = { ...newItems[index] };
    if (field === "qty" || field === "price") {
      (itemToUpdate[field] as number) = Number(value) < 0 ? 0 : Number(value);
    } else {
      (itemToUpdate[field] as string) = String(value);
    }
    itemToUpdate.total_price = itemToUpdate.qty * itemToUpdate.price;
    newItems[index] = itemToUpdate;
    setPoForm((prev) => ({ ...prev, items: newItems }));
  };

  const handleAddItemFromDB = (barang: Barang) => {
    const newItem: POItem = {
      barang_id: barang.id,
      part_number: barang.part_number,
      name: barang.part_name || "",
      qty: 1,
      uom: barang.uom || "Pcs",
      price: barang.last_purchase_price || 0,
      total_price: (barang.last_purchase_price || 0) * 1,
      vendor_name: "",
    };

    setPoForm((prev) => ({
      ...prev,
      items: [...prev.items, newItem],
    }));
    setIsAddItemDialogOpen(false);
    toast.success("Barang ditambahkan ke PO.");
  };

  const removeItem = (index: number) => {
    setPoForm((prev) => ({
      ...prev,
      items: prev.items.filter((_, i) => i !== index),
    }));
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
    if (replacingIndex === null) return;
    const newItems = [...poForm.items];
    const item = newItems[replacingIndex];
    item.barang_id = barang.id;
    item.part_number = barang.part_number;
    item.name = barang.part_name || item.name;
    item.uom = barang.uom || item.uom;
    if (barang.last_purchase_price && barang.last_purchase_price > 0) {
      item.price = barang.last_purchase_price;
      item.total_price = item.qty * item.price;
      toast.success("Barang diganti & harga diperbarui.");
    } else {
      toast.success("Barang diganti (Harga tetap).");
    }
    setPoForm({ ...poForm, items: newItems });
    setIsReplaceDialogOpen(false);
    setReplacingIndex(null);
  };

  const handleCheckSubmit = () => {
    if (!currentUser) return;
    if (!poForm.vendor_details || !poForm.vendor_details.vendor_id) {
      toast.error("Vendor Utama wajib dipilih.");
      return;
    }
    if (poForm.items.length === 0) {
      toast.error("Pilih minimal satu item.");
      return;
    }
    if (!mrData) {
      setIsConfirmDirectPOOpen(true);
      return;
    }
    handleSubmit(parseInt(mrData.id));
  };

  const handleSubmit = async (mrIdToSubmit: number | null) => {
    if (!currentUser) return;
    setLoading(true);
    setIsConfirmDirectPOOpen(false);
    try {
      await createPurchaseOrder(
        poForm,
        mrIdToSubmit,
        currentUser.id,
        userProfile?.company || "GMI",
      );
      toast.success("PO berhasil diajukan!");
      router.push("/purchase-order");
    } catch (err: any) {
      toast.error("Gagal membuat PO", { description: err.message });
    } finally {
      setLoading(false);
    }
  };

  const handleAttachmentUpload = async (
    e: React.ChangeEvent<HTMLInputElement>,
    type: "po" | "finance",
  ) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (poForm.kode_po === "Generating...") return;
    const setIsLoading =
      type === "po" ? setIsUploadingPO : setIsUploadingFinance;
    setIsLoading(true);
    const filePath = `po/${poForm.kode_po}/${type}/${Date.now()}_${file.name}`;
    const { data, error } = await supabase.storage
      .from("mr")
      .upload(filePath, file);
    if (error) {
      toast.error("Gagal upload", { description: error.message });
    } else {
      setPoForm((prev) => ({
        ...prev,
        attachments: [
          ...(prev.attachments || []),
          { name: file.name, url: data.path, type },
        ],
      }));
      toast.success("Berhasil diunggah");
    }
    setIsLoading(false);
    e.target.value = "";
  };

  const removeAttachment = (index: number) => {
    const att = poForm.attachments?.[index];
    if (!att) return;
    setPoForm((p) => ({
      ...p,
      attachments: p.attachments?.filter((_, i) => i !== index),
    }));
    supabase.storage.from("mr").remove([att.url]);
  };

  const toggleSelection = (index: number) => {
    setSelectedOrderIndices((prev) =>
      prev.includes(index) ? prev.filter((i) => i !== index) : [...prev, index],
    );
  };

  const selectAll = () => {
    if (mrData) {
      if (selectedOrderIndices.length === mrData.orders.length) {
        setSelectedOrderIndices([]);
      } else {
        setSelectedOrderIndices(mrData.orders.map((_, i) => i));
      }
    }
  };

  if (loading && !mrData && !poForm.kode_po)
    return (
      <div className="col-span-12">
        <Skeleton className="h-[80vh] w-full" />
      </div>
    );

  if (error) return <div className="col-span-12 text-center">{error}</div>;

  const subtotal = poForm.items.reduce(
    (acc, item) => acc + item.total_price,
    0,
  );
  const poAttachments =
    poForm.attachments?.filter((a) => !a.type || a.type === "po") || [];
  const financeAttachments =
    poForm.attachments?.filter((a) => a.type === "finance") || [];

  return (
    <>
      <TooltipProvider>
        <div className="col-span-12 flex flex-wrap justify-between items-center gap-4">
          <div>
            <h1 className="text-3xl font-bold">Buat Purchase Order</h1>
            <div className="flex items-center gap-2 mt-1">
              <span className="text-muted-foreground">PO:</span>
              <span className="font-semibold text-primary">
                {poForm.kode_po}
              </span>
              {mrData ? (
                <Tooltip>
                  <TooltipTrigger>
                    <Badge
                      variant="outline"
                      className="bg-primary/10 text-primary border-primary/20 flex items-center gap-1 cursor-help"
                    >
                      Ref MR: {mrData.kode_mr}{" "}
                      <HelpCircle className="h-3 w-3" />
                    </Badge>
                  </TooltipTrigger>
                  <TooltipContent>
                    <p>PO ini terhubung ke MR. Item diambil dari MR.</p>
                  </TooltipContent>
                </Tooltip>
              ) : (
                <Tooltip>
                  <TooltipTrigger>
                    <Badge
                      variant="outline"
                      className="bg-amber-100 text-amber-700 border-amber-200 flex items-center gap-1 cursor-help"
                    >
                      Direct PO (Tanpa MR) <HelpCircle className="h-3 w-3" />
                    </Badge>
                  </TooltipTrigger>
                  <TooltipContent>
                    <p>
                      PO ini dibuat langsung tanpa referensi MR.
                      <br />
                      Anda perlu menambahkan item secara manual.
                    </p>
                  </TooltipContent>
                </Tooltip>
              )}
            </div>
          </div>

          <div className="flex gap-2">
            {/* Tombol Kaitkan/Ganti/Putuskan MR */}
            {mrData ? (
              <div className="flex gap-1">
                <Button variant="outline" onClick={handleOpenLinkMR}>
                  <RefreshCcw className="mr-2 h-4 w-4" />
                  Ganti MR
                </Button>
                <Button
                  variant="destructive"
                  size="icon"
                  onClick={() => setIsUnlinkDialogOpen(true)}
                  title="Putuskan Koneksi MR"
                >
                  <Unlink className="h-4 w-4" />
                </Button>
              </div>
            ) : (
              <Button variant="outline" onClick={handleOpenLinkMR}>
                <Link2 className="mr-2 h-4 w-4" />
                Kaitkan Material Request
              </Button>
            )}

            <Button onClick={handleCheckSubmit} disabled={loading}>
              {loading ? (
                <Loader2 className="animate-spin mr-2 h-4 w-4" />
              ) : (
                <Send className="mr-2 h-4 w-4" />
              )}{" "}
              Ajukan PO
            </Button>
          </div>
        </div>
      </TooltipProvider>

      {/* --- KOLOM KIRI --- */}
      <div className="col-span-12 lg:col-span-7 flex flex-col gap-6">
        {mrData ? (
          <Content title={`Referensi MR: ${mrData.kode_mr}`}>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-x-6 gap-y-4">
              <InfoItem
                icon={CircleUser}
                label="Pembuat MR"
                value={mrData.users_with_profiles?.nama || "N/A"}
              />
              <InfoItem
                icon={Building}
                label="Departemen"
                value={mrData.department}
              />
              <InfoItem icon={Tag} label="Kategori" value={mrData.kategori} />
              <InfoItem
                icon={DollarSign}
                label="Estimasi biaya"
                value={formatCurrency(mrData.cost_estimation)}
              />
              <InfoItem
                icon={Building2}
                label="Cost Center"
                value={getCostCenterName(mrData)}
              />
              <InfoItem
                icon={Truck}
                label="Tujuan"
                value={mrData.tujuan_site || "N/A"}
              />
              <div className="md:col-span-2">
                <InfoItem
                  icon={Info}
                  label="Remarks"
                  value={mrData.remarks}
                  isBlock
                />
              </div>
              <div className="md:col-span-2">
                <Link
                  href={`/material-request/${mrData.id}`}
                  target="_blank"
                  className="text-xs text-primary hover:underline flex items-center gap-1"
                >
                  Lihat Detail MR Asli <ExternalLink className="h-3 w-3" />
                </Link>
              </div>
            </div>
          </Content>
        ) : (
          <Content className="bg-muted/40 border-dashed border-2">
            <div className="flex items-center gap-4 text-muted-foreground p-4">
              <Info className="h-8 w-8" />
              <div>
                <h4 className="font-semibold text-foreground">
                  Mode Direct PO
                </h4>
                <p className="text-sm">
                  PO ini dibuat tanpa referensi Material Request. Pastikan ini
                  sesuai prosedur perusahaan.
                </p>
              </div>
            </div>
          </Content>
        )}

        {mrData && (
          <Content
            title="Pilih Item dari Material Request"
            description="Centang item yang akan diproses."
          >
            <div className="mb-2 flex items-center space-x-2">
              <Checkbox
                id="select-all"
                checked={mrData?.orders.length === selectedOrderIndices.length}
                onCheckedChange={selectAll}
              />
              <label
                htmlFor="select-all"
                className="text-sm font-medium cursor-pointer"
              >
                Pilih Semua
              </label>
            </div>
            <div className="border rounded-md overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-[50px]">Pilih</TableHead>
                    <TableHead>Nama Barang</TableHead>
                    <TableHead>Qty (MR)</TableHead>
                    <TableHead>Est. Harga</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {mrData?.orders.map((order, index) => (
                    <TableRow
                      key={index}
                      className={
                        selectedOrderIndices.includes(index)
                          ? "bg-muted/50"
                          : ""
                      }
                    >
                      <TableCell>
                        <Checkbox
                          checked={selectedOrderIndices.includes(index)}
                          onCheckedChange={() => toggleSelection(index)}
                        />
                      </TableCell>
                      <TableCell>
                        <div className="font-medium">{order.name}</div>
                        <div className="text-xs text-muted-foreground font-mono">
                          {order.part_number || "-"}
                        </div>
                      </TableCell>
                      <TableCell>
                        {order.qty} {order.uom}
                      </TableCell>
                      <TableCell>
                        {formatCurrency(order.estimasi_harga)}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </Content>
        )}

        <Content
          title="Rincian Item Purchase Order (Final)"
          cardAction={
            <Button
              variant="outline"
              size="sm"
              onClick={() => setIsAddItemDialogOpen(true)}
            >
              <PackagePlus className="mr-2 h-4 w-4" /> Tambah Item
            </Button>
          }
        >
          <div className="overflow-x-auto border rounded-md">
            <Table className="min-w-[700px]">
              <TableHeader>
                <TableRow>
                  <TableHead className="w-[200px]">Nama Barang</TableHead>
                  <TableHead>Qty PO</TableHead>
                  <TableHead>Harga Satuan</TableHead>
                  <TableHead>Total</TableHead>
                  <TableHead className="w-[100px] text-right">Aksi</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {poForm.items.length === 0 && (
                  <TableRow>
                    <TableCell
                      colSpan={5}
                      className="text-center h-24 text-muted-foreground"
                    >
                      Belum ada item dipilih atau ditambahkan.
                    </TableCell>
                  </TableRow>
                )}
                {poForm.items.map((item, index) => (
                  <TableRow key={index}>
                    <TableCell>
                      {/* REVISI: Selalu READ-ONLY karena harus dari DB */}
                      <div className="font-medium">{item.name}</div>
                      <div className="text-xs text-muted-foreground font-mono mt-1">
                        {item.part_number}
                      </div>
                    </TableCell>
                    <TableCell>
                      <Input
                        type="number"
                        value={item.qty}
                        className="w-20"
                        min="1"
                        onChange={(e) =>
                          handleItemChange(index, "qty", e.target.value)
                        }
                      />
                    </TableCell>
                    <TableCell>
                      <CurrencyInput
                        value={item.price}
                        className="w-32"
                        onValueChange={(v) =>
                          handleItemChange(index, "price", v)
                        }
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

        <Content title="Catatan PO">
          <Textarea
            placeholder="Tambahkan catatan..."
            value={poForm.notes}
            onChange={(e) =>
              setPoForm((prev) => ({ ...prev, notes: e.target.value }))
            }
          />
        </Content>
      </div>

      {/* --- KOLOM KANAN --- */}
      <div className="col-span-12 lg:col-span-5 flex flex-col gap-6">
        <Content title="Vendor & Pembayaran">
          <div className="space-y-4">
            <div>
              <Label className="mb-1 block">Pilih Vendor Utama</Label>
              <VendorSearchCombobox poForm={poForm} setPoForm={setPoForm} />
            </div>
            <div className="p-3 bg-muted/50 rounded-md space-y-2 text-sm">
              <div className="flex justify-between">
                <span className="text-muted-foreground">Kontak:</span>
                <span>{poForm.vendor_details?.contact_person || "-"}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Email:</span>
                <span>{poForm.vendor_details?.email || "-"}</span>
              </div>
              <div>
                <span className="text-muted-foreground block mb-1">
                  Alamat:
                </span>
                <p className="whitespace-pre-wrap">
                  {poForm.vendor_details?.alamat || "-"}
                </p>
              </div>
            </div>
            <hr />

            {/* PAYMENT TERM SECTION */}
            <div>
              <Label className="text-sm font-medium">Payment Term</Label>
              <div className="flex flex-col gap-3 mt-1">
                <Select
                  value={paymentTermType}
                  onValueChange={setPaymentTermType}
                >
                  <SelectTrigger className="w-full">
                    <SelectValue placeholder="Pilih Metode Pembayaran" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="Termin">
                      Termin (Jangka Waktu)
                    </SelectItem>
                    <SelectItem value="Cash">Cash (Tunai)</SelectItem>
                    <SelectItem value="DP_BP">
                      DP & Pelunasan (DP & Balance)
                    </SelectItem>
                  </SelectContent>
                </Select>

                {paymentTermType === "Termin" && (
                  <div className="relative">
                    <Input
                      type="number"
                      value={paymentTermDays}
                      onChange={(e) => setPaymentTermDays(e.target.value)}
                      className="pr-12"
                      placeholder="30"
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
              <Label>Alamat Pengiriman</Label>
              <Textarea
                value={poForm.shipping_address}
                onChange={(e) =>
                  setPoForm((p) => ({ ...p, shipping_address: e.target.value }))
                }
              />
            </div>
          </div>
        </Content>

        <Content title="Lampiran">
          <div className="space-y-4">
            <div>
              <Label>Lampiran PO</Label>
              <Input
                type="file"
                onChange={(e) => handleAttachmentUpload(e, "po")}
                disabled={isUploadingPO}
                className="mt-1"
              />
              <ul className="space-y-1 mt-2">
                {poAttachments.map((att, i) => (
                  <li
                    key={i}
                    className="flex justify-between text-xs bg-muted p-1 rounded items-center"
                  >
                    <span className="truncate max-w-[150px]">{att.name}</span>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-5 w-5"
                      onClick={() =>
                        removeAttachment(poForm.attachments?.indexOf(att) ?? -1)
                      }
                    >
                      <Trash2 className="h-3 w-3 text-destructive" />
                    </Button>
                  </li>
                ))}
              </ul>
            </div>
            <hr />
            <div>
              <Label>Lampiran Finance</Label>
              <Input
                type="file"
                onChange={(e) => handleAttachmentUpload(e, "finance")}
                disabled={isUploadingFinance}
                className="mt-1"
              />
              <ul className="space-y-1 mt-2">
                {financeAttachments.map((att, i) => (
                  <li
                    key={i}
                    className="flex justify-between text-xs bg-muted p-1 rounded items-center"
                  >
                    <span className="truncate max-w-[150px]">{att.name}</span>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-5 w-5"
                      onClick={() =>
                        removeAttachment(poForm.attachments?.indexOf(att) ?? -1)
                      }
                    >
                      <Trash2 className="h-3 w-3 text-destructive" />
                    </Button>
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </Content>

        {/* --- RINGKASAN BIAYA --- */}
        <Content title="Ringkasan Biaya">
          <div className="space-y-4">
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">Subtotal</span>
              <span>{formatCurrency(subtotal)}</span>
            </div>

            {/* Input Diskon */}
            <div className="flex justify-between items-center">
              <Label className="text-xs">Input Diskon (Rp)</Label>
              <CurrencyInput
                value={poForm.discount}
                onValueChange={(v) => setPoForm((p) => ({ ...p, discount: v }))}
                className="w-36 h-9 text-right"
              />
            </div>

            {/* PPN Section */}
            <div className="space-y-2 pt-2 border-t border-dashed">
              <div className="flex items-center space-x-2">
                <Checkbox
                  id="include-tax-create"
                  checked={isTaxIncluded}
                  onCheckedChange={(c) => setIsTaxIncluded(c as boolean)}
                  disabled={loading}
                />
                <Label
                  htmlFor="include-tax-create"
                  className="text-xs font-medium leading-none cursor-pointer"
                >
                  Harga Item Sudah Termasuk PPN?
                </Label>
              </div>
              {!isTaxIncluded && (
                <div className="pl-6 space-y-3 pt-2">
                  <div className="flex gap-2">
                    <Select
                      value={taxMode}
                      onValueChange={(v) => setTaxMode(v as any)}
                      disabled={loading}
                    >
                      <SelectTrigger className="w-full h-9 text-xs">
                        <SelectValue placeholder="Pilih metode..." />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="percentage">
                          Persentase (%)
                        </SelectItem>
                        <SelectItem value="manual">Manual (Rp)</SelectItem>
                      </SelectContent>
                    </Select>
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
                          disabled={loading}
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
                        setPoForm((p) => ({ ...p, tax: numValue }))
                      }
                      className="w-full h-9 text-right"
                      disabled={loading}
                    />
                  )}
                </div>
              )}
            </div>

            {/* PPH Section */}
            <div className="space-y-2 border-t border-dashed pt-2">
              <Label className="text-xs font-semibold">
                PPH (Pajak Penghasilan)
              </Label>
              <Select value={pphType} onValueChange={setPphType}>
                <SelectTrigger className="h-9 text-xs">
                  <SelectValue placeholder="Pilih PPH..." />
                </SelectTrigger>
                <SelectContent>
                  {PPH_OPTIONS.map((opt) => (
                    <SelectItem key={opt.value} value={opt.value}>
                      {opt.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Input Ongkir */}
            <div className="flex justify-between items-center pt-2 border-t border-dashed">
              <Label className="text-xs">Ongkir / Lain-lain</Label>
              <CurrencyInput
                value={poForm.postage}
                onValueChange={(v) => setPoForm((p) => ({ ...p, postage: v }))}
                className="w-36 h-9 text-right"
              />
            </div>

            {/* --- VISUALISASI PERHITUNGAN --- */}
            <div className="bg-muted/30 p-4 rounded-md space-y-2 mt-4 text-sm border">
              <div className="flex justify-between">
                <span className="text-muted-foreground">Subtotal</span>
                <span>{formatCurrency(subtotal)}</span>
              </div>

              {/* Tampilkan Diskon jika ada */}
              {(poForm.discount || 0) > 0 && (
                <div className="flex justify-between text-destructive">
                  <span>- Diskon</span>
                  <span>({formatCurrency(poForm.discount)})</span>
                </div>
              )}

              {/* Tampilkan PPH jika ada */}
              {(poForm.pph_amount || 0) > 0 && (
                <div className="flex justify-between text-destructive">
                  <span>
                    - PPH ({PPH_OPTIONS.find((o) => o.value === pphType)?.rate}
                    %)
                  </span>
                  <span>({formatCurrency(poForm.pph_amount || 0)})</span>
                </div>
              )}

              {/* Tampilkan PPN jika ada */}
              {(poForm.tax || 0) > 0 && (
                <div className="flex justify-between text-primary">
                  <span>+ PPN {isTaxIncluded ? "(Included)" : ""}</span>
                  <span>{formatCurrency(poForm.tax || 0)}</span>
                </div>
              )}

              {/* Tampilkan Ongkir jika ada */}
              {(poForm.postage || 0) > 0 && (
                <div className="flex justify-between text-primary">
                  <span>+ Ongkir</span>
                  <span>{formatCurrency(poForm.postage || 0)}</span>
                </div>
              )}

              {/* Garis Pemisah */}
              <div className="border-t border-muted-foreground/30 my-2 pt-2">
                <div className="flex justify-between font-bold text-lg">
                  <span>Grand Total</span>
                  <span>{formatCurrency(poForm.total_price)}</span>
                </div>
                {(poForm.pph_amount || 0) > 0 && (
                  <p className="text-[10px] text-muted-foreground text-right mt-1 italic">
                    *Net Payable (setelah potong PPH)
                  </p>
                )}
              </div>
            </div>
          </div>
        </Content>
      </div>

      {/* --- DIALOG LINK MR (FITUR BARU) --- */}
      <Dialog open={isLinkMROpen} onOpenChange={setIsLinkMROpen}>
        <DialogContent className="sm:max-w-2xl max-h-[80vh] flex flex-col p-0 gap-0 overflow-hidden">
          <DialogHeader className="p-6 pb-2">
            <DialogTitle>Kaitkan Material Request</DialogTitle>
            <DialogDescription>
              Pilih MR yang sudah disetujui untuk dibuatkan PO.
            </DialogDescription>
          </DialogHeader>
          <div className="p-6 pt-2 flex-1 overflow-y-auto">
            <Input
              placeholder="Cari No MR atau Remarks..."
              value={searchMrQuery}
              onChange={(e) => setSearchMrQuery(e.target.value)}
              className="mb-4"
            />

            {isLoadingMRs ? (
              <div className="py-8 text-center">
                <Loader2 className="h-6 w-6 animate-spin mx-auto text-primary" />
              </div>
            ) : availableMRs.length === 0 ? (
              <div className="py-8 text-center text-muted-foreground">
                Tidak ada MR yang tersedia (Approved).
              </div>
            ) : (
              <div className="border rounded-md overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Kode MR</TableHead>
                      <TableHead>Remarks</TableHead>
                      <TableHead>Nilai Est.</TableHead>
                      <TableHead className="text-right">Aksi</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {availableMRs.map((mr) => (
                      <TableRow key={mr.id}>
                        <TableCell className="font-medium">
                          {mr.kode_mr}
                        </TableCell>
                        <TableCell
                          className="text-xs text-muted-foreground max-w-[200px] truncate"
                          title={mr.remarks}
                        >
                          {mr.remarks || "-"}
                        </TableCell>
                        <TableCell>
                          {formatCurrency(mr.cost_estimation)}
                        </TableCell>
                        <TableCell className="text-right">
                          <Button size="sm" onClick={() => handleSelectMR(mr)}>
                            Pilih
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            )}
          </div>
          <DialogFooter className="p-4 border-t bg-muted/20">
            <Button variant="outline" onClick={() => setIsLinkMROpen(false)}>
              Batal
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* --- CONFIRMATION DIALOG DIRECT PO --- */}
      <AlertDialog
        open={isConfirmDirectPOOpen}
        onOpenChange={setIsConfirmDirectPOOpen}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2 text-yellow-600">
              <AlertTriangle className="h-5 w-5" /> Konfirmasi Direct PO
            </AlertDialogTitle>
            <AlertDialogDescription>
              Anda akan membuat Purchase Order{" "}
              <strong>tanpa referensi Material Request (MR)</strong>.
              <br />
              <br />
              Apakah Anda yakin ingin melanjutkan? Pastikan ini sesuai dengan
              prosedur perusahaan.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Batal</AlertDialogCancel>
            <AlertDialogAction onClick={() => handleSubmit(null)}>
              Ya, Lanjutkan (Direct PO)
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* --- CONFIRMATION DIALOG UNLINK MR --- */}
      <AlertDialog
        open={isUnlinkDialogOpen}
        onOpenChange={setIsUnlinkDialogOpen}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2 text-destructive">
              <Unlink className="h-5 w-5" /> Putuskan Koneksi MR?
            </AlertDialogTitle>
            <AlertDialogDescription>
              Tindakan ini akan <strong>menghapus semua item</strong> yang
              diambil dari MR <strong>{mrData?.kode_mr}</strong> dan mengubah PO
              ini menjadi Direct PO.
              <br />
              <br />
              Apakah Anda yakin?
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Batal</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleUnlinkMR}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Putuskan & Reset
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

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

      {/* --- DIALOG TAMBAH BARANG (BARU) --- */}
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
              <div className="grid grid-cols-2 gap-4 text-sm">
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
                      <span className="text-xs bg-green-100 text-green-700 px-2 py-1 rounded-full flex items-center gap-1 w-fit border border-green-200">
                        <Tag className="h-3 w-3" /> Terdaftar di Master Barang
                      </span>
                    ) : (
                      <span className="text-xs bg-amber-100 text-amber-700 px-2 py-1 rounded-full flex items-center gap-1 w-fit border border-amber-200">
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

export default function CreatePOPage() {
  return (
    <Suspense fallback={<Skeleton className="h-screen w-full" />}>
      <CreatePOPageContent />
    </Suspense>
  );
}
