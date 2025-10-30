// src/app/(With Sidebar)/material-request/[id]/page.tsx

"use client";

import { use, useEffect, useState, Suspense } from "react";
import { createClient } from "@/lib/supabase/client";
import { Content } from "@/components/content";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  CircleUser,
  Building,
  Tag,
  Calendar,
  DollarSign,
  Info,
  Download,
  Link as LinkIcon,
  AlertTriangle,
  Check,
  X,
  Loader2,
  Edit,
  Save,
  Plus,
  Trash2,
  Paperclip,
  Truck,
  Building2, // Impor ikon
  ExternalLink, // Impor ikon
} from "lucide-react";
import Link from "next/link";
import { Skeleton } from "@/components/ui/skeleton";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { User as AuthUser } from "@supabase/supabase-js";
import {
  MaterialRequest,
  Approval,
  Discussion,
  Order,
  User as Profile,
  Attachment, // Pastikan Attachment diimpor
} from "@/type";
import { formatCurrency, formatDateFriendly, cn } from "@/lib/utils";
import { DiscussionSection } from "./discussion-component";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Combobox, ComboboxData } from "@/components/combobox";
import { CurrencyInput } from "@/components/ui/currency-input"; // Impor CurrencyInput

// Hapus dataLokasi dan dataCostCenter yang di-hardcode
// const dataCostCenter: ComboboxData = [ ... ];
// const dataLokasi: ComboboxData = [ ... ];

