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
  AlertTriangle,
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
} from "lucide-react";
import { User } from "@supabase/supabase-js";
import { createClient } from "@/lib/supabase/client";
import { BarangSearchCombobox } from "../BarangSearchCombobox";
import {
  Barang,
  MaterialRequest,
  POItem,
  PurchaseOrderPayload,
  Order,
  Attachment,
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
import { searchVendors } from "@/services/vendorService";

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

// --- Main Component ---
function CreatePOPageContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const mrId = searchParams.get("mrId");
  const supabase = createClient();

  const [mrData, setMrData] = useState<any>(null);
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

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

        setMrData(fetchedMr);
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

  // ... (Logika Kalkulasi Pajak & Total - Tidak Berubah) ...
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
  }, [
    poForm.tax,
    taxMode,
    isTaxIncluded,
    poForm.items,
    poForm.discount,
    poForm.postage,
  ]);

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

  const addItem = (barang: Barang) => {
    const newItem: POItem = {
      barang_id: barang.id,
      part_number: barang.part_number,
      name: barang.part_name || "",
      qty: 1,
      uom: barang.uom || "Pcs",
      price: 0,
      total_price: 0,
      vendor_name: "",
    };
    setPoForm((prev) => ({ ...prev, items: [...prev.items, newItem] }));
  };

  const removeItem = (index: number) => {
    setPoForm((prev) => ({
      ...prev,
      items: prev.items.filter((_, i) => i !== index),
    }));
  };

  const handleSubmit = async () => {
    if (!currentUser || !mrData) return;
    if (!poForm.vendor_details || !poForm.vendor_details.vendor_id) {
      toast.error("Vendor Utama wajib dipilih.");
      return;
    }
    if (poForm.items.length === 0) {
      toast.error("Harap tambahkan minimal satu item.");
      return;
    }
    if (poForm.kode_po === "Generating...") {
      toast.error("Kode PO sedang dibuat.");
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

  // ... Attachment Handlers (Tetap Sama) ...
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

  // --- REVISI: Helper untuk Nama Cost Center ---
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
  // ---------------------------------------------

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
          <h1 className="text-3xl font-bold">Buat Purchase Order Baru</h1>
          <p className="text-muted-foreground">
            PO:{" "}
            <span className="font-semibold text-primary">{poForm.kode_po}</span>
          </p>
        </div>
        <div className="flex gap-2">
          <Button onClick={handleSubmit} disabled={loading}>
            {loading ? (
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            ) : (
              <Send className="mr-2 h-4 w-4" />
            )}
            Ajukan
          </Button>
        </div>
      </div>

      <div className="col-span-12 lg:col-span-7 flex flex-col gap-6">
        {/* Info Referensi MR */}
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

              {/* REVISI: Menggunakan Helper untuk Cost Center */}
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
                <InfoItem icon={Info} label="Remarks" value={mrData.remarks} />
              </div>
            </div>
          </Content>
        )}

        {/* Tabel Item PO */}
        <Content title="Item Purchase Order">
          <div className="overflow-x-auto">
            <Table className="min-w-[800px]">
              <TableHeader>
                <TableRow>
                  <TableHead>Part Number</TableHead>
                  <TableHead>Nama Barang</TableHead>
                  <TableHead>Qty</TableHead>
                  <TableHead>Harga Satuan</TableHead>
                  <TableHead>Total</TableHead>
                  {/* REVISI: Kolom Vendor HAPUS */}
                  <TableHead>Aksi</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {poForm.items.map((item, index) => (
                  <TableRow key={index}>
                    <TableCell>
                      <span className="font-mono text-xs">
                        {item.part_number}
                      </span>
                    </TableCell>
                    <TableCell>{item.name}</TableCell>
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
                        placeholder="Rp 0"
                        onValueChange={(v) =>
                          handleItemChange(index, "price", v)
                        }
                      />
                    </TableCell>
                    <TableCell>{formatCurrency(item.total_price)}</TableCell>
                    <TableCell>
                      <Button
                        variant="destructive"
                        size="icon"
                        onClick={() => removeItem(index)}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
          <div className="mt-4">
            <BarangSearchCombobox onSelect={addItem} />
          </div>
        </Content>
      </div>

      {/* Sidebar Kanan */}
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
                  setPoForm((p) => ({ ...p, shipping_address: e.target.value }))
                }
              />
            </div>
          </div>
        </Content>

        {/* Lampiran PO */}
        <Content title="Lampiran PO">
          <div className="space-y-4">
            <Input
              type="file"
              onChange={(e) => handleAttachmentUpload(e, "po")}
              disabled={isUploadingPO}
            />
            <ul className="space-y-2">
              {poAttachments.map((att, i) => (
                <li
                  key={i}
                  className="flex justify-between items-center text-sm bg-muted p-2 rounded"
                >
                  <span className="truncate max-w-[200px]">{att.name}</span>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() =>
                      removeAttachment(poForm.attachments?.indexOf(att) ?? -1)
                    }
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </li>
              ))}
            </ul>
          </div>
        </Content>

        {/* Lampiran Finance */}
        <Content title="Lampiran Finance">
          <div className="space-y-4">
            <Input
              type="file"
              onChange={(e) => handleAttachmentUpload(e, "finance")}
              disabled={isUploadingFinance}
            />
            <ul className="space-y-2">
              {financeAttachments.map((att, i) => (
                <li
                  key={i}
                  className="flex justify-between items-center text-sm bg-muted p-2 rounded"
                >
                  <span className="truncate max-w-[200px]">{att.name}</span>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() =>
                      removeAttachment(poForm.attachments?.indexOf(att) ?? -1)
                    }
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </li>
              ))}
            </ul>
          </div>
        </Content>

        {/* Ringkasan Biaya */}
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

            {/* --- Bagian Pajak (PPN) yang Diperbarui --- */}
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
                  Harga Item Sudah Termasuk Pajak (PPN)?
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
            {/* --- Akhir Bagian Pajak (PPN) --- */}

            <div className="flex justify-between items-center">
              <Label>Ongkir</Label>
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
    </>
  );
}

const InfoItem = ({ icon: Icon, label, value }: any) => (
  <div className="flex items-start gap-3">
    <Icon className="h-5 w-5 text-muted-foreground mt-1 flex-shrink-0" />
    <div>
      <p className="text-sm text-muted-foreground">{label}</p>
      <p className="font-medium">{value}</p>
    </div>
  </div>
);

export default function CreatePOPage() {
  return (
    <Suspense fallback={<Skeleton className="h-screen w-full" />}>
      <CreatePOPageContent />
    </Suspense>
  );
}
