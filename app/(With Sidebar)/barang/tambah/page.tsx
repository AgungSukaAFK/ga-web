"use client";

import { Content } from "@/components/content";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { createClient } from "@/lib/supabase/client";
import { validateCSV } from "@/lib/utils";
import { useEffect, useState } from "react";
import { toast } from "sonner";

// Menambahkan type untuk dataBarang agar lebih terstruktur
type Barang = {
  part_number: string;
  part_name: string;
  category: string;
  uom: string;
  vendor: string;
};

export default function TambahBarangPage() {
  const s = createClient();

  const [loading, setLoading] = useState(false);
  const [dataBarang, setDataBarang] = useState<Barang>({
    part_number: "",
    part_name: "",
    category: "",
    uom: "",
    vendor: "",
  });
  const [alertMessage, setAlertMessage] = useState<string | null>(null);
  const [dataCSV, setDataCSV] = useState("");

  useEffect(() => {
    if (alertMessage) {
      toast.info(alertMessage);
      setAlertMessage(null);
    }
  }, [alertMessage]);

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    setDataBarang((prevData) => ({
      ...prevData,
      [name]: value,
    }));
  };

  const handleAddBarang = async () => {
    if (!dataBarang.part_number) {
      setAlertMessage("Part number tidak boleh kosong");
      return;
    }
    if (!dataBarang.part_name) {
      setAlertMessage("Part name tidak boleh kosong");
      return;
    }
    if (!dataBarang.category) {
      setAlertMessage("Kategori tidak boleh kosong");
      return;
    }
    if (!dataBarang.uom) {
      setAlertMessage("UoM tidak boleh kosong");
      return;
    }
    if (!dataBarang.vendor) {
      setAlertMessage("Vendor tidak boleh kosong");
      return;
    }

    try {
      setLoading(true);
      const { error } = await s.from("barang").insert(dataBarang);

      if (error?.code === "23505") {
        setAlertMessage("Part number sudah terdaftar");
        return;
      }
      if (error) throw error;
      setAlertMessage("Barang berhasil ditambahkan");
      clearInput();
    } catch (error) {
      console.error("Error tambah barang:", error);
      setAlertMessage("Terjadi kesalahan saat menambahkan barang");
    } finally {
      setLoading(false);
    }
  };

  const handleAddBarangBatch = async () => {
    const { valid, errors, rows } = validateCSV(dataCSV);

    if (!valid) {
      toast.error(errors.join(", ") || "Format CSV tidak valid");
      return;
    }

    try {
      setLoading(true);

      // 🔑 Ambil semua part_number yang sudah ada di DB
      const { data: existing, error: existingError } = await s
        .from("barang")
        .select("part_number");

      if (existingError) throw existingError;

      const existingSet = new Set(existing.map((row: any) => row.part_number));

      // 🔑 Filter hanya part_number yang belum ada di DB
      const newRows = rows.filter((cols) => !existingSet.has(cols[0]));

      if (newRows.length === 0) {
        toast.info("Tidak ada data baru yang ditambahkan (semua sudah ada)");
        return;
      }

      // 🔑 Insert batch dengan chunk (biar aman kalau ribuan data)
      const chunkSize = 1000;
      for (let i = 0; i < newRows.length; i += chunkSize) {
        const chunk = newRows.slice(i, i + chunkSize).map((cols) => ({
          part_number: cols[0],
          part_name: cols[1],
          category: cols[2],
          uom: cols[3],
          vendor: cols[4],
        }));

        const { error } = await s.from("barang").insert(chunk);
        if (error) throw error;
      }

      toast.success(`${newRows.length} data barang berhasil ditambahkan`);
      clearInputBatch();
    } catch (err: any) {
      console.error("Error tambah barang batch:", err.message);
      toast.error("Gagal menambahkan data batch: " + err.message);
    } finally {
      setLoading(false);
    }
  };

  const clearInput = () => {
    setDataBarang({
      part_number: "",
      part_name: "",
      category: "",
      uom: "",
      vendor: "",
    });
  };

  const clearInputBatch = () => {
    setDataCSV("");
  };

  return (
    <>
      <Content
        title="Tambah data barang"
        size="md"
        cardAction={
          <Button variant={"outline"} onClick={clearInput}>
            Clear
          </Button>
        }
      >
        <div className="space-y-4">
          <div>
            <label className="mb-2 block font-medium">Part Number</label>
            <Input
              disabled={loading}
              name="part_number"
              onChange={handleInputChange}
              value={dataBarang.part_number}
              placeholder="Part number..."
            />
          </div>
          <div>
            <label className="mb-2 block font-medium">Part Name</label>
            <Input
              disabled={loading}
              name="part_name"
              onChange={handleInputChange}
              value={dataBarang.part_name}
              placeholder="Part name..."
            />
          </div>
          <div>
            <label className="mb-2 block font-medium">
              Kategori{" "}
              <em className="text-base font-normal">
                (gunakan tanda koma untuk kategori lebih dari satu)
              </em>
            </label>
            <Input
              disabled={loading}
              name="category"
              onChange={handleInputChange}
              value={dataBarang.category}
              placeholder="Kategori..."
            />
          </div>
          <div>
            <label className="mb-2 block font-medium">UoM</label>
            <Input
              disabled={loading}
              name="uom"
              onChange={handleInputChange}
              value={dataBarang.uom}
              placeholder="UoM..."
            />
          </div>
          <div>
            <label className="mb-2 block font-medium">Vendor</label>
            <Input
              disabled={loading}
              name="vendor"
              onChange={handleInputChange}
              value={dataBarang.vendor}
              placeholder="Vendor..."
            />
          </div>
          <div className="flex justify-end">
            <Button onClick={handleAddBarang} disabled={loading}>
              {loading ? "Loading..." : "Tambah"}
            </Button>
          </div>
        </div>
      </Content>
      <Content
        title="Tambah data barang (batch) menggunakan CSV"
        size="md"
        cardAction={
          <Button variant={"outline"} onClick={clearInputBatch}>
            Clear
          </Button>
        }
      >
        <div className="space-y-4">
          <p>Contoh format penulisan CSV yang sesuai</p>
          <div className="text-sm font-light space-y-2">
            <pre>part_number,part_name,category,uom,vendor</pre>
            <pre>
              &quot;12345&quot;,&quot;Bolt 12mm&quot;,&quot;Sparepart,
              Mechanical&quot;,&quot;pcs&quot;,&quot;Vendor A&quot;
            </pre>
            <pre>
              &quot;67890&quot;,&quot;Oil
              Filter&quot;,&quot;Engine&quot;,&quot;unit&quot;,&quot;Vendor
              B&quot;
            </pre>
            <pre>
              &quot;11223&quot;,&quot;Bearing&quot;,&quot;Mechanical,
              Rotating&quot;,&quot;pcs&quot;,&quot;Vendor C&quot;
            </pre>
          </div>
          <Textarea
            placeholder="Paste data barang dalam format CSV di sini..."
            rows={10}
            onChange={(e) => setDataCSV(e.target.value)}
            value={dataCSV}
          />
          <div className="flex justify-end">
            <Button onClick={handleAddBarangBatch} disabled={loading}>
              {loading ? "Loading..." : "Tambah"}
            </Button>
          </div>
        </div>
      </Content>
    </>
  );
}
