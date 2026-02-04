"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Content } from "@/components/content";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { toast } from "sonner";
import { createClient } from "@/lib/supabase/client";
import { CurrencyInput } from "@/components/ui/currency-input";
import { Loader2, Upload, FileSpreadsheet } from "lucide-react";
// Import Component Vendor Search
import { VendorSearchCombobox } from "./VendorSearchCombobox";

export default function TambahBarangPage() {
  const router = useRouter();
  const supabase = createClient();
  const [loading, setLoading] = useState(false);
  const [activeTab, setActiveTab] = useState("manual");

  const [form, setForm] = useState({
    part_number: "",
    part_name: "",
    category: "",
    uom: "",
    vendor: "",
    is_asset: false,
    last_purchase_price: 0,
    link: "", // Field link baru
  });

  const [csvFile, setCsvFile] = useState<File | null>(null);

  // --- HANDLER: MANUAL SAVE ---
  const handleManualSave = async () => {
    // 1. Validasi Wajib Diisi (Termasuk Harga)
    if (!form.part_number || !form.part_name) {
      toast.error("Part Number dan Nama Barang wajib diisi.");
      return;
    }

    if (!form.last_purchase_price || form.last_purchase_price <= 0) {
      toast.error("Harga Referensi wajib diisi dan harus lebih dari 0.");
      return;
    }

    setLoading(true);
    try {
      const { error } = await supabase.from("barang").insert([
        {
          part_number: form.part_number,
          part_name: form.part_name,
          category: form.category,
          uom: form.uom,
          vendor: form.vendor,
          is_asset: form.is_asset,
          last_purchase_price: form.last_purchase_price,
          link: form.link,
        },
      ]);

      if (error) throw error;
      toast.success("Barang berhasil ditambahkan");
      router.push("/barang");
    } catch (err: any) {
      toast.error(`Gagal menyimpan: ${err.message}`);
    } finally {
      setLoading(false);
    }
  };

  // --- HANDLER: CSV IMPORT ---
  const handleCsvUpload = async () => {
    if (!csvFile) {
      toast.error("Silakan pilih file CSV terlebih dahulu.");
      return;
    }

    setLoading(true);
    const reader = new FileReader();

    reader.onload = async (e) => {
      const text = e.target?.result as string;
      if (!text) {
        toast.error("File kosong.");
        setLoading(false);
        return;
      }

      const rows = text
        .split("\n")
        .map((row) => row.trim())
        .filter((row) => row.length > 0);

      const dataToInsert = [];
      const errors = [];

      for (let i = 1; i < rows.length; i++) {
        const columns = rows[i]
          .split(",")
          .map((col) => col.trim().replace(/^"|"$/g, ""));

        if (columns.length < 2) continue;

        const part_number = columns[0];
        const part_name = columns[1];

        if (!part_number || !part_name) {
          errors.push(`Baris ${i + 1}: Part Number/Name kosong.`);
          continue;
        }

        dataToInsert.push({
          part_number: part_number,
          part_name: part_name,
          category: columns[2] || "",
          uom: columns[3] || "PCS",
          vendor: columns[4] || "",
          is_asset: columns[5]?.toLowerCase() === "true" || columns[5] === "1",
          last_purchase_price: Number(columns[6]) || 0,
          link: columns[7] || "", // Asumsi kolom ke-8 adalah link
        });
      }

      if (dataToInsert.length === 0) {
        toast.error("Tidak ada data valid yang ditemukan dalam CSV.");
        setLoading(false);
        return;
      }

      try {
        const { error } = await supabase.from("barang").insert(dataToInsert);
        if (error) throw error;

        toast.success(`Berhasil mengimpor ${dataToInsert.length} item.`);
        if (errors.length > 0) {
          toast.warning(`${errors.length} baris gagal (lihat console).`);
          console.warn("CSV Errors:", errors);
        }
        router.push("/barang");
      } catch (err: any) {
        toast.error(`Gagal import CSV: ${err.message}`);
      } finally {
        setLoading(false);
      }
    };
    reader.readAsText(csvFile);
  };

  return (
    <Content title="Tambah Master Barang">
      <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
        <TabsList className="grid w-full grid-cols-2 mb-4">
          <TabsTrigger value="manual">Input Manual</TabsTrigger>
          <TabsTrigger value="csv">Import CSV</TabsTrigger>
        </TabsList>

        <TabsContent value="manual">
          <div className="max-w-2xl space-y-4 border p-4 rounded-md bg-card">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>
                  Part Number <span className="text-red-500">*</span>
                </Label>
                <Input
                  value={form.part_number}
                  onChange={(e) =>
                    setForm({ ...form, part_number: e.target.value })
                  }
                  placeholder="Contoh: B-001"
                />
              </div>
              <div className="space-y-2">
                <Label>
                  Nama Barang <span className="text-red-500">*</span>
                </Label>
                <Input
                  value={form.part_name}
                  onChange={(e) =>
                    setForm({ ...form, part_name: e.target.value })
                  }
                  placeholder="Contoh: Laptop Dell"
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Kategori</Label>
                <Input
                  value={form.category}
                  onChange={(e) =>
                    setForm({ ...form, category: e.target.value })
                  }
                  placeholder="Elektronik / ATK"
                />
              </div>
              <div className="space-y-2">
                <Label>Satuan (UoM)</Label>
                <Input
                  value={form.uom}
                  onChange={(e) => setForm({ ...form, uom: e.target.value })}
                  placeholder="PCS, UNIT"
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label>Vendor / Supplier</Label>
              <VendorSearchCombobox
                defaultValue={form.vendor}
                onSelect={(val) => setForm({ ...form, vendor: val })}
              />
              <p className="text-[11px] text-muted-foreground">
                *Cari berdasarkan Nama atau Kode Vendor.
              </p>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2 bg-muted/30 p-3 rounded border border-dashed">
                <Label className="text-primary font-semibold">
                  Harga Referensi Awal <span className="text-red-500">*</span>
                </Label>
                <CurrencyInput
                  value={form.last_purchase_price}
                  onValueChange={(val) =>
                    setForm({ ...form, last_purchase_price: val })
                  }
                  placeholder="Rp 0"
                />
                <p className="text-[11px] text-muted-foreground mt-1">
                  Wajib diisi sebagai acuan budget.
                </p>
              </div>

              <div className="space-y-2 bg-muted/30 p-3 rounded border border-dashed">
                <Label className="text-primary font-semibold">
                  Link Pembelian / Katalog
                </Label>
                <Input
                  value={form.link}
                  onChange={(e) => setForm({ ...form, link: e.target.value })}
                  placeholder="https://tokopedia..."
                />
              </div>
            </div>

            <div className="flex items-center space-x-2 border p-3 rounded-md">
              <Checkbox
                id="is_asset"
                checked={form.is_asset}
                onCheckedChange={(c) =>
                  setForm({ ...form, is_asset: c as boolean })
                }
              />
              <Label htmlFor="is_asset" className="cursor-pointer">
                Barang ini termasuk Aset Perusahaan (Fixed Asset)?
              </Label>
            </div>

            <div className="flex justify-end gap-2 pt-4">
              <Button variant="outline" onClick={() => router.back()}>
                Batal
              </Button>
              <Button onClick={handleManualSave} disabled={loading}>
                {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                Simpan Barang
              </Button>
            </div>
          </div>
        </TabsContent>

        <TabsContent value="csv">
          <div className="max-w-2xl space-y-6 border p-4 rounded-md bg-card">
            <Alert>
              <FileSpreadsheet className="h-4 w-4" />
              <AlertTitle>Format File CSV</AlertTitle>
              <AlertDescription>
                Pastikan file CSV Anda menggunakan pemisah koma (<code>,</code>)
                dengan urutan kolom sebagai berikut:
                <div className="mt-2 p-2 bg-muted rounded font-mono text-xs overflow-x-auto">
                  part_number, part_name, category, uom, vendor,
                  is_asset(true/false), price, link
                </div>
                <p className="mt-2 text-xs text-muted-foreground">
                  * Baris pertama dianggap sebagai Header dan tidak akan
                  diimport.
                  <br />* Kolom <strong>price</strong> (ke-7) adalah untuk Harga
                  Referensi Awal.
                </p>
              </AlertDescription>
            </Alert>

            <div className="space-y-2">
              <Label>Upload File CSV</Label>
              <div className="flex items-center gap-2">
                <Input
                  type="file"
                  accept=".csv"
                  onChange={(e) => setCsvFile(e.target.files?.[0] || null)}
                  className="cursor-pointer"
                />
              </div>
            </div>

            <div className="flex justify-end gap-2 pt-4">
              <Button variant="outline" onClick={() => router.back()}>
                Batal
              </Button>
              <Button onClick={handleCsvUpload} disabled={loading || !csvFile}>
                {loading ? (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                ) : (
                  <Upload className="mr-2 h-4 w-4" />
                )}
                Upload & Import
              </Button>
            </div>
          </div>
        </TabsContent>
      </Tabs>
    </Content>
  );
}
