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
import { MaterialRequest, Approval } from "@/type";
import { formatCurrency, formatDateFriendly } from "@/lib/utils";
import {
  AlertTriangle,
  ArrowDown,
  ArrowUp,
  CheckCircle,
  Loader2,
  XCircle,
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
            .select("*, users_with_profiles!userid(nama)")
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
      // Reset status ke 'pending' saat menerapkan template
      const approvalsFromTemplate = template.approval_path.map((app) => ({
        ...app,
        status: "pending",
      }));
      setNewApprovals(approvalsFromTemplate);
      toast.success(
        `Template "${template.template_name}" berhasil diterapkan.`
      );
    } catch (err: any) {
      toast.error("Gagal menerapkan template", { description: err.message });
    }
  };

  // Fungsi-fungsi untuk memodifikasi approval path (tidak berubah)
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

  // Fungsi untuk submit validasi dan penolakan (tidak berubah)
  const handleValidate = async () => {
    if (newApprovals.length === 0 || newApprovals.some((a) => !a.type)) {
      toast.error("Jalur approval belum lengkap.");
      return;
    }
    setActionLoading(true);
    const { error } = await s
      .from("material_requests")
      .update({ approvals: newApprovals, status: "Pending Approval" })
      .eq("id", mrId);
    setActionLoading(false);
    if (error) {
      toast.error("Gagal memvalidasi", { description: error.message });
    } else {
      toast.success("MR berhasil divalidasi!");
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
      ? [...mr.discussions, newDiscussion]
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

      {/* Read-only details */}
      <Content title="Detail Pengajuan" size="md">
        <div className="space-y-4">
          <InfoItem
            label="Requester"
            value={(mr as any).users_with_profiles?.nama || "N/A"}
          />
          <InfoItem label="Departemen" value={mr.department} />
          <InfoItem label="Kategori" value={mr.kategori} />
          <InfoItem label="Due Date" value={formatDateFriendly(mr.due_date)} />
          <InfoItem
            label="Estimasi Biaya"
            value={formatCurrency(mr.cost_estimation)}
          />
          <InfoItem label="Remarks" value={mr.remarks} isBlock />
        </div>
      </Content>

      <Content title="Item yang Diminta" size="md">
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

      {/* Action section */}
      <Content title="Tentukan Jalur Approval" size="md">
        <div className="space-y-4">
          <div>
            <Label className="text-sm font-medium">Gunakan Template</Label>
            <Combobox
              data={templateList}
              onChange={handleTemplateChange}
              defaultValue={selectedTemplateId}
            />
          </div>
          <div className="text-xs text-muted-foreground text-center">
            Atau bangun jalur approval secara manual di bawah (jika perlu).
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
                {newApprovals.map((app, i) => (
                  <TableRow key={app.userid}>
                    <TableCell
                      className="font-medium max-w-[150px] truncate"
                      title={app.nama}
                    >
                      {app.nama}
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
                ))}
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

      <Content title="Tolak Permintaan" size="md">
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
    </>
  );
}

// Komponen helper
const InfoItem = ({
  label,
  value,
  isBlock,
}: {
  label: string;
  value: string;
  isBlock?: boolean;
}) => (
  <div className={isBlock ? "flex flex-col" : "grid grid-cols-3"}>
    <dt className="text-sm text-muted-foreground col-span-1">{label}</dt>
    <dd className="text-sm font-semibold col-span-2 whitespace-pre-wrap">
      {value}
    </dd>
  </div>
);

// Bungkus dengan Suspense
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
