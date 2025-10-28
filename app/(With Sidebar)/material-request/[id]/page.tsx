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
} from "@/type";
import { formatCurrency, formatDateFriendly, cn } from "@/lib/utils";
import { DiscussionSection } from "./discussion-component";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Combobox, ComboboxData } from "@/components/combobox";

const dataCostCenter: ComboboxData = [
  { label: "APD - GMI", value: "APD - GMI" },
  { label: "Bangunan - GMI", value: "Bangunan - GMI" },
  { label: "Alat Berat - GIS", value: "Alat Berat - GIS" },
  { label: "Operasional Kantor - HO", value: "Operasional Kantor - HO" },
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

  const supabase = createClient();

  const fetchMrData = async () => {
    if (isNaN(mrId)) {
      setError("ID Material Request tidak valid.");
      return null;
    }
    const { data: mrData, error: mrError } = await supabase
      .from("material_requests")
      .select("*, users_with_profiles!userid(nama)")
      .eq("id", mrId)
      .single();

    if (mrError) {
      setError("Gagal memuat data MR.");
      toast.error("Gagal memuat data", { description: mrError.message });
      return null;
    } else {
      setMr(mrData as any);
      const initialCost = Number(mrData.cost_estimation) || 0;
      setFormattedCost(
        new Intl.NumberFormat("id-ID", {
          style: "currency",
          currency: "IDR",
          minimumFractionDigits: 0,
        }).format(initialCost)
      );
      return mrData;
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
  }, [mrId]);

  const isMyTurnForApproval =
    mr && currentUser
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

    const { error: updateError } = await supabase
      .from("material_requests")
      .update({
        cost_estimation: mr.cost_estimation,
        orders: mr.orders,
        attachments: mr.attachments,
        cost_center: mr.cost_center,
        tujuan_site: mr.tujuan_site,
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

  const handleItemChange = (
    index: number,
    field: keyof Order,
    value: string
  ) => {
    if (!mr) return;
    const newOrders = [...mr.orders];
    (newOrders[index] as any)[field] = value;
    setMr({ ...mr, orders: newOrders });
  };

  const addItem = () => {
    if (!mr) return;
    const newItem: Order = {
      name: "",
      qty: "1",
      uom: "Pcs",
      vendor: "",
      url: "",
      note: "",
      vendor_contact: "",
    };
    setMr({ ...mr, orders: [...mr.orders, newItem] });
  };

  const removeItem = (index: number) => {
    if (!mr) return;
    setMr({ ...mr, orders: mr.orders.filter((_, i) => i !== index) });
  };

  const handleCostChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const rawValue = e.target.value.replace(/[^0-9]/g, "");
    const numericValue = parseInt(rawValue, 10) || 0;
    if (mr) setMr({ ...mr, cost_estimation: String(numericValue) });
    setFormattedCost(
      new Intl.NumberFormat("id-ID", {
        style: "currency",
        currency: "IDR",
        minimumFractionDigits: 0,
      }).format(numericValue)
    );
  };

  const handleAttachmentUpload = async (
    e: React.ChangeEvent<HTMLInputElement>
  ) => {
    const files = e.target.files;
    if (!files || files.length === 0 || !mr) return;

    setIsUploading(true);
    const toastId = toast.loading(`Mengunggah ${files.length} file...`);
    const uploadPromises = Array.from(files).map(async (file) => {
      const filePath = `${mr.kode_mr.replace(/\//g, "-")}/${Date.now()}_${
        file.name
      }`;
      const { data, error } = await supabase.storage
        .from("mr") // Pastikan bucket 'mr'
        .upload(filePath, file);
      if (error) return { error };
      return { data: { ...data, name: file.name }, error: null };
    });

    const results = await Promise.all(uploadPromises);
    const successfulUploads = results
      .filter((r) => !r.error)
      .map((r) => ({ url: r.data!.path, name: r.data!.name }));

    if (successfulUploads.length > 0) {
      setMr((prevMr) =>
        prevMr
          ? {
              ...prevMr,
              attachments: [...prevMr.attachments, ...successfulUploads],
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
    if (!mr) return;
    const attachmentToRemove = mr.attachments[indexToRemove];
    // Hapus dari state
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

  const getStatusBadge = (status: string) => {
    switch (status.toLowerCase()) {
      case "approved":
        return <Badge variant="outline">Approved</Badge>;
      case "rejected":
        return <Badge variant="destructive">Rejected</Badge>;
      case "pending approval":
        return <Badge variant="secondary">Pending Approval</Badge>;
      case "pending validation":
        return <Badge variant="secondary">Pending Validation</Badge>;
      default:
        return <Badge>{status}</Badge>;
    }
  };

  const getApprovalStatusBadge = (
    status: "pending" | "approved" | "rejected"
  ) => {
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

  // REVISI: Logika untuk highlight approver
  const currentTurnIndex = mr.approvals.findIndex(
    (app) => app.status === "pending"
  );
  const allPreviousApproved =
    currentTurnIndex === -1
      ? false
      : mr.approvals
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

            {/* REVISI: Tambah Cost Center & Tujuan Site */}
            <InfoItem
              icon={Building}
              label="Cost Center"
              value={mr.cost_center || "N/A"}
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

            {isEditing ? (
              <div className="space-y-1">
                <Label>Estimasi Biaya</Label>
                <Input
                  type="text"
                  value={formattedCost}
                  onChange={handleCostChange}
                  disabled={actionLoading}
                />
              </div>
            ) : (
              <InfoItem
                icon={DollarSign}
                label="Estimasi Biaya"
                value={formatCurrency(mr.cost_estimation)}
              />
            )}

            {/* REVISI: Tambah input untuk Cost Center & Tujuan di mode edit */}
            {isEditing && (
              <>
                <div className="space-y-1">
                  <Label>Cost Center</Label>
                  <Combobox
                    data={dataCostCenter}
                    onChange={(value) => setMr({ ...mr, cost_center: value })}
                    defaultValue={mr.cost_center}
                    disabled={actionLoading}
                  />
                </div>
                <div className="space-y-1">
                  <Label>Tujuan (Site)</Label>
                  <Combobox
                    data={dataLokasi}
                    onChange={(value) => setMr({ ...mr, tujuan_site: value })}
                    defaultValue={mr.tujuan_site}
                    disabled={actionLoading}
                  />
                </div>
              </>
            )}

            <div className="md:col-span-2">
              <InfoItem icon={Info} label="Remarks" value={mr.remarks} />
            </div>
          </div>
        </Content>

        <Content title="Order Items">
          {isEditing ? (
            <div className="space-y-4">
              <div className="rounded-md border overflow-x-auto">
                {/* REVISI: Tabel Edit diperlengkap */}
                <Table className="min-w-[1000px]">
                  <TableHeader>
                    <TableRow>
                      <TableHead>Nama</TableHead>
                      <TableHead>Qty</TableHead>
                      <TableHead>UoM</TableHead>
                      <TableHead>Vendor</TableHead>
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
                        <TableCell>
                          <Input
                            value={item.vendor}
                            onChange={(e) =>
                              handleItemChange(index, "vendor", e.target.value)
                            }
                            disabled={actionLoading}
                          />
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
              {/* REVISI: Tabel Baca diperlengkap */}
              <Table className="min-w-[800px]">
                <TableHeader>
                  <TableRow>
                    <TableHead>Nama Item</TableHead>
                    <TableHead>Qty</TableHead>
                    <TableHead>Vendor</TableHead>
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
                      <TableCell>{item.vendor || "-"}</TableCell>
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
                // REVISI: Logika untuk menentukan highlight
                const isMyTurn =
                  currentTurnIndex === index &&
                  (currentTurnIndex === 0 || allPreviousApproved);
                return (
                  <li
                    key={index}
                    className={cn(
                      "flex items-center justify-between gap-4 p-3 rounded-md transition-all",
                      isMyTurn && "bg-primary/10 ring-2 ring-primary/50" // <-- Kelas highlight
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
          ) : mr.attachments.length > 0 ? (
            <ul className="space-y-2">
              {mr.attachments.map((file, index) => (
                <li key={index}>
                  <Link
                    href={`https://xdkjqwpvmyqcggpwghyi.supabase.co/storage/v1/object/public/mr/${file.url}`}
                    target="_blank"
                    className="flex items-center gap-2 text-sm text-primary hover:underline"
                  >
                    <Download className="h-4 w-4" />
                    <span>{file.name}</span>
                  </Link>
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-sm text-muted-foreground">Tidak ada lampiran.</p>
          )}
        </Content>
      </div>

      <div className="col-span-12">
        <DiscussionSection
          mrId={String(mr.id)}
          initialDiscussions={mr.discussions as Discussion[]}
        />
      </div>
    </>
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
