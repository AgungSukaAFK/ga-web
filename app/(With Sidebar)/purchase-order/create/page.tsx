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
import { Skeleton } from "@/components/ui/skeleton";
import { toast } from "sonner";
import {
  createPurchaseOrder,
  fetchMaterialRequestById,
  generatePoCode,
  fetchPurchaseOrderById,
} from "@/services/purchaseOrderService";
import { formatCurrency } from "@/lib/utils";
import { AlertTriangle, Save, Send, Trash2 } from "lucide-react";
import { User } from "@supabase/supabase-js";
import { createClient } from "@/lib/supabase/client";
import { BarangSearchCombobox } from "../BarangSearchCombobox";
import {
  Barang,
  MaterialRequestForPO,
  POItem,
  PurchaseOrderPayload,
} from "@/type";

function CreatePOPageContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const mrId = searchParams.get("mrId");
  const repeatPoId = searchParams.get("repeatPoId");

  const [mrData, setMrData] = useState<MaterialRequestForPO | null>(null);
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [poForm, setPoForm] = useState<
    Omit<PurchaseOrderPayload, "mr_id" | "user_id">
  >({
    kode_po: "Generating...",
    status: "Draft",
    items: [],
    currency: "IDR",
    discount: 0,
    tax: 0,
    postage: 0,
    total_price: 0,
    payment_term: "Net 30",
    shipping_address: "Kantor Pusat GMI, Jakarta",
    notes: "",
    vendor_details: { name: "", address: "", contact_person: "" },
  });

  useEffect(() => {
    const initializeForm = async () => {
      try {
        setLoading(true);
        const supabase = createClient();
        const {
          data: { user },
        } = await supabase.auth.getUser();
        if (!user) throw new Error("User tidak otentikasi");
        setCurrentUser(user);

        const newPoCode = await generatePoCode();
        let initialItems: POItem[] = [];
        let originalPoId: number | null = null;
        let fetchedMr: MaterialRequestForPO | null = null;

        if (mrId) {
          fetchedMr = await fetchMaterialRequestById(parseInt(mrId));
          initialItems = []; // Dikosongkan, harus dipilih dari master data
        } else if (repeatPoId) {
          const oldPo = await fetchPurchaseOrderById(parseInt(repeatPoId));
          if (!oldPo)
            throw new Error("PO yang akan di-repeat tidak ditemukan.");
          initialItems = oldPo.items;
          originalPoId = oldPo.id;
          toast.info(`Item dari ${oldPo.kode_po} telah dimuat.`);
        } else {
          throw new Error("Sumber untuk PO (MR atau PO lama) tidak ditemukan.");
        }

        setMrData(fetchedMr);
        setPoForm((prev) => ({
          ...prev,
          kode_po: newPoCode,
          items: initialItems,
          repeated_from_po_id: originalPoId,
        }));
      } catch (err: any) {
        toast.error("Gagal memuat data", { description: err.message });
        setError(err.message);
      } finally {
        setLoading(false);
      }
    };
    initializeForm();
  }, [mrId, repeatPoId]);

  useEffect(() => {
    const subtotal = poForm.items.reduce(
      (acc, item) => acc + item.qty * item.price,
      0
    );
    const grandTotal = subtotal - poForm.discount + poForm.tax + poForm.postage;
    setPoForm((prev) => ({ ...prev, total_price: grandTotal }));
  }, [poForm.items, poForm.discount, poForm.tax, poForm.postage]);

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

  // FIX: Fungsi 'addItem' sekarang menerima objek 'Barang'
  const addItem = (barang: Barang) => {
    const newItem: POItem = {
      barang_id: barang.id,
      part_number: barang.part_number,
      name: barang.part_name,
      qty: 1,
      uom: barang.uom || "Pcs",
      price: 0,
      total_price: 0,
      vendor_name: "", // Dikosongkan untuk diisi manual per item jika perlu
    };
    setPoForm((prev) => ({ ...prev, items: [...prev.items, newItem] }));
  };

  const removeItem = (index: number) => {
    setPoForm((prev) => ({
      ...prev,
      items: prev.items.filter((_, i) => i !== index),
    }));
  };

  const handleSubmit = async (status: "Draft" | "Ordered") => {
    if (!currentUser) {
      toast.error("Data tidak lengkap untuk membuat PO.");
      return;
    }

    const payload: PurchaseOrderPayload = {
      ...poForm,
      status,
      mr_id: mrData ? mrData.id : null,
      user_id: currentUser.id,
      discount: Number(poForm.discount) || 0,
      tax: Number(poForm.tax) || 0,
      postage: Number(poForm.postage) || 0,
    };

    const toastId = toast.loading(`Menyimpan PO sebagai ${status}...`);
    try {
      await createPurchaseOrder(payload);
      toast.success("Purchase Order berhasil dibuat!", { id: toastId });
      router.push("/purchase-order");
    } catch (err: any) {
      toast.error("Gagal membuat PO", {
        id: toastId,
        description: err.message,
      });
    }
  };

  const handleVendorChange = (
    field: "name" | "address" | "contact_person",
    value: string
  ) => {
    setPoForm((prev) => ({
      ...prev,
      vendor_details: {
        name: prev.vendor_details?.name || "",
        address: prev.vendor_details?.address || "",
        contact_person: prev.vendor_details?.contact_person || "",
        [field]: value,
      },
    }));
  };

  if (loading)
    return (
      <div className="col-span-12">
        <Skeleton className="h-[80vh] w-full" />
      </div>
    );
  if (error)
    return (
      <div className="col-span-12 text-center">
        <AlertTriangle className="mx-auto h-12 w-12 text-destructive" />
        <p className="mt-4">{error}</p>
      </div>
    );

  return (
    <>
      <div className="col-span-12 flex flex-wrap justify-between items-center gap-4">
        <div>
          <h1 className="text-3xl font-bold">Buat Purchase Order Baru</h1>
          <p className="text-muted-foreground">
            PO:{" "}
            <span className="font-semibold text-primary">{poForm.kode_po}</span>
            {mrData && ` | Ref. MR: ${mrData.kode_mr}`}
            {poForm.repeated_from_po_id && ` | Repeat Order`}
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={() => handleSubmit("Draft")}>
            <Save className="mr-2 h-4 w-4" /> Simpan Draft
          </Button>
          <Button onClick={() => handleSubmit("Ordered")}>
            <Send className="mr-2 h-4 w-4" /> Buat PO
          </Button>
        </div>
      </div>

      {mrData && (
        <div className="col-span-12">
          <Content title={`Referensi Item dari ${mrData.kode_mr}`}>
            <ul className="list-disc list-inside text-sm text-muted-foreground">
              {mrData.orders.map((order, index) => (
                <li key={index}>
                  {order.qty} {order.uom} - {order.name}
                </li>
              ))}
            </ul>
          </Content>
        </div>
      )}

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
      </div>

      <div className="col-span-12 lg:col-span-4 space-y-6">
        <Content title="Vendor Utama & Pengiriman">
          <div className="space-y-4">
            <div>
              <label className="text-sm font-medium">Nama Vendor Utama</label>
              <Input
                value={poForm.vendor_details?.name || ""}
                onChange={(e) => handleVendorChange("name", e.target.value)}
                placeholder="PT Sejahtera Abadi"
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
                placeholder="Bpk. Budi (0812...)"
              />
            </div>
            <div>
              <label className="text-sm font-medium">Alamat Vendor</label>
              <Textarea
                value={poForm.vendor_details?.address || ""}
                onChange={(e) => handleVendorChange("address", e.target.value)}
                placeholder="Jl. Industri No. 5..."
              />
            </div>
            <hr />
            <div>
              <label className="text-sm font-medium">Payment Term</label>
              <Input
                value={poForm.payment_term}
                onChange={(e) =>
                  setPoForm((p) => ({ ...p, payment_term: e.target.value }))
                }
              />
            </div>
            <div>
              <label className="text-sm font-medium">Alamat Pengiriman</label>
              <Textarea
                value={poForm.shipping_address}
                onChange={(e) =>
                  setPoForm((p) => ({ ...p, shipping_address: e.target.value }))
                }
              />
            </div>
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
                  setPoForm((p) => ({ ...p, discount: Number(e.target.value) }))
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
                  setPoForm((p) => ({ ...p, tax: Number(e.target.value) }))
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
                  setPoForm((p) => ({ ...p, postage: Number(e.target.value) }))
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

export default function CreatePOPage() {
  return (
    <Suspense
      fallback={
        <div className="col-span-12">
          <Skeleton className="h-[80vh] w-full" />
        </div>
      }
    >
      <CreatePOPageContent />
    </Suspense>
  );
}
