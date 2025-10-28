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
import { formatCurrency } from "@/lib/utils";
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
  LinkIcon,
} from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { BarangSearchCombobox } from "../../BarangSearchCombobox";
import {
  PurchaseOrderDetail,
  POItem,
  Barang,
  PurchaseOrderPayload,
  Attachment,
} from "@/type";
import { Label } from "@/components/ui/label";
import Link from "next/link";

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

function EditPOPageContent({ params }: { params: { id: string } }) {
  const router = useRouter();
  const poId = parseInt(params.id);

  const [poForm, setPoForm] = useState<PurchaseOrderDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [isUploading, setIsUploading] = useState(false);
  const [actionLoading, setActionLoading] = useState(false); // Mengganti nama state agar lebih jelas
  const [error, setError] = useState<string | null>(null);

  // State untuk Payment Term
  const [paymentTermType, setPaymentTermType] = useState("Termin");
  const [paymentTermDays, setPaymentTermDays] = useState("30");

  useEffect(() => {
    if (isNaN(poId)) {
      setError("ID Purchase Order tidak valid.");
      setLoading(false);
      return;
    }

    fetchPurchaseOrderById(poId)
      .then((data) => {
        setPoForm(data);
        // Inisialisasi state payment term dari data yang di-load
        if (data && data.payment_term) {
          if (data.payment_term.toLowerCase() === "cash") {
            setPaymentTermType("Cash");
            setPaymentTermDays("");
          } else {
            setPaymentTermType("Termin");
            const days = data.payment_term.match(/\d+/);
            setPaymentTermDays(days ? days[0] : "30");
          }
        }
      })
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false));
  }, [poId]);

  useEffect(() => {
    if (!poForm) return;
    const subtotal = poForm.items.reduce(
      (acc, item) => acc + item.qty * item.price,
      0
    );
    const grandTotal =
      subtotal -
      (poForm.discount || 0) +
      (poForm.tax || 0) +
      (poForm.postage || 0);
    setPoForm((prev) => (prev ? { ...prev, total_price: grandTotal } : null));
  }, [poForm?.items, poForm?.discount, poForm?.tax, poForm?.postage]);

  // Efek untuk update payment_term string
  useEffect(() => {
    if (!poForm) return; // Jangan jalankan jika poForm belum terisi
    let newPaymentTerm = "";
    if (paymentTermType === "Cash") {
      newPaymentTerm = "Cash";
    } else {
      newPaymentTerm = `Termin ${paymentTermDays} Hari`;
    }
    setPoForm((p) => (p ? { ...p, payment_term: newPaymentTerm } : null));
  }, [paymentTermType, paymentTermDays]);

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
      vendor_name: "",
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

  const handleSubmit = async () => {
    if (!poForm) return;

    const payload: Partial<PurchaseOrderPayload> = { ...poForm };
    // Hapus data relasi sebelum mengirim update
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
    e: React.ChangeEvent<HTMLInputElement>
  ) => {
    const file = e.target.files?.[0];
    if (!file || !poForm) return;

    setIsUploading(true);
    const toastId = toast.loading("Mengunggah lampiran...");
    const supabase = createClient();
    const filePath = `po/${poForm.kode_po}/${Date.now()}_${file.name}`;

    const { data: uploadData, error: uploadError } = await supabase.storage
      .from("mr") // Pastikan ini nama bucket yang benar
      .upload(filePath, file);

    if (uploadError) {
      toast.error("Gagal mengunggah file", {
        id: toastId,
        description: uploadError.message,
      });
      setIsUploading(false);
      return;
    }

    const newAttachment: Attachment = { name: file.name, url: uploadData.path };
    const updatedAttachments = [...(poForm.attachments || []), newAttachment];

    setPoForm({ ...poForm, attachments: updatedAttachments });
    toast.success("Lampiran berhasil diunggah!", { id: toastId });
    setIsUploading(false);
    e.target.value = "";
  };

  const removeAttachment = (indexToRemove: number) => {
    if (!poForm) return;
    const attachmentToRemove = poForm.attachments?.[indexToRemove];
    if (!attachmentToRemove) return;

    const updatedAttachments = poForm.attachments?.filter(
      (_, index) => index !== indexToRemove
    );
    setPoForm({ ...poForm, attachments: updatedAttachments });

    // Hapus dari storage di background
    const supabase = createClient();
    supabase.storage.from("mr").remove([attachmentToRemove.url]);

    toast.info(
      `Lampiran "${attachmentToRemove.name}" dihapus. Perubahan akan tersimpan saat Anda menekan 'Simpan Perubahan'.`
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
      <div className="col-span-12 text-center">
        <AlertTriangle className="mx-auto h-12 w-12 text-destructive" />
        <p className="mt-4">{error || "Data PO tidak ditemukan."}</p>
      </div>
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
            disabled={actionLoading || isUploading}
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
                value={poForm.material_requests.cost_center || "N/A"}
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
                    <TableHead>Vendor</TableHead>
                    <TableHead>Catatan</TableHead>
                    <TableHead>Link</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {poForm.material_requests.orders.map((order, index) => (
                    <TableRow key={index}>
                      <TableCell className="font-medium">
                        {order.name}
                      </TableCell>
                      <TableCell>
                        {order.qty} {order.uom}
                      </TableCell>
                      <TableCell>{order.vendor || "-"}</TableCell>
                      <TableCell className="max-w-xs truncate">
                        {order.note || "-"}
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
                        onChange={(e) =>
                          handleItemChange(index, "qty", e.target.value)
                        }
                        className="w-20"
                        min="1"
                      />
                    </TableCell>
                    <TableCell>
                      <Input
                        type="number"
                        value={item.price}
                        onChange={(e) =>
                          handleItemChange(index, "price", e.target.value)
                        }
                        placeholder="Harga"
                        min="0"
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
                value={poForm.shipping_address}
                onChange={(e) =>
                  setPoForm((p) =>
                    p ? { ...p, shipping_address: e.target.value } : null
                  )
                }
              />
            </div>
          </div>
        </Content>
        <Content title="Lampiran PO">
          <div className="space-y-4">
            <Input
              type="file"
              onChange={handleAttachmentUpload}
              disabled={isUploading}
            />
            {isUploading && (
              <div className="flex items-center text-sm text-muted-foreground">
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Mengunggah...
              </div>
            )}
            {poForm.attachments && poForm.attachments.length > 0 && (
              <ul className="space-y-2">
                {poForm.attachments.map((att, index) => (
                  <li
                    key={index}
                    className="flex items-center justify-between text-sm"
                  >
                    <span className="truncate">{att.name}</span>
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
        </Content>
        <Content title="Ringkasan Biaya">
          <div className="space-y-2">
            <div className="flex justify-between">
              <span>Subtotal</span>
              <span>
                {formatCurrency(
                  poForm.items.reduce((acc, item) => acc + item.total_price, 0)
                )}
              </span>
            </div>
            <div className="flex justify-between items-center">
              <Label>Diskon</Label>
              <Input
                type="number"
                value={poForm.discount || 0}
                onChange={(e) =>
                  setPoForm((p) =>
                    p ? { ...p, discount: Number(e.target.value) } : null
                  )
                }
                className="w-32 text-right"
                min="0"
              />
            </div>
            <div className="flex justify-between items-center">
              <Label>Pajak (PPN)</Label>
              <Input
                type="number"
                value={poForm.tax || 0}
                onChange={(e) =>
                  setPoForm((p) =>
                    p ? { ...p, tax: Number(e.target.value) } : null
                  )
                }
                className="w-32 text-right"
                min="0"
              />
            </div>
            <div className="flex justify-between items-center">
              <Label>Ongkos Kirim</Label>
              <Input
                type="number"
                value={poForm.postage || 0}
                onChange={(e) =>
                  setPoForm((p) =>
                    p ? { ...p, postage: Number(e.target.value) } : null
                  )
                }
                className="w-32 text-right"
                min="0"
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
