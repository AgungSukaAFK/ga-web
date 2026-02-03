// src/app/(With Sidebar)/barang/edit/[id]/page.tsx

"use client";

import { Content } from "@/components/content";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { CurrencyInput } from "@/components/ui/currency-input";
import { createClient } from "@/lib/supabase/client";
import { use, useEffect, useState } from "react";
import { toast } from "sonner";
import { Loader2 } from "lucide-react";
// Import component VendorSearchCombobox dari folder tambah
// Pastikan path-nya sesuai dengan struktur folder Anda
import { VendorSearchCombobox } from "../../tambah/VendorSearchCombobox";

export default function EditBarangPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = use(params);
  const [loading, setLoading] = useState(false);
  const [fetching, setFetching] = useState(true);

  // Inisialisasi state awal agar tidak error "uncontrolled to controlled"
  const [data, setData] = useState({
    part_number: "",
    part_name: "",
    category: "",
    uom: "",
    vendor: "",
    last_purchase_price: 0,
    is_asset: false,
  });

  // --- 1. Fetch Data Barang ---
  useEffect(() => {
    async function fetch() {
      setFetching(true);
      const s = createClient();
      const { data: barangData, error } = await s
        .from("barang")
        .select("*")
        .eq("id", id)
        .single();

      if (error) {
        console.error(error);
        toast.error("Gagal mengambil data barang");
      } else if (barangData) {
        setData({
          part_number: barangData.part_number || "",
          part_name: barangData.part_name || "",
          category: barangData.category || "",
          uom: barangData.uom || "",
          vendor: barangData.vendor || "", // Load vendor lama
          last_purchase_price: barangData.last_purchase_price || 0, // Load harga
          is_asset: barangData.is_asset || false, // Load status asset
        });
      }
      setFetching(false);
    }
    fetch();
  }, [id]);

  // --- 2. Cek Hak Akses (Security) ---
  useEffect(() => {
    const checkAccess = async () => {
      const s = createClient();
      const { data: userData } = await s.auth.getUser();
      if (!userData.user) return;

      const { data: profileData } = await s
        .from("profiles")
        .select("role")
        .eq("id", userData.user.id)
        .single();

      // Hanya Approver & Admin yang boleh edit master barang
      if (
        !profileData ||
        (profileData.role !== "approver" && profileData.role !== "admin")
      ) {
        window.location.href = "/barang";
      }
    };
    checkAccess();
  }, []);

  // --- 3. Handler Update ---
  const handleSubmit = async () => {
    if (!data.part_name || !data.part_number || !data.category || !data.uom) {
      toast.warning(
        "Field wajib (Part Number, Nama, Kategori, UoM) harus diisi",
      );
      return;
    }

    setLoading(true);
    const s = createClient();

    // Kirim semua perubahan ke database
    const { error } = await s
      .from("barang")
      .update({
        part_number: data.part_number,
        part_name: data.part_name,
        category: data.category,
        uom: data.uom,
        vendor: data.vendor, // Update Vendor
        last_purchase_price: data.last_purchase_price, // Update Harga
        is_asset: data.is_asset, // Update Status Asset
      })
      .eq("id", id);

    setLoading(false);

    if (error) {
      toast.error(`Gagal menyimpan: ${error.message}`);
      return;
    }
    toast.success("Perubahan berhasil disimpan");
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    setData((prev) => ({ ...prev, [name]: value }));
  };

  if (fetching) {
    return (
      <Content size="md" title="Edit Barang">
        <div className="flex justify-center items-center h-40">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        </div>
      </Content>
    );
  }

  return (
    <Content size="md" title="Edit Barang">
      <div className="space-y-4">
        {/* Row 1 */}
        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-2">
            <Label>Part Number</Label>
            <Input
              name="part_number"
              value={data.part_number}
              onChange={handleInputChange}
            />
          </div>
          <div className="space-y-2">
            <Label>Part Name</Label>
            <Input
              name="part_name"
              value={data.part_name}
              onChange={handleInputChange}
            />
          </div>
        </div>

        {/* Row 2 */}
        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-2">
            <Label>Kategori</Label>
            <Input
              name="category"
              value={data.category}
              onChange={handleInputChange}
            />
          </div>
          <div className="space-y-2">
            <Label>UoM</Label>
            <Input name="uom" value={data.uom} onChange={handleInputChange} />
          </div>
        </div>

        {/* Vendor Search Combobox */}
        <div className="space-y-2">
          <Label>Vendor / Supplier</Label>
          <VendorSearchCombobox
            defaultValue={data.vendor} // Menampilkan vendor saat ini
            onSelect={(val) => setData((prev) => ({ ...prev, vendor: val }))}
          />
          <p className="text-[11px] text-muted-foreground">
            *Cari dari database vendor atau biarkan tetap.
          </p>
        </div>

        {/* Harga Referensi */}
        <div className="space-y-2 bg-muted/30 p-3 rounded border border-dashed">
          <Label className="text-primary font-semibold">
            Harga Referensi (Last Price)
          </Label>
          <CurrencyInput
            value={data.last_purchase_price}
            onValueChange={(val) =>
              setData((prev) => ({ ...prev, last_purchase_price: val }))
            }
          />
          <p className="text-[11px] text-muted-foreground mt-1">
            Update harga ini jika terjadi perubahan harga pasar tanpa melalui
            PO.
          </p>
        </div>

        {/* Status Asset */}
        <div className="flex items-center space-x-2 border p-3 rounded-md">
          <Checkbox
            id="is_asset"
            checked={data.is_asset}
            onCheckedChange={(c) =>
              setData((prev) => ({ ...prev, is_asset: c as boolean }))
            }
          />
          <Label htmlFor="is_asset" className="cursor-pointer">
            Barang ini termasuk Aset Perusahaan (Fixed Asset)?
          </Label>
        </div>
      </div>

      <div className="flex justify-end mt-6 gap-2">
        <Button variant="outline" onClick={() => window.history.back()}>
          Batal
        </Button>
        <Button onClick={handleSubmit} disabled={loading}>
          {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
          Simpan Perubahan
        </Button>
      </div>
    </Content>
  );
}
