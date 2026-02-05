// src/app/(With Sidebar)/barang/tambah/page.tsx

"use client";

import { useState, useRef } from "react";
import { useRouter } from "next/navigation";
import { Content } from "@/components/content";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Textarea } from "@/components/ui/textarea";
import { CurrencyInput } from "@/components/ui/currency-input";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
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
  FileSpreadsheet,
  UploadCloud,
  Download,
  FileText,
  AlertTriangle,
} from "lucide-react";
import { VendorSearchCombobox } from "./VendorSearchCombobox";

export default function TambahBarangPage() {
  const router = useRouter();
  const supabase = createClient();
  const [loading, setLoading] = useState(false);

  // State Import CSV
  const [isImportOpen, setIsImportOpen] = useState(false);
  const [csvLoading, setCsvLoading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // State Form Manual
  const [formData, setFormData] = useState({
    part_number: "",
    part_name: "",
    category: "",
    uom: "",
    vendor: "",
    price: 0,
    link: "",
    description: "",
    is_asset: false,
  });

  // --- HANDLER MANUAL SUBMIT ---
  const handleSubmit = async () => {
    if (
      !formData.part_number ||
      !formData.part_name ||
      !formData.category ||
      !formData.uom
    ) {
      toast.warning("Mohon lengkapi field yang bertanda bintang (*)");
      return;
    }

    setLoading(true);
    const toastId = toast.loading("Menyimpan data barang...");

    try {
      const { error } = await supabase.from("barang").insert([
        {
          part_number: formData.part_number,
          part_name: formData.part_name,
          category: formData.category,
          uom: formData.uom,
          vendor: formData.vendor || null,
          last_purchase_price: formData.price || 0,
          link: formData.link || null,
          description: formData.description || null,
          is_asset: formData.is_asset,
          created_at: new Date(),
        },
      ]);

      if (error) {
        if (error.code === "23505") {
          throw new Error("Part Number sudah terdaftar. Gunakan kode unik.");
        }
        throw error;
      }

      toast.success("Barang berhasil ditambahkan!", { id: toastId });
      router.push("/barang");
    } catch (err: any) {
      console.error(err);
      toast.error(`Gagal menyimpan: ${err.message}`, { id: toastId });
    } finally {
      setLoading(false);
    }
  };

  // --- DOWNLOAD TEMPLATE CSV ---
  const handleDownloadTemplate = () => {
    // Header CSV
    const headers = [
      "Part Number (Wajib)",
      "Nama Barang (Wajib)",
      "Kategori (Wajib)",
      "UOM (Wajib)",
      "Harga Referensi",
      "Vendor",
      "Link Pembelian",
      "Catatan",
    ];

    // Contoh Data
    const row1 = [
      "ATK-001",
      "Kertas A4 80gr",
      "ATK",
      "RIM",
      "50000",
      "PaperOne",
      "http://...",
      "Kertas putih polos",
    ];

    const row2 = [
      "IT-LPT-02",
      "Laptop Dell Latitude",
      "IT",
      "UNIT",
      "12000000",
      "Dell Indo",
      "",
      "Spek i5 16GB",
    ];

    const csvContent =
      "data:text/csv;charset=utf-8," +
      [headers.join(","), row1.join(","), row2.join(",")].join("\n");

    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", "template_import_barang.csv");
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  // --- PROCESS CSV ---
  const processCsvFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setCsvLoading(true);
    const toastId = toast.loading("Membaca & Memproses CSV...");

    const reader = new FileReader();
    reader.onload = async (evt) => {
      try {
        const text = evt.target?.result as string;
        // Split baris & hapus baris kosong
        const rows = text.split(/\r?\n/).filter((row) => row.trim() !== "");

        // Validasi minimal ada header + 1 data
        if (rows.length < 2) {
          throw new Error("File CSV kosong atau hanya berisi header.");
        }

        const dataToInsert = [];
        let failCount = 0;

        // Loop mulai dari index 1 (skip header row 0)
        for (let i = 1; i < rows.length; i++) {
          // Split koma, handle kemungkinan quote di CSV sederhana (basic split)
          const cols = rows[i].split(",");

          // Mapping sesuai urutan Template
          const pn = cols[0]?.trim();
          const name = cols[1]?.trim();
          const cat = cols[2]?.trim();
          const uom = cols[3]?.trim();
          const price = parseFloat(cols[4]?.trim() || "0");
          const vendor = cols[5]?.trim() || null;
          const link = cols[6]?.trim() || null;
          const desc = cols[7]?.trim() || null;

          // Validasi Field Wajib
          if (pn && name && cat && uom) {
            dataToInsert.push({
              part_number: pn,
              part_name: name,
              category: cat,
              uom: uom,
              last_purchase_price: isNaN(price) ? 0 : price,
              vendor: vendor,
              link: link,
              description: desc,
              is_asset: false, // Default false untuk import massal
              created_at: new Date(),
            });
          } else {
            failCount++;
          }
        }

        if (dataToInsert.length === 0) {
          throw new Error(
            "Tidak ada data valid yang ditemukan untuk diimport.",
          );
        }

        // Batch Insert
        const { error } = await supabase.from("barang").insert(dataToInsert);

        if (error) {
          if (error.code === "23505")
            throw new Error(
              "Terdapat Part Number duplikat di dalam file atau database.",
            );
          throw error;
        }

        toast.success(
          `Sukses! ${dataToInsert.length} barang diimport. (${failCount} baris diabaikan/gagal)`,
          { id: toastId },
        );

        setIsImportOpen(false); // Tutup dialog
        setTimeout(() => router.push("/barang"), 1500);
      } catch (err: any) {
        console.error(err);
        toast.error(`Gagal Import: ${err.message}`, { id: toastId });
      } finally {
        setCsvLoading(false);
        if (fileInputRef.current) fileInputRef.current.value = "";
      }
    };
    reader.readAsText(file);
  };

  return (
    <Content
      title="Tambah Master Barang"
      description="Buat data barang baru secara manual atau import massal via CSV."
      // Action Header
      cardAction={
        <Dialog open={isImportOpen} onOpenChange={setIsImportOpen}>
          <DialogTrigger asChild>
            <Button variant="outline" size="sm" className="gap-2">
              <FileSpreadsheet className="h-4 w-4 text-green-600" />
              Import CSV
            </Button>
          </DialogTrigger>
          <DialogContent className="sm:max-w-lg">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <UploadCloud className="h-5 w-5 text-primary" /> Import Data
                Barang
              </DialogTitle>
              <DialogDescription>
                Upload file CSV untuk menambahkan banyak barang sekaligus.
              </DialogDescription>
            </DialogHeader>

            <div className="space-y-4 py-4">
              {/* Panduan Format */}
              <div className="rounded-md border bg-muted/30 p-3 text-sm">
                <h4 className="font-semibold mb-2 flex items-center gap-2 text-xs uppercase tracking-wide text-muted-foreground">
                  <Info className="h-3 w-3" /> Struktur Kolom CSV (Berurutan)
                </h4>
                <Table className="text-xs">
                  <TableHeader>
                    <TableRow className="hover:bg-transparent">
                      <TableHead className="h-7">1. Part Number*</TableHead>
                      <TableHead className="h-7">2. Nama*</TableHead>
                      <TableHead className="h-7">3. Kategori*</TableHead>
                      <TableHead className="h-7">4. UOM*</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    <TableRow className="hover:bg-transparent border-0">
                      <TableCell
                        colSpan={4}
                        className="py-2 text-muted-foreground italic"
                      >
                        ...dilanjutkan: 5. Harga, 6. Vendor, 7. Link, 8. Catatan
                      </TableCell>
                    </TableRow>
                  </TableBody>
                </Table>
              </div>

              {/* Area Upload */}
              <div className="flex flex-col gap-3">
                <div className="flex justify-between items-center">
                  <Label>File CSV</Label>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-6 text-xs text-blue-600 hover:text-blue-700 hover:bg-blue-50"
                    onClick={handleDownloadTemplate}
                  >
                    <Download className="mr-1 h-3 w-3" /> Download Template
                  </Button>
                </div>

                <div
                  className="border-2 border-dashed border-muted-foreground/25 rounded-lg p-8 flex flex-col items-center justify-center text-center cursor-pointer hover:bg-muted/20 transition-colors"
                  onClick={() => fileInputRef.current?.click()}
                >
                  <input
                    type="file"
                    accept=".csv"
                    ref={fileInputRef}
                    className="hidden"
                    onChange={processCsvFile}
                    disabled={csvLoading}
                  />
                  {csvLoading ? (
                    <div className="flex flex-col items-center gap-2">
                      <Loader2 className="h-8 w-8 animate-spin text-primary" />
                      <p className="text-sm font-medium">Memproses data...</p>
                    </div>
                  ) : (
                    <>
                      <div className="p-3 bg-primary/10 rounded-full mb-3">
                        <FileSpreadsheet className="h-6 w-6 text-primary" />
                      </div>
                      <p className="text-sm font-medium text-foreground">
                        Klik untuk upload file CSV
                      </p>
                      <p className="text-xs text-muted-foreground mt-1">
                        Maksimal 5MB
                      </p>
                    </>
                  )}
                </div>
              </div>

              <div className="flex items-start gap-2 p-3 bg-yellow-50 text-yellow-800 rounded text-xs">
                <AlertTriangle className="h-4 w-4 mt-0.5 flex-shrink-0" />
                <p>
                  Pastikan <strong>Part Number</strong> unik. Data yang memiliki
                  Part Number sama dengan yang sudah ada di database akan gagal
                  disimpan.
                </p>
              </div>
            </div>
          </DialogContent>
        </Dialog>
      }
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
              <Package className="h-5 w-5 text-primary" /> Form Barang Baru
            </h2>
            <p className="text-sm text-muted-foreground">
              Isi detail barang dengan lengkap. Field bertanda{" "}
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
                Kode identifikasi unik (SKU/PN) untuk database.
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
                  saat pembuatan PO. Boleh 0.
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
            disabled={loading}
          >
            Batal
          </Button>
          <Button
            size="lg"
            className="px-8 bg-green-600 hover:bg-green-700 font-semibold"
            onClick={handleSubmit}
            disabled={loading}
          >
            {loading ? (
              <Loader2 className="mr-2 h-5 w-5 animate-spin" />
            ) : (
              <Save className="mr-2 h-5 w-5" />
            )}
            Simpan Barang
          </Button>
        </div>
      </div>
    </Content>
  );
}
