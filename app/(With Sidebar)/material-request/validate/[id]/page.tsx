// src/app/(With Sidebar)/material-request/validate/[id]/page.tsx

"use client";

import { use, useEffect, useState, Suspense } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { Content } from "@/components/content";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { toast } from "sonner";
import {
  MaterialRequest,
  Approval,
  Discussion,
  Order,
  Profile,
  Attachment,
} from "@/type"; // Pastikan 'Order' dan 'Profile' ada
import { formatCurrency, formatDateFriendly, cn } from "@/lib/utils";
import {
  AlertTriangle,
  ArrowDown,
  ArrowUp,
  CheckCircle,
  Clock,
  Download,
  Loader2,
  XCircle,
  Building2,
  Truck,
  CircleUser,
  ArrowLeft,
  Check,
  Link as LinkIcon,
  Paperclip,
  Tag,
  ExternalLink, // Import ExternalLink
  DollarSign, // Import DollarSign
  Info, // Import Info
} from "lucide-react";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Combobox, ComboboxData } from "@/components/combobox";
import {
  fetchTemplateById,
  fetchTemplateList,
} from "@/services/approvalTemplateService";
import { Label } from "@/components/ui/label";
import Link from "next/link";
import { fetchActiveCostCenters } from "@/services/mrService"; // Import fetcher Cost Center

