// src/app/(With Sidebar)/petty-cash/buat/page.tsx

"use client";

import { Content } from "@/components/content";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { createClient } from "@/lib/supabase/client";
import { useState, useEffect } from "react";
import { toast } from "sonner";
import { useRouter } from "next/navigation";
import { createPettyCash } from "@/services/pettyCashService";
import { PettyCashType } from "@/type";
import { PETTY_CASH_TYPE_OPTIONS } from "@/type/enum";
import {
  Loader2,
  Save,
  UploadCloud,
  X,
  ReceiptText,
  Info,
  UserCircle,
} from "lucide-react";

export default function CreatePettyCashPage() {
  const router = useRouter();
  const supabase = createClient();

  const [loading, setLoading] = useState(false);
  const [uploading, setUploading] = useState(false);

  // State Profil User
  const [profile, setProfile] = useState<{
    company: string;
    department: string;
    nama: string;
  } | null>(null);

  // State Form (Cost Center dihilangkan, diset null nanti)
  const [formData, setFormData] = useState({
    type: "Reimbursement" as PettyCashType,
    amount: "", // Disimpan sebagai string angka murni ("1500000")
    purpose: "",
    needed_date: new Date().toISOString().split("T")[0],
    attachments: [] as { url: string; name: string }[],
  });

  // Fetch Profile
  useEffect(() => {
    const fetchInitialData = async () => {
      try {
        const {
          data: { user },
        } = await supabase.auth.getUser();
        if (!user) throw new Error("User tidak terautentikasi.");

        const { data: userProfile, error: profileError } = await supabase
          .from("profiles")
          .select("company, department, nama")
          .eq("id", user.id)
          .single();

        if (profileError) throw profileError;
        setProfile(userProfile);
      } catch (error: any) {
        toast.error("Gagal memuat data awal", { description: error.message });
      }
    };
    fetchInitialData();
  }, []);

  // Handler Input Currency (Format langsung di kotak input)
  const handleAmountChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    // Hapus semua karakter selain angka (biar huruf tidak bisa diketik)
    const rawValue = e.target.value.replace(/[^0-9]/g, "");
    setFormData({ ...formData, amount: rawValue });
  };

  // Fungsi untuk menampilkan angka berformat ribuan di layar
  const formatDisplayAmount = (val: string) => {
    if (!val) return "";
    return new Intl.NumberFormat("id-ID").format(Number(val));
  };

  // Handler Upload
  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (file.size > 5 * 1024 * 1024) {
      return toast.error("Ukuran file maksimal 5MB.");
    }

    setUploading(true);
    try {
      const fileExt = file.name.split(".").pop();
      const fileName = `${Date.now()}-${Math.random().toString(36).substring(2)}.${fileExt}`;
      const filePath = `petty-cash/${fileName}`;

      const { error: uploadError } = await supabase.storage
        .from("mr-attachments")
        .upload(filePath, file);

      if (uploadError) throw uploadError;

      const { data: publicUrlData } = supabase.storage
        .from("mr-attachments")
        .getPublicUrl(filePath);

      setFormData((prev) => ({
        ...prev,
        attachments: [
          ...prev.attachments,
          { url: publicUrlData.publicUrl, name: file.name },
        ],
      }));
      toast.success("Lampiran berhasil diunggah");
    } catch (error: any) {
      toast.error("Gagal mengunggah file", { description: error.message });
    } finally {
      setUploading(false);
      e.target.value = "";
    }
  };

  const removeAttachment = (index: number) => {
    setFormData((prev) => ({
      ...prev,
      attachments: prev.attachments.filter((_, i) => i !== index),
    }));
  };

  // Handler Submit
  const handleSubmit = async () => {
    if (!formData.amount || Number(formData.amount) <= 0)
      return toast.error("Nominal wajib diisi dan valid.");
    if (!formData.purpose.trim())
      return toast.error("Keterangan/Tujuan wajib diisi dengan detail.");
    if (!profile?.company || !profile?.department)
      return toast.error("Data profil (Company/Dept) tidak lengkap.");

    if (
      formData.type === "Reimbursement" &&
      formData.attachments.length === 0
    ) {
      return toast.error(
        "Pengajuan tipe Reimbursement wajib melampirkan bukti struk.",
      );
    }

    setLoading(true);
    try {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) throw new Error("Sesi login berakhir.");

      await createPettyCash(
        {
          company_code: profile.company,
          department: profile.department,
          cost_center_id: null as any, // CC di set null, GA yang akan mengisi
          type: formData.type,
          amount: Number(formData.amount),
          purpose: formData.purpose,
          needed_date: formData.needed_date,
          attachments: formData.attachments,
        },
        user.id,
      );

      toast.success("Pengajuan Petty Cash berhasil dikirim!");
      router.push("/petty-cash");
    } catch (error: any) {
      toast.error("Gagal mengirim pengajuan", { description: error.message });
    } finally {
      setLoading(false);
    }
  };

  return (
    <Content
      title="Buat Pengajuan Petty Cash"
      description="Isi form di bawah ini untuk mengajukan dana kas kecil operasional."
    >
      <div className="grid grid-cols-1 xl:grid-cols-3 gap-6 pb-10 items-start">
        {/* KOLOM KIRI: FORM UTAMA (Lebih lebar) */}
        <div className="xl:col-span-2 space-y-6">
          <Card>
            <CardHeader className="border-b bg-muted/20 pb-4">
              <CardTitle className="text-lg flex items-center gap-2">
                <ReceiptText className="h-5 w-5 text-primary" />
                Rincian Pengajuan
              </CardTitle>
              <CardDescription>
                Pilih tipe dan masukkan nominal dana yang dibutuhkan.
              </CardDescription>
            </CardHeader>
            <CardContent className="p-6 space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="space-y-2">
                  <Label>
                    Kategori / Tipe Pengajuan{" "}
                    <span className="text-red-500">*</span>
                  </Label>
                  <Select
                    value={formData.type}
                    onValueChange={(val: PettyCashType) =>
                      setFormData({ ...formData, type: val })
                    }
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Pilih Tipe..." />
                    </SelectTrigger>
                    <SelectContent>
                      {PETTY_CASH_TYPE_OPTIONS.map((opt) => (
                        <SelectItem key={opt} value={opt}>
                          {opt}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label>
                    Tanggal Dibutuhkan / Transaksi{" "}
                    <span className="text-red-500">*</span>
                  </Label>
                  <Input
                    type="date"
                    value={formData.needed_date}
                    onChange={(e) =>
                      setFormData({ ...formData, needed_date: e.target.value })
                    }
                  />
                </div>
              </div>

              {/* INPUT NOMINAL (SUDAH DIPERBAIKI) */}
              <div className="space-y-2">
                <Label>
                  Nominal Pengajuan <span className="text-red-500">*</span>
                </Label>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                    <span className="text-muted-foreground font-semibold">
                      Rp
                    </span>
                  </div>
                  <Input
                    type="text" // Diubah ke text agar tidak bereaksi pada scroll mouse
                    inputMode="numeric" // Memunculkan numpad di HP
                    placeholder="0"
                    className="pl-10 text-lg font-medium h-12"
                    value={formatDisplayAmount(formData.amount)}
                    onChange={handleAmountChange}
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label>
                  Tujuan Penggunaan (Keterangan Detail){" "}
                  <span className="text-red-500">*</span>
                </Label>
                <Textarea
                  placeholder="Jelaskan secara rinci tujuan penggunaan dana ini..."
                  rows={4}
                  className="resize-none"
                  value={formData.purpose}
                  onChange={(e) =>
                    setFormData({ ...formData, purpose: e.target.value })
                  }
                />
              </div>

              <div className="space-y-2 pt-2">
                <Label className="flex items-center gap-2">
                  Lampiran (Struk/Nota/Invoice)
                  {formData.type === "Reimbursement" && (
                    <span className="text-red-500">* Wajib</span>
                  )}
                </Label>
                <div className="p-4 border-2 border-dashed rounded-lg bg-muted/10 transition-colors hover:bg-muted/30">
                  <div className="flex flex-col sm:flex-row items-center justify-between gap-4">
                    <div className="text-sm text-muted-foreground text-center sm:text-left">
                      <p className="font-medium text-foreground">
                        Upload Bukti Pendukung
                      </p>
                      <p className="text-xs">
                        Format: JPG, PNG, PDF. Maks: 5MB.
                      </p>
                    </div>
                    <Input
                      type="file"
                      className="hidden"
                      id="file-upload"
                      onChange={handleFileUpload}
                      disabled={uploading}
                    />
                    <Button
                      asChild
                      variant="outline"
                      className="cursor-pointer shrink-0"
                      disabled={uploading}
                    >
                      <label htmlFor="file-upload">
                        {uploading ? (
                          <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                        ) : (
                          <UploadCloud className="h-4 w-4 mr-2" />
                        )}
                        {uploading ? "Mengunggah..." : "Pilih File"}
                      </label>
                    </Button>
                  </div>
                </div>

                {formData.attachments.length > 0 && (
                  <div className="grid gap-2 mt-4">
                    {formData.attachments.map((file, index) => (
                      <div
                        key={index}
                        className="flex items-center justify-between p-3 bg-background border rounded-md shadow-sm"
                      >
                        <a
                          href={file.url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-sm font-medium text-primary hover:underline truncate max-w-[85%]"
                        >
                          {file.name}
                        </a>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8 text-destructive hover:text-destructive/80 hover:bg-destructive/10"
                          onClick={() => removeAttachment(index)}
                        >
                          <X className="h-4 w-4" />
                        </Button>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </CardContent>
          </Card>

          {/* ACTION BUTTONS */}
          <div className="flex justify-end gap-3">
            <Button
              variant="outline"
              onClick={() => router.back()}
              disabled={loading}
            >
              Batal
            </Button>
            <Button onClick={handleSubmit} disabled={loading}>
              {loading ? (
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              ) : (
                <Save className="h-4 w-4 mr-2" />
              )}
              Kirim Pengajuan PC
            </Button>
          </div>
        </div>

        {/* KOLOM KANAN: PANEL INFO */}
        <div className="space-y-6">
          {/* Card Pemohon */}
          <Card>
            <CardHeader className="pb-3 border-b bg-muted/20">
              <CardTitle className="text-base flex items-center gap-2">
                <UserCircle className="h-5 w-5 text-muted-foreground" />
                Data Pemohon
              </CardTitle>
            </CardHeader>
            <CardContent className="p-4 text-sm space-y-4">
              <div>
                <p className="text-muted-foreground text-xs mb-1">
                  Nama Lengkap
                </p>
                <p className="font-semibold">{profile?.nama || "Memuat..."}</p>
              </div>
              <div>
                <p className="text-muted-foreground text-xs mb-1">Departemen</p>
                <p className="font-semibold">{profile?.department || "-"}</p>
              </div>
              <div>
                <p className="text-muted-foreground text-xs mb-1">
                  Perusahaan (Company)
                </p>
                <p className="font-semibold">{profile?.company || "-"}</p>
              </div>
            </CardContent>
          </Card>

          {/* Card Guideline */}
          <Card className="bg-primary/5 border-primary/20">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm flex items-center gap-2 text-primary">
                <Info className="h-4 w-4" />
                Informasi Penting
              </CardTitle>
            </CardHeader>
            <CardContent className="text-xs text-muted-foreground space-y-3 pb-4">
              <p>
                <strong className="text-foreground">Reimbursement:</strong> Dana
                diganti setelah Anda menggunakan uang pribadi. Wajib mengunggah
                nota/struk asli.
              </p>
              <p>
                <strong className="text-foreground">
                  Cash Advance (Kasbon):
                </strong>{" "}
                Dana diberikan di awal. Anda{" "}
                <span className="text-red-500 font-medium">wajib</span>{" "}
                melakukan pelaporan (Settlement) dan mengunggah struk maksimal 3
                hari setelah kegiatan.
              </p>
              <p>
                * Pembebanan{" "}
                <strong className="text-foreground">Cost Center</strong> akan
                ditentukan dan divalidasi oleh tim General Affair / Finance.
              </p>
            </CardContent>
          </Card>
        </div>
      </div>
    </Content>
  );
}