function DetailMRPageContent({ params }: { params: { id: string } }) {
  const mrId = parseInt(params.id);

  const [mr, setMr] = useState<MaterialRequest | null>(null);
  const [currentUser, setCurrentUser] = useState<AuthUser | null>(null);
  const [userProfile, setUserProfile] = useState<Profile | null>(null);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [isEditing, setIsEditing] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [formattedCost, setFormattedCost] = useState("Rp 0");

  // REVISI: State untuk cost center name (hasil join)
  const [costCenterName, setCostCenterName] = useState<string | null>(null);

  const supabase = createClient();

  const fetchMrData = async () => {
    if (isNaN(mrId)) {
      setError("ID Material Request tidak valid.");
      return null;
    }

    // REVISI: Query di-join dengan cost_centers
    const { data: mrData, error: mrError } = await supabase
      .from("material_requests")
      .select(
        `
        *, 
        users_with_profiles!userid(nama),
        cost_centers!cost_center_id(name) 
      `
      )
      .eq("id", mrId)
      .single();

    if (mrError) {
      setError("Gagal memuat data MR.");
      toast.error("Gagal memuat data", { description: mrError.message });
      return null;
    } else {
      const initialData = {
        ...mrData,
        attachments: Array.isArray(mrData.attachments)
          ? mrData.attachments
          : [],
        discussions: Array.isArray(mrData.discussions)
          ? mrData.discussions
          : [],
        approvals: Array.isArray(mrData.approvals) ? mrData.approvals : [],
        orders: Array.isArray(mrData.orders) ? mrData.orders : [],
      };
      setMr(initialData as any);

      // Simpan nama cost center dari data join
      const ccName = (mrData.cost_centers as any)?.name;
      setCostCenterName(ccName || "N/A");

      // Set formatted cost akan di-handle oleh useEffect [mr.orders]
      return initialData;
    }
  };

  useEffect(() => {
    const initializePage = async () => {
      setLoading(true);
      setError(null);
      const {
        data: { user },
      } = await supabase.auth.getUser();
      setCurrentUser(user);

      if (user) {
        const { data: profile } = await supabase
          .from("profiles")
          .select("*")
          .eq("id", user.id)
          .single();
        setUserProfile(profile as Profile | null);
      }
      await fetchMrData();
      setLoading(false);
    };
    initializePage();
  }, [mrId]); // Hanya fetch ulang jika ID berubah

  // --- REVISI: useEffect untuk Auto-Sum Estimasi Biaya ---
  useEffect(() => {
    if (mr) {
      const total = mr.orders.reduce((acc, item) => {
        const qty = Number(item.qty) || 0;
        const price = Number(item.estimasi_harga) || 0;
        return acc + qty * price;
      }, 0);

      // Update state MR (hanya jika isEditing) dan state tampilan
      if (isEditing) {
        setMr((prevMr) =>
          prevMr ? { ...prevMr, cost_estimation: String(total) } : null
        );
      }
      setFormattedCost(formatCurrency(total));
    }
  }, [mr?.orders, isEditing]); // Dijalankan saat 'orders' berubah atau mode edit berubah

  const isMyTurnForApproval =
    mr && currentUser && mr.approvals // Pastikan approvals ada
      ? mr.approvals
          .slice(
            0,
            mr.approvals.findIndex((a) => a.userid === currentUser.id)
          )
          .every((a) => a.status === "approved")
      : false;

  const canEdit =
    userProfile?.department === "Purchasing" &&
    mr?.status === "Pending Approval" &&
    isMyTurnForApproval;

  const handleSaveChanges = async () => {
    if (!mr) return;
    setActionLoading(true);
    const toastId = toast.loading("Menyimpan perubahan...");

    // REVISI: Hanya update 'orders' dan 'attachments'.
    // cost_estimation di-trigger auto-sum, cost_center_id di-set GA
    const { error: updateError } = await supabase
      .from("material_requests")
      .update({
        // cost_estimation: mr.cost_estimation, // Dihapus, di-handle auto-sum
        orders: mr.orders,
        attachments: mr.attachments,
        // cost_center: mr.cost_center, // Dihapus
        // tujuan_site: mr.tujuan_site, // Dihapus, tidak boleh diedit di sini
      })
      .eq("id", mr.id);

    setActionLoading(false);
    if (updateError) {
      toast.error("Gagal menyimpan perubahan", {
        id: toastId,
        description: updateError.message,
      });
    } else {
      toast.success("Perubahan berhasil disimpan!", { id: toastId });
      setIsEditing(false);
      await fetchMrData(); // Fetch ulang data untuk sinkronisasi
    }
  };

  const handleApprovalAction = async (decision: "approved" | "rejected") => {
    if (!mr || !currentUser) return;

    if (isEditing && decision === "approved") {
      await handleSaveChanges();
    }

    setActionLoading(true);
    const approverIndex = mr.approvals.findIndex(
      (app) => app.userid === currentUser.id
    );

    if (approverIndex === -1) {
      toast.error("Anda tidak ada dalam daftar approval.");
      setActionLoading(false);
      return;
    }

    const updatedApprovals = JSON.parse(JSON.stringify(mr.approvals));
    updatedApprovals[approverIndex].status = decision;

    let newMrStatus = mr.status;
    if (decision === "rejected") {
      newMrStatus = "Rejected";
    } else if (decision === "approved") {
      const isLastApproval = updatedApprovals.every(
        (app: Approval) => app.status === "approved"
      );
      if (isLastApproval) {
        newMrStatus = "Waiting PO";
      }
    }

    const { error } = await supabase
      .from("material_requests")
      .update({ approvals: updatedApprovals, status: newMrStatus })
      .eq("id", mr.id);

    if (error) {
      toast.error("Aksi gagal", { description: error.message });
    } else {
      toast.success(
        `MR berhasil di-${decision === "approved" ? "setujui" : "tolak"}`
      );
      await fetchMrData();
    }
    setActionLoading(false);
    setIsEditing(false);
  };

  // REVISI: handleItemChange
  const handleItemChange = (
    index: number,
    field: keyof Order,
    value: string | number // Terima number untuk estimasi_harga
  ) => {
    if (!mr) return;
    const newOrders = [...mr.orders];
    (newOrders[index] as any)[field] = value;
    setMr({ ...mr, orders: newOrders });
  };

  // REVISI: addItem
  const addItem = () => {
    if (!mr) return;
    const newItem: Order = {
      name: "",
      qty: "1",
      uom: "Pcs",
      estimasi_harga: 0,
      url: "",
      note: "",
    };
    setMr({ ...mr, orders: [...mr.orders, newItem] });
  };

  const removeItem = (index: number) => {
    if (!mr) return;
    setMr({ ...mr, orders: mr.orders.filter((_, i) => i !== index) });
  };

  // HAPUS handleCostChange
  // const handleCostChange = ...

  const handleAttachmentUpload = async (
    e: React.ChangeEvent<HTMLInputElement>
  ) => {
    // ... (Fungsi ini tetap sama)
    const files = e.target.files;
    if (!files || files.length === 0 || !mr) return;

    setIsUploading(true);
    const toastId = toast.loading(`Mengunggah ${files.length} file...`);
    const uploadPromises = Array.from(files).map(async (file) => {
      const filePath = `${mr.kode_mr.replace(/\//g, "-")}/${Date.now()}_${
        file.name
      }`;
      const { data, error } = await supabase.storage
        .from("mr")
        .upload(filePath, file);
      if (error) return { error };
      return { data: { ...data, name: file.name }, error: null };
    });

    const results = await Promise.all(uploadPromises);
    const successfulUploads = results
      .filter((r) => !r.error)
      .map((r) => ({ url: r.data!.path, name: r.data!.name } as Attachment));

    if (successfulUploads.length > 0) {
      setMr((prevMr) =>
        prevMr
          ? {
              ...prevMr,
              attachments: [
                ...(prevMr.attachments || []),
                ...successfulUploads,
              ],
            }
          : null
      );
      toast.success(`${successfulUploads.length} file berhasil ditambahkan.`, {
        id: toastId,
      });
    }

    const failedUploads = results.filter((r) => r.error);
    if (failedUploads.length > 0) {
      toast.error(`Gagal mengunggah ${failedUploads.length} file.`, {
        id: toastId,
      });
    } else if (successfulUploads.length === 0) {
      toast.dismiss(toastId);
    }

    setIsUploading(false);
    e.target.value = "";
  };

  const removeAttachment = (indexToRemove: number) => {
    // ... (Fungsi ini tetap sama)
    if (!mr || !Array.isArray(mr.attachments)) return;
    const attachmentToRemove = mr.attachments[indexToRemove];
    if (!attachmentToRemove) return;

    setMr((prevMr) =>
      prevMr
        ? {
            ...prevMr,
            attachments: prevMr.attachments.filter(
              (_, i) => i !== indexToRemove
            ),
          }
        : null
    );
    supabase.storage.from("mr").remove([attachmentToRemove.url]);
    toast.info(
      `Lampiran "${attachmentToRemove.name}" dihapus. Perubahan akan tersimpan saat Anda menyimpan.`
    );
  };

  const ApprovalActions = () => {
    // ... (Fungsi ini tetap sama)
    if (!mr || !currentUser || mr.status !== "Pending Approval") return null;
    const myApprovalIndex = mr.approvals.findIndex(
      (app) => app.userid === currentUser.id
    );
    if (
      myApprovalIndex === -1 ||
      mr.approvals[myApprovalIndex].status !== "pending"
    )
      return null;
    if (!isMyTurnForApproval)
      return (
        <p className="text-sm text-muted-foreground text-center">
          Menunggu persetujuan dari approver sebelumnya.
        </p>
      );

    return (
      <div className="flex gap-2">
        <Button
          className="w-full"
          onClick={() => handleApprovalAction("approved")}
          disabled={actionLoading}
        >
          {actionLoading ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <Check className="mr-2 h-4 w-4" />
          )}{" "}
          Setujui
        </Button>
        <Button
          variant="destructive"
          className="w-full"
          onClick={() => handleApprovalAction("rejected")}
          disabled={actionLoading}
        >
          {actionLoading ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <X className="mr-2 h-4 w-4" />
          )}{" "}
          Tolak
        </Button>
      </div>
    );
  };

  // REVISI: getStatusBadge diperbarui
  const getStatusBadge = (status: string) => {
    switch (status?.toLowerCase()) {
      case "approved":
        return <Badge variant="outline">Approved</Badge>;
      case "rejected":
        return <Badge variant="destructive">Rejected</Badge>;
      case "pending approval":
        return <Badge variant="secondary">Pending Approval</Badge>;
      case "pending validation":
        return <Badge variant="secondary">Pending Validation</Badge>;
      case "waiting po":
        return <Badge className="bg-blue-500 text-white">Waiting PO</Badge>;
      case "completed":
        return <Badge className="bg-green-500 text-white">Completed</Badge>;
      default:
        return <Badge>{status || "N/A"}</Badge>;
    }
  };

  const getApprovalStatusBadge = (
    status: "pending" | "approved" | "rejected"
  ) => {
    // ... (Fungsi ini tetap sama)
    switch (status) {
      case "approved":
        return (
          <Badge variant="outline" className="capitalize">
            {status}
          </Badge>
        );
      case "rejected":
        return (
          <Badge variant="destructive" className="capitalize">
            {status}
          </Badge>
        );
      default:
        return (
          <Badge variant="secondary" className="capitalize">
            {status}
          </Badge>
        );
    }
  };

  if (loading) return <DetailMRSkeleton />;
  if (error || !mr)
    return (
      <Content className="col-span-12">
        <div className="flex flex-col items-center justify-center h-96 text-center">
          <AlertTriangle className="w-16 h-16 text-destructive mb-4" />
          <h1 className="text-2xl font-bold">Data Tidak Ditemukan</h1>
          <p className="text-muted-foreground">{error}</p>
          <Button asChild variant="outline" className="mt-6">
            <Link href="/material-request">Kembali ke Daftar MR</Link>
          </Button>
        </div>
      </Content>
    );

  const currentTurnIndex = mr.approvals.findIndex(
    (app) => app.status === "pending"
  );
  const allPreviousApproved =
    currentTurnIndex === -1
      ? false
      : currentTurnIndex === 0 || // Jika ini approver pertama
        mr.approvals
          .slice(0, currentTurnIndex)
          .every((app) => app.status === "approved");

  return (
    <>
      <div className="col-span-12">
        <div className="flex flex-wrap justify-between items-center gap-4 mb-6">
          <div>
            <h1 className="text-3xl font-bold">{mr.kode_mr}</h1>
            <p className="text-muted-foreground">Detail Material Request</p>
          </div>
          <div className="flex items-center gap-2">
            {canEdit && !isEditing && (
              <Button
                variant="outline"
                size="sm"
                onClick={() => setIsEditing(true)}
              >
                <Edit className="mr-2 h-4 w-4" /> Edit Rincian
              </Button>
            )}
            <span className="text-lg">Status:</span>
            {getStatusBadge(mr.status)}
          </div>
        </div>
      </div>

      <div className="col-span-12 lg:col-span-8 space-y-6">
        <Content title="Informasi Utama">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-x-6 gap-y-4">
            <InfoItem
              icon={CircleUser}
              label="Pembuat"
              value={(mr as any).users_with_profiles?.nama || "N/A"}
            />
            <InfoItem
              icon={Building}
              label="Departemen"
              value={mr.department}
            />
            <InfoItem icon={Tag} label="Kategori" value={mr.kategori} />
            <InfoItem
              icon={Calendar}
              label="Tanggal Dibuat"
              value={formatDateFriendly(mr.created_at)}
            />

            {/* REVISI: Tampilkan Cost Center & Tujuan Site */}
            <InfoItem
              icon={Building2}
              label="Cost Center"
              value={
                costCenterName ||
                (mr.cost_center_id
                  ? `ID: ${mr.cost_center_id}`
                  : "Belum Ditentukan GA")
              }
            />
            <InfoItem
              icon={Truck}
              label="Tujuan (Site)"
              value={mr.tujuan_site || "N/A"}
            />

            <InfoItem
              icon={Calendar}
              label="Due Date"
              value={formatDateFriendly(mr.due_date)}
            />

            {/* REVISI: Estimasi Biaya (selalu read-only) */}
            <InfoItem
              icon={DollarSign}
              label="Total Estimasi Biaya"
              value={formattedCost}
            />

            {/* Hapus blok isEditing untuk Cost Center dan Tujuan Site */}

            <div className="md:col-span-2">
              <InfoItem icon={Info} label="Remarks" value={mr.remarks} />
            </div>
          </div>
        </Content>

        <Content title="Order Items">
          {isEditing ? (
            <div className="space-y-4">
              <div className="rounded-md border overflow-x-auto">
                {/* REVISI: Tabel Edit Item */}
                <Table className="min-w-[1000px]">
                  <TableHeader>
                    <TableRow>
                      <TableHead>Nama</TableHead>
                      <TableHead>Qty</TableHead>
                      <TableHead>UoM</TableHead>
                      <TableHead>Estimasi Harga</TableHead>
                      <TableHead>Total</TableHead>
                      <TableHead>Catatan</TableHead>
                      <TableHead>Link</TableHead>
                      <TableHead>Aksi</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {mr.orders.map((item, index) => (
                      <TableRow key={index}>
                        <TableCell>
                          <Input
                            value={item.name}
                            onChange={(e) =>
                              handleItemChange(index, "name", e.target.value)
                            }
                            disabled={actionLoading}
                          />
                        </TableCell>
                        <TableCell>
                          <Input
                            value={item.qty}
                            onChange={(e) =>
                              handleItemChange(index, "qty", e.target.value)
                            }
                            className="w-20"
                            type="number"
                            disabled={actionLoading}
                          />
                        </TableCell>
                        <TableCell>
                          <Input
                            value={item.uom}
                            onChange={(e) =>
                              handleItemChange(index, "uom", e.target.value)
                            }
                            className="w-24"
                            disabled={actionLoading}
                          />
                        </TableCell>
                        {/* REVISI: CurrencyInput untuk Estimasi Harga */}
                        <TableCell>
                          <CurrencyInput
                            value={item.estimasi_harga}
                            onValueChange={(value) =>
                              handleItemChange(index, "estimasi_harga", value)
                            }
                            disabled={actionLoading}
                            className="w-32"
                          />
                        </TableCell>
                        <TableCell>
                          {formatCurrency(
                            Number(item.qty) * item.estimasi_harga
                          )}
                        </TableCell>
                        <TableCell>
                          <Input
                            value={item.note}
                            onChange={(e) =>
                              handleItemChange(index, "note", e.target.value)
                            }
                            disabled={actionLoading}
                          />
                        </TableCell>
                        <TableCell>
                          <Input
                            value={item.url}
                            onChange={(e) =>
                              handleItemChange(index, "url", e.target.value)
                            }
                            disabled={actionLoading}
                            type="url"
                          />
                        </TableCell>
                        <TableCell>
                          <Button
                            variant="destructive"
                            size="icon"
                            onClick={() => removeItem(index)}
                            disabled={actionLoading}
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
              <Button
                variant="outline"
                onClick={addItem}
                disabled={actionLoading}
              >
                <Plus className="mr-2 h-4 w-4" /> Tambah Item
              </Button>
            </div>
          ) : (
            <div className="rounded-md border overflow-x-auto">
              {/* REVISI: Tabel Baca Item */}
              <Table className="min-w-[800px]">
                <TableHeader>
                  <TableRow>
                    <TableHead>Nama Item</TableHead>
                    <TableHead>Qty</TableHead>
                    <TableHead className="text-right">Estimasi Harga</TableHead>
                    <TableHead className="text-right">Total Estimasi</TableHead>
                    <TableHead>Catatan</TableHead>
                    <TableHead>Link</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {mr.orders.map((item, index) => (
                    <TableRow key={index}>
                      <TableCell className="font-medium">{item.name}</TableCell>
                      <TableCell>
                        {item.qty} {item.uom}
                      </TableCell>
                      <TableCell className="text-right">
                        {formatCurrency(item.estimasi_harga)}
                      </TableCell>
                      <TableCell className="text-right font-medium">
                        {formatCurrency(Number(item.qty) * item.estimasi_harga)}
                      </TableCell>
                      <TableCell className="max-w-xs truncate">
                        {item.note || "-"}
                      </TableCell>
                      <TableCell>
                        {item.url && (
                          <Button asChild variant={"outline"} size="sm">
                            <Link
                              href={item.url}
                              target="_blank"
                              rel="noopener noreferrer"
                            >
                              <LinkIcon className="h-3 w-3" />
                            </Link>
                          </Button>
                        )}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </Content>
      </div>

      <div className="col-span-12 lg:col-span-4 space-y-6">
        <Content title="Tindakan">
          {isEditing ? (
            <div className="flex flex-col gap-2">
              <Button onClick={handleSaveChanges} disabled={actionLoading}>
                {actionLoading ? (
                  <Loader2 className="animate-spin" />
                ) : (
                  <Save className="mr-2 h-4 w-4" />
                )}{" "}
                Simpan Perubahan
              </Button>
              <ApprovalActions />
              <Button
                variant="ghost"
                onClick={() => {
                  setIsEditing(false);
                  fetchMrData();
                }}
              >
                Batal Edit
              </Button>
            </div>
          ) : (
            <ApprovalActions />
          )}
        </Content>

        <Content title="Jalur Approval">
          {mr.approvals.length > 0 ? (
            <ul className="space-y-2">
              {mr.approvals.map((approver, index) => {
                const isMyTurn =
                  currentTurnIndex === index &&
                  (currentTurnIndex === 0 || allPreviousApproved);
                return (
                  <li
                    key={index}
                    className={cn(
                      "flex items-center justify-between gap-4 p-3 rounded-md transition-all",
                      isMyTurn && "bg-primary/10 ring-2 ring-primary/50"
                    )}
                  >
                    <div>
                      <p className="font-semibold">{approver.nama}</p>
                      <p className="text-sm text-muted-foreground">
                        {approver.type}
                      </p>
                    </div>
                    {getApprovalStatusBadge(
                      approver.status as "approved" | "rejected" | "pending"
                    )}
                  </li>
                );
              })}
            </ul>
          ) : (
            <p className="text-sm text-muted-foreground text-center">
              Jalur approval belum ditentukan oleh GA.
            </p>
          )}
        </Content>
        <Content title="Lampiran">
          {isEditing ? (
            <div className="space-y-4">
              <Label htmlFor="attachments">Tambah Lampiran</Label>
              <Input
                id="attachments"
                type="file"
                multiple
                disabled={actionLoading || isUploading}
                onChange={handleAttachmentUpload}
              />
              {isUploading && (
                <div className="flex items-center text-sm text-muted-foreground">
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />{" "}
                  Mengunggah...
                </div>
              )}
              {mr.attachments.length > 0 && (
                <ul className="space-y-2 mt-2">
                  {mr.attachments.map((file, index) => (
                    <li
                      key={index}
                      className="flex items-center justify-between text-sm p-2 bg-muted/50 rounded"
                    >
                      <div className="flex items-center gap-2 truncate min-w-0">
                        <Paperclip className="h-4 w-4 flex-shrink-0" />
                        <span className="truncate">{file.name}</span>
                      </div>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-6 w-6"
                        onClick={() => removeAttachment(index)}
                      >
                        <Trash2 className="h-4 w-4 text-destructive" />
                      </Button>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          ) : (mr.attachments || []).length > 0 ? (
            <ul className="space-y-2">
              {(mr.attachments as Attachment[]).map((file, index) => (
                <li key={index}>
                  <Link
                    href={`https://xdkjqwpvmyqcggpwghyi.supabase.co/storage/v1/object/public/mr/${file.url}`}
                    target="_blank"
                    className="flex items-center gap-2 text-sm text-primary hover:underline"
                  >
                    <Paperclip className="h-4 w-4" />
                    <span>{file.name}</span>
                    <ExternalLink className="h-3 w-3 text-muted-foreground" />
                  </Link>
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-sm text-muted-foreground">Tidak ada lampiran.</p>
          )}
        </Content>
      </div>

      {/* REVISI: Aktifkan Diskusi */}
      <div className="col-span-12">
        <DiscussionSection
          mrId={String(mr.id)}
          initialDiscussions={mr.discussions as Discussion[]}
        />
      </div>
    </>
  );
}

// Komponen InfoItem (disalin ke atas, di dalam ValidateMRPageContent)
// const InfoItem = ...

const DetailMRSkeleton = () => (
  <>
    <div className="col-span-12">
      <Skeleton className="h-12 w-1/2" />
    </div>
    <Content className="col-span-12 lg:col-span-8">
      <Skeleton className="h-64 w-full" />
    </Content>
    <Content className="col-span-12 lg:col-span-4">
      <Skeleton className="h-64 w-full" />
    </Content>
  </>
);

export default function DetailMRPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const resolvedParams = use(params);
  return (
    <Suspense fallback={<DetailMRSkeleton />}>
      <DetailMRPageContent params={resolvedParams} />
    </Suspense>
  );
}

const InfoItem = ({
  icon: Icon,
  label,
  value,
}: {
  icon: React.ElementType;
  label: string;
  value: string;
}) => (
  <div className="flex items-start gap-3">
    <Icon className="h-5 w-5 text-muted-foreground mt-1 flex-shrink-0" />
    <div>
      <p className="text-sm text-muted-foreground">{label}</p>
      <p className="font-medium whitespace-pre-wrap">{value}</p>
    </div>
  </div>
);
