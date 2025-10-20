// src/app/(With Sidebar)/material-request/buat/page.tsx

"use client";

import { Content } from "@/components/content";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { MaterialRequest, Order } from "@/type";
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
import { createClient } from "@/lib/supabase/client";
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

const kategoriData: ComboboxData = [
  { label: "New Item", value: "New Item" },
  { label: "Replace Item", value: "Replace Item" },
  { label: "Fix & Repair", value: "Fix & Repair" },
  { label: "Upgrade", value: "Upgrade" },
];

const deptAbbreviations: { [key: string]: string } = {
  "General Affair": "GA",
  Marketing: "MKT",
  Manufacture: "MAN",
  K3: "HSE",
  Finance: "FIN",
  IT: "IT",
  Logistik: "LOG",
  Purchasing: "PUR",
  Warehouse: "WH",
  Service: "SVC",
  "General Manager": "GM",
  "Executive Manager": "EM",
  "Boards of Director": "BOD",
};

const toRoman = (num: number): string => {
  const romanMap: { [key: number]: string } = {
    1: "I",
    2: "II",
    3: "III",
    4: "IV",
    5: "V",
    6: "VI",
    7: "VII",
    8: "VIII",
    9: "IX",
    10: "X",
    11: "XI",
    12: "XII",
  };
  return romanMap[num] || "";
};

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
  const s = createClient();
  const router = useRouter();

  const [formCreateMR, setFormCreateMR] = useState<Omit<MaterialRequest, "id">>(
    {
      userid: "",
      kode_mr: "Memuat...",
      kategori: "",
      status: "Pending Validation",
      remarks: "",
      cost_estimation: "",
      department: "",
      created_at: new Date(),
      due_date: new Date(),
      orders: [],
      approvals: [],
      attachments: [],
      discussions: [],
    }
  );

  const [formattedCost, setFormattedCost] = useState("Rp 0");
  const [loading, setLoading] = useState(false);
  const [isUploading, setIsUploading] = useState(false);

  useEffect(() => {
    const fetchUserData = async () => {
      const {
        data: { user },
      } = await s.auth.getUser();
      if (user) {
        const { data: profile, error } = await s
          .from("profiles")
          .select("department")
          .eq("id", user.id)
          .single();
        if (error) {
          toast.error("Gagal mengambil profil user", {
            description: error.message,
          });
          return;
        }
        if (profile && profile.department) {
          setFormCreateMR((prev) => ({
            ...prev,
            department: profile.department,
          }));
        } else {
          toast.warning("Departemen tidak ditemukan.", {
            description: "Harap lengkapi profil Anda.",
          });
        }
      }
    };
    fetchUserData();
  }, [s]);

  useEffect(() => {
    const generateKodeMR = async () => {
      if (!formCreateMR.department) {
        setFormCreateMR((prev) => ({
          ...prev,
          kode_mr: "Menunggu data departemen...",
        }));
        return;
      }

      const now = new Date();
      const currentYear = now.getFullYear();
      const currentYearYY = currentYear.toString().slice(-2);
      const currentMonthRoman = toRoman(now.getMonth() + 1);

      const { data: lastMr, error } = await s
        .from("material_requests")
        .select("kode_mr")
        .gte("created_at", `${currentYear}-01-01T00:00:00Z`)
        .lt("created_at", `${currentYear + 1}-01-01T00:00:00Z`)
        .order("id", { ascending: false })
        .limit(1)
        .single();

      if (error && error.code !== "PGRST116") {
        toast.error("Gagal men-generate Kode MR.");
        console.error("Error fetching last MR of the year:", error);
        return;
      }

      let nextNumber = 1;
      if (lastMr) {
        try {
          const parts = lastMr.kode_mr.split("/");
          const lastNumberStr = parts[parts.length - 1];
          if (lastNumberStr) {
            nextNumber = parseInt(lastNumberStr, 10) + 1;
          }
        } catch (e) {
          console.error("Error parsing last MR code:", e);
        }
      }

      const deptAbbr =
        deptAbbreviations[formCreateMR.department] || formCreateMR.department;
      const newKodeMR = `GMI/MR/${currentMonthRoman}/${currentYearYY}/${deptAbbr}/${nextNumber}`;
      setFormCreateMR((prev) => ({ ...prev, kode_mr: newKodeMR }));
    };

    generateKodeMR();
  }, [formCreateMR.department, s]);

  const handleCBKategori = (value: string) => {
    setFormCreateMR({ ...formCreateMR, kategori: value });
  };

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
    if (!files || files.length === 0) return;
    setIsUploading(true);
    const toastId = toast.loading(`Mengunggah ${files.length} file...`);

    const uploadPromises = Array.from(files).map(async (file) => {
      const filePath = `${formCreateMR.kode_mr.replace(
        /\//g,
        "-"
      )}/${Date.now()}_${file.name}`;
      const { data, error } = await s.storage.from("mr").upload(filePath, file);
      if (error) return { error, file };
      return { data: { ...data, name: file.name }, error: null, file };
    });

    const results = await Promise.all(uploadPromises);
    const successfulUploads = results
      .filter((r) => !r.error)
      .map((r) => ({ url: r.data!.path, name: r.data!.name }));
    const failedUploads = results.filter((r) => r.error);

    if (successfulUploads.length > 0) {
      setFormCreateMR((prev) => ({
        ...prev,
        attachments: [...prev.attachments, ...successfulUploads],
      }));
      toast.success(`${successfulUploads.length} file berhasil diunggah.`, {
        id: toastId,
      });
    }
    if (failedUploads.length > 0) {
      toast.error(`Gagal mengunggah ${failedUploads.length} file.`, {
        id: toastId,
      });
      console.error("Failed uploads:", failedUploads);
    } else if (successfulUploads.length === 0) {
      toast.dismiss(toastId);
    }

    setIsUploading(false);
    e.target.value = "";
  };

  const handleRemoveAttachment = async (index: number, path: string) => {
    const toastId = toast.loading("Menghapus file...");
    const { error: removeError } = await s.storage.from("mr").remove([path]);

    if (removeError) {
      toast.error(`Gagal menghapus file: ${removeError.message}`, {
        id: toastId,
      });
      return;
    }

    const updatedAttachments = formCreateMR.attachments.filter(
      (_, i) => i !== index
    );
    setFormCreateMR((prev) => ({ ...prev, attachments: updatedAttachments }));
    toast.success("File berhasil dihapus.", { id: toastId });
  };

  const [ajukanAlert, setAjukanAlert] = useState<string>("");

  const handleAjukanMR = async () => {
    setAjukanAlert("");
    if (
      !formCreateMR.kategori ||
      !formCreateMR.remarks ||
      !formCreateMR.cost_estimation
    ) {
      setAjukanAlert("Kategori, Remarks, dan Estimasi Biaya wajib diisi.");
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
        `Kategori '${formCreateMR.kategori}' wajib menyertakan lampiran foto atau dokumen.`
      );
      return;
    }

    setLoading(true);
    const toastId = toast.loading("Mengajukan MR...");

    try {
      const {
        data: { user },
      } = await s.auth.getUser();
      if (!user) throw new Error("User tidak ditemukan.");

      const payload = { ...formCreateMR, userid: user.id, approvals: [] };

      const { error } = await s.from("material_requests").insert([payload]);
      if (error) throw error;

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
        description="Isi data pada form di bawah ini. Departemen Anda akan terisi otomatis."
      >
        <div className="grid grid-cols-12 gap-4">
          <div className="flex flex-col gap-2 col-span-12 md:col-span-6">
            <Label>Kode MR</Label>
            <Input readOnly disabled value={formCreateMR.kode_mr} />
          </div>
          <div className="flex flex-col gap-2 col-span-12 md:col-span-6">
            <Label>Departemen</Label>
            <Input
              readOnly
              disabled
              value={formCreateMR.department || "Memuat..."}
            />
          </div>
          <div className="flex flex-col gap-2 col-span-12">
            <Label>Kategori</Label>
            <Combobox data={kategoriData} onChange={handleCBKategori} />
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
            <Label>Estimasi Biaya</Label>
            <Input
              type="text"
              placeholder="Rp 500.000"
              value={formattedCost}
              onChange={handleCostChange}
            />
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
                      <Button asChild variant="outline">
                        <Link
                          href={order.url}
                          target="_blank"
                          rel="noopener noreferrer"
                        >
                          Link <LinkIcon />
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
