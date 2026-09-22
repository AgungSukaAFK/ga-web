// src/app/(With Sidebar)/petty-cash/management/PettyCashManagementClient.tsx
//
// Management Petty Cash (ADMIN ONLY) - satu halaman untuk melihat & meng-
// override status + jalur approval SEMUA dokumen di alur baru Petty Cash
// (petty_cash_pengajuan / petty_cash_voucher / petty_cash_deklarasi), lintas
// user & departemen. Dipakai buat membenahi dokumen yang nyangkut (mis.
// approver resign/salah pencet) tanpa harus lewat alur approve/reject normal
// tahap per tahap. Proteksi di level RLS ada di
// supabase/petty-cash-admin-management-setup.sql (cuma role admin yang bisa
// UPDATE lewat policy itu) - guard di komponen ini cuma proteksi UI, bukan
// pengganti RLS.

"use client";

import { useEffect, useMemo, useState } from "react";
import { Content } from "@/components/content";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { createClient } from "@/lib/supabase/client";
import { formatCurrency } from "@/lib/utils";
import { toast } from "sonner";
import Link from "next/link";
import {
  PettyCashPengajuan,
  PettyCashPengajuanApprover,
  PettyCashVoucher,
  PettyCashDeklarasi,
} from "@/type";
import { PcDocumentInfoPanel } from "@/components/petty-cash/PcDocumentInfoPanel";
import {
  PC_PENGAJUAN_STATUS_OPTIONS,
  PC_PENGAJUAN_STATUS_COLORS,
  PC_PENGAJUAN_STATUS_COLOR_DEFAULT,
  PC_VOUCHER_STATUS_OPTIONS,
  PC_VOUCHER_STATUS_COLORS,
  PC_VOUCHER_STATUS_COLOR_DEFAULT,
  PC_DEKLARASI_STATUS_OPTIONS,
  PC_DEKLARASI_STATUS_COLORS,
  PC_DEKLARASI_STATUS_COLOR_DEFAULT,
} from "@/type/enum";
import {
  fetchAllPengajuan,
  adminUpdatePengajuan,
} from "@/services/pettyCashPengajuanService";
import {
  fetchAllVouchers,
  adminUpdateVoucher,
} from "@/services/pettyCashVoucherService";
import {
  fetchAllDeklarasi,
  adminUpdateDeklarasi,
} from "@/services/pettyCashDeklarasiService";
import {
  Loader2,
  RefreshCcw,
  Eye,
  ShieldAlert,
  Search,
  Save,
} from "lucide-react";

type StageKey = "pengajuan" | "voucher" | "deklarasi";
type AnyDoc = PettyCashPengajuan | PettyCashVoucher | PettyCashDeklarasi;

const formatDate = (dateStr: string | Date) =>
  new Date(dateStr).toLocaleDateString("id-ID", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });

const getKode = (stage: StageKey, row: AnyDoc): string => {
  if (stage === "pengajuan") return (row as PettyCashPengajuan).kode_pengajuan;
  if (stage === "voucher") return (row as PettyCashVoucher).kode_voucher;
  return (row as PettyCashDeklarasi).kode_deklarasi;
};

// Deklarasi tidak punya needed_date (lihat komentar di type/index.ts) -
// dipakai membedakan apa PcDocumentInfoPanel/tautan detail perlu
// menampilkan tanggal/minggu dibutuhkan atau tidak.
const showsNeededDate = (stage: StageKey) => stage !== "deklarasi";

const getNeededDate = (stage: StageKey, row: AnyDoc) =>
  stage === "pengajuan"
    ? (row as PettyCashPengajuan).needed_date
    : stage === "voucher"
      ? (row as PettyCashVoucher).needed_date
      : null;

