"use client";

import { Content } from "@/components/content";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation"; // Import useRouter
import { MaterialRequest, Order } from "../page";
import { Combobox, ComboboxData } from "@/components/combobox";
import { DatePicker } from "@/components/date-picker";
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
  ArrowDown,
  ArrowUp,
  Loader2,
  Plus,
  Search,
  SearchX,
  Trash2,
  X,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
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

// Tipe data untuk user, sesuaikan jika perlu
type User = {
  id: string;
  nama: string;
  email: string;
  role: string;
  department: string;
};

const dataDepartment: ComboboxData = [
  { label: "General Affair", value: "General Affair" },
  { label: "Marketing", value: "Marketing" },
  { label: "Manufacture", value: "Manufacture" },
  { label: "K3", value: "K3" },
  { label: "Finance", value: "Finance" },
  { label: "IT", value: "IT" },
  { label: "Logistik", value: "Logistik" },
  { label: "Purchasing", value: "Purchasing" },
  { label: "Warehouse", value: "Warehouse" },
  { label: "Service", value: "Service" },
  { label: "General Manager", value: "General Manager" },
  { label: "Executive Manager", value: "Executive Manager" },
  { label: "Boards of Director", value: "Boards of Director" },
];

// Data untuk combobox kategori
const kategoriData: ComboboxData = [
  { label: "New Item", value: "New Item" },
  { label: "Replace Item", value: "Replace Item" },
  { label: "Fix & Repair", value: "Fix & Repair" },
];

