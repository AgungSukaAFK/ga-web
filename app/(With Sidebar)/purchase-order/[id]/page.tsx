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
  Edit as EditIcon, // <-- Impor ikon
  Plus, // <-- Impor ikon
  ExternalLink, // <-- Impor ikon
} from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import {
  PurchaseOrderDetail,
  POItem,
  Barang,
  PurchaseOrderPayload,
  Attachment,
  Order, // <-- Impor Tipe Order
} from "@/type";
import { Label } from "@/components/ui/label";
import Link from "next/link";
import { Checkbox } from "@/components/ui/checkbox";
import { CurrencyInput } from "@/components/ui/currency-input"; // <-- Impor CurrencyInput
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"; // <-- Impor Dialog
import { Combobox, ComboboxData } from "@/components/combobox"; // <-- Impor Combobox
import { BarangSearchCombobox } from "../BarangSearchCombobox";

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

// Data UoM untuk Dialog Item
const dataUoM: ComboboxData = [
  { label: "Pcs", value: "Pcs" },
  { label: "Unit", value: "Unit" },
  { label: "Set", value: "Set" },
  { label: "Box", value: "Box" },
  { label: "Rim", value: "Rim" },
  { label: "Roll", value: "Roll" },
];

function EditPOPageContent({ params }: { params: { id: string } }) {
  const router = useRouter();
  const poId = parseInt(params.id);

  const [poForm, setPoForm] = useState<PurchaseOrderDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [isUploadingPO, setIsUploadingPO] = useState(false);
  const [isUploadingFinance, setIsUploadingFinance] = useState(false);
  const [actionLoading, setActionLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [paymentTermType, setPaymentTermType] = useState("Termin");
  const [paymentTermDays, setPaymentTermDays] = useState("30");

  const [taxMode, setTaxMode] = useState<"percentage" | "manual">("percentage");
  const [taxPercentage, setTaxPercentage] = useState<number>(11);
  const [isTaxIncluded, setIsTaxIncluded] = useState<boolean>(false);

  // --- State untuk Dialog Edit Item PO ---
  const [openItemDialog, setOpenItemDialog] = useState(false);
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
        };
        setPoForm(initialData);

        if (initialData.payment_term) {
          if (initialData.payment_term.toLowerCase() === "cash") {
            setPaymentTermType("Cash");
            setPaymentTermDays("");
          } else {
            setPaymentTermType("Termin");
            const days = initialData.payment_term.match(/\d+/);
            setPaymentTermDays(days ? days[0] : "30");
          }
        }

        if (initialData.tax === 0 && initialData.items.length > 0) {
          setIsTaxIncluded(true);
          setTaxMode("manual");
        } else {
          setIsTaxIncluded(false);
          const subtotalSaatLoad = initialData.items.reduce(
            (acc, item) => acc + item.qty * item.price,
            0
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

  // --- REVISI: Logika Kalkulasi Pajak/Total ---
  useEffect(() => {
    if (!poForm) return;
    const subtotal = poForm.items.reduce(
      (acc, item) => acc + item.qty * item.price,
      0
    );

    let calculatedTax = 0;
    if (isTaxIncluded) {
      calculatedTax = 0;
    } else {
      if (taxMode === "percentage") {
        calculatedTax = subtotal * (taxPercentage / 100);
      } else {
        calculatedTax = poForm.tax || 0;
      }
    }

    const grandTotal =
      subtotal - (poForm.discount || 0) + calculatedTax + (poForm.postage || 0);

    setPoForm((prev) => {
      if (!prev) return null;
      const newTax =
        taxMode !== "manual" || isTaxIncluded ? calculatedTax : prev.tax;
      if (prev.tax !== newTax || prev.total_price !== grandTotal) {
        return {
          ...prev,
          tax: newTax,
          total_price: grandTotal,
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
  ]);

  useEffect(() => {
    if (!poForm || taxMode !== "manual" || isTaxIncluded) return;

    const subtotal = poForm.items.reduce(
      (acc, item) => acc + item.qty * item.price,
      0
    );
    const grandTotal =
      subtotal -
      (poForm.discount || 0) +
      (poForm.tax || 0) +
      (poForm.postage || 0);

    if (poForm.total_price !== grandTotal) {
      setPoForm((prev) => (prev ? { ...prev, total_price: grandTotal } : null));
    }
  }, [poForm?.tax, taxMode, isTaxIncluded]);
  // --- AKHIR REVISI LOGIKA ---

  useEffect(() => {
    if (!poForm) return;
    let newPaymentTerm = "";
    if (paymentTermType === "Cash") {
      newPaymentTerm = "Cash";
    } else {
      newPaymentTerm = `Termin ${paymentTermDays} Hari`;
    }
    if (poForm.payment_term !== newPaymentTerm) {
      setPoForm((p) => (p ? { ...p, payment_term: newPaymentTerm } : null));
    }
  }, [paymentTermType, paymentTermDays, poForm?.payment_term]);

  const handleItemChange = (
    index: number,
    field: keyof POItem,
    value: string | number
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

  const addItem = (barang: Barang) => {
    if (!poForm) return;
    const newItem: POItem = {
      barang_id: barang.id,
      part_number: barang.part_number,
      name: barang.part_name || "",
      qty: 1,
      uom: barang.uom || "Pcs",
      price: 0,
      total_price: 0,
      vendor_name: barang.vendor || "",
    };
    setPoForm((prev) =>
      prev ? { ...prev, items: [...prev.items, newItem] } : null
    );
  };

  const removeItem = (index: number) => {
    if (!poForm) return;
    setPoForm((prev) =>
      prev ? { ...prev, items: prev.items.filter((_, i) => i !== index) } : null
    );
  };

  // --- Handler Dialog Item ---
  const handleOpenEditItemDialog = (index: number) => {
    if (!poForm) return;
    setEditingItemIndex(index);
    setItemFormData(poForm.items[index]);
    setOpenItemDialog(true);
  };

  const handleSaveItemChanges = () => {
    if (!poForm || editingItemIndex === null) return;
    if (
      !itemFormData.name.trim() ||
      itemFormData.qty <= 0 ||
      !itemFormData.uom.trim() ||
      itemFormData.price < 0
    ) {
      toast.error("Nama, Qty (>0), UoM, dan Harga (>=0) harus valid.");
      return;
    }

    const updatedItems = [...poForm.items];
    const updatedItem = {
      ...itemFormData,
      total_price: itemFormData.qty * itemFormData.price,
    };
    updatedItems[editingItemIndex] = updatedItem;

    setPoForm({ ...poForm, items: updatedItems });
    setOpenItemDialog(false);
    setEditingItemIndex(null);
  };
  // --- Akhir Handler Dialog ---

  const handleSubmit = async () => {
    if (!poForm) return;

    const payload: Partial<PurchaseOrderPayload> = {
      ...poForm,
      attachments: Array.isArray(poForm.attachments) ? poForm.attachments : [],
    };
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

  const handleVendorChange = (
    field: "name" | "address" | "contact_person",
    value: string
  ) => {
    setPoForm((prev) => {
      if (!prev) return null;
      return {
        ...prev,
        vendor_details: {
          name: prev.vendor_details?.name || "",
          address: prev.vendor_details?.address || "",
          contact_person: prev.vendor_details?.contact_person || "",
          [field]: value,
        },
      };
    });
  };

  const handleAttachmentUpload = async (
    e: React.ChangeEvent<HTMLInputElement>,
    type: "po" | "finance"
  ) => {
    // ... (Fungsi ini tetap sama)
    const file = e.target.files?.[0];
    if (!file || !poForm) return;

    const setIsLoading =
      type === "po" ? setIsUploadingPO : setIsUploadingFinance;
    setIsLoading(true);

    const toastId = toast.loading(
      `Mengunggah lampiran ${type.toUpperCase()}...`
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
      prev ? { ...prev, attachments: updatedAttachments } : null
    );
    toast.success(`Lampiran ${type.toUpperCase()} berhasil diunggah!`, {
      id: toastId,
    });
    setIsLoading(false);
    e.target.value = "";
  };

  const removeAttachment = (indexToRemove: number) => {
    // ... (Fungsi ini tetap sama)
    if (!poForm || !Array.isArray(poForm.attachments)) return;
    const attachmentToRemove = poForm.attachments?.[indexToRemove];
    if (!attachmentToRemove) return;

    const updatedAttachments = poForm.attachments?.filter(
      (_, index) => index !== indexToRemove
    );
    setPoForm((prev) =>
      prev ? { ...prev, attachments: updatedAttachments } : null
    );

    const supabase = createClient();
    supabase.storage.from("mr").remove([attachmentToRemove.url]);

    toast.info(
      `Lampiran "${attachmentToRemove.name}" dihapus. Perubahan akan tersimpan saat Anda menekan 'Simpan Perubahan'.`
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
    0
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
              <InfoItem
                icon={Building2}
                label="Cost Center"
                value={
                  poForm.material_requests.cost_center_id?.toString() ||
                  (poForm.material_requests as any).cost_center || // Fallback
                  "N/A"
                }
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

        {/* --- REVISI: Tabel Item Referensi MR --- */}
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
                            Number(order.qty) * order.estimasi_harga
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
                    )
                  )}
                </TableBody>
              </Table>
            </div>
          </Content>
        )}
        {/* --- AKHIR REVISI --- */}

        <Content title="Detail Item Pesanan">
          <div className="overflow-x-auto">
            <Table className="min-w-[900px]">
              <TableHeader>
                <TableRow>
                  <TableHead>Part Number</TableHead>
                  <TableHead>Nama Barang</TableHead>
                  <TableHead>Qty</TableHead>
                  <TableHead>Harga</TableHead>
                  <TableHead>Total</TableHead>
                  <TableHead>Vendor</TableHead>
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
                      {/* Qty tidak bisa diedit di sini, hanya di dialog */}
                      {item.qty} {item.uom}
                    </TableCell>
                    {/* Harga tidak bisa diedit di sini, hanya di dialog */}
                    <TableCell>{formatCurrency(item.price)}</TableCell>
                    <TableCell>{formatCurrency(item.total_price)}</TableCell>
                    <TableCell>{item.vendor_name}</TableCell>
                    <TableCell className="space-x-1">
                      <Button
                        variant="outline"
                        size="icon"
                        className="h-8 w-8"
                        onClick={() => handleOpenEditItemDialog(index)}
                      >
                        <EditIcon className="w-4 h-4" />
                      </Button>
                      <Button
                        variant="destructive"
                        size="icon"
                        className="h-8 w-8"
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
              placeholder="Masukkan catatan internal untuk tim purchasing..."
              rows={4}
            />
          </div>
        </Content>
      </div>

      <div className="col-span-12 lg:col-span-5 flex flex-col gap-6">
        <Content title="Vendor Utama & Pengiriman">
          <div className="space-y-4">
            <div>
              <Label className="text-sm font-medium">Nama Vendor Utama</Label>
              <Input
                value={poForm.vendor_details?.name || ""}
                onChange={(e) => handleVendorChange("name", e.target.value)}
              />
            </div>
            <div>
              <Label className="text-sm font-medium">
                Kontak Person Vendor
              </Label>
              <Input
                value={poForm.vendor_details?.contact_person || ""}
                onChange={(e) =>
                  handleVendorChange("contact_person", e.target.value)
                }
              />
            </div>
            <div>
              <Label className="text-sm font-medium">Alamat Vendor</Label>
              <Textarea
                value={poForm.vendor_details?.address || ""}
                onChange={(e) => handleVendorChange("address", e.target.value)}
              />
            </div>
            <hr />
            <div>
              <Label className="text-sm font-medium">Payment Term</Label>
              <div className="flex gap-2 mt-1">
                <Select
                  value={paymentTermType}
                  onValueChange={(value) => setPaymentTermType(value)}
                >
                  <SelectTrigger className="w-1/2">
                    <SelectValue placeholder="Pilih tipe..." />
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
                      placeholder="... hari"
                      className="pr-12"
                      min="0"
                    />
                    <span className="absolute right-3 top-1/2 -translate-y-1/2 text-sm text-muted-foreground">
                      Hari
                    </span>
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
                    p ? { ...p, shipping_address: e.target.value } : null
                  )
                }
              />
            </div>
          </div>
        </Content>

        {/* --- REVISI: Konten Lampiran (terpisah) --- */}
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

        {/* --- REVISI: Ringkasan Biaya dengan CurrencyInput --- */}
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
                onValueChange={(numValue) =>
                  setPoForm((p) => (p ? { ...p, discount: numValue } : null))
                }
                className="w-32"
                disabled={actionLoading || isUploadingPO || isUploadingFinance}
              />
            </div>
            <div className="space-y-2 pt-2 border-t">
              <div className="flex items-center space-x-2">
                <Checkbox
                  id="include-tax-edit"
                  checked={isTaxIncluded}
                  onCheckedChange={(c) => setIsTaxIncluded(c as boolean)}
                  disabled={
                    actionLoading || isUploadingPO || isUploadingFinance
                  }
                />
                <Label
                  htmlFor="include-tax-edit"
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
                    disabled={
                      actionLoading || isUploadingPO || isUploadingFinance
                    }
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
                        disabled={
                          actionLoading || isUploadingPO || isUploadingFinance
                        }
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
                          setPoForm((p) => (p ? { ...p, tax: numValue } : null))
                        }
                        className="w-full"
                        disabled={
                          actionLoading || isUploadingPO || isUploadingFinance
                        }
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
                onValueChange={(numValue) =>
                  setPoForm((p) => (p ? { ...p, postage: numValue } : null))
                }
                className="w-32"
                disabled={actionLoading || isUploadingPO || isUploadingFinance}
              />
            </div>
            <hr className="my-2" />
            <div className="flex justify-between font-bold text-lg">
              <span>Grand Total</span>
              <span>{formatCurrency(poForm.total_price)}</span>
            </div>
          </div>
        </Content>
      </div>

      {/* --- REVISI: Dialog Edit Item PO dengan CurrencyInput --- */}
      <Dialog open={openItemDialog} onOpenChange={setOpenItemDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Edit Item PO</DialogTitle>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="grid grid-cols-4 items-center gap-4">
              <Label className="text-right">Part Number</Label>
              <p className="col-span-3 font-mono text-sm p-2 border rounded-md bg-muted/50">
                {itemFormData.part_number || "-"}
              </p>
            </div>
            <div className="grid grid-cols-4 items-center gap-4">
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
            <div className="grid grid-cols-4 items-center gap-4">
              <Label htmlFor="itemUomDlg" className="text-right">
                UoM
              </Label>
              <div className="col-span-3">
                <Combobox
                  data={dataUoM}
                  onChange={(v) =>
                    setItemFormData((prev) => ({ ...prev, uom: v }))
                  }
                  defaultValue={itemFormData.uom}
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
            <div className="grid grid-cols-4 items-center gap-4">
              <Label htmlFor="itemPriceDlg" className="text-right">
                Harga Satuan
              </Label>
              <CurrencyInput
                id="itemPriceDlg"
                className="col-span-3"
                value={itemFormData.price}
                onValueChange={(value) =>
                  setItemFormData((prev) => ({
                    ...prev,
                    price: value,
                  }))
                }
              />
            </div>
            <div className="grid grid-cols-4 items-center gap-4">
              <Label htmlFor="itemVendorNameDlg" className="text-right">
                Vendor Item
              </Label>
              <Input
                id="itemVendorNameDlg"
                className="col-span-3"
                value={itemFormData.vendor_name}
                onChange={(e) =>
                  setItemFormData((prev) => ({
                    ...prev,
                    vendor_name: e.target.value,
                  }))
                }
                placeholder="Nama Vendor Item"
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
    </>
  );
}

// Ini adalah satu-satunya default export
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