// Kode dokumen asal (rantai Pengajuan -> Voucher -> Deklarasi) - dipakai
// nunjukin konteks di dialog detail, sesuai relasi yang di-join
// fetchAllVouchers/fetchAllDeklarasi (lihat services/pettyCash*Service.ts).
const getSourceLabel = (stage: StageKey, row: AnyDoc): string | null => {
  if (stage === "voucher") {
    const kode = (row as PettyCashVoucher).petty_cash_pengajuan?.kode_pengajuan;
    return kode ? `Dari Pengajuan ${kode}` : null;
  }
  if (stage === "deklarasi") {
    const voucher = (row as PettyCashDeklarasi).petty_cash_voucher;
    if (!voucher) return null;
    const pengajuanKode = voucher.petty_cash_pengajuan?.kode_pengajuan;
    return `Dari Voucher ${voucher.kode_voucher}${pengajuanKode ? ` (Pengajuan ${pengajuanKode})` : ""}`;
  }
  return null;
};

const STAGE_CONFIG: Record<
  StageKey,
  {
    label: string;
    statusOptions: readonly string[];
    statusColors: Record<string, string>;
    statusColorDefault: string;
    fetchAll: () => Promise<AnyDoc[]>;
    adminUpdate: (
      id: number,
      patch: { status?: string; approvals?: PettyCashPengajuanApprover[] },
    ) => Promise<void>;
  }
> = {
  pengajuan: {
    label: "Pengajuan",
    statusOptions: PC_PENGAJUAN_STATUS_OPTIONS,
    statusColors: PC_PENGAJUAN_STATUS_COLORS,
    statusColorDefault: PC_PENGAJUAN_STATUS_COLOR_DEFAULT,
    fetchAll: fetchAllPengajuan,
    adminUpdate: adminUpdatePengajuan,
  },
  voucher: {
    label: "Voucher",
    statusOptions: PC_VOUCHER_STATUS_OPTIONS,
    statusColors: PC_VOUCHER_STATUS_COLORS,
    statusColorDefault: PC_VOUCHER_STATUS_COLOR_DEFAULT,
    fetchAll: fetchAllVouchers,
    adminUpdate: adminUpdateVoucher,
  },
  deklarasi: {
    label: "Deklarasi",
    statusOptions: PC_DEKLARASI_STATUS_OPTIONS,
    statusColors: PC_DEKLARASI_STATUS_COLORS,
    statusColorDefault: PC_DEKLARASI_STATUS_COLOR_DEFAULT,
    fetchAll: fetchAllDeklarasi,
    adminUpdate: adminUpdateDeklarasi,
  },
};

const APPROVAL_STATUS_OPTIONS = ["pending", "approved", "rejected"] as const;