export default function BuatMRPage() {
  const s = createClient();
  const router = useRouter(); // Inisialisasi router

  // State utama untuk form Material Request
  const [formCreateMR, setFormCreateMR] = useState<Omit<MaterialRequest, "id">>(
    {
      userid: "",
      kode_mr: "Memuat...", // Nilai awal
      kategori: "",
      status: "Pending", // Status awal
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

  // Loading states
  const [loading, setLoading] = useState(false);
  const [isUploading, setIsUploading] = useState(false);

  // --- START: GENERATE KODE MR OTOMATIS ---
  useEffect(() => {
    const generateKodeMR = async () => {
      // Jangan generate jika department belum dipilih
      if (!formCreateMR.department) {
        setFormCreateMR((prev) => ({
          ...prev,
          kode_mr: "Pilih departemen terlebih dahulu",
        }));
        return;
      }

      // 1. Ambil MR terakhir dari database
      const { data: lastMr, error: fetchError } = await s
        .from("material_requests")
        .select("kode_mr")
        .order("id", { ascending: false })
        .limit(1)
        .single();

      if (fetchError && fetchError.code !== "PGRST116") {
        // Abaikan error 'exact one row' jika tabel kosong
        console.error("Error fetching last MR:", fetchError);
        toast.error("Gagal men-generate Kode MR.");
        return;
      }

      // 2. Siapkan komponen kode
      const currentYear = new Date().getFullYear().toString().slice(-2);
      const deptAbbr = formCreateMR.department; // Asumsi value dari combobox adalah singkatan
      let nextNumber = 1;

      // 3. Jika ada MR sebelumnya, ambil nomor terakhir dan increment
      if (lastMr) {
        try {
          const parts = lastMr.kode_mr.split("/");
          const lastNumber = parseInt(parts[parts.length - 1], 10);
          if (!isNaN(lastNumber)) {
            nextNumber = lastNumber + 1;
          }
        } catch (e) {
          console.error("Error parsing last MR code:", e);
          // Fallback jika format kode lama tidak sesuai
          nextNumber = 1;
        }
      }

      // 4. Format nomor dengan padding nol jika perlu (misal: 001)
      const paddedNextNumber = nextNumber.toString().padStart(1, "0"); // Ubah '1' ke '3' jika ingin 001, 002, dst.

      // 5. Gabungkan menjadi kode MR baru
      const newKodeMR = `GMI/MR-${currentYear}/${deptAbbr}/${paddedNextNumber}`;
      setFormCreateMR((prev) => ({ ...prev, kode_mr: newKodeMR }));
    };

    generateKodeMR();
  }, [formCreateMR.department, s]);
  // --- END: GENERATE KODE MR OTOMATIS ---

  // Handler untuk Combobox
  const handleCBKategori = (value: string) => {
    setFormCreateMR({ ...formCreateMR, kategori: value });
  };

  const handleCBDepartment = (value: string) => {
    setFormCreateMR({ ...formCreateMR, department: value });
  };

  // State & handler untuk pencarian user approval
  const [searchUser, setSearchUser] = useState<User[]>([]);
  const [searchUserQuery, setSearchUserQuery] = useState("");
  const [noUserFound, setNoUserFound] = useState(false);

  const handleAddApproval = (user: User) => {
    setSearchUser([]);
    setSearchUserQuery("");
    setNoUserFound(false);
    const exists = formCreateMR.approvals.find((u) => u.userid === user.id);
    if (exists) {
      toast.warning(`${user.nama} sudah ada di daftar approval.`);
      return;
    }
    setFormCreateMR({
      ...formCreateMR,
      approvals: [
        ...formCreateMR.approvals,
        {
          type: "",
          status: "pending",
          userid: user.id,
          nama: user.nama,
          email: user.email,
          role: user.role,
          department: user.department,
        },
      ],
    });
  };

  const handleSearchUser = async () => {
    setNoUserFound(false);
    if (searchUserQuery.trim() === "") {
      setSearchUser([]);
      return;
    }
    const { data, error } = await s
      .from("users_with_profiles")
      .select("*")
      .ilike("nama", `%${searchUserQuery}%`)
      .limit(5);
    if (error) {
      console.error("Error searching users:", error);
      toast.error("Gagal mencari pengguna.");
      return;
    }
    if (data && data.length === 0) {
      setNoUserFound(true);
    } else {
      setSearchUser(data as User[]);
    }
  };

  // Handler untuk mengatur urutan approval
  const handleMoveUp = (index: number) => {
    if (index > 0) {
      const updatedApprovals = [...formCreateMR.approvals];
      const [movedUser] = updatedApprovals.splice(index, 1);
      updatedApprovals.splice(index - 1, 0, movedUser);
      setFormCreateMR({ ...formCreateMR, approvals: updatedApprovals });
    }
  };

  const handleMoveDown = (index: number) => {
    if (index < formCreateMR.approvals.length - 1) {
      const updatedApprovals = [...formCreateMR.approvals];
      const [movedUser] = updatedApprovals.splice(index, 1);
      updatedApprovals.splice(index + 1, 0, movedUser);
      setFormCreateMR({ ...formCreateMR, approvals: updatedApprovals });
    }
  };

  const handleRemoveApproval = (userid: string) => {
    const updatedApprovals = formCreateMR.approvals.filter(
      (u) => u.userid !== userid
    );
    setFormCreateMR({ ...formCreateMR, approvals: updatedApprovals });
  };

  // State & handler untuk order item
  const [openAddItem, setOpenAddItem] = useState(false);
  const [orderItem, setOrderItem] = useState<Order>({
    name: "",
    qty: "",
    uom: "",
    vendor: "",
    vendor_contact: "",
    note: "",
    url: "",
  });

  const handleAddItem = () => {
    if (
      orderItem.name.trim() === "" ||
      orderItem.qty.trim() === "" ||
      orderItem.uom.trim() === ""
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
      note: "",
      url: "",
    });
  };

  // --- START: FUNGSI ATTACHMENT BARU ---
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
      if (error) {
        return { error, file };
      }
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
      toast.error(
        `Gagal mengunggah ${failedUploads.length} file: ${failedUploads
          .map((f) => f.file.name)
          .join(", ")}`,
        { id: toastId }
      );
      console.error("Failed uploads:", failedUploads);
    } else if (successfulUploads.length === 0) {
      toast.dismiss(toastId); // Hapus loading toast jika tidak ada file sama sekali
    }

    setIsUploading(false);
    e.target.value = ""; // Reset input file
  };

  const handleRemoveAttachment = async (index: number, path: string) => {
    const toastId = toast.loading("Menghapus file...");
    const { error: removeError } = await s.storage.from("mr").remove([path]);

    if (removeError) {
      toast.error(`Gagal menghapus file: ${removeError.message}`, {
        id: toastId,
      });
      console.error("Error removing file:", removeError);
      return;
    }

    const updatedAttachments = formCreateMR.attachments.filter(
      (_, i) => i !== index
    );
    setFormCreateMR((prev) => ({ ...prev, attachments: updatedAttachments }));
    toast.success("File berhasil dihapus.", { id: toastId });
  };
  // --- END: FUNGSI ATTACHMENT BARU ---

  // --- START: FUNGSI PENGAJUAN MR ---
  const [ajukanAlert, setAjukanAlert] = useState<string>("");

  const handleAjukanMR = async () => {
    // Validasi
    if (
      !formCreateMR.kategori ||
      !formCreateMR.department ||
      !formCreateMR.remarks ||
      !formCreateMR.cost_estimation
    ) {
      setAjukanAlert(
        "Harap lengkapi semua field di bagian Informasi Material Request."
      );
      return;
    }
    if (formCreateMR.approvals.length === 0) {
      setAjukanAlert("Jalur approval harus ditentukan.");
      return;
    }
    if (formCreateMR.approvals.some((app) => !app.type)) {
      setAjukanAlert(
        "Harap tentukan semua 'Jenis approval' di tabel approval."
      );
      return;
    }
    if (formCreateMR.orders.length === 0) {
      setAjukanAlert("Minimal harus ada satu order item.");
      return;
    }
    setAjukanAlert("");

    setLoading(true);
    const toastId = toast.loading("Mengajukan MR...");

    try {
      // Ambil user id saat ini
      const {
        data: { user },
      } = await s.auth.getUser();
      if (!user)
        throw new Error("User tidak ditemukan. Silakan login kembali.");

      // Siapkan payload
      const payload = {
        ...formCreateMR,
        userid: user.id,
      };

      // Insert ke database
      const { error } = await s.from("material_requests").insert([payload]);

      if (error) {
        throw error;
      }

      toast.success("Material Request berhasil diajukan!", { id: toastId });
      // Redirect ke halaman daftar MR atau dashboard
      router.push("/material-request");
    } catch (err: any) {
      console.error("Error submitting MR:", err);
      toast.error(`Gagal mengajukan MR: ${err.message}`, { id: toastId });
      setAjukanAlert(`Terjadi kesalahan: ${err.message}`);
    } finally {
      setLoading(false);
    }
  };
  // --- END: FUNGSI PENGAJUAN MR ---

  return (
    <>
      {/* Informasi MR */}
      <Content
        size="md"
        title="Informasi Material Request"
        description="Isi data pada form dibawah untuk membuat material request baru"
      >
        <div className="grid grid-cols-12 gap-4">
          <div className="flex flex-col gap-2 col-span-12">
            <Label>Kode MR</Label>
            <Input readOnly disabled value={formCreateMR.kode_mr} />
          </div>
          <div className="flex flex-col gap-2 col-span-12">
            <Label>Department</Label>
            <Combobox data={dataDepartment} onChange={handleCBDepartment} />
          </div>
          <div className="flex flex-col gap-2 col-span-12">
            <Label>Kategori</Label>
            <Combobox data={kategoriData} onChange={handleCBKategori} />
          </div>
          <div className="flex flex-col gap-2 col-span-12">
            <Label>Remarks</Label>
            <Textarea
              placeholder="Jelaskan kebutuhan Anda di sini..."
              value={formCreateMR.remarks}
              rows={3}
              onChange={(e) =>
                setFormCreateMR({ ...formCreateMR, remarks: e.target.value })
              }
            />
          </div>
          <div className="flex flex-col gap-2 col-span-12 md:col-span-6">
            <Label>Estimasi biaya (Rp)</Label>
            <Input
              type="number"
              placeholder="Contoh: 500000"
              value={formCreateMR.cost_estimation}
              onChange={(e) =>
                setFormCreateMR({
                  ...formCreateMR,
                  cost_estimation: e.target.value,
                })
              }
            />
          </div>
          <div className="flex flex-col gap-2 col-span-12 md:col-span-6">
            <Label>Due date</Label>
            <DatePicker
              value={formCreateMR.due_date}
              onChange={(date) =>
                setFormCreateMR({ ...formCreateMR, due_date: date as Date })
              }
            />
          </div>
        </div>
      </Content>

      {/* Approval MR */}
      <Content
        size="md"
        title="Tentukan Jalur Approval MR"
        description="Pilih pengguna untuk persetujuan MR ini"
      >
        <div className="flex flex-col gap-4">
          <div className="flex flex-col gap-2">
            <Label>Cari pengguna berdasarkan nama</Label>
            <div className="flex gap-2">
              <Input
                disabled={loading}
                placeholder="Masukkan nama pengguna..."
                onChange={(e) => setSearchUserQuery(e.target.value)}
                value={searchUserQuery}
                onKeyDown={(e) => e.key === "Enter" && handleSearchUser()}
              />
              <Button variant={"outline"} onClick={handleSearchUser}>
                <Search />
              </Button>
            </div>
            <div className="flex flex-col gap-2 mt-2">
              {noUserFound && (
                <Alert variant="default">
                  <SearchX className="h-4 w-4" />
                  <AlertTitle>Pengguna tidak ditemukan</AlertTitle>
                  <AlertDescription>
                    Tidak ditemukan pengguna dengan nama &quot;{searchUserQuery}
                    &quot;
                  </AlertDescription>
                </Alert>
              )}
              {searchUser.length > 0 && (
                <>
                  <Label>Hasil pencarian</Label>
                  {searchUser.map((user) => (
                    <div
                      key={user.id}
                      className="flex items-center gap-4 px-4 py-2 border rounded-lg"
                    >
                      <Avatar className="h-8 w-8 rounded-lg">
                        <AvatarImage
                          src={`https://ui-avatars.com/api/?name=${user.nama}`}
                        />
                        <AvatarFallback className="rounded-lg">
                          CN
                        </AvatarFallback>
                      </Avatar>
                      <div className="grid flex-1">
                        <span className="font-medium">
                          {user.nama}{" "}
                          <Badge variant={"outline"}>{user.department}</Badge>
                        </span>
                        <span className="text-xs text-muted-foreground">
                          {user.email}
                        </span>
                      </div>
                      <Button
                        variant={"outline"}
                        size={"sm"}
                        onClick={() => handleAddApproval(user)}
                      >
                        <Plus />
                      </Button>
                    </div>
                  ))}
                </>
              )}
            </div>
          </div>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>No</TableHead>
                <TableHead>User</TableHead>
                <TableHead>Jenis approval</TableHead>
                <TableHead>Aksi</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {formCreateMR.approvals.map((approval, index) => (
                <TableRow key={approval.userid}>
                  <TableCell>{index + 1}</TableCell>
                  <TableCell>
                    <div className="flex flex-col">
                      <span className="font-medium">
                        {approval.nama}{" "}
                        <Badge variant={"outline"}>{approval.department}</Badge>
                      </span>
                      <span className="text-xs text-muted-foreground">
                        {approval.email}
                      </span>
                    </div>
                  </TableCell>
                  <TableCell className="w-[200px]">
                    <Combobox
                      data={[
                        { label: "Mengetahui", value: "Mengetahui" },
                        { label: "Menyetujui", value: "Menyetujui" },
                      ]}
                      onChange={(value) => {
                        const updatedApprovals = formCreateMR.approvals.map(
                          (app) =>
                            app.userid === approval.userid
                              ? { ...app, type: value }
                              : app
                        );
                        setFormCreateMR({
                          ...formCreateMR,
                          approvals: updatedApprovals,
                        });
                      }}
                    />
                  </TableCell>
                  <TableCell className="flex gap-2">
                    <Button
                      variant={"outline"}
                      size={"icon"}
                      onClick={() => handleMoveUp(index)}
                      disabled={index === 0}
                    >
                      <ArrowUp className="h-4 w-4" />
                    </Button>
                    <Button
                      variant="outline"
                      size="icon"
                      onClick={() => handleMoveDown(index)}
                      disabled={index === formCreateMR.approvals.length - 1}
                    >
                      <ArrowDown className="h-4 w-4" />
                    </Button>
                    <Button
                      variant="destructive"
                      size="icon"
                      onClick={() => handleRemoveApproval(approval.userid)}
                    >
                      <X className="h-4 w-4" />
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      </Content>

      {/* Order Item */}
      <Content
        title="Order Item"
        size="md"
        cardAction={
          <Dialog open={openAddItem} onOpenChange={setOpenAddItem}>
            <DialogTrigger asChild>
              <Button variant="outline" disabled={loading}>
                Tambah Order Item
              </Button>
            </DialogTrigger>
            <DialogContent>
              <AlertDialogHeader>
                <DialogTitle>Tambah order item</DialogTitle>
              </AlertDialogHeader>
              <div className="grid gap-4 py-4">
                <div className="grid grid-cols-4 items-center gap-4">
                  <Label className="text-right">Nama Item</Label>
                  <Input
                    className="col-span-3"
                    onChange={(e) =>
                      setOrderItem({ ...orderItem, name: e.target.value })
                    }
                    value={orderItem.name}
                  />
                </div>
                <div className="grid grid-cols-4 items-center gap-4">
                  <Label className="text-right">UoM</Label>
                  <div className="col-span-3">
                    <Combobox
                      data={[
                        { label: "Each", value: "Each" },
                        { label: "Pcs", value: "Pcs" },
                        { label: "Box", value: "Box" },
                        { label: "Lusin", value: "Lusin" },
                        { label: "Pack", value: "Pack" },
                        { label: "Roll", value: "Roll" },
                        { label: "Set", value: "Set" },
                        { label: "Unit", value: "Unit" },
                        { label: "Rim", value: "Rim" },
                        { label: "Sheet", value: "Sheet" },
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
                    onChange={(e) =>
                      setOrderItem({ ...orderItem, qty: e.target.value })
                    }
                    value={orderItem.qty}
                  />
                </div>
                <div className="grid grid-cols-4 items-center gap-4">
                  <Label className="text-right">Link Ref.</Label>
                  <Input
                    className="col-span-3"
                    onChange={(e) =>
                      setOrderItem({ ...orderItem, url: e.target.value })
                    }
                    value={orderItem.url}
                  />
                </div>
                <div className="grid grid-cols-4 items-center gap-4">
                  <Label className="text-right">Vendor</Label>
                  <Input
                    className="col-span-3"
                    onChange={(e) =>
                      setOrderItem({ ...orderItem, vendor: e.target.value })
                    }
                    value={orderItem.vendor}
                  />
                </div>
                <div className="grid grid-cols-4 items-center gap-4">
                  <Label className="text-right">Kontak Vendor</Label>
                  <Input
                    className="col-span-3"
                    onChange={(e) =>
                      setOrderItem({
                        ...orderItem,
                        vendor_contact: e.target.value,
                      })
                    }
                    value={orderItem.vendor_contact}
                  />
                </div>
                <div className="grid grid-cols-4 items-center gap-4">
                  <Label className="text-right">Note</Label>
                  <Textarea
                    className="col-span-3"
                    onChange={(e) =>
                      setOrderItem({ ...orderItem, note: e.target.value })
                    }
                    value={orderItem.note}
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
        <div className="flex flex-col gap-4">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>No</TableHead>
                <TableHead>Nama Item</TableHead>
                <TableHead>UoM</TableHead>
                <TableHead>Qty</TableHead>
                <TableHead>Note</TableHead>
                <TableHead>Aksi</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {formCreateMR.orders.map((order, index) => (
                <TableRow key={index}>
                  <TableCell>{index + 1}</TableCell>
                  <TableCell>{order.name}</TableCell>
                  <TableCell>{order.uom}</TableCell>
                  <TableCell>{order.qty}</TableCell>
                  <TableCell>{order.note}</TableCell>
                  <TableCell>
                    <Button
                      variant="destructive"
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
                      <X className="w-4 h-4" />
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      </Content>

      {/* Attachment */}
      <Content title="Lampiran File" size="sm">
        <div className="flex flex-col gap-4">
          <div className="flex flex-col gap-2">
            <Label htmlFor="attachments">
              Unggah lampiran jika ada (bisa lebih dari satu)
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
                <Loader2 className="mr-2 h-4 w-4 animate-spin" /> Sedang
                mengunggah...
              </div>
            )}
          </div>
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
                  <TableCell>
                    <a
                      href={`https://xdkjqwpvmyqcggpwghyi.supabase.co/storage/v1/object/public/mr/${att.url}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-blue-600 underline hover:text-blue-800"
                    >
                      {att.name}
                    </a>
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
        </div>
      </Content>

      {/* Tombol Ajukan */}
      <Content size="lg">
        <div className="flex flex-col gap-4">
          {ajukanAlert && (
            <Alert variant="destructive">
              <AlertTitle>Perhatian!</AlertTitle>
              <AlertDescription>{ajukanAlert}</AlertDescription>
            </Alert>
          )}
          <Button onClick={handleAjukanMR} disabled={loading || isUploading}>
            {loading ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" /> Mengajukan...
              </>
            ) : (
              "Ajukan MR"
            )}
          </Button>
        </div>
      </Content>
    </>
  );
}
