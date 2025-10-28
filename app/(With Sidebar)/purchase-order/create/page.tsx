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
} from "lucide-react";
import { User } from "@supabase/supabase-js";
import { createClient } from "@/lib/supabase/client";
import { BarangSearchCombobox } from "../BarangSearchCombobox";
import { Barang, MaterialRequest, POItem, PurchaseOrderPayload } from "@/type";
import { Label } from "@/components/ui/label";
import Link from "next/link";

// Tipe data MR yang diambil untuk halaman ini (termasuk relasi)
type MRData = MaterialRequest & {
  users_with_profiles: { nama: string } | null;
};

function CreatePOPageContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const mrId = searchParams.get("mrId");

  const [mrData, setMrData] = useState<MRData | null>(null);
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // State untuk Payment Term
  const [paymentTermType, setPaymentTermType] = useState("Termin");
  const [paymentTermDays, setPaymentTermDays] = useState("30");

  const [poForm, setPoForm] = useState<
    Omit<
      PurchaseOrderPayload,
      "mr_id" | "user_id" | "status" | "approvals" | "company_code"
    >
  >({
    kode_po: "Generating...",
    items: [],
    currency: "IDR",
    discount: 0,
    tax: 0,
    postage: 0,
    total_price: 0,
    payment_term: "Termin 30 Hari", // Default
    shipping_address: "Kantor Pusat GMI, Jakarta",
    notes: "",
    vendor_details: { name: "", address: "", contact_person: "" },
  });

  useEffect(() => {
    const initializeForm = async () => {
      try {
        setLoading(true);
        if (!mrId) {
          throw new Error("ID Material Request tidak ditemukan di URL.");
        }

        const supabase = createClient();
        const {
          data: { user },
        } = await supabase.auth.getUser();
        if (!user) throw new Error("User tidak otentikasi");
        setCurrentUser(user);

        // REVISI: Ambil profil user (pembuat PO)
        const { data: profile } = await supabase
          .from("profiles")
          .select("department, lokasi, company")
          .eq("id", user.id)
          .single();

        if (
          !profile ||
          !profile.department ||
          !profile.lokasi ||
          !profile.company
        ) {
          throw new Error(
            "Profil Anda tidak lengkap (departemen/lokasi/company). Harap hubungi admin."
          );
        }

        // REVISI: Gunakan info profil untuk generate kode
        const [newPoCode, fetchedMr] = await Promise.all([
          generatePoCode(profile.company, profile.lokasi),
          fetchMaterialRequestById(parseInt(mrId)),
        ]);

        if (!fetchedMr) {
          throw new Error("Data Material Request tidak dapat ditemukan.");
        }

        setMrData(fetchedMr as MRData);
        setPoForm((prev) => ({
          ...prev,
          kode_po: newPoCode,
          items: [],
          shipping_address: fetchedMr.tujuan_site || prev.shipping_address, // Ambil tujuan site dari MR
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

  useEffect(() => {
    const subtotal = poForm.items.reduce(
      (acc, item) => acc + item.qty * item.price,
      0
    );
    const grandTotal = subtotal - poForm.discount + poForm.tax + poForm.postage;
    setPoForm((prev) => ({ ...prev, total_price: grandTotal }));
  }, [poForm.items, poForm.discount, poForm.tax, poForm.postage]);

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
    if (!currentUser || !mrData) {
      toast.error("Data tidak lengkap untuk membuat PO.");
      return;
    }
    if (poForm.items.length === 0) {
      toast.error("Harap tambahkan minimal satu item ke dalam PO.");
      return;
    }
    if (!poForm.payment_term.trim()) {
      toast.error("Payment term wajib diisi.");
      return;
    }

    setLoading(true);
    const toastId = toast.loading("Mengajukan PO untuk validasi...");

    try {
      // REVISI: Panggil createPurchaseOrder dengan 4 argumen
      await createPurchaseOrder(
        poForm,
        parseInt(mrData.id),
        currentUser.id,
        mrData.company_code
      );
      toast.success("PO berhasil diajukan & menunggu validasi!", {
        id: toastId,
      });
      router.push("/purchase-order");
    } catch (err: any) {
      toast.error("Gagal membuat PO", {
        id: toastId,
        description: err.message,
      });
    } finally {
      setLoading(false);
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
          </p>
        </div>
        <div className="flex gap-2">
          <Button onClick={handleSubmit} disabled={loading}>
            {loading ? (
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            ) : (
              <Send className="mr-2 h-4 w-4" />
            )}
            Ajukan untuk Validasi
          </Button>
        </div>
      </div>

      <div className="col-span-12 lg:col-span-7 flex flex-col gap-6">
        {mrData && (
          <Content title={`Informasi Referensi dari ${mrData.kode_mr}`}>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-x-6 gap-y-4">
              <InfoItem
                icon={CircleUser}
                label="Pembuat MR"
                value={mrData.users_with_profiles?.nama || "N/A"}
              />
              <InfoItem
                icon={Building}
                label="Departemen MR"
                value={mrData.department}
              />
              <InfoItem
                icon={Tag}
                label="Kategori MR"
                value={mrData.kategori}
              />
              <InfoItem
                icon={DollarSign}
                label="Estimasi Biaya MR"
                value={formatCurrency(mrData.cost_estimation)}
              />
              <InfoItem
                icon={Building2}
                label="Cost Center"
                value={mrData.cost_center || "N/A"}
              />
              <InfoItem
                icon={Truck}
                label="Tujuan Site (MR)"
                value={mrData.tujuan_site || "N/A"}
              />
              <div className="md:col-span-2">
                <InfoItem
                  icon={Info}
                  label="Remarks MR"
                  value={mrData.remarks}
                />
              </div>
            </div>
          </Content>
        )}

        {mrData && (
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
                  {mrData.orders.map((order, index) => (
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

        <Content title="Input Item Purchase Order (Berdasarkan Master Barang)">
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
                    <TableCell>{item.vendor_name}</TableCell>
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

      <div className="col-span-12 lg:col-span-5 flex flex-col gap-6">
        <Content title="Vendor Utama & Pengiriman">
          <div className="space-y-4">
            <div>
              <Label className="text-sm font-medium">Nama Vendor Utama</Label>
              <Input
                value={poForm.vendor_details?.name || ""}
                onChange={(e) => handleVendorChange("name", e.target.value)}
                placeholder="PT Sejahtera Abadi"
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
                placeholder="Bpk. Budi (0812...)"
              />
            </div>
            <div>
              <Label className="text-sm font-medium">Alamat Vendor</Label>
              <Textarea
                value={poForm.vendor_details?.address || ""}
                onChange={(e) => handleVendorChange("address", e.target.value)}
                placeholder="Jl. Industri No. 5..."
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
              <Label>Diskon</Label>
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
              <Label>Pajak (PPN)</Label>
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
              <Label>Ongkos Kirim</Label>
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

// Komponen helper
const InfoItem = ({
  icon: Icon,
  label,
  value,
}: {
  icon: React.ElementType;
  label: string;
  value: string;
}) => (
  <div className="flex items-start gap-3">
    <Icon className="h-5 w-5 text-muted-foreground mt-1 flex-shrink-0" />
    <div>
      <p className="text-sm text-muted-foreground">{label}</p>
      <p className="font-medium whitespace-pre-wrap">{value}</p>
    </div>
  </div>
);

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
