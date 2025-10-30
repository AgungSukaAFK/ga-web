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
import { LinkIcon, Loader2, Trash2, Edit as EditIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogTitle,
  DialogHeader, // Import DialogHeader
} from "@/components/ui/dialog";
// Hapus AlertDialogHeader jika tidak digunakan, ganti dengan DialogHeader
// import { AlertDialogHeader } from "@/components/ui/alert-dialog";
import { toast } from "sonner";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import {
  getActiveUserProfile,
  generateMRCode,
  uploadAttachment,
  removeAttachment,
  createMaterialRequest,
  // fetchActiveCostCenters, // Kita tidak perlu fetch CC di sini lagi
} from "@/services/mrService";
import { Checkbox } from "@/components/ui/checkbox";
import { CurrencyInput } from "@/components/ui/currency-input"; // Pastikan Anda punya komponen ini
import { formatCurrency } from "@/lib/utils"; // Import formatCurrency

const kategoriData: ComboboxData = [
  { label: "New Item", value: "New Item" },
  { label: "Replace Item", value: "Replace Item" },
  { label: "Fix & Repair", value: "Fix & Repair" },
  { label: "Upgrade", value: "Upgrade" },
];

// HAPUS dataCostCenter

const dataLokasi: ComboboxData = [
  // ... (data lokasi tetap sama)
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

const dataUoM: ComboboxData = [
  { label: "Pcs", value: "Pcs" },
  { label: "Unit", value: "Unit" },
  { label: "Set", value: "Set" },
  { label: "Box", value: "Box" },
  { label: "Rim", value: "Rim" },
  { label: "Roll", value: "Roll" },
];

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

  const [formCreateMR, setFormCreateMR] = useState<Omit<MaterialRequest, "id">>(
    {
      userid: "",
      kode_mr: "Memuat...",
      kategori: "",
      status: "Pending Validation",
      remarks: "",
      cost_estimation: "0", // Default ke string "0"
      department: "",
      company_code: "",
      cost_center_id: null, // REVISI: Selalu null saat dibuat
      tujuan_site: "",
      created_at: new Date(),
      due_date: new Date(),
      orders: [],
      approvals: [],
      attachments: [],
      discussions: [],
    }
  );

  const [userLokasi, setUserLokasi] = useState("");
  const [formattedCost, setFormattedCost] = useState("Rp 0"); // State untuk tampilan auto-sum
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
          setUserLokasi(profile.lokasi);

          setFormCreateMR((prev) => ({
            ...prev,
            department: profile.department || "",
            company_code: profile.company || "",
            tujuan_site: profile.lokasi || "",
            kode_mr: newKodeMR,
          }));
        } else {
          toast.warning("Profil belum lengkap.");
        }
      } catch (error: any) {
        toast.error("Gagal mengambil profil user", {
          description: error.message,
        });
      }
    };
    fetchUserData();
  }, []);

  // --- REVISI: useEffect untuk Auto-Sum Estimasi Biaya ---
  useEffect(() => {
    const total = formCreateMR.orders.reduce((acc, item) => {
      const qty = Number(item.qty) || 0;
      const price = Number(item.estimasi_harga) || 0;
      return acc + qty * price;
    }, 0);

    setFormCreateMR((prev) => ({
      ...prev,
      cost_estimation: String(total), // Update state utama dengan angka (sebagai string)
    }));
    setFormattedCost(formatCurrency(total)); // Update state tampilan
  }, [formCreateMR.orders]);

  const handleCBKategori = (value: string) => {
    setFormCreateMR({ ...formCreateMR, kategori: value });
  };

  // HAPUS handler 'handleCBCostCenter'

  const handleCBTujuanSite = (value: string) => {
    setFormCreateMR({ ...formCreateMR, tujuan_site: value });
  };

  useEffect(() => {
    if (tujuanSamaDenganLokasi) {
      setFormCreateMR((prev) => ({ ...prev, tujuan_site: userLokasi }));
    } else {
      if (userLokasi) {
        setFormCreateMR((prev) => ({ ...prev, tujuan_site: "" }));
      }
    }
  }, [tujuanSamaDenganLokasi, userLokasi]);

  // HAPUS handler 'handleCostChange' karena sudah auto-sum

  const [openItemDialog, setOpenItemDialog] = useState(false);
  // REVISI: State 'orderItem' baru
  const [orderItem, setOrderItem] = useState<
    Omit<Order, "vendor" | "vendor_contact">
  >({
    name: "",
    qty: "1",
    uom: "Pcs",
    estimasi_harga: 0,
    url: "",
    note: "",
  });

  const handleOpenAddItemDialog = () => {
    setEditingIndex(null);
    setOrderItem({
      name: "",
      qty: "1",
      uom: "Pcs",
      estimasi_harga: 0,
      url: "",
      note: "",
    });
    setOpenItemDialog(true);
  };

  const handleOpenEditItemDialog = (index: number) => {
    setEditingIndex(index);
    setOrderItem(formCreateMR.orders[index]);
    setOpenItemDialog(true);
  };

  const [editingIndex, setEditingIndex] = useState<number | null>(null);

  const handleSaveOrUpdateItem = () => {
    if (
      !orderItem.name.trim() ||
      !orderItem.qty.trim() ||
      !orderItem.uom.trim()
    ) {
      toast.error("Nama item, quantity, dan UoM harus diisi.");
      return;
    }

    // Pastikan estimasi_harga adalah angka
    const itemToSave: Order = {
      ...orderItem,
      estimasi_harga: Number(orderItem.estimasi_harga) || 0,
    };

    setFormCreateMR((prevForm) => {
      const updatedOrders = [...prevForm.orders];
      if (editingIndex !== null) {
        updatedOrders[editingIndex] = itemToSave;
      } else {
        updatedOrders.push(itemToSave);
      }
      return { ...prevForm, orders: updatedOrders };
    });

    setOpenItemDialog(false);
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    // ... (Fungsi ini tetap sama)
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
        attachments: [...(prev.attachments || []), ...successfulUploads],
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
    // ... (Fungsi ini tetap sama)
    const toastId = toast.loading("Menghapus file...");
    try {
      await removeAttachment(path);
      const updatedAttachments = (formCreateMR.attachments || []).filter(
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

    // REVISI: Hapus pengecekan cost_center_id
    if (
      !formCreateMR.kategori ||
      !formCreateMR.remarks ||
      !formCreateMR.cost_estimation || // Estimasi biaya masih dicek (hasil auto-sum)
      !formCreateMR.department ||
      // !formCreateMR.cost_center_id || // <-- HAPUS PENGECEKAN INI
      !formCreateMR.tujuan_site ||
      !formCreateMR.company_code
    ) {
      setAjukanAlert(
        "Semua data utama (Kategori, Remarks, Tujuan) wajib diisi."
      );
      return;
    }

    if (formCreateMR.orders.length === 0) {
      setAjukanAlert("Minimal harus ada satu order item.");
      return;
    }

    // Cek apakah estimasi biaya 0
    if (Number(formCreateMR.cost_estimation) <= 0) {
      setAjukanAlert("Total estimasi biaya harus lebih besar dari Rp 0.");
      return;
    }

    const wajibLampiran = ["Replace Item", "Fix & Repair", "Upgrade"];
    if (
      wajibLampiran.includes(formCreateMR.kategori) &&
      (formCreateMR.attachments || []).length === 0
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

      const { company_code, ...payload } = formCreateMR;

      const finalPayload = {
        ...payload,
        cost_estimation: Number(payload.cost_estimation), // Kirim sebagai angka
        cost_center_id: null, // Pastikan dikirim sebagai null
      };

      await createMaterialRequest(finalPayload as any, user.id, company_code);

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
          {/* ... (Kode MR, Perusahaan, Departemen, Lokasi tetap sama) ... */}
          <div className="flex flex-col gap-2 col-span-12">
            {" "}
            <Label>Kode MR</Label>{" "}
            <Input readOnly disabled value={formCreateMR.kode_mr} />{" "}
          </div>
          <div className="flex flex-col gap-2 col-span-12 md:col-span-4">
            {" "}
            <Label>Perusahaan</Label>{" "}
            <Input
              readOnly
              disabled
              value={formCreateMR.company_code || "Memuat..."}
            />{" "}
          </div>
          <div className="flex flex-col gap-2 col-span-12 md:col-span-4">
            {" "}
            <Label>Departemen</Label>{" "}
            <Input
              readOnly
              disabled
              value={formCreateMR.department || "Memuat..."}
            />{" "}
          </div>
          <div className="flex flex-col gap-2 col-span-12 md:col-span-4">
            {" "}
            <Label>Lokasi Saya (Pengaju)</Label>{" "}
            <Input readOnly disabled value={userLokasi || "Memuat..."} />{" "}
          </div>

          <div className="flex flex-col gap-2 col-span-12 md:col-span-6">
            <Label>Kategori</Label>
            <Combobox
              data={kategoriData}
              onChange={handleCBKategori}
              placeholder="Pilih kategori..."
              defaultValue={formCreateMR.kategori}
            />
          </div>

          {/* REVISI: Hapus Combobox Cost Center */}
          <div className="flex flex-col gap-2 col-span-12 md:col-span-6">
            <Label>Estimasi Biaya (Otomatis)</Label>
            <Input
              readOnly
              disabled
              value={formattedCost}
              className="font-bold text-lg"
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
                  defaultValue={formCreateMR.tujuan_site}
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

          {/* REVISI: Hapus Input Estimasi Biaya Manual */}
        </div>
      </Content>

      <Content
        title="Order Item"
        size="lg"
        cardAction={
          <Button
            variant="outline"
            disabled={loading}
            onClick={handleOpenAddItemDialog}
          >
            Tambah Order Item
          </Button>
        }
      >
        <div className="rounded-md border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>No</TableHead>
                <TableHead>Nama Item</TableHead>
                <TableHead>Qty</TableHead>
                <TableHead>Estimasi Harga</TableHead>
                <TableHead>Total Estimasi</TableHead>
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
                  <TableCell>{formatCurrency(order.estimasi_harga)}</TableCell>
                  <TableCell className="font-medium">
                    {formatCurrency(Number(order.qty) * order.estimasi_harga)}
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
                  <TableCell className="space-x-1">
                    <Button
                      variant="outline"
                      size="icon"
                      className="h-8 w-8"
                      onClick={() => handleOpenEditItemDialog(index)}
                    >
                      <EditIcon className="w-4 h-4" />
                    </Button>
                    <Button
                      variant="destructive"
                      size="icon"
                      className="h-8 w-8"
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
              {formCreateMR.orders.length === 0 && (
                <TableRow>
                  <TableCell
                    colSpan={7}
                    className="text-center h-24 text-muted-foreground"
                  >
                    Belum ada item ditambahkan.
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </div>
      </Content>

      {/* REVISI: Dialog Item */}
      <Dialog open={openItemDialog} onOpenChange={setOpenItemDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {editingIndex !== null ? "Edit Order Item" : "Tambah Order Item"}
            </DialogTitle>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="grid grid-cols-4 items-center gap-4">
              <Label htmlFor="itemName" className="text-right">
                Nama Item
              </Label>
              <Input
                id="itemName"
                className="col-span-3"
                value={orderItem.name}
                onChange={(e) =>
                  setOrderItem({ ...orderItem, name: e.target.value })
                }
              />
            </div>
            <div className="grid grid-cols-4 items-center gap-4">
              <Label htmlFor="itemUom" className="text-right">
                UoM
              </Label>
              <div className="col-span-3">
                <Combobox
                  data={dataUoM}
                  onChange={(value) =>
                    setOrderItem({ ...orderItem, uom: value })
                  }
                  defaultValue={orderItem.uom}
                  placeholder="Pilih UoM..."
                />
              </div>
            </div>
            <div className="grid grid-cols-4 items-center gap-4">
              <Label htmlFor="itemQty" className="text-right">
                Quantity
              </Label>
              <Input
                id="itemQty"
                className="col-span-3"
                type="number"
                value={orderItem.qty}
                onChange={(e) =>
                  setOrderItem({ ...orderItem, qty: e.target.value })
                }
              />
            </div>
            {/* REVISI: Ganti Vendor dengan Estimasi Harga */}
            <div className="grid grid-cols-4 items-center gap-4">
              <Label htmlFor="estimasi_harga" className="text-right">
                Estimasi Harga
              </Label>
              <CurrencyInput
                id="estimasi_harga"
                className="col-span-3"
                value={orderItem.estimasi_harga}
                onValueChange={(value) =>
                  setOrderItem({ ...orderItem, estimasi_harga: value })
                }
              />
            </div>

            <div className="grid grid-cols-4 items-center gap-4">
              <Label htmlFor="itemUrl" className="text-right">
                Link Ref.
              </Label>
              <Input
                id="itemUrl"
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
              <Label htmlFor="itemNote" className="text-right">
                Catatan
              </Label>
              <Textarea
                id="itemNote"
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
            <Button onClick={handleSaveOrUpdateItem}>
              {editingIndex !== null ? "Simpan Perubahan" : "Tambah"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Content title="Lampiran File" size="sm">
        {/* ... (Konten lampiran tetap sama) ... */}
        <div className="flex flex-col gap-4">
          {" "}
          <div className="flex flex-col gap-2">
            {" "}
            <Label htmlFor="attachments">
              {" "}
              Unggah lampiran (wajib untuk Replace, Fix & Repair, Upgrade){" "}
            </Label>{" "}
            <Input
              id="attachments"
              type="file"
              multiple
              disabled={loading || isUploading}
              onChange={handleFileUpload}
            />{" "}
            {isUploading && (
              <div className="flex items-center text-sm text-muted-foreground">
                {" "}
                <Loader2 className="mr-2 h-4 w-4 animate-spin" /> Mengunggah...{" "}
              </div>
            )}{" "}
          </div>{" "}
          {(formCreateMR.attachments || []).length > 0 && (
            <Table>
              {" "}
              <TableHeader>
                {" "}
                <TableRow>
                  {" "}
                  <TableHead>No</TableHead> <TableHead>Nama File</TableHead>{" "}
                  <TableHead>Aksi</TableHead>{" "}
                </TableRow>{" "}
              </TableHeader>{" "}
              <TableBody>
                {" "}
                {formCreateMR.attachments.map((att, index) => (
                  <TableRow key={index}>
                    {" "}
                    <TableCell>{index + 1}</TableCell>{" "}
                    <TableCell className="truncate max-w-xs">
                      {" "}
                      {att.name}{" "}
                    </TableCell>{" "}
                    <TableCell>
                      {" "}
                      <Button
                        variant="destructive"
                        size="icon"
                        onClick={() => handleRemoveAttachment(index, att.url)}
                      >
                        {" "}
                        <Trash2 className="w-4 h-4" />{" "}
                      </Button>{" "}
                    </TableCell>{" "}
                  </TableRow>
                ))}{" "}
              </TableBody>{" "}
            </Table>
          )}{" "}
        </div>
      </Content>

      <Content size="lg">
        {/* ... (Tombol Ajukan MR tetap sama) ... */}
        <div className="flex flex-col gap-4">
          {" "}
          {ajukanAlert && (
            <Alert variant="destructive">
              {" "}
              <AlertTitle>Perhatian!</AlertTitle>{" "}
              <AlertDescription>{ajukanAlert}</AlertDescription>{" "}
            </Alert>
          )}{" "}
          <Button
            onClick={handleAjukanMR}
            disabled={loading || isUploading}
            className="w-full"
          >
            {" "}
            {loading ? (
              <>
                {" "}
                <Loader2 className="mr-2 h-4 w-4 animate-spin" /> Mengajukan...{" "}
              </>
            ) : (
              "Buat Material Request"
            )}{" "}
          </Button>{" "}
        </div>
      </Content>
    </>
  );
}
