// src/app/(With Sidebar)/barang/edit/[id]/page.tsx

"use client";

import { use, useEffect, useState, Suspense } from "react";
import { useRouter } from "next/navigation";
import { Content } from "@/components/content";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Textarea } from "@/components/ui/textarea";
import { CurrencyInput } from "@/components/ui/currency-input";
import { createClient } from "@/lib/supabase/client";
import { toast } from "sonner";
import {
  Loader2,
  Save,
  Package,
  Tag,
  DollarSign,
  Link as LinkIcon,
  Building,
  ArrowLeft,
  Info,
  FileText,
  AlertTriangle,
} from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
// Pastikan path import ini sesuai dengan lokasi file VendorSearchCombobox Anda
import { VendorSearchCombobox } from "../../tambah/VendorSearchCombobox";

function EditBarangContent({ params }: { params: { id: string } }) {
  const router = useRouter();
  const supabase = createClient();
  const id = parseInt(params.id);

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [formData, setFormData] = useState({
    part_number: "",
    part_name: "",
    category: "",
    uom: "",
    vendor: "",
    price: 0,
    link: "",
    description: "", // Kolom Catatan
    is_asset: false,
  });

  // --- FETCH DATA BARANG ---
  useEffect(() => {
    if (isNaN(id)) {
      setError("ID Barang tidak valid.");
      setLoading(false);
      return;
    }

    const fetchData = async () => {
      try {
        const { data, error } = await supabase
          .from("barang")
          .select("*")
          .eq("id", id)
          .single();

        if (error) throw error;
        if (!data) throw new Error("Barang tidak ditemukan.");

        setFormData({
          part_number: data.part_number || "",
          part_name: data.part_name || "",
          category: data.category || "",
          uom: data.uom || "",
          vendor: data.vendor || "",
          price: data.last_purchase_price || 0,
          link: data.link || "",
          description: data.description || "",
          is_asset: data.is_asset || false,
        });
      } catch (err: any) {
        console.error(err);
        setError(err.message);
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, [id, supabase]);

  // --- HANDLER SUBMIT ---
  const handleSubmit = async () => {
    // 1. Validasi Wajib (Sama seperti Tambah Barang)
    if (
      !formData.part_number ||
      !formData.part_name ||
      !formData.category ||
      !formData.uom
    ) {
      toast.warning("Mohon lengkapi field yang bertanda bintang (*)");
      return;
    }

    setSaving(true);
    const toastId = toast.loading("Menyimpan perubahan...");

    try {
      const { error } = await supabase
        .from("barang")
        .update({
          part_number: formData.part_number,
          part_name: formData.part_name,
          category: formData.category,
          uom: formData.uom,
          vendor: formData.vendor || null,
          last_purchase_price: formData.price || 0,
          link: formData.link || null,
          description: formData.description || null,
          is_asset: formData.is_asset,
          // Jangan update created_at, update updated_at jika ada kolomnya
        })
        .eq("id", id);

      if (error) {
        if (error.code === "23505") {
          throw new Error(
            "Part Number sudah terdaftar pada barang lain. Gunakan kode unik.",
          );
        }
        throw error;
      }

      toast.success("Barang berhasil diperbarui!", { id: toastId });
      router.push("/barang");
      router.refresh();
    } catch (err: any) {
      console.error(err);
      toast.error(`Gagal menyimpan: ${err.message}`, { id: toastId });
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="p-6">
        <Skeleton className="h-12 w-1/3 mb-6" />
        <Skeleton className="h-[500px] w-full" />
      </div>
    );
  }

  if (error) {
    return (
      <Content>
        <div className="flex flex-col items-center justify-center h-96 text-center">
          <AlertTriangle className="w-12 h-12 text-destructive mb-4" />
          <h2 className="text-xl font-bold">Terjadi Kesalahan</h2>
          <p className="text-muted-foreground mb-4">{error}</p>
          <Button variant="outline" onClick={() => router.back()}>
            Kembali
          </Button>
        </div>
      </Content>
    );
  }

  return (
    <Content
      title="Edit Data Barang"
      description={`Mengubah data untuk barang: ${formData.part_name}`}
    >
      <div className="max-w-5xl mx-auto">
        <div className="flex items-center gap-4 mb-6">
          <Button
            variant="outline"
            size="icon"
            onClick={() => router.back()}
            title="Kembali"
          >
            <ArrowLeft className="h-4 w-4" />
          </Button>
          <div className="flex-1">
            <h2 className="text-lg font-bold flex items-center gap-2">
              <Package className="h-5 w-5 text-primary" /> Edit Barang
            </h2>
            <p className="text-sm text-muted-foreground">
              Perbarui detail barang. Field bertanda{" "}
              <span className="text-red-500 font-bold">*</span> wajib diisi.
            </p>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 bg-card border rounded-lg p-6 shadow-sm">
          {/* --- KOLOM KIRI: INFO UTAMA --- */}
          <div className="space-y-6">
            <div className="space-y-2">
              <Label className="text-sm font-semibold">
                Part Number (Kode Unik) <span className="text-red-500">*</span>
              </Label>
              <Input
                placeholder="Contoh: EL-LPT-001"
                value={formData.part_number}
                onChange={(e) =>
                  setFormData({ ...formData, part_number: e.target.value })
                }
                className="h-11 font-mono border-muted-foreground/30 focus-visible:ring-2 focus-visible:ring-primary"
              />
              <p className="text-[11px] text-muted-foreground">
                Hati-hati mengubah Part Number jika barang ini sudah digunakan
                di PO/MR.
              </p>
            </div>

            <div className="space-y-2">
              <Label className="text-sm font-semibold">
                Nama Barang <span className="text-red-500">*</span>
              </Label>
              <Input
                placeholder="Contoh: Laptop Thinkpad X1 Carbon"
                value={formData.part_name}
                onChange={(e) =>
                  setFormData({ ...formData, part_name: e.target.value })
                }
                className="h-11 border-muted-foreground/30"
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label className="text-sm font-semibold flex items-center gap-2">
                  <Tag className="h-3 w-3" /> Kategori{" "}
                  <span className="text-red-500">*</span>
                </Label>
                <Input
                  placeholder="Elektronik / ATK"
                  value={formData.category}
                  onChange={(e) =>
                    setFormData({ ...formData, category: e.target.value })
                  }
                  className="h-11 border-muted-foreground/30"
                />
              </div>
              <div className="space-y-2">
                <Label className="text-sm font-semibold">
                  Satuan (UoM) <span className="text-red-500">*</span>
                </Label>
                <Input
                  placeholder="PCS / UNIT / SET"
                  value={formData.uom}
                  onChange={(e) =>
                    setFormData({ ...formData, uom: e.target.value })
                  }
                  className="h-11 border-muted-foreground/30"
                />
              </div>
            </div>

            {/* Checkbox Asset */}
            <div
              className="flex items-center space-x-3 p-4 border rounded-md bg-muted/20 cursor-pointer hover:bg-muted/30 transition-all"
              onClick={() =>
                setFormData((p) => ({ ...p, is_asset: !p.is_asset }))
              }
            >
              <Checkbox
                id="is-asset"
                checked={formData.is_asset}
                onCheckedChange={(c) =>
                  setFormData({ ...formData, is_asset: c as boolean })
                }
              />
              <div className="grid gap-0.5">
                <Label
                  htmlFor="is-asset"
                  className="cursor-pointer font-semibold text-sm"
                >
                  Tandai sebagai Fixed Asset
                </Label>
                <span className="text-xs text-muted-foreground">
                  Barang ini akan dicatat sebagai aset inventaris perusahaan.
                </span>
              </div>
            </div>
          </div>

          {/* --- KOLOM KANAN: OPSIONAL & DETAILS --- */}
          <div className="space-y-6">
            <div className="space-y-2">
              <Label className="text-sm font-semibold flex items-center gap-2">
                <Building className="h-3 w-3" /> Vendor Default{" "}
                <span className="text-xs font-normal text-muted-foreground">
                  (Optional)
                </span>
              </Label>
              <div className="h-11">
                <VendorSearchCombobox
                  defaultValue={formData.vendor}
                  onSelect={(val) => setFormData({ ...formData, vendor: val })}
                />
              </div>
              <p className="text-[11px] text-muted-foreground">
                Vendor langganan utama untuk barang ini.
              </p>
            </div>

            <div className="space-y-2">
              <Label className="text-sm font-semibold flex items-center gap-2">
                <DollarSign className="h-3 w-3" /> Harga Referensi{" "}
                <span className="text-xs font-normal text-muted-foreground">
                  (Optional)
                </span>
              </Label>
              <CurrencyInput
                value={formData.price}
                onValueChange={(val) =>
                  setFormData({ ...formData, price: val })
                }
                className="h-11 border-muted-foreground/30"
                placeholder="Rp 0"
              />
              <div className="flex gap-2 items-start text-[11px] text-amber-600 bg-amber-50 p-2 rounded border border-amber-100">
                <Info className="h-3 w-3 mt-0.5 flex-shrink-0" />
                <p>
                  Harga ini (HPS) hanya referensi. Harga beli aktual ditentukan
                  saat pembuatan PO.
                </p>
              </div>
            </div>

            <div className="space-y-2">
              <Label className="text-sm font-semibold flex items-center gap-2">
                <LinkIcon className="h-3 w-3" /> Link Pembelian{" "}
                <span className="text-xs font-normal text-muted-foreground">
                  (Optional)
                </span>
              </Label>
              <Input
                placeholder="https://tokopedia.com/..."
                value={formData.link}
                onChange={(e) =>
                  setFormData({ ...formData, link: e.target.value })
                }
                className="h-11 border-muted-foreground/30"
              />
            </div>

            {/* FIELD BARU: CATATAN */}
            <div className="space-y-2">
              <Label className="text-sm font-semibold flex items-center gap-2">
                <FileText className="h-3 w-3" /> Catatan / Spesifikasi{" "}
                <span className="text-xs font-normal text-muted-foreground">
                  (Optional)
                </span>
              </Label>
              <Textarea
                placeholder="Masukkan spesifikasi detail, warna, ukuran, atau catatan lain..."
                value={formData.description}
                onChange={(e) =>
                  setFormData({ ...formData, description: e.target.value })
                }
                className="min-h-[100px] border-muted-foreground/30 bg-background resize-none p-3"
              />
            </div>
          </div>
        </div>

        <div className="flex justify-end gap-3 mt-8">
          <Button
            variant="outline"
            size="lg"
            className="px-8"
            onClick={() => router.back()}
            disabled={saving}
          >
            Batal
          </Button>
          <Button
            size="lg"
            className="px-8 bg-blue-600 hover:bg-blue-700 font-semibold"
            onClick={handleSubmit}
            disabled={saving}
          >
            {saving ? (
              <Loader2 className="mr-2 h-5 w-5 animate-spin" />
            ) : (
              <Save className="mr-2 h-5 w-5" />
            )}
            Simpan Perubahan
          </Button>
        </div>
      </div>
    </Content>
  );
}

export default function EditBarangPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const resolvedParams = use(params);
  return (
    <Suspense
      fallback={
        <div className="p-6">
          <Skeleton className="h-[80vh] w-full" />
        </div>
      }
    >
      <EditBarangContent params={resolvedParams} />
    </Suspense>
  );
}