export default function PettyCashManagementClient({
  isAdmin,
}: {
  isAdmin: boolean;
}) {
  const supabase = createClient();

  const [stage, setStage] = useState<StageKey>("pengajuan");
  const [docs, setDocs] = useState<AnyDoc[]>([]);
  const [loading, setLoading] = useState(true);

  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("all");

  const [selected, setSelected] = useState<AnyDoc | null>(null);
  const [editStatus, setEditStatus] = useState<string>("");
  const [editApprovals, setEditApprovals] = useState<
    PettyCashPengajuanApprover[]
  >([]);
  const [saving, setSaving] = useState(false);

  const config = STAGE_CONFIG[stage];

  const loadData = async () => {
    setLoading(true);
    try {
      const data = await config.fetchAll();
      setDocs(data);
    } catch (error: any) {
      toast.error("Gagal memuat data", { description: error.message });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (!isAdmin) return;
    setStatusFilter("all");
    setSearch("");
    loadData();
  }, [stage, isAdmin]);

  const filteredDocs = useMemo(() => {
    const q = search.trim().toLowerCase();
    return docs.filter((row) => {
      if (statusFilter !== "all" && row.status !== statusFilter) return false;
      if (!q) return true;
      const kode = getKode(stage, row).toLowerCase();
      const dept = row.department?.toLowerCase() || "";
      const pemohon = row.users_with_profiles?.nama?.toLowerCase() || "";
      return kode.includes(q) || dept.includes(q) || pemohon.includes(q);
    });
  }, [docs, search, statusFilter, stage]);

  const getStatusBadge = (status: string) => {
    const colorClass = config.statusColors[status] || config.statusColorDefault;
    return (
      <Badge className={`${colorClass} whitespace-nowrap`}>{status}</Badge>
    );
  };

  const openDetail = (row: AnyDoc) => {
    setSelected(row);
    setEditStatus(row.status);
    setEditApprovals(row.approvals || []);
  };

  const updateApprovalStatus = (
    idx: number,
    status: "pending" | "approved" | "rejected",
  ) => {
    setEditApprovals((prev) =>
      prev.map((app, i) => (i === idx ? { ...app, status } : app)),
    );
  };

  const handleSave = async () => {
    if (!selected) return;
    setSaving(true);
    try {
      await config.adminUpdate(selected.id, {
        status: editStatus,
        approvals: editApprovals,
      });
      toast.success(`${getKode(stage, selected)} berhasil diperbarui.`);
      setSelected(null);
      await loadData();
    } catch (error: any) {
      toast.error("Gagal menyimpan perubahan", {
        description: error.message,
      });
    } finally {
      setSaving(false);
    }
  };

  if (!isAdmin) {
    return (
      <Content
        title="Management Petty Cash"
        description="Khusus untuk role Admin."
      >
        <div className="flex flex-col items-center justify-center h-64 text-muted-foreground gap-2">
          <ShieldAlert className="h-10 w-10" />
          <p className="text-sm">
            Anda tidak memiliki akses ke halaman ini.
          </p>
        </div>
      </Content>
    );
  }

  return (
    <>
      <Content
        title="Management Petty Cash"
        description="Pantau & override status/approval semua dokumen Petty Cash lintas departemen (admin only)."
        cardAction={
          <Button variant="outline" size="sm" onClick={loadData} disabled={loading}>
            <RefreshCcw
              className={`h-4 w-4 mr-1 ${loading ? "animate-spin" : ""}`}
            />
            Refresh
          </Button>
        }
      >
        <div className="space-y-4">
          <Tabs value={stage} onValueChange={(v) => setStage(v as StageKey)}>
            <TabsList>
              <TabsTrigger value="pengajuan">Pengajuan</TabsTrigger>
              <TabsTrigger value="voucher">Voucher</TabsTrigger>
              <TabsTrigger value="deklarasi">Deklarasi</TabsTrigger>
            </TabsList>
          </Tabs>

          <div className="flex flex-col sm:flex-row gap-2">
            <div className="relative flex-1">
              <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Cari kode, departemen, atau nama pemohon..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="pl-8"
              />
            </div>
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className="sm:w-[200px]">
                <SelectValue placeholder="Semua Status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Semua Status</SelectItem>
                {config.statusOptions.map((s) => (
                  <SelectItem key={s} value={s}>
                    {s}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="rounded-md border overflow-x-auto">
            <Table className="min-w-[900px]">
              <TableHeader>
                <TableRow>
                  <TableHead className="w-[110px]">Tanggal</TableHead>
                  <TableHead className="w-[190px]">Kode</TableHead>
                  <TableHead>Pemohon</TableHead>
                  <TableHead className="w-[140px]">Departemen</TableHead>
                  <TableHead className="w-[140px] text-right">Total</TableHead>
                  <TableHead className="w-[140px]">Status</TableHead>
                  <TableHead className="w-[70px] text-center">Aksi</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {loading ? (
                  <TableRow>
                    <TableCell colSpan={7} className="text-center h-32">
                      <Loader2 className="animate-spin h-6 w-6 mx-auto text-primary" />
                    </TableCell>
                  </TableRow>
                ) : filteredDocs.length === 0 ? (
                  <TableRow>
                    <TableCell
                      colSpan={7}
                      className="text-center h-32 text-muted-foreground"
                    >
                      Tidak ada data yang cocok.
                    </TableCell>
                  </TableRow>
                ) : (
                  filteredDocs.map((row) => (
                    <TableRow
                      key={row.id}
                      className="cursor-pointer hover:bg-muted/50 transition-colors"
                      onClick={() => openDetail(row)}
                    >
                      <TableCell className="whitespace-nowrap text-sm">
                        {formatDate(row.created_at)}
                      </TableCell>
                      <TableCell className="font-semibold text-sm truncate">
                        {getKode(stage, row)}
                      </TableCell>
                      <TableCell className="text-sm truncate">
                        {row.users_with_profiles?.nama || "-"}
                      </TableCell>
                      <TableCell className="text-sm truncate">
                        {row.department}
                      </TableCell>
                      <TableCell className="text-right font-semibold text-sm">
                        {formatCurrency(row.total_amount)}
                      </TableCell>
                      <TableCell>{getStatusBadge(row.status)}</TableCell>
                      <TableCell className="text-center">
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-7 w-7 text-muted-foreground hover:text-primary"
                          onClick={(e) => {
                            e.stopPropagation();
                            openDetail(row);
                          }}
                        >
                          <Eye className="h-4 w-4" />
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>
        </div>
      </Content>

      {/* DIALOG DETAIL + OVERRIDE */}
      <Dialog
        open={!!selected}
        onOpenChange={(open) => !open && setSelected(null)}
      >
        <DialogContent className="sm:max-w-3xl max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center justify-between gap-2">
              <span>{selected && getKode(stage, selected)}</span>
              {selected && (
                <Link
                  href={`/petty-cash/${stage}/${selected.id}`}
                  target="_blank"
                  className="text-xs font-normal text-primary hover:underline"
                >
                  Detail Lengkap / Cetak
                </Link>
              )}
            </DialogTitle>
            <DialogDescription>
              Diajukan oleh {selected?.users_with_profiles?.nama || "-"} (
              {selected?.department})
              {selected && getSourceLabel(stage, selected)
                ? ` - ${getSourceLabel(stage, selected)}`
                : ""}
            </DialogDescription>
          </DialogHeader>

          {selected && (
            <div className="space-y-4">
              <PcDocumentInfoPanel
                requesterName={selected.users_with_profiles?.nama}
                requesterEmail={selected.users_with_profiles?.email}
                department={selected.department}
                companyCode={selected.company_code}
                site={(selected as any).site}
                costCenterName={selected.cost_centers?.name}
                neededDate={getNeededDate(stage, selected)}
                weekOfMonth={(selected as any).week_of_month}
                showNeededDate={showsNeededDate(stage)}
                notes={selected.notes}
                items={selected.items}
                totalAmount={selected.total_amount}
                attachments={selected.attachments}
                approvals={selected.approvals}
                discussions={selected.discussions}
                revisions={(selected as any).revisions}
              />

              <div className="space-y-2 border-t pt-4">
                <p className="text-xs font-medium text-muted-foreground">
                  Status Dokumen (override)
                </p>
                <Select value={editStatus} onValueChange={setEditStatus}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {config.statusOptions.map((s) => (
                      <SelectItem key={s} value={s}>
                        {s}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <p className="text-xs font-medium text-muted-foreground">
                  Jalur Approval (override per approver)
                </p>
                <div className="space-y-1.5">
                  {editApprovals.map((app, i) => (
                    <div
                      key={i}
                      className="flex items-center justify-between gap-2 text-sm border rounded-md px-3 py-1.5"
                    >
                      <span className="truncate">
                        {i + 1}. {app.nama}{" "}
                        <span className="text-xs text-muted-foreground">
                          ({app.department})
                        </span>
                      </span>
                      <Select
                        value={app.status}
                        onValueChange={(v) =>
                          updateApprovalStatus(
                            i,
                            v as "pending" | "approved" | "rejected",
                          )
                        }
                      >
                        <SelectTrigger className="w-[130px] h-8 shrink-0">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {APPROVAL_STATUS_OPTIONS.map((s) => (
                            <SelectItem key={s} value={s}>
                              {s}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  ))}
                  {editApprovals.length === 0 && (
                    <p className="text-xs text-muted-foreground">
                      Belum ada jalur approval tercatat.
                    </p>
                  )}
                </div>
              </div>
            </div>
          )}

          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setSelected(null)}
              disabled={saving}
            >
              Batal
            </Button>
            <Button onClick={handleSave} disabled={saving}>
              {saving ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : (
                <Save className="mr-2 h-4 w-4" />
              )}
              Simpan Perubahan
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
