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
import { formatCurrency } from "@/lib/utils";
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
  Paperclip,
  ChevronsUpDown,
  ExternalLink,
  RefreshCcw, // Ikon untuk ganti barang
  Search,
} from "lucide-react";
import { User } from "@supabase/supabase-js";
import { createClient } from "@/lib/supabase/client";
import {
  MaterialRequest,
  POItem,
  PurchaseOrderPayload,
  Vendor,
  StoredVendorDetails,
  Attachment,
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
} from "@/components/ui/dialog";
import { searchVendors } from "@/services/vendorService";
import { BarangSearchCombobox } from "../BarangSearchCombobox"; // Pastikan path import benar
import Link from "next/link";

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
      <PopoverContent className="w-[400px] p-0">
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
                  value={`${vendor.kode_vendor} - ${vendor.nama_vendor}`}
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
  const mrId = searchParams.get("mrId");
  const supabase = createClient();

  const [mrData, setMrData] = useState<MaterialRequest | null>(null);
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // State untuk Partial Selection
  const [selectedOrderIndices, setSelectedOrderIndices] = useState<number[]>(
    []
  );

  // State untuk Fitur Ganti Barang (Revisi Baru)
  const [isReplaceDialogOpen, setIsReplaceDialogOpen] = useState(false);
  const [replacingIndex, setReplacingIndex] = useState<number | null>(null);

  const [isUploadingPO, setIsUploadingPO] = useState(false);
  const [isUploadingFinance, setIsUploadingFinance] = useState(false);

  const [paymentTermType, setPaymentTermType] = useState("Termin");
  const [paymentTermDays, setPaymentTermDays] = useState("30");

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
  });

  const [taxMode, setTaxMode] = useState<"percentage" | "manual">("percentage");
  const [taxPercentage, setTaxPercentage] = useState<number>(11);
  const [isTaxIncluded, setIsTaxIncluded] = useState<boolean>(false);

  // Helper: Get Cost Center Name
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
        if (!mrId)
          throw new Error("ID Material Request tidak ditemukan di URL.");

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
          throw new Error("Profil Anda tidak lengkap.");
        }

        const [newPoCode, fetchedMr] = await Promise.all([
          generatePoCode(profile.company, profile.lokasi),
          fetchMaterialRequestById(parseInt(mrId)),
        ]);

        if (!fetchedMr) throw new Error("Data MR tidak ditemukan.");

        setMrData(fetchedMr as any);
        setPoForm((prev) => ({
          ...prev,
          kode_po: newPoCode,
          items: [],
          shipping_address: fetchedMr.tujuan_site || prev.shipping_address,
          attachments: [],
        }));
      } catch (err: any) {
        toast.error("Gagal memuat data", { description: err.message });
        setError(err.message);
      } finally {
        setLoading(false);
      }
    };
    initializeForm();
  }, [mrId]);

  // --- Effect: Update PO Items when Selection Changes ---
  useEffect(() => {
    if (!mrData) return;

    const newItems: POItem[] = selectedOrderIndices.map((index) => {
      const order = mrData.orders[index];

      // Cek apakah item ini sudah ada di poForm.items (untuk preserve qty/price yg sudah diedit)
      const existingItem = poForm.items.find(
        (i) => i.barang_id === order.barang_id && order.barang_id !== null // Cek ID valid
      );

      // Jika item ini dulunya "asal ketik" (barang_id null/0), kita tetap buat baru
      // agar bisa diedit/diganti nantinya.
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
  }, [selectedOrderIndices, mrData]); // Jangan masukkan poForm.items dependency

  // --- Logika Kalkulasi Pajak & Total ---
  useEffect(() => {
    const subtotal = poForm.items.reduce(
      (acc, item) => acc + item.qty * item.price,
      0
    );
    let calculatedTax = 0;
    if (!isTaxIncluded) {
      if (taxMode === "percentage")
        calculatedTax = subtotal * (taxPercentage / 100);
      else calculatedTax = poForm.tax || 0;
    }
    const grandTotal =
      subtotal - (poForm.discount || 0) + calculatedTax + (poForm.postage || 0);

    setPoForm((prev) => ({
      ...prev,
      tax: taxMode !== "manual" || isTaxIncluded ? calculatedTax : prev.tax,
      total_price: grandTotal,
    }));
  }, [
    poForm.items,
    poForm.discount,
    poForm.postage,
    taxMode,
    taxPercentage,
    isTaxIncluded,
  ]);

  useEffect(() => {
    if (taxMode === "manual" && !isTaxIncluded) {
      const subtotal = poForm.items.reduce(
        (acc, item) => acc + item.qty * item.price,
        0
      );
      const grandTotal =
        subtotal -
        (poForm.discount || 0) +
        (poForm.tax || 0) +
        (poForm.postage || 0);
      setPoForm((prev) => ({ ...prev, total_price: grandTotal }));
    }
  }, [poForm.tax, taxMode, isTaxIncluded]);

  useEffect(() => {
    if (paymentTermType === "Cash") {
      setPoForm((p) => ({ ...p, payment_term: "Cash" }));
    } else {
      setPoForm((p) => ({
        ...p,
        payment_term: `Termin ${paymentTermDays} Hari`,
      }));
    }
  }, [paymentTermType, paymentTermDays]);

  // --- Handlers ---
  const handleItemChange = (
    index: number,
    field: keyof POItem,
    value: string | number
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

  // --- Handler Ganti Barang (Fitur Baru) ---
  const handleOpenReplaceDialog = (index: number) => {
    setReplacingIndex(index);
    setIsReplaceDialogOpen(true);
  };

  const handleReplaceItem = (barang: Barang) => {
    if (replacingIndex === null) return;

    const newItems = [...poForm.items];
    const item = newItems[replacingIndex];

    // Update data item dengan data Master Barang
    item.barang_id = barang.id;
    item.part_number = barang.part_number;
    item.name = barang.part_name || item.name;
    item.uom = barang.uom || item.uom;
    // Kita biarkan qty dan price seperti sebelumnya (atau reset jika perlu)

    setPoForm({ ...poForm, items: newItems });
    setIsReplaceDialogOpen(false);
    setReplacingIndex(null);
    toast.success("Item berhasil diganti dengan data Master Barang.");
  };

  const handleSubmit = async () => {
    if (!currentUser || !mrData) return;
    if (!poForm.vendor_details || !poForm.vendor_details.vendor_id) {
      toast.error("Vendor Utama wajib dipilih.");
      return;
    }
    if (poForm.items.length === 0) {
      toast.error("Pilih minimal satu item dari daftar MR.");
      return;
    }
    setLoading(true);
    try {
      await createPurchaseOrder(
        poForm,
        parseInt(mrId!),
        currentUser.id,
        mrData.company_code
      );
      toast.success("PO berhasil diajukan!");
      router.push("/purchase-order");
    } catch (err: any) {
      toast.error("Gagal membuat PO", { description: err.message });
    } finally {
      setLoading(false);
    }
  };

  // Attachment Handlers
  const handleAttachmentUpload = async (
    e: React.ChangeEvent<HTMLInputElement>,
    type: "po" | "finance"
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

  // Selection Helper
  const toggleSelection = (index: number) => {
    setSelectedOrderIndices((prev) =>
      prev.includes(index) ? prev.filter((i) => i !== index) : [...prev, index]
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

  if (loading && !mrData)
    return (
      <div className="col-span-12">
        <Skeleton className="h-[80vh] w-full" />
      </div>
    );
  if (error) return <div className="col-span-12 text-center">{error}</div>;

  const subtotal = poForm.items.reduce(
    (acc, item) => acc + item.total_price,
    0
  );
  const poAttachments =
    poForm.attachments?.filter((a) => !a.type || a.type === "po") || [];
  const financeAttachments =
    poForm.attachments?.filter((a) => a.type === "finance") || [];

  return (
    <>
      <div className="col-span-12 flex flex-wrap justify-between items-center gap-4">
        <div>
          <h1 className="text-3xl font-bold">Buat Purchase Order (Partial)</h1>
          <p className="text-muted-foreground">
            PO:{" "}
            <span className="font-semibold text-primary">{poForm.kode_po}</span>
          </p>
        </div>
        <Button onClick={handleSubmit} disabled={loading}>
          {loading ? (
            <Loader2 className="animate-spin mr-2 h-4 w-4" />
          ) : (
            <Send className="mr-2 h-4 w-4" />
          )}{" "}
          Ajukan PO
        </Button>
      </div>

      {/* --- KOLOM KIRI: MR INFO & ITEM SELECTION --- */}
      <div className="col-span-12 lg:col-span-7 flex flex-col gap-6">
        {/* 1. Referensi MR (Informasi Lengkap) */}
        {mrData && (
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
        )}

        {/* 2. Pilih Item dari MR */}
        <Content
          title="Pilih Item dari Material Request"
          description="Pilih item yang akan dimasukkan ke dalam PO ini (Partial PO)."
          size="lg"
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
          <div className="border rounded-md overflow-hidden">
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
                      selectedOrderIndices.includes(index) ? "bg-muted/50" : ""
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

        {/* 3. Tabel Item PO Final (Editable + Replace) */}
        {poForm.items.length > 0 && (
          <Content title="Rincian Item Purchase Order (Final)">
            <div className="overflow-x-auto">
              <Table className="min-w-[600px]">
                <TableHeader>
                  <TableRow>
                    <TableHead>Nama Barang</TableHead>
                    <TableHead>Qty PO</TableHead>
                    <TableHead>Harga Satuan</TableHead>
                    <TableHead>Total</TableHead>
                    <TableHead className="w-[50px]">Aksi</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {poForm.items.map((item, index) => (
                    <TableRow key={index}>
                      <TableCell>
                        <div className="font-medium">{item.name}</div>
                        <div className="text-xs text-muted-foreground font-mono">
                          {item.part_number}
                        </div>
                        {/* Indikator jika item belum terlink ke Master Barang */}
                        {!item.barang_id && (
                          <span className="text-[10px] text-amber-600 bg-amber-100 px-1 rounded">
                            Manual Input
                          </span>
                        )}
                      </TableCell>
                      <TableCell>
                        <Input
                          type="number"
                          value={item.qty}
                          className="w-24"
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
                      <TableCell>
                        <Button
                          variant="ghost"
                          size="icon"
                          title="Ganti dengan Master Barang"
                          onClick={() => handleOpenReplaceDialog(index)}
                        >
                          <RefreshCcw className="h-4 w-4 text-blue-600" />
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </Content>
        )}

        <Content title="Catatan PO">
          <Textarea
            placeholder="Tambahkan catatan untuk Vendor atau Internal..."
            value={poForm.notes}
            onChange={(e) =>
              setPoForm((prev) => ({ ...prev, notes: e.target.value }))
            }
          />
        </Content>
      </div>

      {/* --- KOLOM KANAN: VENDOR & FINANCE --- */}
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
            <div>
              <Label className="text-sm font-medium">Payment Term</Label>
              <div className="flex gap-2 mt-1">
                <Select
                  value={paymentTermType}
                  onValueChange={setPaymentTermType}
                >
                  <SelectTrigger className="w-1/2">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="Termin">Termin</SelectItem>
                    <SelectItem value="Cash">Cash</SelectItem>
                  </SelectContent>
                </Select>
                {paymentTermType === "Termin" && (
                  <div className="w-1/2 relative">
                    <Input
                      type="number"
                      value={paymentTermDays}
                      onChange={(e) => setPaymentTermDays(e.target.value)}
                      className="pr-12"
                    />
                    <span className="absolute right-3 top-1/2 -translate-y-1/2 text-sm text-muted-foreground">
                      Hari
                    </span>
                  </div>
                )}
              </div>
            </div>

            <div>
              <Label>Alamat Pengiriman</Label>
              <Textarea
                value={poForm.shipping_address}
                onChange={(e) =>
                  setPoForm((p) => ({
                    ...p,
                    shipping_address: e.target.value,
                  }))
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

        <Content title="Ringkasan Biaya">
          <div className="space-y-4">
            <div className="flex justify-between">
              <span>Subtotal</span>
              <span>{formatCurrency(subtotal)}</span>
            </div>
            <div className="flex justify-between items-center">
              <Label>Diskon</Label>
              <CurrencyInput
                value={poForm.discount}
                onValueChange={(v) => setPoForm((p) => ({ ...p, discount: v }))}
                className="w-32"
              />
            </div>

            {/* Bagian Pajak */}
            <div className="space-y-2 pt-2 border-t">
              <div className="flex items-center space-x-2">
                <Checkbox
                  id="include-tax-create"
                  checked={isTaxIncluded}
                  onCheckedChange={(c) => setIsTaxIncluded(c as boolean)}
                  disabled={loading}
                />
                <Label
                  htmlFor="include-tax-create"
                  className="text-sm font-medium leading-none"
                >
                  Harga Item Sudah Termasuk PPN?
                </Label>
              </div>
              {!isTaxIncluded && (
                <div className="pl-6 space-y-3 pt-2 animate-in fade-in">
                  <Label className="text-sm font-medium">
                    Metode Pajak (PPN)
                  </Label>
                  <Select
                    value={taxMode}
                    onValueChange={(v) => setTaxMode(v as any)}
                    disabled={loading}
                  >
                    <SelectTrigger className="w-full">
                      <SelectValue placeholder="Pilih metode..." />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="percentage">Persentase (%)</SelectItem>
                      <SelectItem value="manual">Manual (Rp)</SelectItem>
                    </SelectContent>
                  </Select>
                  {taxMode === "percentage" && (
                    <div className="relative animate-in fade-in">
                      <Input
                        type="number"
                        value={taxPercentage}
                        onChange={(e) =>
                          setTaxPercentage(Number(e.target.value) || 0)
                        }
                        className="w-full text-right pr-6"
                        min="0"
                        step="0.01"
                        disabled={loading}
                      />
                      <span className="absolute right-2 top-1/2 -translate-y-1/2 text-sm text-muted-foreground">
                        %
                      </span>
                    </div>
                  )}
                  {taxMode === "manual" && (
                    <div className="relative animate-in fade-in">
                      <CurrencyInput
                        value={poForm.tax}
                        onValueChange={(numValue) =>
                          setPoForm((p) => ({ ...p, tax: numValue }))
                        }
                        className="w-full"
                        disabled={loading}
                      />
                    </div>
                  )}
                </div>
              )}
            </div>

            <div className="flex justify-between items-center pt-2 border-t">
              <Label>Ongkos Kirim</Label>
              <CurrencyInput
                value={poForm.postage}
                onValueChange={(v) => setPoForm((p) => ({ ...p, postage: v }))}
                className="w-32"
              />
            </div>
            <div className="flex justify-between font-bold text-lg border-t pt-2">
              <span>Grand Total</span>
              <span>{formatCurrency(poForm.total_price)}</span>
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
