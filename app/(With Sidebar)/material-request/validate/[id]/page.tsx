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
} from "@/type";
import {
  formatCurrency,
  formatDateFriendly,
  cn,
  calculatePriority, // Import helper prioritas
} from "@/lib/utils";
import {
  AlertTriangle,
  ArrowDown,
  ArrowUp,
  CheckCircle,
  Clock,
  Loader2,
  XCircle,
  Building2,
  Truck,
  CircleUser,
  ArrowLeft,
  Paperclip,
  Tag,
  ExternalLink,
  DollarSign,
  Info,
  Zap,
  Layers,
  HelpCircle, // Icon untuk info level
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
import {
  fetchActiveCostCenters,
  rebuildKodeMrForDepartment,
} from "@/services/mrService";
import { logActivity } from "@/services/logService";
import { dataDepartment } from "@/type/comboboxData";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { MR_LEVELS, APPROVAL_TYPE_OPTIONS } from "@/type/enum"; // Import Enum Level
import {
  notifyOnMRValidated,
  sendNotification,
} from "@/lib/notifications/client";

// Komponen helper InfoItem
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
  const [profile, setProfile] = useState<Profile | null>(null);

  // State untuk approval
  const [newApprovals, setNewApprovals] = useState<Approval[]>([]);
  const [templateList, setTemplateList] = useState<ComboboxData>([]);
  const [selectedTemplateId, setSelectedTemplateId] = useState<string>("");
  const [rejectionReason, setRejectionReason] = useState("");

  const [costCenterList, setCostCenterList] = useState<ComboboxData>([]);
  // Sisa budget mentah per cost center (id -> current_budget), agar perbandingan
  // tidak bergantung pada parsing string label yang rapuh.
  const [costCenterBudgets, setCostCenterBudgets] = useState<
    Record<string, number>
  >({});
  const [selectedCostCenterId, setSelectedCostCenterId] = useState<
    number | null
  >(null);

  // Departemen MR (bisa diubah GA saat validasi awal)
  const [selectedDepartment, setSelectedDepartment] = useState<string>("");

  // State untuk dialog info level
  const [isLevelInfoOpen, setIsLevelInfoOpen] = useState(false);

  const s = createClient();

  useEffect(() => {
    if (isNaN(mrId)) {
      setError("ID Material Request tidak valid.");
      setLoading(false);
      return;
    }

    const fetchInitialData = async () => {
      setLoading(true);
      try {
        // 1. Ambil profil GA
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
          .select(
            "*, users_with_profiles!userid(nama, email), prioritas, level, due_date",
          )
          .eq("id", mrId)
          .single();

        if (mrError) throw mrError;
        if (mrData.status !== "Pending Validation") {
          setError("Material Request ini tidak lagi menunggu validasi.");
        }
        setMr(mrData as any);
        setSelectedCostCenterId(mrData.cost_center_id || null);
        setSelectedDepartment(mrData.department || "");

        // 3. Ambil Template dan Cost Center
        const [templatesResult, costCentersResult] = await Promise.all([
          fetchTemplateList(),
          fetchActiveCostCenters(mrData.company_code),
        ]);

        const templateOptions: ComboboxData = templatesResult.map((t) => ({
          label: t.template_name,
          value: String(t.id),
        }));
        setTemplateList(templateOptions);

        const costCenterOptions: ComboboxData = costCentersResult.map((cc) => ({
          label: `${cc.name} (${formatCurrency(cc.current_budget)})`,
          value: cc.id.toString(),
        }));
        setCostCenterList(costCenterOptions);

        const budgetMap: Record<string, number> = {};
        costCentersResult.forEach((cc) => {
          budgetMap[cc.id.toString()] = Number(cc.current_budget) || 0;
        });
        setCostCenterBudgets(budgetMap);
      } catch (err: any) {
        setError("Gagal memuat data.");
        toast.error("Gagal memuat data", { description: err.message });
      } finally {
        setLoading(false);
      }
    };

    fetchInitialData();
  }, [mrId, s]);

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
        }),
      );
      setNewApprovals(approvalsFromTemplate);
      toast.success(
        `Template "${template.template_name}" berhasil diterapkan.`,
      );
    } catch (err: any) {
      toast.error("Gagal menerapkan template", { description: err.message });
    }
  };

  const handleCostCenterChange = (value: string) => {
    setSelectedCostCenterId(value ? Number(value) : null);
  };

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
      prev.map((app) => (app.userid === userId ? { ...app, type } : app)),
    );
  };

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

    // Validasi Budget (Peringatan) — pakai angka mentah, bukan parse label.
    const budget = costCenterBudgets[selectedCostCenterId.toString()] ?? 0;

    if (Number(mr.cost_estimation) > budget) {
      if (
        !window.confirm(
          `Peringatan: Estimasi biaya MR (${formatCurrency(
            mr.cost_estimation,
          )}) melebihi sisa budget Cost Center (${formatCurrency(
            budget,
          )}).\n\nApakah Anda yakin ingin tetap validasi?`,
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

    // Departemen: cek perubahan & hitung ulang kode_mr (hanya jika berbasis departemen/HO)
    const departmentChanged =
      !!selectedDepartment && selectedDepartment !== mr.department;
    const newKodeMr = departmentChanged
      ? rebuildKodeMrForDepartment(mr.kode_mr, mr.department, selectedDepartment)
      : null;
    const effectiveKodeMr = newKodeMr ?? mr.kode_mr;

    const updatePayload: Record<string, any> = {
      approvals: finalApprovals,
      status: "Pending Approval",
      cost_center_id: selectedCostCenterId,
    };
    if (departmentChanged) updatePayload.department = selectedDepartment;
    if (newKodeMr) updatePayload.kode_mr = newKodeMr;

    try {
      const { error: updateError } = await s
        .from("material_requests")
        .update(updatePayload)
        .eq("id", mrId);

      if (updateError) throw updateError;

      // Catat perubahan departemen ke activity log (terlihat di tab Logs mr-management/edit)
      if (departmentChanged) {
        const kodeNote = newKodeMr
          ? ` Kode MR diperbarui: ${mr.kode_mr} → ${newKodeMr}.`
          : " Kode MR tidak berubah (berbasis lokasi).";
        await logActivity(
          profile.id,
          "UPDATE_MR_DEPARTMENT",
          "material_request",
          String(mrId),
          `GA ${profile.nama || "Unknown"} mengubah departemen MR dari "${mr.department}" menjadi "${selectedDepartment}" saat validasi.${kodeNote}`,
          {
            old_department: mr.department,
            new_department: selectedDepartment,
            old_kode_mr: mr.kode_mr,
            new_kode_mr: newKodeMr,
          },
        );
      }

      // Notify creator and first approver
      const firstApprover = newApprovals.find((a) => a.status === "pending");
      notifyOnMRValidated({
        actorId: profile.id,
        creatorId: mr.userid,
        firstApproverId: firstApprover?.userid,
        kodeMR: effectiveKodeMr,
        mrId: mrId,
      });

      toast.success("MR berhasil divalidasi!", {
        id: toastId,
      });
      router.push("/approval-validation");
    } catch (err: any) {
      toast.error("Gagal memvalidasi MR", {
        id: toastId,
        description: err.message,
      });
    } finally {
      setActionLoading(false);
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
      // Notify creator of rejection by GA
      if (profile?.id && mr?.userid) {
        sendNotification({
          userId: mr.userid,
          actorId: profile.id,
          type: "mr_rejected",
          title: "MR Kamu Ditolak oleh GA",
          message: `Material Request ${mr.kode_mr} ditolak dengan alasan: ${rejectionReason}`,
          link: `/material-request/${mrId}`,
          resourceId: String(mrId),
          resourceType: "material_request",
        });
      }
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

  // HITUNG LIVE PRIORITY
  const livePriority = mr.due_date
    ? calculatePriority(mr.due_date)
    : "Menghitung...";

  const currentTurnIndex = newApprovals.findIndex(
    (app) => app.status === "pending",
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

            {/* --- PRIORITAS LIVE --- */}
            <div className="grid grid-cols-3 gap-x-2">
              <div className="text-sm text-muted-foreground col-span-1 flex items-center gap-2">
                <Zap className="h-4 w-4" />
                Prioritas (Live)
              </div>
              <div className="text-sm font-semibold col-span-2 whitespace-pre-wrap flex items-center gap-2">
                <Badge
                  variant={livePriority === "P0" ? "destructive" : "outline"}
                  className={livePriority === "P0" ? "animate-pulse" : ""}
                >
                  {livePriority}
                </Badge>
                <span className="text-xs font-normal text-muted-foreground">
                  (Deadline: {formatDateFriendly(mr.due_date)})
                </span>
              </div>
            </div>

            {/* --- LEVEL INFO --- */}
            <div className="grid grid-cols-3 gap-x-2">
              <div className="text-sm text-muted-foreground col-span-1 flex items-center gap-2">
                <Layers className="h-4 w-4" />
                Level
                <button
                  onClick={() => setIsLevelInfoOpen(true)}
                  className="text-muted-foreground hover:text-primary"
                >
                  <HelpCircle className="h-3 w-3" />
                </button>
              </div>
              <div className="text-sm font-semibold col-span-2 whitespace-pre-wrap">
                {mr.level || "OPEN 1"}
              </div>
            </div>

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
                1. Departemen MR (bisa diubah)
              </Label>
              <Combobox
                data={dataDepartment}
                onChange={(value) => setSelectedDepartment(value)}
                defaultValue={selectedDepartment}
                placeholder="Pilih departemen..."
              />
              {selectedDepartment && selectedDepartment !== mr.department && (
                <p className="text-xs text-muted-foreground mt-1">
                  Departemen diubah:{" "}
                  <span className="font-medium text-foreground">
                    {mr.department}
                  </span>{" "}
                  →{" "}
                  <span className="font-medium text-foreground">
                    {selectedDepartment}
                  </span>
                  .{" "}
                  {(() => {
                    const preview = rebuildKodeMrForDepartment(
                      mr.kode_mr,
                      mr.department,
                      selectedDepartment,
                    );
                    return preview
                      ? `Kode MR akan menjadi: ${preview}`
                      : "Kode MR tidak berubah (berbasis lokasi).";
                  })()}
                </p>
              )}
            </div>

            <div>
              <Label className="font-medium text-base">
                2. Tentukan Cost Center (Wajib)
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
                  (costCenterBudgets[selectedCostCenterId.toString()] ?? 0) && (
                  <p className="text-xs text-destructive font-medium mt-1">
                    Peringatan: Estimasi biaya MR melebihi sisa budget Cost
                    Center ini.
                  </p>
                )}
            </div>

            <div>
              <Label className="font-medium text-base">
                3. Terapkan Jalur Approval (Wajib)
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
                            data={APPROVAL_TYPE_OPTIONS}
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

      {/* Dialog Info Level (Sama seperti halaman Edit) */}
      <Dialog open={isLevelInfoOpen} onOpenChange={setIsLevelInfoOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Keterangan Level Material Request</DialogTitle>
            <DialogDescription>
              Level ini melacak status fisik barang setelah MR disetujui.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4 max-h-[60vh] overflow-y-auto">
            <h4 className="font-semibold">
              Level OPEN (Barang Belum Diterima Site)
            </h4>
            <ul className="list-disc pl-5 space-y-2 text-sm">
              {MR_LEVELS.filter((l) => l.group === "OPEN").map((level) => (
                <li key={level.value}>
                  <strong>{level.value}:</strong> {level.description}
                </li>
              ))}
            </ul>
            <h4 className="font-semibold">
              Level CLOSE (Barang Sudah Diterima Site)
            </h4>
            <ul className="list-disc pl-5 space-y-2 text-sm">
              {MR_LEVELS.filter((l) => l.group === "CLOSE").map((level) => (
                <li key={level.value}>
                  <strong>{level.value}:</strong> {level.description}
                </li>
              ))}
            </ul>
          </div>
          <DialogFooter>
            <Button onClick={() => setIsLevelInfoOpen(false)}>Tutup</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}

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
