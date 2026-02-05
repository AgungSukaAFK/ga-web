// src/app/(With Sidebar)/purchase-order/edit/[id]/page.tsx

"use client";

import { use, useEffect, useState, Suspense } from "react";
import { useRouter } from "next/navigation";
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
  fetchPurchaseOrderById,
  updatePurchaseOrder,
} from "@/services/purchaseOrderService";
import { formatCurrency, cn } from "@/lib/utils";
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
  ExternalLink,
  ChevronsUpDown,
  Plus,
  Eye,
  RefreshCcw,
  FileText,
} from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { BarangSearchCombobox } from "../../BarangSearchCombobox";
import {
  PurchaseOrderDetail,
  POItem,
  Barang,
  PurchaseOrderPayload,
  Attachment,
  Order,
  Vendor,
  StoredVendorDetails,
} from "@/type";
import { Label } from "@/components/ui/label";
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
import { searchVendors } from "@/services/vendorService";

// --- KONFIGURASI PPH ---
const PPH_OPTIONS = [
  { label: "Tidak Ada PPH", value: "none", rate: 0 },
  { label: "PPH 21 (NPWP) - 1%", value: "pph21_npwp", rate: 1.0 },
  { label: "PPH 21 (Tanpa NPWP) - 1.5%", value: "pph21_non_npwp", rate: 1.5 },
  { label: "PPH 23 (NPWP) - 2%", value: "pph23_npwp", rate: 2.0 },
  { label: "PPH 23 (Tanpa NPWP) - 4%", value: "pph23_non_npwp", rate: 4.0 },
];

// Komponen helper kecil untuk menampilkan info
const InfoItem = ({
  icon: Icon,
  label,
  value,
  isBlock = false,
}: {
  icon: React.ElementType;
  label: string;
  value: string;
  isBlock?: boolean;
}) => (
  <div className={isBlock ? "flex flex-col gap-1" : "grid grid-cols-3 gap-x-2"}>
    <dt className="text-sm text-muted-foreground col-span-1 flex items-center gap-2">
      <Icon className="h-4 w-4" />
      {label}
    </dt>
    <dd className="text-sm font-semibold col-span-2 whitespace-pre-wrap">
      {value}
    </dd>
  </div>
);

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
                  <div className="flex flex-col">
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

