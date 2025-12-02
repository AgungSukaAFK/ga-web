// src/app/(With Sidebar)/material-request/buat/page.tsx

"use client";

import { Content } from "@/components/content";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { MaterialRequest, Order, Attachment, Barang } from "@/type"; // REVISI: Import Barang
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
import {
  LinkIcon,
  Loader2,
  Trash2,
  Edit as EditIcon,
  Calendar as CalendarIcon,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogTitle,
  DialogHeader,
} from "@/components/ui/dialog";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";
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
import { CurrencyInput } from "@/components/ui/currency-input";
import { formatCurrency, cn, calculatePriority } from "@/lib/utils";
import { format } from "date-fns";
import { BarangSearchCombobox } from "../../purchase-order/BarangSearchCombobox"; // REVISI: Import ini

// ... (Konstanta kategoriData, dataLokasi tetap sama)
const kategoriData: ComboboxData = [
  { label: "New Item", value: "New Item" },
  { label: "Replace Item", value: "Replace Item" },
  { label: "Fix & Repair", value: "Fix & Repair" },
  { label: "Upgrade", value: "Upgrade" },
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

// dataUoM tidak lagi wajib di sini jika diambil dari master, tapi bisa buat fallback
const dataUoM: ComboboxData = [
  { label: "Pcs", value: "Pcs" },
  { label: "Unit", value: "Unit" },
  { label: "Set", value: "Set" },
  { label: "Box", value: "Box" },
  { label: "Rim", value: "Rim" },
  { label: "Roll", value: "Roll" },
];

export default function BuatMRPage() {
  // ... (State & Effect utama tidak berubah)
  const router = useRouter();

  const [formCreateMR, setFormCreateMR] = useState<Omit<MaterialRequest, "id">>(
    {
      userid: "",
      kode_mr: "Memuat...",
      kategori: "",
      status: "Pending Validation",
      level: "OPEN 1",
      prioritas: null,
      remarks: "",
      cost_estimation: "0",
      department: "",
      company_code: "",
      cost_center_id: null,
      tujuan_site: "",
      created_at: new Date(),
      due_date: undefined,
      orders: [],
      approvals: [],
      attachments: [],
      discussions: [],
    }
  );

  const [userLokasi, setUserLokasi] = useState("");
  const [formattedCost, setFormattedCost] = useState("Rp 0");
  const [loading, setLoading] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [tujuanSamaDenganLokasi, setTujuanSamaDenganLokasi] = useState(true);
  const [isDatePopoverOpen, setIsDatePopoverOpen] = useState(false);

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

  useEffect(() => {
    const total = formCreateMR.orders.reduce((acc, item) => {
      const qty = Number(item.qty) || 0;
      const price = Number(item.estimasi_harga) || 0;
      return acc + qty * price;
    }, 0);

    setFormCreateMR((prev) => ({
      ...prev,
      cost_estimation: String(total),
    }));
    setFormattedCost(formatCurrency(total));
  }, [formCreateMR.orders]);

  useEffect(() => {
    if (formCreateMR.due_date) {
      const priority = calculatePriority(formCreateMR.due_date) as
        | "P0"
        | "P1"
        | "P2"
        | "P3"
        | "P4";
      setFormCreateMR((prev) => ({
        ...prev,
        prioritas: priority,
      }));
    } else {
      setFormCreateMR((prev) => ({
        ...prev,
        prioritas: null,
      }));
    }
  }, [formCreateMR.due_date]);

  const handleCBKategori = (value: string) => {
    setFormCreateMR({ ...formCreateMR, kategori: value });
  };

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

  // --- Item Management (REVISI BAGIAN INI) ---
  const [openItemDialog, setOpenItemDialog] = useState(false);
  const [editingIndex, setEditingIndex] = useState<number | null>(null);

  // State lokal untuk dialog
  const [orderItem, setOrderItem] = useState<Order>({
    name: "",
    qty: "1",
    uom: "Pcs",
    estimasi_harga: 0,
    url: "",
    note: "",
    barang_id: null,
    part_number: null,
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
      barang_id: null,
      part_number: null,
    });
    setOpenItemDialog(true);
  };

  const handleOpenEditItemDialog = (index: number) => {
    setEditingIndex(index);
    setOrderItem(formCreateMR.orders[index]);
    setOpenItemDialog(true);
  };

  // REVISI: Handler saat barang dipilih dari Combobox
  const handleSelectBarang = (barang: Barang) => {
    setOrderItem((prev) => ({
      ...prev,
      name: barang.part_name || prev.name,
      part_number: barang.part_number,
      uom: barang.uom || "Pcs",
      barang_id: barang.id,
    }));
  };

  const handleSaveOrUpdateItem = () => {
    // REVISI: Validasi wajib pilih dari database (barang_id harus ada)
    if (!orderItem.barang_id || !orderItem.name) {
      toast.error("Wajib memilih barang dari database.");
      return;
    }
    if (!orderItem.qty || Number(orderItem.qty) <= 0) {
      toast.error("Quantity harus lebih dari 0.");
      return;
    }

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

  const removeItem = (index: number) => {
    setFormCreateMR((prev) => ({
      ...prev,
      orders: prev.orders.filter((_, i) => i !== index),
    }));
  };

  // ... (Sisa handlers: FileUpload, RemoveAttachment, AjukanMR tetap sama)
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

    if (
      !formCreateMR.kategori ||
      !formCreateMR.remarks ||
      !formCreateMR.due_date ||
      !formCreateMR.department ||
      !formCreateMR.tujuan_site ||
      !formCreateMR.company_code
    ) {
      setAjukanAlert(
        "Semua data utama (Kategori, Due Date, Remarks, Tujuan) wajib diisi."
      );
      return;
    }

    if (formCreateMR.orders.length === 0) {
      setAjukanAlert("Minimal harus ada satu order item.");
      return;
    }

    // Validasi Level 2: Pastikan semua item punya barang_id
    if (formCreateMR.orders.some((o) => !o.barang_id)) {
      setAjukanAlert(
        "Terdapat item yang tidak valid (bukan dari database). Hapus dan input ulang."
      );
      return;
    }

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
        cost_estimation: Number(payload.cost_estimation),
        cost_center_id: null,
        level: "OPEN 1",
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

  // ... (Bagian Render UI)
  return (
    <>
      <Content
        title="Buat Material Request Baru"
        description="Isi data pada form di bawah ini. Departemen & Lokasi Anda akan terisi otomatis."
      >
        {/* ... (Form Header sama persis seperti sebelumnya) ... */}
        <div className="grid grid-cols-12 gap-4">
          {/* ... field read-only ... */}
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
              defaultValue={formCreateMR.kategori}
            />
          </div>

          <div className="flex flex-col gap-2 col-span-12 md:col-span-6">
            <Label>Due Date (Target Pemakaian)</Label>
            <Popover
              open={isDatePopoverOpen}
              onOpenChange={setIsDatePopoverOpen}
            >
              <PopoverTrigger asChild>
                <Button
                  variant="outline"
                  className={cn(
                    "w-full justify-start text-left font-normal",
                    !formCreateMR.due_date && "text-muted-foreground"
                  )}
                >
                  <CalendarIcon className="mr-2 h-4 w-4" />
                  {formCreateMR.due_date ? (
                    format(formCreateMR.due_date, "dd MMMM yyyy")
                  ) : (
                    <span>Pilih tanggal...</span>
                  )}
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-0">
                <Calendar
                  mode="single"
                  selected={formCreateMR.due_date}
                  onSelect={(date) => {
                    setFormCreateMR((prev) => ({ ...prev, due_date: date }));
                    setIsDatePopoverOpen(false);
                  }}
                  disabled={(date) => date < new Date()}
                  initialFocus
                />
              </PopoverContent>
            </Popover>
          </div>

          <div className="flex flex-col gap-2 col-span-12 md:col-span-6">
            <Label>Estimasi Prioritas (Otomatis)</Label>
            <div
              className={cn(
                "flex items-center h-9 px-3 border rounded-md bg-muted/50 font-semibold transition-colors",
                formCreateMR.prioritas === "P0" &&
                  "text-destructive bg-destructive/10 border-destructive/20"
              )}
            >
              {formCreateMR.prioritas || "-"}
            </div>
          </div>

          <div className="flex flex-col gap-2 col-span-12 md:col-span-6">
            <Label>Tujuan Pengiriman (Site)</Label>
            <div className="flex items-center space-x-2 mt-2 h-9">
              <Checkbox
                id="tujuan-sama"
                checked={tujuanSamaDenganLokasi}
                onCheckedChange={(checked) =>
                  setTujuanSamaDenganLokasi(checked as boolean)
                }
              />
              <label
                htmlFor="tujuan-sama"
                className="text-sm font-medium leading-none cursor-pointer"
              >
                Sama dengan lokasi saya
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

          <div className="flex flex-col gap-2 col-span-12">
            <Label>Remarks (Tujuan & Latar Belakang)</Label>
            <Textarea
              placeholder="Jelaskan tujuan..."
              value={formCreateMR.remarks}
              rows={4}
              onChange={(e) =>
                setFormCreateMR({ ...formCreateMR, remarks: e.target.value })
              }
            />
          </div>
          <div className="flex flex-col gap-2 col-span-12">
            <Label>Estimasi Biaya (Otomatis)</Label>
            <Input
              readOnly
              disabled
              value={formattedCost}
              className="font-bold text-lg"
            />
          </div>
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
        {/* ... (Tabel Item sama persis) ... */}
        <div className="rounded-md border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>No</TableHead>
                <TableHead>Nama Item</TableHead>
                <TableHead>Part Number</TableHead>
                <TableHead>Qty</TableHead>
                <TableHead>Estimasi Harga</TableHead>
                <TableHead>Total</TableHead>
                <TableHead>Aksi</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {formCreateMR.orders.map((order, index) => (
                <TableRow key={index}>
                  <TableCell>{index + 1}</TableCell>
                  <TableCell>{order.name}</TableCell>
                  <TableCell className="text-xs font-mono">
                    {order.part_number || "-"}
                  </TableCell>
                  <TableCell>
                    {order.qty} {order.uom}
                  </TableCell>
                  <TableCell>{formatCurrency(order.estimasi_harga)}</TableCell>
                  <TableCell>
                    {formatCurrency(Number(order.qty) * order.estimasi_harga)}
                  </TableCell>
                  <TableCell>
                    <div className="flex gap-1">
                      <Button
                        size="icon"
                        variant="outline"
                        onClick={() => handleOpenEditItemDialog(index)}
                      >
                        <EditIcon className="h-4 w-4" />
                      </Button>
                      <Button
                        size="icon"
                        variant="destructive"
                        onClick={() => removeItem(index)}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      </Content>

      {/* --- DIALOG TAMBAH ITEM (MODIFIED) --- */}
      <Dialog open={openItemDialog} onOpenChange={setOpenItemDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {editingIndex !== null ? "Edit Order Item" : "Tambah Order Item"}
            </DialogTitle>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="space-y-2">
              <Label className="text-right">Cari Barang (Wajib)</Label>
              {/* REVISI: Ganti Input dengan BarangSearchCombobox */}
              <BarangSearchCombobox onSelect={handleSelectBarang} />
              {orderItem.name && (
                <div className="text-xs text-muted-foreground mt-1 p-2 bg-muted rounded border">
                  Terpilih: <strong>{orderItem.name}</strong> (
                  {orderItem.part_number})
                </div>
              )}
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Quantity</Label>
                <Input
                  type="number"
                  value={orderItem.qty}
                  onChange={(e) =>
                    setOrderItem({ ...orderItem, qty: e.target.value })
                  }
                  min="1"
                />
              </div>
              <div className="space-y-2">
                <Label>UoM</Label>
                <Input
                  value={orderItem.uom}
                  readOnly
                  disabled
                  className="bg-muted"
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label>Estimasi Harga Satuan</Label>
              <CurrencyInput
                value={orderItem.estimasi_harga}
                onValueChange={(value) =>
                  setOrderItem({ ...orderItem, estimasi_harga: value })
                }
              />
            </div>

            <div className="space-y-2">
              <Label>Catatan / Link Ref</Label>
              <Input
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
        {/* ... (Sama persis) ... */}
        <div className="flex flex-col gap-4">
          <Input
            type="file"
            multiple
            onChange={handleFileUpload}
            disabled={isUploading}
          />
          {/* List Lampiran */}
          {(formCreateMR.attachments || []).length > 0 && (
            <ul className="space-y-2">
              {formCreateMR.attachments.map((att, index) => (
                <li
                  key={index}
                  className="flex justify-between items-center p-2 bg-muted rounded text-sm"
                >
                  <span className="truncate max-w-[200px]">{att.name}</span>
                  <Button
                    size="icon"
                    variant="ghost"
                    onClick={() => handleRemoveAttachment(index, att.url)}
                  >
                    <Trash2 className="h-4 w-4 text-destructive" />
                  </Button>
                </li>
              ))}
            </ul>
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
