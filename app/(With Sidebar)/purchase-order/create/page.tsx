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
  ExternalLink, // Impor ikon
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
} from "@/type"; // Impor Order
import { Label } from "@/components/ui/label";
import Link from "next/link";
import { Checkbox } from "@/components/ui/checkbox";
import { CurrencyInput } from "@/components/ui/currency-input"; // Impor CurrencyInput

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
    payment_term: "Termin 30 Hari",
    shipping_address: "Kantor Pusat GMI, Jakarta",
    notes: "",
    vendor_details: { name: "", address: "", contact_person: "" },
  });

  const [taxMode, setTaxMode] = useState<"percentage" | "manual">("percentage");
  const [taxPercentage, setTaxPercentage] = useState<number>(11);
  const [isTaxIncluded, setIsTaxIncluded] = useState<boolean>(false);

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
          shipping_address: fetchedMr.tujuan_site || prev.shipping_address,
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

  // --- REVISI: Logika Kalkulasi Pajak/Total ---
  useEffect(() => {
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

    setPoForm((prev) => ({
      ...prev,
      tax: taxMode !== "manual" || isTaxIncluded ? calculatedTax : prev.tax,
      total_price: grandTotal,
    }));

    if (taxMode === "percentage" || isTaxIncluded) {
      setPoForm((prev) => ({ ...prev, tax: calculatedTax }));
    }
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
  // --- AKHIR REVISI LOGIKA ---

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
      vendor_name: barang.vendor || "", // Ambil vendor dari master barang
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

    if (!mrId) {
      toast.error("ID Material Request tidak ditemukan.");
      return;
    }

    try {
      await createPurchaseOrder(
        poForm,
        parseInt(mrId),
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

  const subtotal = poForm.items.reduce(
    (acc, item) => acc + item.total_price,
    0
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
                value={
                  mrData.cost_center_id?.toString() ||
                  (mrData as any).cost_center ||
                  "N/A"
                }
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

        {/* --- REVISI: Tabel Item Referensi MR --- */}
        {mrData && (
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
                  {(mrData.orders as Order[]).map((order, index) => (
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
                  ))}
                </TableBody>
              </Table>
            </div>
          </Content>
        )}
        {/* --- AKHIR REVISI --- */}

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
                    {/* --- REVISI: Gunakan CurrencyInput untuk Harga --- */}
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
                    <TableCell>
                      <Input
                        value={item.vendor_name || ""}
                        onChange={(e) =>
                          handleItemChange(index, "vendor_name", e.target.value)
                        }
                        placeholder="Nama Vendor Item"
                      />
                    </TableCell>
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
          {/* ... (Konten Vendor & Pengiriman tetap sama) ... */}
          <div className="space-y-4">
            {" "}
            <div>
              {" "}
              <Label className="text-sm font-medium">
                Nama Vendor Utama
              </Label>{" "}
              <Input
                value={poForm.vendor_details?.name || ""}
                onChange={(e) => handleVendorChange("name", e.target.value)}
                placeholder="PT Sejahtera Abadi"
              />{" "}
            </div>{" "}
            <div>
              {" "}
              <Label className="text-sm font-medium">
                {" "}
                Kontak Person Vendor{" "}
              </Label>{" "}
              <Input
                value={poForm.vendor_details?.contact_person || ""}
                onChange={(e) =>
                  handleVendorChange("contact_person", e.target.value)
                }
                placeholder="Bpk. Budi (0812...)"
              />{" "}
            </div>{" "}
            <div>
              {" "}
              <Label className="text-sm font-medium">Alamat Vendor</Label>{" "}
              <Textarea
                value={poForm.vendor_details?.address || ""}
                onChange={(e) => handleVendorChange("address", e.target.value)}
                placeholder="Jl. Industri No. 5..."
              />{" "}
            </div>{" "}
            <hr />{" "}
            <div>
              {" "}
              <Label className="text-sm font-medium">Payment Term</Label>{" "}
              <div className="flex gap-2 mt-1">
                {" "}
                <Select
                  value={paymentTermType}
                  onValueChange={(value) => setPaymentTermType(value)}
                >
                  {" "}
                  <SelectTrigger className="w-1/2">
                    {" "}
                    <SelectValue placeholder="Pilih tipe..." />{" "}
                  </SelectTrigger>{" "}
                  <SelectContent>
                    {" "}
                    <SelectItem value="Termin">Termin</SelectItem>{" "}
                    <SelectItem value="Cash">Cash</SelectItem>{" "}
                  </SelectContent>{" "}
                </Select>{" "}
                {paymentTermType === "Termin" && (
                  <div className="w-1/2 relative">
                    {" "}
                    <Input
                      type="number"
                      value={paymentTermDays}
                      onChange={(e) => setPaymentTermDays(e.target.value)}
                      placeholder="... hari"
                      className="pr-12"
                      min="0"
                    />{" "}
                    <span className="absolute right-3 top-1/2 -translate-y-1/2 text-sm text-muted-foreground">
                      {" "}
                      Hari{" "}
                    </span>{" "}
                  </div>
                )}{" "}
              </div>{" "}
            </div>{" "}
            <div>
              {" "}
              <Label className="text-sm font-medium">
                Alamat Pengiriman
              </Label>{" "}
              <Textarea
                value={poForm.shipping_address}
                onChange={(e) =>
                  setPoForm((p) => ({ ...p, shipping_address: e.target.value }))
                }
              />{" "}
            </div>{" "}
          </div>
        </Content>

        {/* --- REVISI: Bagian Ringkasan Biaya dengan CurrencyInput --- */}
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
                  setPoForm((p) => ({ ...p, discount: numValue }))
                }
                className="w-32"
                disabled={loading}
              />
            </div>

            <div className="space-y-2 pt-2 border-t">
              <div className="flex items-center space-x-2">
                <Checkbox
                  id="include-tax"
                  checked={isTaxIncluded}
                  onCheckedChange={(checked) =>
                    setIsTaxIncluded(checked as boolean)
                  }
                  disabled={loading}
                />
                <Label
                  htmlFor="include-tax"
                  className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70"
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
                    onValueChange={(value) =>
                      setTaxMode(value as "percentage" | "manual")
                    }
                    disabled={loading}
                  >
                    <SelectTrigger className="w-full">
                      <SelectValue placeholder="Pilih metode pajak..." />
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
                onValueChange={(numValue) =>
                  setPoForm((p) => ({ ...p, postage: numValue }))
                }
                className="w-32"
                disabled={loading}
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

// Komponen helper InfoItem tetap sama
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