function ValidateMRPageContent({ params }: { params: { id: string } }) {
  const router = useRouter();
  const mrId = parseInt(params.id);

  const [mr, setMr] = useState<
    | (MaterialRequest & {
        users_with_profiles: { nama: string; email: string } | null;
      })
    | null
  >(null);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null); // State untuk GA profile

  // State untuk approval
  const [newApprovals, setNewApprovals] = useState<Approval[]>([]);
  const [templateList, setTemplateList] = useState<ComboboxData>([]);
  const [selectedTemplateId, setSelectedTemplateId] = useState<string>("");
  const [rejectionReason, setRejectionReason] = useState("");

  // --- REVISI: State untuk Cost Center ---
  // Tipe yang benar adalah ComboboxData (karena ComboboxData sudah ...[])
  const [costCenterList, setCostCenterList] = useState<ComboboxData>([]);
  const [selectedCostCenterId, setSelectedCostCenterId] = useState<
    number | null
  >(null);

  const s = createClient();

  // Fetch data MR, template, dan Cost Center
  useEffect(() => {
    if (isNaN(mrId)) {
      setError("ID Material Request tidak valid.");
      setLoading(false);
      return;
    }

    const fetchInitialData = async () => {
      setLoading(true);
      try {
        // 1. Ambil profil GA dulu
        const {
          data: { user },
        } = await s.auth.getUser();
        if (user) {
          const { data: profileData } = await s
            .from("profiles")
            .select("*")
            .eq("id", user.id)
            .single();
          setProfile(profileData as Profile);
        } else {
          throw new Error("Sesi user tidak ditemukan.");
        }

        // 2. Ambil MR
        const { data: mrData, error: mrError } = await s
          .from("material_requests")
          .select("*, users_with_profiles!userid(nama, email)")
          .eq("id", mrId)
          .single();

        if (mrError) throw mrError;
        if (mrData.status !== "Pending Validation") {
          setError("Material Request ini tidak lagi menunggu validasi.");
        }
        setMr(mrData as any);
        // Set initial CC (jika sudah pernah diisi)
        setSelectedCostCenterId(mrData.cost_center_id || null);

        // 3. Ambil Template dan Cost Center (berdasarkan company MR)
        const [templatesResult, costCentersResult] = await Promise.all([
          fetchTemplateList(),
          fetchActiveCostCenters(mrData.company_code),
        ]);

        // 4. Proses Template (Tipe ComboboxData sudah array)
        const templateOptions: ComboboxData = templatesResult.map((t) => ({
          label: t.template_name,
          value: String(t.id),
        }));
        setTemplateList(templateOptions);

        // 5. Proses Cost Center (Tipe ComboboxData sudah array)
        const costCenterOptions: ComboboxData = costCentersResult.map((cc) => ({
          label: `${cc.name} (${formatCurrency(cc.current_budget)})`,
          value: cc.id.toString(),
        }));
        setCostCenterList(costCenterOptions); // Ini sekarang akan berfungsi
      } catch (err: any) {
        setError("Gagal memuat data.");
        toast.error("Gagal memuat data", { description: err.message });
      } finally {
        setLoading(false);
      }
    };

    fetchInitialData();
  }, [mrId, s]);

  // Efek untuk menerapkan template saat dipilih
  const handleTemplateChange = async (templateId: string) => {
    setSelectedTemplateId(templateId);
    if (!templateId) {
      setNewApprovals([]);
      return;
    }
    try {
      const template = await fetchTemplateById(Number(templateId));
      const approvalsFromTemplate = (template.approval_path as any[]).map(
        (app: any): Approval => ({
          ...app,
          status: "pending" as const,
          type: app.type || "",
        })
      );
      setNewApprovals(approvalsFromTemplate);
      toast.success(
        `Template "${template.template_name}" berhasil diterapkan.`
      );
    } catch (err: any) {
      toast.error("Gagal menerapkan template", { description: err.message });
    }
  };

  // Handler untuk Combobox Cost Center
  const handleCostCenterChange = (value: string) => {
    setSelectedCostCenterId(value ? Number(value) : null);
  };

  // Fungsi untuk mengelola Approval Path
  const removeApprover = (userId: string) =>
    setNewApprovals((prev) => prev.filter((a) => a.userid !== userId));

  const moveApprover = (index: number, direction: "up" | "down") => {
    const newArr = [...newApprovals];
    const newIndex = direction === "up" ? index - 1 : index + 1;
    if (newIndex < 0 || newIndex >= newArr.length) return;
    [newArr[index], newArr[newIndex]] = [newArr[newIndex], newArr[index]];
    setNewApprovals(newArr);
  };

  const updateApproverType = (userId: string, type: string) => {
    setNewApprovals((prev) =>
      prev.map((app) => (app.userid === userId ? { ...app, type } : app))
    );
  };

  // Fungsi untuk Aksi
  const handleValidate = async () => {
    if (!mr || !profile) {
      toast.error("Data MR atau profil GA tidak ditemukan.");
      return;
    }

    if (!selectedCostCenterId) {
      toast.error("Cost Center wajib dipilih sebelum validasi.");
      return;
    }

    if (newApprovals.length === 0 || newApprovals.some((a) => !a.type)) {
      toast.error("Jalur approval belum lengkap.");
      return;
    }

    // Peringatan budget
    const selectedCC = costCenterList.find(
      (c) => c.value === selectedCostCenterId.toString()
    );
    let budget = 0;
    if (selectedCC) {
      try {
        const budgetMatch = selectedCC.label.match(/\(Rp\s(.+)\)/);
        if (budgetMatch && budgetMatch[1]) {
          budget = parseFloat(budgetMatch[1].replace(/\./g, ""));
        }
      } catch (e) {
        console.error("Gagal parse budget dari label");
      }
    }

    if (Number(mr.cost_estimation) > budget) {
      if (
        !window.confirm(
          `Peringatan: Estimasi biaya MR (${formatCurrency(
            mr.cost_estimation
          )}) melebihi sisa budget Cost Center (${formatCurrency(
            budget
          )}).\n\nApakah Anda yakin ingin tetap validasi?`
        )
      ) {
        return;
      }
    }

    setActionLoading(true);
    const toastId = toast.loading("Memvalidasi MR...");

    const validationApproval: Approval = {
      type: "Validator",
      status: "approved",
      userid: profile.id,
      nama: profile.nama || "GA User",
      email: profile.email || "",
      role: profile.role || "user",
      department: profile.department || "General Affair",
      processed_at: new Date().toISOString(),
    };

    const finalApprovals = [validationApproval, ...newApprovals];

    try {
      const { error: updateError } = await s
        .from("material_requests")
        .update({
          approvals: finalApprovals,
          status: "Pending Approval",
          cost_center_id: selectedCostCenterId,
        })
        .eq("id", mrId);

      if (updateError) throw updateError;

      const requesterEmail = mr.users_with_profiles?.email;
      const firstApprover = newApprovals[0];
      const emailPromises = [];

      if (requesterEmail) {
        emailPromises.push(
          fetch("/api/v1/send-email", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              to: requesterEmail,
              subject: `[VALIDATED] MR Anda (${mr.kode_mr}) telah divalidasi`,
              html: `<h1>Material Request Divalidasi</h1><p>Halo,</p><p>Material Request Anda dengan kode <strong>${mr.kode_mr}</strong> telah berhasil divalidasi oleh General Affair dan sekarang sedang dalam proses persetujuan.</p><a href="${window.location.origin}/material-request/${mr.id}">Lihat Detail MR</a>`,
            }),
          })
        );
      }
      if (firstApprover?.email) {
        emailPromises.push(
          fetch("/api/v1/send-email", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              to: firstApprover.email,
              subject: `[ACTION REQUIRED] Persetujuan MR Baru (${mr.kode_mr})`,
              html: `<h1>Tugas Persetujuan Baru</h1><p>Halo ${firstApprover.nama},</p><p>Anda memiliki Material Request baru dengan kode <strong>${mr.kode_mr}</strong> yang menunggu persetujuan Anda.</p><a href="${window.location.origin}/approval-validation">Buka Halaman Approval</a>`,
            }),
          })
        );
      }
      await Promise.all(emailPromises);
      toast.success("MR berhasil divalidasi dan notifikasi email terkirim!", {
        id: toastId,
      });
    } catch (err: any) {
      const errorMsg = err.message || "Terjadi kesalahan";
      toast.error(
        errorMsg.includes("update")
          ? "Gagal memvalidasi"
          : "Validasi berhasil, tapi email gagal terkirim",
        {
          id: toastId,
          description: errorMsg,
        }
      );
    } finally {
      setActionLoading(false);
      router.push("/approval-validation");
    }
  };

  const handleReject = async () => {
    if (!rejectionReason.trim()) {
      toast.error("Alasan penolakan wajib diisi.");
      return;
    }
    setActionLoading(true);
    const newDiscussion: Discussion = {
      user_id: profile?.id || "system",
      user_name: profile?.nama || "System (Validation)",
      message: `MR Ditolak oleh GA dengan alasan: ${rejectionReason}`,
      timestamp: new Date().toISOString(),
    };
    const updatedDiscussions = mr?.discussions
      ? [...(mr.discussions as Discussion[]), newDiscussion]
      : [newDiscussion];
    const { error } = await s
      .from("material_requests")
      .update({ status: "Rejected", discussions: updatedDiscussions })
      .eq("id", mrId);
    setActionLoading(false);
    if (error) {
      toast.error("Gagal menolak MR", { description: error.message });
    } else {
      toast.success("MR telah ditolak.");
      router.push("/approval-validation");
    }
  };

  if (loading)
    return (
      <div className="col-span-12">
        <Skeleton className="h-[80vh] w-full" />
      </div>
    );
  if (error || !mr)
    return (
      <Content className="col-span-12">
        <div className="text-center">
          <AlertTriangle className="mx-auto h-12 w-12 text-destructive" />
          <p className="mt-4">{error || "Data MR tidak ditemukan."}</p>
        </div>
      </Content>
    );

  const currentTurnIndex = newApprovals.findIndex(
    (app) => app.status === "pending"
  );
  const allPreviousApproved =
    currentTurnIndex === -1
      ? false
      : currentTurnIndex === 0 ||
        newApprovals
          .slice(0, currentTurnIndex)
          .every((app) => app.status === "approved");

  return (
    <>
      <div className="col-span-12">
        <div className="flex flex-wrap justify-between items-start gap-4">
          <div>
            <Button
              variant="outline"
              size="sm"
              onClick={() => router.back()}
              className="mb-4"
            >
              <ArrowLeft className="mr-2 h-4 w-4" /> Kembali
            </Button>
            <h1 className="text-3xl font-bold">Validasi Material Request</h1>
            <p className="text-muted-foreground">
              MR:{" "}
              <span className="font-semibold text-primary">{mr.kode_mr}</span>
            </p>
          </div>
          <Badge variant="secondary">{mr.status}</Badge>
        </div>
      </div>

      <div className="col-span-12 lg:col-span-7 flex flex-col gap-6">
        <Content title="Detail Pengajuan" size="sm">
          <div className="space-y-4">
            <InfoItem
              icon={CircleUser}
              label="Requester"
              value={mr.users_with_profiles?.nama || "N/A"}
            />
            <InfoItem
              icon={Building2}
              label="Departemen"
              value={mr.department}
            />
            <InfoItem icon={Tag} label="Kategori" value={mr.kategori} />
            <InfoItem
              icon={Clock}
              label="Due Date"
              value={formatDateFriendly(mr.due_date)}
            />
            <InfoItem
              icon={Building2}
              label="Cost Center"
              value={
                costCenterList
                  .find((c) => c.value === mr.cost_center_id?.toString())
                  ?.label.split(" (")[0] ||
                (mr.cost_center_id
                  ? `ID: ${mr.cost_center_id}`
                  : "Belum Ditentukan")
              }
            />
            <InfoItem
              icon={Truck}
              label="Tujuan Site"
              value={mr.tujuan_site || "N/A"}
            />
            <InfoItem
              icon={DollarSign}
              label="Total Estimasi Biaya"
              value={formatCurrency(mr.cost_estimation)}
            />
            <InfoItem icon={Info} label="Remarks" value={mr.remarks} isBlock />
          </div>
        </Content>

        <Content title="Item yang Diminta" size="sm">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Nama Item</TableHead>
                <TableHead>Qty</TableHead>
                <TableHead className="text-right">Estimasi Harga</TableHead>
                <TableHead className="text-right">Total Estimasi</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {(mr.orders as Order[]).map((item: Order, i: number) => (
                <TableRow key={i}>
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
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </Content>

        <Content title="Lampiran" size="sm">
          {(mr.attachments || []).length > 0 ? (
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

      <div className="col-span-12 lg:col-span-5 flex flex-col gap-6">
        <Content
          title="Tentukan Jalur Approval"
          size="sm"
          cardAction={
            <Button asChild size={"sm"} variant={"outline"}>
              <Link target="_blank" href={"/approval-validation/templates"}>
                Kelola Template
              </Link>
            </Button>
          }
        >
          <div className="space-y-4">
            <div>
              <Label className="font-medium text-base">
                1. Tentukan Cost Center (Wajib)
              </Label>
              <Combobox
                data={costCenterList}
                onChange={handleCostCenterChange}
                defaultValue={selectedCostCenterId?.toString() ?? ""}
                placeholder={
                  costCenterList.length > 0
                    ? "Pilih Cost Center..."
                    : "Memuat..."
                }
                disabled={costCenterList.length === 0}
              />
              {selectedCostCenterId &&
                Number(mr.cost_estimation) >
                  (costCenterList.find(
                    (c) => c.value === selectedCostCenterId.toString()
                  )
                    ? parseFloat(
                        (
                          costCenterList
                            .find(
                              (c) => c.value === selectedCostCenterId.toString()
                            )!
                            .label.match(/\(Rp\s(.+)\)/)?.[1] || "0"
                        ).replace(/\./g, "")
                      )
                    : 0) && (
                  <p className="text-xs text-destructive font-medium mt-1">
                    Peringatan: Estimasi biaya MR melebihi sisa budget Cost
                    Center ini.
                  </p>
                )}
            </div>

            <div>
              <Label className="font-medium text-base">
                2. Terapkan Jalur Approval (Wajib)
              </Label>
              <Combobox
                data={templateList}
                onChange={handleTemplateChange}
                defaultValue={selectedTemplateId}
                placeholder="Pilih template..."
                disabled={templateList.length === 0}
              />
            </div>

            <div className="border rounded-md overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>User</TableHead>
                    <TableHead>Jenis</TableHead>
                    <TableHead>Aksi</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {newApprovals.length === 0 && (
                    <TableRow>
                      <TableCell colSpan={3} className="h-24 text-center">
                        Pilih template untuk memulai.
                      </TableCell>
                    </TableRow>
                  )}
                  {newApprovals.map((app, i) => {
                    const isMyTurn =
                      currentTurnIndex === i &&
                      (currentTurnIndex === 0 || allPreviousApproved);
                    return (
                      <TableRow
                        key={app.userid + i}
                        className={cn(isMyTurn && "bg-primary/10")}
                      >
                        <TableCell
                          className="font-medium max-w-[150px] truncate"
                          title={app.nama}
                        >
                          <div className="flex items-center gap-2">
                            {i === 0 && (
                              <Clock className="h-4 w-4 text-primary" />
                            )}
                            {app.nama}
                          </div>
                        </TableCell>
                        <TableCell className="w-40">
                          <Combobox
                            data={[
                              { label: "Mengetahui", value: "Mengetahui" },
                              { label: "Menyetujui", value: "Menyetujui" },
                            ]}
                            onChange={(value) =>
                              updateApproverType(app.userid, value)
                            }
                            defaultValue={app.type}
                            placeholder="Pilih..."
                          />
                        </TableCell>
                        <TableCell className="flex gap-1">
                          <Button
                            size="icon"
                            variant="ghost"
                            onClick={() => moveApprover(i, "up")}
                            disabled={i === 0}
                          >
                            <ArrowUp className="h-4 w-4" />
                          </Button>
                          <Button
                            size="icon"
                            variant="ghost"
                            onClick={() => moveApprover(i, "down")}
                            disabled={i === newApprovals.length - 1}
                          >
                            <ArrowDown className="h-4 w-4" />
                          </Button>
                          <Button
                            size="icon"
                            variant="ghost"
                            onClick={() => removeApprover(app.userid)}
                          >
                            <XCircle className="h-4 w-4 text-destructive" />
                          </Button>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </div>
            <Button
              onClick={handleValidate}
              disabled={
                actionLoading ||
                newApprovals.length === 0 ||
                !selectedCostCenterId
              }
              className="w-full"
              size="lg"
            >
              {actionLoading ? (
                <Loader2 className="animate-spin" />
              ) : (
                <CheckCircle className="mr-2 h-4 w-4" />
              )}
              Validasi & Mulai Proses Approval
            </Button>
          </div>
        </Content>

        <Content title="Tolak Permintaan" size="sm">
          <div className="space-y-4">
            <Textarea
              placeholder="Tuliskan alasan penolakan di sini..."
              value={rejectionReason}
              onChange={(e) => setRejectionReason(e.target.value)}
            />
            <Button
              variant="destructive"
              onClick={handleReject}
              disabled={actionLoading || !rejectionReason.trim()}
              className="w-full"
            >
              {actionLoading ? (
                <Loader2 className="animate-spin" />
              ) : (
                <XCircle className="mr-2 h-4 w-4" />
              )}
              Tolak Material Request
            </Button>
          </div>
        </Content>
      </div>
    </>
  );
}

const InfoItem = ({
  label,
  value,
  icon: Icon,
  isBlock,
}: {
  label: string;
  value: string;
  icon: React.ElementType;
  isBlock?: boolean;
}) => (
  <div
    className={cn(isBlock ? "flex flex-col gap-1" : "grid grid-cols-3 gap-x-2")}
  >
    <div className="text-sm text-muted-foreground col-span-1 flex items-center gap-2">
      <Icon className="h-4 w-4" />
      {label}
    </div>
    <div className="text-sm font-semibold col-span-2 whitespace-pre-wrap">
      {value}
    </div>
  </div>
);

export default function ValidateMRPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const resolvedParams = use(params);
  return (
    <Suspense
      fallback={
        <div className="col-span-12">
          <Skeleton className="h-[80vh] w-full" />
        </div>
      }
    >
      <ValidateMRPageContent params={resolvedParams} />
    </Suspense>
  );
}