function EditPOPageContent({ params }: { params: { id: string } }) {
  const router = useRouter();
  const poId = parseInt(params.id);

  const [poForm, setPoForm] = useState<PurchaseOrderDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [isUploadingPO, setIsUploadingPO] = useState(false);
  const [isUploadingFinance, setIsUploadingFinance] = useState(false);
  const [actionLoading, setActionLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Dialog States
  const [isReplaceDialogOpen, setIsReplaceDialogOpen] = useState(false);
  const [replacingIndex, setReplacingIndex] = useState<number | null>(null);
  const [isViewItemOpen, setIsViewItemOpen] = useState(false);
  const [viewItemIndex, setViewItemIndex] = useState<number | null>(null);

  // Payment Term Logic
  const [paymentTermType, setPaymentTermType] = useState("Termin");
  const [paymentTermDays, setPaymentTermDays] = useState("30");
  const [dpPercentage, setDpPercentage] = useState<number>(30);

  // Tax States
  const [taxMode, setTaxMode] = useState<"percentage" | "manual">("percentage");
  const [taxPercentage, setTaxPercentage] = useState<number>(11);
  const [isTaxIncluded, setIsTaxIncluded] = useState<boolean>(false);

  // PPH State
  const [pphType, setPphType] = useState<string>("none");

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

        // --- Init Payment Term ---
        if (initialData.payment_term) {
          if (initialData.payment_term.toLowerCase() === "cash") {
            setPaymentTermType("Cash");
            setPaymentTermDays("");
          } else if (initialData.payment_term.startsWith("DP")) {
            // Try parse "DP 30% - Pelunasan 70%"
            setPaymentTermType("DP_BP");
            const match = initialData.payment_term.match(/DP (\d+)%/);
            if (match) setDpPercentage(parseInt(match[1]));
          } else {
            setPaymentTermType("Termin");
            const days = initialData.payment_term.match(/\d+/);
            setPaymentTermDays(days ? days[0] : "30");
          }
        }

        // --- Init PPH ---
        if (initialData.pph_type) {
          setPphType(initialData.pph_type);
        }

        // --- Init PPN ---
        if (initialData.tax === 0 && initialData.items.length > 0) {
          // Asumsi jika tax 0 tapi ada item, mungkin inclusive atau emang 0
          // Tapi disini logicnya agak tricky, kita default ke logic sebelumnya
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

  // --- Logika Kalkulasi Pajak/Total (Updated) ---
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
      calculatedTax = 0; // Tax 0 karena sudah include di harga item (display only purpose mostly)
    } else {
      if (taxMode === "percentage") {
        calculatedTax = taxableAmount * (taxPercentage / 100);
      } else {
        calculatedTax = poForm.tax || 0;
      }
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

      // Compare old values with new values
      if (
        prev.tax !== newTax ||
        prev.total_price !== grandTotal ||
        prev.pph_type !== (pphType === "none" ? null : pphType) ||
        prev.pph_amount !== pphAmount
      ) {
        return {
          ...prev,
          tax: newTax,
          total_price: grandTotal,
          pph_type: pphType === "none" ? null : pphType,
          pph_rate: selectedPph.rate,
          pph_amount: pphAmount,
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
    pphType, // Dependency baru
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

  // Update Payment Term String
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

    if (poForm.payment_term !== newPaymentTerm) {
      setPoForm((p) => (p ? { ...p, payment_term: newPaymentTerm } : null));
    }
  }, [paymentTermType, paymentTermDays, dpPercentage, poForm?.payment_term]);

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

  // --- Handlers Baru: Add, Replace, View ---
  const handleAddManualItem = () => {
    if (!poForm) return;
    setPoForm((prev) =>
      prev
        ? {
            ...prev,
            items: [
              ...prev.items,
              {
                barang_id: 0,
                part_number: "",
                name: "",
                qty: 1,
                uom: "Pcs",
                price: 0,
                total_price: 0,
                vendor_name: "",
              },
            ],
          }
        : null,
    );
    toast.info("Item baru ditambahkan.");
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

  const handleSubmit = async () => {
    if (!poForm) return;
    // Validasi Vendor Utama
    if (!poForm.vendor_details || !poForm.vendor_details.vendor_id) {
      toast.error("Vendor Utama wajib dipilih.");
      return;
    }

    // FIX: Gunakan non-null assertion (!) untuk vendor_details agar sesuai tipe
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
      toast.success("Purchase Order berhasil diperbarui!", { id: toastId });
      router.push(`/purchase-order/${poId}`);
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
    type: "po" | "finance",
  ) => {
    const file = e.target.files?.[0];
    if (!file || !poForm) return;

    const setIsLoading =
      type === "po" ? setIsUploadingPO : setIsUploadingFinance;
    setIsLoading(true);

    const toastId = toast.loading(
      `Mengunggah lampiran ${type.toUpperCase()}...`,
    );
    const supabase = createClient();
    const filePath = `po/${poForm.kode_po}/${type}/${Date.now()}_${file.name}`;

    const { data: uploadData, error: uploadError } = await supabase.storage
      .from("mr")
      .upload(filePath, file);

    if (uploadError) {
      toast.error(`Gagal mengunggah file ${type.toUpperCase()}`, {
        id: toastId,
        description: uploadError.message,
      });
      setIsLoading(false);
      return;
    }

    const newAttachment: Attachment = {
      name: file.name,
      url: uploadData.path,
      type: type,
    };

    const currentAttachments = Array.isArray(poForm.attachments)
      ? poForm.attachments
      : [];
    const updatedAttachments = [...currentAttachments, newAttachment];

    setPoForm((prev) =>
      prev ? { ...prev, attachments: updatedAttachments } : null,
    );
    toast.success(`Lampiran ${type.toUpperCase()} berhasil diunggah!`, {
      id: toastId,
    });
    setIsLoading(false);
    e.target.value = "";
  };

  const removeAttachment = (indexToRemove: number) => {
    if (!poForm || !Array.isArray(poForm.attachments)) return;
    const attachmentToRemove = poForm.attachments?.[indexToRemove];
    if (!attachmentToRemove) return;

    const updatedAttachments = poForm.attachments?.filter(
      (_, index) => index !== indexToRemove,
    );
    setPoForm((prev) =>
      prev ? { ...prev, attachments: updatedAttachments } : null,
    );

    const supabase = createClient();
    supabase.storage.from("mr").remove([attachmentToRemove.url]);

    toast.info(
      `Lampiran "${attachmentToRemove.name}" dihapus. Perubahan akan tersimpan saat Anda menekan 'Simpan Perubahan'.`,
    );
  };

  const poAttachments =
    poForm?.attachments?.filter((att) => !att.type || att.type === "po") || [];
  const financeAttachments =
    poForm?.attachments?.filter((att) => att.type === "finance") || [];

  if (loading)
    return (
      <div className="col-span-12">
        <Skeleton className="h-[80vh] w-full" />
      </div>
    );
  if (error || !poForm)
    return (
      <div className="col-span-12 text-center">
        <AlertTriangle className="mx-auto h-12 w-12 text-destructive" />
        <p className="mt-4">{error || "Data PO tidak ditemukan."}</p>
      </div>
    );

  const subtotal = poForm.items.reduce(
    (acc, item) => acc + item.qty * item.price,
    0,
  );

  return (
    <>
      <div className="col-span-12 flex flex-wrap justify-between items-center gap-4">
        <div>
          <h1 className="text-3xl font-bold">Edit Purchase Order</h1>
          <p className="text-muted-foreground">
            PO:{" "}
            <span className="font-semibold text-primary">{poForm.kode_po}</span>
            {poForm.material_requests &&
              ` | Ref. MR: ${poForm.material_requests.kode_mr}`}
          </p>
        </div>
        <div className="flex gap-2">
          <Button
            onClick={handleSubmit}
            disabled={actionLoading || isUploadingPO || isUploadingFinance}
          >
            {actionLoading ? (
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            ) : (
              <Save className="mr-2 h-4 w-4" />
            )}
            Simpan Perubahan
          </Button>
        </div>
      </div>

      <div className="col-span-12 lg:col-span-7 flex flex-col gap-6">
        {poForm.material_requests && (
          <Content
            title={`Informasi Referensi dari ${poForm.material_requests.kode_mr}`}
          >
            <div className="grid grid-cols-1 md:grid-cols-2 gap-x-6 gap-y-4">
              <InfoItem
                icon={CircleUser}
                label="Pembuat MR"
                value={
                  poForm.material_requests.users_with_profiles?.nama || "N/A"
                }
              />
              <InfoItem
                icon={Building}
                label="Departemen MR"
                value={poForm.material_requests.department}
              />
              <InfoItem
                icon={Tag}
                label="Kategori MR"
                value={poForm.material_requests.kategori}
              />
              <InfoItem
                icon={DollarSign}
                label="Estimasi Biaya MR"
                value={formatCurrency(poForm.material_requests.cost_estimation)}
              />
              {/* REVISI: Tampilkan Nama Cost Center */}
              <InfoItem
                icon={Building2}
                label="Cost Center"
                value={getCostCenterName(poForm.material_requests)}
              />
              <InfoItem
                icon={Truck}
                label="Tujuan Site (MR)"
                value={poForm.material_requests.tujuan_site || "N/A"}
              />
              <div className="md:col-span-2">
                <InfoItem
                  icon={Info}
                  label="Remarks MR"
                  value={poForm.material_requests.remarks}
                  isBlock
                />
              </div>
            </div>
          </Content>
        )}

        {poForm.material_requests && (
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
                  {(poForm.material_requests.orders as Order[]).map(
                    (order, index) => (
                      <TableRow key={index}>
                        <TableCell className="font-medium">
                          {order.name}
                        </TableCell>
                        <TableCell>
                          {order.qty} {order.uom}
                        </TableCell>
                        <TableCell className="text-right">
                          {formatCurrency(order.estimasi_harga)}
                        </TableCell>
                        <TableCell className="text-right font-medium">
                          {formatCurrency(
                            Number(order.qty) * order.estimasi_harga,
                          )}
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
                    ),
                  )}
                </TableBody>
              </Table>
            </div>
          </Content>
        )}

        <Content
          title="Detail Item Pesanan (PO)"
          cardAction={
            <Button variant="outline" size="sm" onClick={handleAddManualItem}>
              <Plus className="mr-2 h-4 w-4" /> Tambah Item
            </Button>
          }
        >
          <div className="overflow-x-auto">
            <Table className="min-w-[900px]">
              <TableHeader>
                <TableRow>
                  <TableHead>Nama Barang</TableHead>
                  <TableHead>Qty</TableHead>
                  <TableHead>Harga</TableHead>
                  <TableHead>Total</TableHead>
                  {/* REVISI: Kolom Vendor Dihapus, diganti Aksi */}
                  <TableHead className="text-right">Aksi</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {poForm.items.map((item, index) => (
                  <TableRow key={index}>
                    <TableCell>
                      {/* Editable name if manual input */}
                      {item.barang_id === 0 ? (
                        <Input
                          value={item.name}
                          onChange={(e) => {
                            const newItems = [...poForm.items];
                            newItems[index].name = e.target.value;
                            setPoForm((p) =>
                              p ? { ...p, items: newItems } : null,
                            );
                          }}
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
                        <span className="text-[10px] text-amber-600 bg-amber-100 px-1 rounded inline-block mt-1">
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

        <Content title="Catatan Internal">
          <div>
            <Label className="text-sm font-medium sr-only">
              Catatan Internal
            </Label>
            <Textarea
              value={poForm.notes || ""}
              onChange={(e) =>
                setPoForm((p) => (p ? { ...p, notes: e.target.value } : null))
              }
              placeholder="Masukkan catatan internal..."
              rows={4}
            />
          </div>
        </Content>
      </div>

      <div className="col-span-12 lg:col-span-5 flex flex-col gap-6">
        <Content title="Vendor Utama & Pengiriman">
          <div className="space-y-4">
            {/* REVISI: Gunakan Search Combobox */}
            <div>
              <Label className="mb-1 block">Pilih Vendor Utama</Label>
              <VendorSearchCombobox poForm={poForm} setPoForm={setPoForm} />
            </div>

            {/* Detail Vendor Read-Only */}
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
            <div>
              <Label className="text-sm font-medium">Payment Term</Label>
              <div className="flex flex-col gap-3 mt-1">
                <Select
                  value={paymentTermType}
                  onValueChange={(value) => setPaymentTermType(value)}
                >
                  <SelectTrigger className="w-full">
                    <SelectValue placeholder="Pilih tipe..." />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="Termin">Termin</SelectItem>
                    <SelectItem value="Cash">Cash</SelectItem>
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
                value={poForm.shipping_address || ""}
                onChange={(e) =>
                  setPoForm((p) =>
                    p ? { ...p, shipping_address: e.target.value } : null,
                  )
                }
              />
            </div>
          </div>
        </Content>

        {/* --- Konten Lampiran PO (Sama) --- */}
        <Content title="Lampiran PO">
          <div className="space-y-4">
            <Label htmlFor="po-attachment-upload">Tambah Lampiran PO</Label>
            <Input
              id="po-attachment-upload"
              type="file"
              onChange={(e) => handleAttachmentUpload(e, "po")}
              disabled={isUploadingPO || isUploadingFinance || actionLoading}
            />
            {isUploadingPO && (
              <div className="flex items-center text-sm text-muted-foreground">
                <Loader2 className="mr-2 h-4 w-4 animate-spin" /> Mengunggah...
              </div>
            )}
            {poAttachments.length > 0 ? (
              <ul className="space-y-2">
                {poAttachments.map((att, index) => {
                  const originalIndex =
                    poForm.attachments?.findIndex((a) => a.url === att.url) ??
                    -1;
                  if (originalIndex === -1) return null;
                  return (
                    <li
                      key={originalIndex}
                      className="flex items-center justify-between text-sm p-2 bg-muted/50 rounded"
                    >
                      <a
                        href={`https://xdkjqwpvmyqcggpwghyi.supabase.co/storage/v1/object/public/mr/${att.url}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="flex items-center gap-2 truncate hover:underline text-primary"
                      >
                        <Paperclip className="h-4 w-4 flex-shrink-0" />
                        <span className="truncate">{att.name}</span>
                      </a>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-6 w-6 flex-shrink-0"
                        onClick={() => removeAttachment(originalIndex)}
                        disabled={
                          actionLoading || isUploadingPO || isUploadingFinance
                        }
                      >
                        <Trash2 className="h-4 w-4 text-destructive" />
                      </Button>
                    </li>
                  );
                })}
              </ul>
            ) : (
              <p className="text-sm text-muted-foreground text-center pt-2">
                Belum ada lampiran PO.
              </p>
            )}
          </div>
        </Content>

        {/* --- Konten Lampiran Finance (Sama) --- */}
        <Content title="Lampiran Finance">
          <div className="space-y-4">
            <Label htmlFor="finance-attachment-upload">
              Tambah Lampiran Finance
            </Label>
            <Input
              id="finance-attachment-upload"
              type="file"
              onChange={(e) => handleAttachmentUpload(e, "finance")}
              disabled={isUploadingPO || isUploadingFinance || actionLoading}
            />
            {isUploadingFinance && (
              <div className="flex items-center text-sm text-muted-foreground">
                <Loader2 className="mr-2 h-4 w-4 animate-spin" /> Mengunggah...
              </div>
            )}
            {financeAttachments.length > 0 ? (
              <ul className="space-y-2">
                {financeAttachments.map((att, index) => {
                  const originalIndex =
                    poForm.attachments?.findIndex((a) => a.url === att.url) ??
                    -1;
                  if (originalIndex === -1) return null;
                  return (
                    <li
                      key={originalIndex}
                      className="flex items-center justify-between text-sm p-2 bg-muted/50 rounded"
                    >
                      <a
                        href={`https://xdkjqwpvmyqcggpwghyi.supabase.co/storage/v1/object/public/mr/${att.url}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="flex items-center gap-2 truncate hover:underline text-primary"
                      >
                        <Paperclip className="h-4 w-4 flex-shrink-0" />
                        <span className="truncate">{att.name}</span>
                      </a>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-6 w-6 flex-shrink-0"
                        onClick={() => removeAttachment(originalIndex)}
                        disabled={
                          actionLoading || isUploadingPO || isUploadingFinance
                        }
                      >
                        <Trash2 className="h-4 w-4 text-destructive" />
                      </Button>
                    </li>
                  );
                })}
              </ul>
            ) : (
              <p className="text-sm text-muted-foreground text-center pt-2">
                Belum ada lampiran finance.
              </p>
            )}
          </div>
        </Content>

        {/* --- Ringkasan Biaya --- */}
        <Content title="Ringkasan Biaya">
          <div className="space-y-4">
            {/* Subtotal */}
            <div className="flex justify-between text-sm font-medium">
              <span className="text-muted-foreground">Subtotal Item</span>
              <span>{formatCurrency(subtotal)}</span>
            </div>

            {/* Input Diskon */}
            <div className="flex justify-between items-center">
              <Label className="text-xs">Input Diskon (Rp)</Label>
              <CurrencyInput
                value={poForm.discount}
                onValueChange={(numValue) =>
                  setPoForm((p) => (p ? { ...p, discount: numValue } : null))
                }
                className="w-36 h-9 text-right"
                disabled={actionLoading}
              />
            </div>

            {/* PPN Section */}
            <div className="space-y-2 pt-2 border-t border-dashed">
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
                    <Select
                      value={taxMode}
                      onValueChange={(v) => setTaxMode(v as any)}
                      disabled={actionLoading}
                    >
                      <SelectTrigger className="w-full h-9 text-xs">
                        <SelectValue placeholder="Metode PPN" />
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
            </div>

            {/* Input PPH */}
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
                onValueChange={(numValue) =>
                  setPoForm((p) => (p ? { ...p, postage: numValue } : null))
                }
                className="w-36 h-9 text-right"
                disabled={actionLoading}
              />
            </div>

            {/* --- VISUALISASI PERHITUNGAN --- */}
            <div className="bg-muted/30 p-4 rounded-md space-y-2 mt-4 text-sm border">
              <div className="flex justify-between">
                <span className="text-muted-foreground">Subtotal</span>
                <span>{formatCurrency(subtotal)}</span>
              </div>

              {(poForm.discount || 0) > 0 && (
                <div className="flex justify-between text-red-600">
                  <span>- Diskon</span>
                  <span>({formatCurrency(poForm.discount)})</span>
                </div>
              )}

              {(poForm.pph_amount || 0) > 0 && (
                <div className="flex justify-between text-red-600">
                  <span>
                    - PPH ({PPH_OPTIONS.find((o) => o.value === pphType)?.rate}
                    %)
                  </span>
                  <span>({formatCurrency(poForm.pph_amount || 0)})</span>
                </div>
              )}

              {(poForm.tax || 0) > 0 && (
                <div className="flex justify-between text-blue-600">
                  <span>+ PPN {isTaxIncluded ? "(Included)" : ""}</span>
                  <span>{formatCurrency(poForm.tax || 0)}</span>
                </div>
              )}

              {(poForm.postage || 0) > 0 && (
                <div className="flex justify-between text-blue-600">
                  <span>+ Ongkir</span>
                  <span>{formatCurrency(poForm.postage || 0)}</span>
                </div>
              )}

              <div className="border-t border-slate-300 my-2 pt-2">
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

          {viewItemIndex !== null && poForm && poForm.items[viewItemIndex] && (
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

export default function EditPOPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const resolvedParams = use(params);
  return (
    <Suspense
      fallback={
        <div className="col-span-12">
          <Skeleton className="h-[80vh] w-full" />
        </div>
      }
    >
      <EditPOPageContent params={resolvedParams} />
    </Suspense>
  );
}
