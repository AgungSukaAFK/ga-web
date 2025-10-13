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
import { Skeleton } from "@/components/ui/skeleton";
import { toast } from "sonner";
import {
  fetchPurchaseOrderById,
  POItem,
  PurchaseOrderDetail,
  PurchaseOrderPayload,
  updatePurchaseOrder,
  Barang,
} from "@/services/purchaseOrderService";
import { formatCurrency } from "@/lib/utils";
import { AlertTriangle, Save, Send, Trash2 } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { BarangSearchCombobox } from "../../BarangSearchCombobox";

function EditPOPageContent({ params }: { params: { id: string } }) {
  const router = useRouter();
  const poId = parseInt(params.id);

  const [poForm, setPoForm] = useState<PurchaseOrderDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [isUploading, setIsUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (isNaN(poId)) {
      setError("ID Purchase Order tidak valid.");
      setLoading(false);
      return;
    }

    fetchPurchaseOrderById(poId)
      .then((data) => {
        setPoForm(data);
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
      name: barang.part_name,
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

  const handleSubmit = async (status: "Draft" | "Ordered") => {
    if (!poForm) return;

    const payload: Partial<PurchaseOrderPayload> = { ...poForm, status };
    delete (payload as any).material_requests;
    delete (payload as any).users_with_profiles;
    delete (payload as any).created_at;
    delete (payload as any).updated_at;
    delete (payload as any).id;

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

    const { error: uploadError } = await supabase.storage
      .from("mr")
      .upload(filePath, file);

    if (uploadError) {
      toast.error("Gagal mengunggah file", {
        id: toastId,
        description: uploadError.message,
      });
      setIsUploading(false);
      return;
    }

    const newAttachment = { name: file.name, url: filePath };
    const updatedAttachments = [...(poForm.attachments || []), newAttachment];

    setPoForm({ ...poForm, attachments: updatedAttachments });
    toast.success("Lampiran berhasil diunggah!", { id: toastId });
    setIsUploading(false);
    e.target.value = "";
  };

  const removeAttachment = (indexToRemove: number) => {
    if (!poForm) return;
    const updatedAttachments = poForm.attachments?.filter(
      (_, index) => index !== indexToRemove
    );
    setPoForm({ ...poForm, attachments: updatedAttachments });
    toast.success(
      "Lampiran dihapus dari daftar. Perubahan akan tersimpan saat Anda menyimpan PO."
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
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={() => handleSubmit("Draft")}>
            <Save className="mr-2 h-4 w-4" /> Simpan Draft
          </Button>
          <Button onClick={() => handleSubmit("Ordered")}>
            <Send className="mr-2 h-4 w-4" /> Finalisasi PO
          </Button>
        </div>
      </div>

      <div className="col-span-12 lg:col-span-8 space-y-6">
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
            <label className="text-sm font-medium sr-only">
              Catatan Internal
            </label>
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

      <div className="col-span-12 lg:col-span-4 space-y-6">
        <Content title="Vendor Utama & Pengiriman">
          <div className="space-y-4">
            <div>
              <label className="text-sm font-medium">Nama Vendor Utama</label>
              <Input
                value={poForm.vendor_details?.name || ""}
                onChange={(e) => handleVendorChange("name", e.target.value)}
              />
            </div>
            <div>
              <label className="text-sm font-medium">
                Kontak Person Vendor
              </label>
              <Input
                value={poForm.vendor_details?.contact_person || ""}
                onChange={(e) =>
                  handleVendorChange("contact_person", e.target.value)
                }
              />
            </div>
            <div>
              <label className="text-sm font-medium">Alamat Vendor</label>
              <Textarea
                value={poForm.vendor_details?.address || ""}
                onChange={(e) => handleVendorChange("address", e.target.value)}
              />
            </div>
            <hr />
            <div>
              <label className="text-sm font-medium">Payment Term</label>
              <Input
                value={poForm.payment_term}
                onChange={(e) =>
                  setPoForm((p) =>
                    p ? { ...p, payment_term: e.target.value } : null
                  )
                }
              />
            </div>
            <div>
              <label className="text-sm font-medium">Alamat Pengiriman</label>
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
              <label>Diskon</label>
              <Input
                type="number"
                value={poForm.discount}
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
              <label>Pajak (PPN)</label>
              <Input
                type="number"
                value={poForm.tax}
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
              <label>Ongkos Kirim</label>
              <Input
                type="number"
                value={poForm.postage}
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
