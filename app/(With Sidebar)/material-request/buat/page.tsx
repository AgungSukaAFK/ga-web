// src/app/(With Sidebar)/material-request/buat/page.tsx

"use client";

import { Content } from "@/components/content";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { MaterialRequest, Order, Attachment } from "@/type";
import { Combobox, ComboboxData } from "@/components/combobox";
import { Textarea } from "@/components/ui/textarea";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { LinkIcon, Loader2, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { AlertDialogHeader } from "@/components/ui/alert-dialog";
import { toast } from "sonner";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import {
  getActiveUserProfile,
  generateMRCode,
  uploadAttachment,
  removeAttachment,
  createMaterialRequest,
} from "@/services/mrService";
import { Checkbox } from "@/components/ui/checkbox";

// Data kategori
const kategoriData: ComboboxData = [
  { label: "New Item", value: "New Item" },
  { label: "Replace Item", value: "Replace Item" },
  { label: "Fix & Repair", value: "Fix & Repair" },
  { label: "Upgrade", value: "Upgrade" },
];

const dataCostCenter: ComboboxData = [
  { label: "APD", value: "APD" },
  { label: "Bangunan", value: "Bangunan" },
  { label: "Alat Berat", value: "Alat Berat" },
  { label: "Operasional Kantor", value: "Operasional Kantor" },
  { label: "Lainnya", value: "Lainnya" },
];

const dataLokasi: ComboboxData = [
  { label: "Head Office", value: "Head Office" },
  { label: "Tanjung Enim", value: "Tanjung Enim" },
  { label: "Balikpapan", value: "Balikpapan" },
  { label: "Site BA", value: "Site BA" },
  { label: "Site TAL", value: "Site TAL" },
  { label: "Site MIP", value: "Site MIP" },
  { label: "Site MIFA", value: "Site MIFA" },
  { label: "Site BIB", value: "Site BIB" },
  { label: "Site AMI", value: "Site AMI" },
  { label: "Site Tabang", value: "Site Tabang" },
];

// Helper format tanggal (asumsi ada di utils)
const formatDateFriendly = (date?: Date): string => {
  if (!date) return "";
  return new Date(date).toLocaleDateString("id-ID", {
    weekday: "long",
    year: "numeric",
    month: "long",
    day: "numeric",
  });
};

export default function BuatMRPage() {
  const router = useRouter();

  // REVISI: Inisialisasi state agar sesuai dengan tipe (string, bukan null/undefined)
  const [formCreateMR, setFormCreateMR] = useState<Omit<MaterialRequest, "id">>(
    {
      userid: "",
      kode_mr: "Memuat...",
      kategori: "",
      status: "Pending Validation",
      remarks: "",
      cost_estimation: "",
      department: "",
      company_code: "",
      cost_center: "",
      tujuan_site: "",
      created_at: new Date(),
      due_date: new Date(),
      orders: [],
      approvals: [],
      attachments: [],
      discussions: [],
    }
  );

  const [userLokasi, setUserLokasi] = useState(""); // State untuk menyimpan lokasi user
  const [formattedCost, setFormattedCost] = useState("Rp 0");
  const [loading, setLoading] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [tujuanSamaDenganLokasi, setTujuanSamaDenganLokasi] = useState(true);

  useEffect(() => {
    const fetchUserData = async () => {
      try {
        const profile = await getActiveUserProfile();
        if (
          profile &&
          profile.department &&
          profile.lokasi &&
          profile.company
        ) {
          const newKodeMR = await generateMRCode(
            profile.department,
            profile.lokasi
          );
          setUserLokasi(profile.lokasi); // Simpan lokasi user

          // REVISI: Pastikan semua nilai adalah string, bukan null
          setFormCreateMR((prev) => ({
            ...prev,
            department: profile.department || "",
            company_code: profile.company || "",
            tujuan_site: profile.lokasi || "", // Set tujuan awal sama dengan lokasi
            kode_mr: newKodeMR,
          }));
        } else {
          toast.warning("Profil belum lengkap.", {
            description: "Departemen, Lokasi, atau Company tidak ditemukan.",
          });
        }
      } catch (error: any) {
        toast.error("Gagal mengambil profil user", {
          description: error.message,
        });
      }
    };
    fetchUserData();
  }, []); // Hanya perlu dijalankan sekali

  const handleCBKategori = (value: string) => {
    setFormCreateMR({ ...formCreateMR, kategori: value });
  };

  const handleCBCostCenter = (value: string) => {
    setFormCreateMR({ ...formCreateMR, cost_center: value });
  };

  const handleCBTujuanSite = (value: string) => {
    setFormCreateMR({ ...formCreateMR, tujuan_site: value });
  };

  useEffect(() => {
    if (tujuanSamaDenganLokasi) {
      setFormCreateMR((prev) => ({ ...prev, tujuan_site: userLokasi }));
    } else {
      setFormCreateMR((prev) => ({ ...prev, tujuan_site: "" })); // Kosongkan agar user memilih
    }
  }, [tujuanSamaDenganLokasi, userLokasi]);

  const handleCostChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const rawValue = e.target.value.replace(/[^0-9]/g, "");
    const numericValue = parseInt(rawValue, 10) || 0;
    setFormCreateMR((prev) => ({
      ...prev,
      cost_estimation: String(numericValue),
    }));
    const formatted = new Intl.NumberFormat("id-ID", {
      style: "currency",
      currency: "IDR",
      minimumFractionDigits: 0,
    }).format(numericValue);
    setFormattedCost(formatted);
  };

  const [openAddItem, setOpenAddItem] = useState(false);
  const [orderItem, setOrderItem] = useState<Order>({
    name: "",
    qty: "",
    uom: "",
    vendor: "",
    vendor_contact: "",
    url: "",
    note: "",
  });

  const handleAddItem = () => {
    if (
      !orderItem.name.trim() ||
      !orderItem.qty.trim() ||
      !orderItem.uom.trim()
    ) {
      toast.error("Nama item, quantity, dan UoM harus diisi.");
      return;
    }
    setOpenAddItem(false);
    setFormCreateMR({
      ...formCreateMR,
      orders: [...formCreateMR.orders, orderItem],
    });
    setOrderItem({
      name: "",
      qty: "",
      uom: "",
      vendor: "",
      vendor_contact: "",
      url: "",
      note: "",
    });
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0 || formCreateMR.kode_mr === "Memuat...") {
      toast.warning("Kode MR belum siap, tunggu sebentar.");
      return;
    }
    setIsUploading(true);
    const toastId = toast.loading(`Mengunggah ${files.length} file...`);
    const successfulUploads: Attachment[] = [];
    let failedUploads = 0;

    for (const file of files) {
      try {
        const newAttachment = await uploadAttachment(
          file,
          formCreateMR.kode_mr
        );
        successfulUploads.push(newAttachment);
      } catch (error) {
        console.error("Gagal unggah satu file:", error);
        failedUploads++;
      }
    }

    if (successfulUploads.length > 0) {
      setFormCreateMR((prev) => ({
        ...prev,
        attachments: [...prev.attachments, ...successfulUploads],
      }));
      toast.success(`${successfulUploads.length} file berhasil diunggah.`, {
        id: toastId,
      });
    }
    if (failedUploads > 0) {
      toast.error(`Gagal mengunggah ${failedUploads} file.`, { id: toastId });
    } else if (successfulUploads.length === 0) {
      toast.dismiss(toastId);
    }

    setIsUploading(false);
    e.target.value = "";
  };

  const handleRemoveAttachment = async (index: number, path: string) => {
    const toastId = toast.loading("Menghapus file...");
    try {
      await removeAttachment(path);
      const updatedAttachments = formCreateMR.attachments.filter(
        (_, i) => i !== index
      );
      setFormCreateMR((prev) => ({ ...prev, attachments: updatedAttachments }));
      toast.success("File berhasil dihapus.", { id: toastId });
    } catch (error: any) {
      toast.error(`Gagal menghapus file: ${error.message}`, { id: toastId });
    }
  };

  const [ajukanAlert, setAjukanAlert] = useState<string>("");

  const handleAjukanMR = async () => {
    setAjukanAlert("");
    if (
      !formCreateMR.kategori ||
      !formCreateMR.remarks ||
      !formCreateMR.cost_estimation ||
      !formCreateMR.department ||
      !formCreateMR.cost_center ||
      !formCreateMR.tujuan_site ||
      !formCreateMR.company_code
    ) {
      setAjukanAlert(
        "Semua data utama (Kategori, Remarks, Estimasi Biaya, Cost Center, dan Tujuan) wajib diisi."
      );
      return;
    }
    if (formCreateMR.orders.length === 0) {
      setAjukanAlert("Minimal harus ada satu order item.");
      return;
    }
    const wajibLampiran = ["Replace Item", "Fix & Repair", "Upgrade"];
    if (
      wajibLampiran.includes(formCreateMR.kategori) &&
      formCreateMR.attachments.length === 0
    ) {
      setAjukanAlert(
        `Kategori '${formCreateMR.kategori}' wajib menyertakan lampiran.`
      );
      return;
    }

    setLoading(true);
    const toastId = toast.loading("Mengajukan MR...");

    try {
      const s = createClient();
      const {
        data: { user },
      } = await s.auth.getUser();
      if (!user) throw new Error("User tidak ditemukan.");

      // REVISI: Pisahkan company_code dari payload utama
      const { company_code, ...payload } = formCreateMR;

      await createMaterialRequest(payload, user.id, company_code);

      toast.success("Material Request berhasil dibuat dan menunggu validasi!", {
        id: toastId,
      });
      router.push("/material-request");
    } catch (err: any) {
      toast.error(`Gagal mengajukan MR: ${err.message}`, { id: toastId });
      setAjukanAlert(`Terjadi kesalahan: ${err.message}`);
    } finally {
      setLoading(false);
    }
  };

  return (
    <>
      <Content
        title="Buat Material Request Baru"
        description="Isi data pada form di bawah ini. Departemen & Lokasi Anda akan terisi otomatis."
      >
        <div className="grid grid-cols-12 gap-4">
          <div className="flex flex-col gap-2 col-span-12">
            <Label>Kode MR</Label>
            <Input readOnly disabled value={formCreateMR.kode_mr} />
          </div>
          <div className="flex flex-col gap-2 col-span-12 md:col-span-4">
            <Label>Perusahaan</Label>
            <Input
              readOnly
              disabled
              value={formCreateMR.company_code || "Memuat..."}
            />
          </div>
          <div className="flex flex-col gap-2 col-span-12 md:col-span-4">
            <Label>Departemen</Label>
            <Input
              readOnly
              disabled
              value={formCreateMR.department || "Memuat..."}
            />
          </div>
          <div className="flex flex-col gap-2 col-span-12 md:col-span-4">
            <Label>Lokasi Saya (Pengaju)</Label>
            <Input readOnly disabled value={userLokasi || "Memuat..."} />
          </div>

          <div className="flex flex-col gap-2 col-span-12 md:col-span-6">
            <Label>Kategori</Label>
            <Combobox
              data={kategoriData}
              onChange={handleCBKategori}
              placeholder="Pilih kategori..."
            />
          </div>

          <div className="flex flex-col gap-2 col-span-12 md:col-span-6">
            <Label>Cost Center</Label>
            <Combobox
              data={dataCostCenter}
              onChange={handleCBCostCenter}
              placeholder="Pilih cost center..."
            />
          </div>

          <div className="flex flex-col gap-2 col-span-12">
            <Label>Remarks (Tujuan & Latar Belakang)</Label>
            <Textarea
              placeholder="Jelaskan tujuan dan latar belakang kebutuhan Anda di sini..."
              value={formCreateMR.remarks}
              rows={4}
              onChange={(e) =>
                setFormCreateMR({ ...formCreateMR, remarks: e.target.value })
              }
            />
          </div>

          <div className="flex flex-col gap-2 col-span-12 md:col-span-6">
            <Label>Tujuan Pengiriman (Site)</Label>
            <div className="flex items-center space-x-2 mt-2">
              <Checkbox
                id="tujuan-sama"
                checked={tujuanSamaDenganLokasi}
                onCheckedChange={(checked) =>
                  setTujuanSamaDenganLokasi(checked as boolean)
                }
              />
              <label
                htmlFor="tujuan-sama"
                className="text-sm font-medium leading-none"
              >
                Tujuan sama dengan lokasi saya
              </label>
            </div>
            {!tujuanSamaDenganLokasi && (
              <div className="mt-2 animate-in fade-in">
                <Combobox
                  data={dataLokasi}
                  onChange={handleCBTujuanSite}
                  placeholder="Pilih lokasi tujuan..."
                />
              </div>
            )}
          </div>

          <div className="flex flex-col gap-2 col-span-12 md:col-span-6">
            <Label>Due Date</Label>
            <Input
              type="date"
              min={new Date().toISOString().slice(0, 10)}
              value={
                formCreateMR.due_date
                  ? new Date(formCreateMR.due_date).toISOString().slice(0, 10)
                  : ""
              }
              onChange={(e) =>
                setFormCreateMR({
                  ...formCreateMR,
                  due_date: e.target.value
                    ? new Date(e.target.value)
                    : undefined,
                })
              }
            />
            {formCreateMR.due_date && (
              <p className="text-xs text-muted-foreground mt-1">
                {formatDateFriendly(formCreateMR.due_date)}
              </p>
            )}
          </div>

          <div className="flex flex-col gap-2 col-span-12">
            <Label>Estimasi Biaya</Label>
            <Input
              type="text"
              placeholder="Rp 500.000"
              value={formattedCost}
              onChange={handleCostChange}
            />
          </div>
        </div>
      </Content>

      <Content
        title="Order Item"
        size="lg"
        cardAction={
          <Dialog open={openAddItem} onOpenChange={setOpenAddItem}>
            <DialogTrigger asChild>
              <Button variant="outline" disabled={loading}>
                Tambah Order Item
              </Button>
            </DialogTrigger>
            <DialogContent>
              <AlertDialogHeader>
                <DialogTitle>Tambah Order Item</DialogTitle>
              </AlertDialogHeader>
              <div className="grid gap-4 py-4">
                <div className="grid grid-cols-4 items-center gap-4">
                  <Label className="text-right">Nama Item</Label>
                  <Input
                    className="col-span-3"
                    value={orderItem.name}
                    onChange={(e) =>
                      setOrderItem({ ...orderItem, name: e.target.value })
                    }
                  />
                </div>
                <div className="grid grid-cols-4 items-center gap-4">
                  <Label className="text-right">UoM</Label>
                  <div className="col-span-3">
                    <Combobox
                      data={[
                        { label: "Pcs", value: "Pcs" },
                        { label: "Unit", value: "Unit" },
                        { label: "Set", value: "Set" },
                        { label: "Box", value: "Box" },
                        { label: "Rim", value: "Rim" },
                        { label: "Roll", value: "Roll" },
                      ]}
                      onChange={(value) =>
                        setOrderItem({ ...orderItem, uom: value })
                      }
                      defaultValue={orderItem.uom}
                    />
                  </div>
                </div>
                <div className="grid grid-cols-4 items-center gap-4">
                  <Label className="text-right">Quantity</Label>
                  <Input
                    className="col-span-3"
                    type="number"
                    value={orderItem.qty}
                    onChange={(e) =>
                      setOrderItem({ ...orderItem, qty: e.target.value })
                    }
                  />
                </div>
                <div className="grid grid-cols-4 items-center gap-4">
                  <Label className="text-right">Vendor</Label>
                  <Input
                    className="col-span-3"
                    value={orderItem.vendor}
                    onChange={(e) =>
                      setOrderItem({ ...orderItem, vendor: e.target.value })
                    }
                    placeholder="(Opsional)"
                  />
                </div>
                <div className="grid grid-cols-4 items-center gap-4">
                  <Label className="text-right">Link Ref.</Label>
                  <Input
                    type="url"
                    className="col-span-3"
                    value={orderItem.url}
                    onChange={(e) =>
                      setOrderItem({ ...orderItem, url: e.target.value })
                    }
                    placeholder="(Opsional)"
                  />
                </div>
                <div className="grid grid-cols-4 items-center gap-4">
                  <Label className="text-right">Catatan</Label>
                  <Textarea
                    className="col-span-3"
                    value={orderItem.note}
                    onChange={(e) =>
                      setOrderItem({ ...orderItem, note: e.target.value })
                    }
                    placeholder="(Opsional)"
                  />
                </div>
              </div>
              <DialogFooter>
                <Button onClick={handleAddItem}>Tambah</Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        }
      >
        <div className="rounded-md border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>No</TableHead>
                <TableHead>Nama Item</TableHead>
                <TableHead>Qty</TableHead>
                <TableHead>Vendor</TableHead>
                <TableHead>Catatan</TableHead>
                <TableHead>Link</TableHead>
                <TableHead>Aksi</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {formCreateMR.orders.map((order, index) => (
                <TableRow key={index}>
                  <TableCell>{index + 1}</TableCell>
                  <TableCell>{order.name}</TableCell>
                  <TableCell>
                    {order.qty} {order.uom}
                  </TableCell>
                  <TableCell>{order.vendor || "-"}</TableCell>
                  <TableCell className="max-w-xs truncate">
                    {order.note || "-"}
                  </TableCell>
                  <TableCell>
                    {order.url && (
                      <Button asChild variant="outline" size="sm">
                        <Link
                          href={order.url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="flex items-center gap-1"
                        >
                          Link <LinkIcon className="h-3 w-3" />
                        </Link>
                      </Button>
                    )}
                  </TableCell>
                  <TableCell>
                    <Button
                      variant="destructive"
                      size="icon"
                      onClick={() => {
                        const updatedOrders = formCreateMR.orders.filter(
                          (_, i) => i !== index
                        );
                        setFormCreateMR({
                          ...formCreateMR,
                          orders: updatedOrders,
                        });
                      }}
                    >
                      <Trash2 className="w-4 h-4" />
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      </Content>

      <Content title="Lampiran File" size="sm">
        <div className="flex flex-col gap-4">
          <div className="flex flex-col gap-2">
            <Label htmlFor="attachments">
              Unggah lampiran (wajib untuk Replace, Fix & Repair, Upgrade)
            </Label>
            <Input
              id="attachments"
              type="file"
              multiple
              disabled={loading || isUploading}
              onChange={handleFileUpload}
            />
            {isUploading && (
              <div className="flex items-center text-sm text-muted-foreground">
                <Loader2 className="mr-2 h-4 w-4 animate-spin" /> Mengunggah...
              </div>
            )}
          </div>
          {formCreateMR.attachments.length > 0 && (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>No</TableHead>
                  <TableHead>Nama File</TableHead>
                  <TableHead>Aksi</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {formCreateMR.attachments.map((att, index) => (
                  <TableRow key={index}>
                    <TableCell>{index + 1}</TableCell>
                    <TableCell className="truncate max-w-xs">
                      {att.name}
                    </TableCell>
                    <TableCell>
                      <Button
                        variant="destructive"
                        size="icon"
                        onClick={() => handleRemoveAttachment(index, att.url)}
                      >
                        <Trash2 className="w-4 h-4" />
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </div>
      </Content>

      <Content size="lg">
        <div className="flex flex-col gap-4">
          {ajukanAlert && (
            <Alert variant="destructive">
              <AlertTitle>Perhatian!</AlertTitle>
              <AlertDescription>{ajukanAlert}</AlertDescription>
            </Alert>
          )}
          <Button
            onClick={handleAjukanMR}
            disabled={loading || isUploading}
            className="w-full"
          >
            {loading ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" /> Mengajukan...
              </>
            ) : (
              "Buat Material Request"
            )}
          </Button>
        </div>
      </Content>
    </>
  );
}
