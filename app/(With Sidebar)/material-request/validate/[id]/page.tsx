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
import { MaterialRequest, Approval, Discussion } from "@/type";
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

function ValidateMRPageContent({ params }: { params: { id: string } }) {
  const router = useRouter();
  const mrId = parseInt(params.id);

  const [mr, setMr] = useState<MaterialRequest | null>(null);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // State untuk approval
  const [newApprovals, setNewApprovals] = useState<Approval[]>([]);
  const [templateList, setTemplateList] = useState<ComboboxData>([]);
  const [selectedTemplateId, setSelectedTemplateId] = useState<string>("");
  const [rejectionReason, setRejectionReason] = useState("");

  const s = createClient();

  // Fetch data MR dan daftar template
  useEffect(() => {
    if (isNaN(mrId)) {
      setError("ID Material Request tidak valid.");
      setLoading(false);
      return;
    }

    const fetchInitialData = async () => {
      setLoading(true);
      try {
        const [mrDataResult, templatesResult] = await Promise.all([
          s
            .from("material_requests")
            .select("*, users_with_profiles!userid(nama, email)") // Ambil email juga
            .eq("id", mrId)
            .single(),
          fetchTemplateList(),
        ]);

        if (mrDataResult.error) throw mrDataResult.error;
        if (mrDataResult.data.status !== "Pending Validation") {
          setError("Material Request ini tidak lagi menunggu validasi.");
        }
        setMr(mrDataResult.data as any);

        const templateOptions = templatesResult.map((t) => ({
          label: t.template_name,
          value: String(t.id),
        }));
        setTemplateList(templateOptions);
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
      setNewApprovals([]); // Kosongkan jika tidak ada template dipilih
      return;
    }
    try {
      const template = await fetchTemplateById(Number(templateId));

      // REVISI: Pastikan tipe data benar saat mapping
      const approvalsFromTemplate = (template.approval_path as any[]).map(
        (app: any): Approval => ({
          ...app,
          status: "pending" as const, // Paksa status menjadi literal type
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

  // --- FUNGSI UNTUK MENGELOLA APPROVAL PATH ---
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

  // --- FUNGSI UNTUK AKSI ---
  const handleValidate = async () => {
    if (!mr || newApprovals.length === 0 || newApprovals.some((a) => !a.type)) {
      toast.error("Jalur approval belum lengkap atau MR tidak ditemukan.");
      return;
    }
    setActionLoading(true);
    const toastId = toast.loading("Memvalidasi MR...");

    const { error: updateError } = await s
      .from("material_requests")
      .update({ approvals: newApprovals, status: "Pending Approval" })
      .eq("id", mrId);

    if (updateError) {
      setActionLoading(false);
      toast.error("Gagal memvalidasi", {
        id: toastId,
        description: updateError.message,
      });
      return;
    }

    try {
      const requesterEmail = (mr as any).users_with_profiles?.email;
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
    } catch (emailError: any) {
      toast.warning("MR divalidasi, namun gagal mengirim notifikasi email.", {
        id: toastId,
        description: emailError.message,
      });
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
    const newDiscussion = {
      user: "System (Validation)",
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

  // REVISI: Logika untuk highlight approver
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
              value={(mr as any).users_with_profiles?.nama || "N/A"}
            />
            <InfoItem
              icon={CircleUser}
              label="Departemen"
              value={mr.department}
            />
            <InfoItem icon={CircleUser} label="Kategori" value={mr.kategori} />
            <InfoItem
              icon={CircleUser}
              label="Due Date"
              value={formatDateFriendly(mr.due_date)}
            />
            <InfoItem
              icon={Building2}
              label="Cost Center"
              value={mr.cost_center || "N/A"}
            />
            <InfoItem
              icon={Truck}
              label="Tujuan Site"
              value={mr.tujuan_site || "N/A"}
            />
            <InfoItem
              icon={CircleUser}
              label="Estimasi Biaya"
              value={formatCurrency(mr.cost_estimation)}
            />
            <InfoItem
              icon={CircleUser}
              label="Remarks"
              value={mr.remarks}
              isBlock
            />
          </div>
        </Content>

        <Content title="Item yang Diminta" size="sm">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Nama Item</TableHead>
                <TableHead>Qty</TableHead>
                <TableHead>Vendor</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {mr.orders.map((item, i) => (
                <TableRow key={i}>
                  <TableCell>{item.name}</TableCell>
                  <TableCell>
                    {item.qty} {item.uom}
                  </TableCell>
                  <TableCell>{item.vendor || "-"}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </Content>

        <Content title="Lampiran" size="sm">
          {mr.attachments.length > 0 ? (
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
              <Label className="text-sm font-medium">Gunakan Template</Label>
              <Combobox
                data={templateList}
                onChange={handleTemplateChange}
                defaultValue={selectedTemplateId}
                placeholder="Pilih template..."
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
                        key={app.userid}
                        className={cn(isMyTurn && "bg-primary/10")} // <-- HIGHLIGHT
                      >
                        <TableCell
                          className="font-medium max-w-[150px] truncate"
                          title={app.nama}
                        >
                          <div className="flex items-center gap-2">
                            {isMyTurn && (
                              <Clock className="h-4 w-4 text-primary" />
                            )}{" "}
                            {/* Indikator */}
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
              disabled={actionLoading}
              className="w-full"
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
              disabled={actionLoading}
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
    <dt className="text-sm text-muted-foreground col-span-1 flex items-center gap-2">
      <Icon className="h-4 w-4" />
      {label}
    </dt>
    <dd className="text-sm font-semibold col-span-2 whitespace-pre-wrap">
      {value}
    </dd>
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
