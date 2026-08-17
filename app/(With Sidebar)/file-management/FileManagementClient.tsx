// src/app/(With Sidebar)/file-management/FileManagementClient.tsx

"use client";

import { Content } from "@/components/content";
import { CustomPagination } from "@/components/custom-pagination";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { createClient } from "@/lib/supabase/client";
import { formatFileSize } from "@/lib/attachments";
import { formatDateWithTime } from "@/lib/utils";
import { LIMIT_OPTIONS } from "@/type/enum";
import {
  queryFileManagementAttachments,
  bulkDeleteAttachments,
  refreshFileManagementSnapshot,
} from "@/services/fileManagementService";
import {
  AttachmentEntry,
  AttachmentDocType,
  AttachmentQueryResult,
  StorageBucketSource,
  DeleteRequestItem,
} from "@/type/file-management";
import {
  Loader2,
  RefreshCw,
  Trash2,
  ExternalLink,
  Search,
  Database,
  HardDrive,
  Sparkles,
} from "lucide-react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useCallback, useEffect, useState } from "react";
import { toast } from "sonner";

const DOC_TYPE_OPTIONS: { value: AttachmentDocType | "all"; label: string }[] = [
  { value: "all", label: "Semua Tipe" },
  { value: "material_request", label: "MR - Lampiran" },
  { value: "material_request_bast", label: "MR - BAST Item" },
  { value: "purchase_order", label: "PO - Lampiran" },
  { value: "petty_cash", label: "Petty Cash" },
  { value: "petty_cash_settlement", label: "Petty Cash - Settlement" },
  { value: "orphan", label: "Orphan (Tidak Terpakai)" },
];

const DOC_TYPE_LABEL: Record<AttachmentDocType, string> = Object.fromEntries(
  DOC_TYPE_OPTIONS.filter((o) => o.value !== "all").map((o) => [o.value, o.label])
) as Record<AttachmentDocType, string>;

const BUCKET_OPTIONS: { value: StorageBucketSource | "all"; label: string }[] = [
  { value: "all", label: "Semua Storage" },
  { value: "legacy", label: "Legacy (Cloud Lama - mr)" },
  { value: "vps", label: "VPS (Baru)" },
];

const SORT_OPTIONS: { value: "date" | "size" | "name"; label: string }[] = [
  { value: "date", label: "Tanggal Upload" },
  { value: "size", label: "Ukuran File" },
  { value: "name", label: "Nama File" },
];

function StatCard({
  icon,
  label,
  value,
  sub,
  highlight,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
  sub?: string;
  highlight?: boolean;
}) {
  return (
    <Card className={highlight ? "border-primary/50 bg-primary/5" : ""}>
      <CardContent className="flex items-start gap-3 py-4">
        <div className="mt-0.5 text-muted-foreground">{icon}</div>
        <div>
          <div className="text-xs text-muted-foreground">{label}</div>
          <div className="text-xl font-semibold">{value}</div>
          {sub && <div className="text-xs text-muted-foreground mt-0.5">{sub}</div>}
        </div>
      </CardContent>
    </Card>
  );
}

function FilterField({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-2">
      <label className="text-sm font-medium">{label}</label>
      {children}
    </div>
  );
}

export function FileManagementClientContent() {
  const s = createClient();
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const [checkingAccess, setCheckingAccess] = useState(true);
  const [result, setResult] = useState<AttachmentQueryResult | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [deleteTarget, setDeleteTarget] = useState<AttachmentEntry[] | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  const currentPage = Number(searchParams.get("page") || "1");
  const limit = Number(searchParams.get("limit") || 25);
  const search = searchParams.get("search") || "";
  const docType = (searchParams.get("doc_type") || "all") as AttachmentDocType | "all";
  const bucket = (searchParams.get("bucket") || "all") as StorageBucketSource | "all";
  const startDate = searchParams.get("start_date") || "";
  const endDate = searchParams.get("end_date") || "";
  const sortBy = (searchParams.get("sort_by") || "date") as "date" | "size" | "name";
  // Default "asc" = file terlama dulu, sesuai tujuan awal fitur ini (cleanup storage).
  const sortDir = (searchParams.get("sort_dir") || "asc") as "asc" | "desc";

  const [searchInput, setSearchInput] = useState(search);
  const [startDateInput, setStartDateInput] = useState(startDate);
  const [endDateInput, setEndDateInput] = useState(endDate);

  const createQueryString = useCallback(
    (updates: Record<string, string | number | undefined>) => {
      const params = new URLSearchParams(searchParams.toString());
      Object.entries(updates).forEach(([name, value]) => {
        if (value !== undefined && value !== null && String(value).trim() !== "") {
          params.set(name, String(value));
        } else {
          params.delete(name);
        }
      });
      if (Object.keys(updates).some((k) => k !== "page")) {
        params.set("page", "1");
      }
      return params.toString();
    },
    [searchParams]
  );

  const handleFilterChange = useCallback(
    (updates: Record<string, string | number | undefined>) => {
      router.push(`${pathname}?${createQueryString(updates)}`);
    },
    [router, pathname, createQueryString]
  );

  const handlePageChange = (page: number) => {
    const params = new URLSearchParams(searchParams.toString());
    params.set("page", String(page));
    router.push(`${pathname}?${params.toString()}`);
  };

  useEffect(() => {
    const handler = setTimeout(() => {
      if (searchInput !== search) handleFilterChange({ search: searchInput });
    }, 500);
    return () => clearTimeout(handler);
  }, [searchInput]);

  useEffect(() => {
    async function checkAccess() {
      const {
        data: { user },
      } = await s.auth.getUser();
      if (!user) {
        router.push("/auth/login");
        return;
      }
      const { data: profile } = await s
        .from("profiles")
        .select("role")
        .eq("id", user.id)
        .single();
      if (!profile || profile.role !== "admin") {
        toast.error("Akses ditolak.");
        router.push("/dashboard");
        return;
      }
      setCheckingAccess(false);
    }
    checkAccess();
  }, []);

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const res = await queryFileManagementAttachments({
        page: currentPage,
        limit,
        search,
        docType,
        bucket,
        startDate,
        endDate,
        sortBy,
        sortDir,
      });
      setResult(res);
      setSelected(new Set());
    } catch (e: any) {
      toast.error("Gagal memuat data", { description: e.message });
    } finally {
      setLoading(false);
    }
  }, [currentPage, limit, search, docType, bucket, startDate, endDate, sortBy, sortDir]);

  useEffect(() => {
    if (!checkingAccess) fetchData();
  }, [checkingAccess, fetchData]);

  const handleRefresh = async () => {
    setRefreshing(true);
    try {
      await refreshFileManagementSnapshot();
      await fetchData();
      toast.success("Data disegarkan dari storage.");
    } catch (e: any) {
      toast.error("Gagal refresh data", { description: e.message });
    } finally {
      setRefreshing(false);
    }
  };

  const rows = result?.rows ?? [];
  const total = result?.total ?? 0;
  const stats = result?.stats;

  const toggleSelect = (id: string) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const allOnPageSelected = rows.length > 0 && rows.every((r) => selected.has(r.id));
  const toggleSelectAll = () => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (allOnPageSelected) {
        rows.forEach((r) => next.delete(r.id));
      } else {
        rows.forEach((r) => next.add(r.id));
      }
      return next;
    });
  };

  const selectedEntries = rows.filter((r) => selected.has(r.id));
  const selectedTotalSize = selectedEntries.reduce((sum, e) => sum + (e.size ?? 0), 0);

  const executeDelete = async () => {
    if (!deleteTarget || deleteTarget.length === 0) return;
    setIsDeleting(true);
    try {
      const items: DeleteRequestItem[] = deleteTarget.map((e) => ({
        id: e.id,
        source: e.source,
        bucket: e.bucket,
        path: e.path,
        url: e.url,
        documentId: e.documentId,
      }));
      const results = await bulkDeleteAttachments(items);
      const failed = results.filter((r) => !r.success);
      const warned = results.filter((r) => r.success && r.message);

      if (failed.length === 0) {
        toast.success(`${results.length} file berhasil dihapus.`);
      } else {
        toast.warning(
          `${results.length - failed.length} dari ${results.length} file berhasil dihapus.`,
          { description: `Gagal: ${failed[0]?.message ?? "-"}` }
        );
      }
      if (warned.length > 0) {
        toast.warning("Ada file terhapus tapi referensi dokumennya gagal diupdate.", {
          description: `${warned[0]?.message ?? ""} - coba refresh & cek manual.`,
        });
      }

      setDeleteTarget(null);
      fetchData();
    } catch (e: any) {
      toast.error("Gagal menghapus file", { description: e.message });
    } finally {
      setIsDeleting(false);
    }
  };

  if (checkingAccess) {
    return (
      <Content title="File Management (Admin)" size="lg" className="col-span-12">
        <div className="flex justify-center items-center h-40">
          <Loader2 className="h-6 w-6 animate-spin" />
        </div>
      </Content>
    );
  }

  return (
    <Content
      title="File Management (Admin)"
      description="Kelola & bersihkan lampiran MR/PO/Petty Cash di Supabase Storage."
      size="lg"
      className="col-span-12"
      cardAction={
        <Button variant="outline" size="sm" onClick={handleRefresh} disabled={refreshing || loading}>
          {refreshing ? (
            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
          ) : (
            <RefreshCw className="mr-2 h-4 w-4" />
          )}
          Refresh Data
        </Button>
      }
    >
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-6">
        <StatCard
          icon={<Database className="h-5 w-5" />}
          label="Bucket Legacy (mr)"
          value={stats ? formatFileSize(stats.legacyBucketTotalBytes) : "-"}
          sub={stats ? `${stats.legacyBucketTotalCount} file` : undefined}
        />
        <StatCard
          icon={<HardDrive className="h-5 w-5" />}
          label="Bucket VPS (baru)"
          value={stats ? formatFileSize(stats.vpsBucketTotalBytes) : "-"}
          sub={stats ? `${stats.vpsBucketTotalCount} file` : undefined}
        />
        <StatCard
          icon={<Sparkles className="h-5 w-5" />}
          label="Orphan (aman dihapus duluan)"
          value={stats ? formatFileSize(stats.orphanTotalBytes) : "-"}
          sub={stats ? `${stats.orphanTotalCount} file tidak terpakai` : undefined}
          highlight
        />
      </div>

      <div className="flex flex-col gap-4 mb-6">
        <div className="relative flex-grow">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Cari nama file / kode dokumen..."
            className="pl-10"
            value={searchInput}
            onChange={(e) => setSearchInput(e.target.value)}
          />
        </div>

        <div className="p-4 border rounded-lg bg-muted/50">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <FilterField label="Tipe Dokumen">
              <Select value={docType} onValueChange={(v) => handleFilterChange({ doc_type: v === "all" ? undefined : v })}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {DOC_TYPE_OPTIONS.map((o) => (
                    <SelectItem key={o.value} value={o.value}>
                      {o.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </FilterField>

            <FilterField label="Storage Source">
              <Select value={bucket} onValueChange={(v) => handleFilterChange({ bucket: v === "all" ? undefined : v })}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {BUCKET_OPTIONS.map((o) => (
                    <SelectItem key={o.value} value={o.value}>
                      {o.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </FilterField>

            <FilterField label="Urutkan Berdasarkan">
              <Select value={sortBy} onValueChange={(v) => handleFilterChange({ sort_by: v })}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {SORT_OPTIONS.map((o) => (
                    <SelectItem key={o.value} value={o.value}>
                      {o.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </FilterField>

            <FilterField label="Arah">
              <Select value={sortDir} onValueChange={(v) => handleFilterChange({ sort_dir: v })}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="asc">Terlama / Terkecil dulu</SelectItem>
                  <SelectItem value="desc">Terbaru / Terbesar dulu</SelectItem>
                </SelectContent>
              </Select>
            </FilterField>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mt-4">
            <FilterField label="Dari Tanggal">
              <Input type="date" value={startDateInput} onChange={(e) => setStartDateInput(e.target.value)} />
            </FilterField>
            <FilterField label="Sampai Tanggal">
              <Input type="date" value={endDateInput} onChange={(e) => setEndDateInput(e.target.value)} />
            </FilterField>
            <div className="hidden lg:block" />
            <div className="flex flex-col gap-2 justify-end">
              <Button
                className="w-full"
                onClick={() =>
                  handleFilterChange({
                    start_date: startDateInput || undefined,
                    end_date: endDateInput || undefined,
                  })
                }
              >
                Terapkan Filter
              </Button>
            </div>
          </div>
        </div>
      </div>

      {selected.size > 0 && (
        <div className="mb-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-3 border rounded-lg bg-primary/5">
          <div className="text-sm">
            <span className="font-semibold">{selected.size} file dipilih</span>{" "}
            <span className="text-muted-foreground">({formatFileSize(selectedTotalSize)})</span>
          </div>
          <Button variant="destructive" size="sm" onClick={() => setDeleteTarget(selectedEntries)}>
            <Trash2 className="mr-2 h-4 w-4" /> Hapus Terpilih
          </Button>
        </div>
      )}

      <div className="border rounded-md overflow-x-auto">
        <Table className="min-w-[1100px]">
          <TableHeader>
            <TableRow>
              <TableHead className="w-[40px]">
                <Checkbox checked={allOnPageSelected} onCheckedChange={toggleSelectAll} />
              </TableHead>
              <TableHead>Nama File</TableHead>
              <TableHead>Dokumen</TableHead>
              <TableHead>Storage</TableHead>
              <TableHead>Ukuran</TableHead>
              <TableHead>Tanggal</TableHead>
              <TableHead className="text-right">Aksi</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {loading ? (
              <TableRow>
                <TableCell colSpan={7} className="text-center h-24">
                  <div className="flex justify-center items-center gap-2">
                    <Loader2 className="h-5 w-5 animate-spin" />
                    Memuat data...
                  </div>
                </TableCell>
              </TableRow>
            ) : rows.length > 0 ? (
              rows.map((entry) => (
                <TableRow key={entry.id}>
                  <TableCell>
                    <Checkbox checked={selected.has(entry.id)} onCheckedChange={() => toggleSelect(entry.id)} />
                  </TableCell>
                  <TableCell className="max-w-[240px]">
                    <a
                      href={entry.viewUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex items-center gap-1 hover:underline"
                    >
                      <span className="truncate">{entry.fileName}</span>
                      <ExternalLink className="h-3 w-3 shrink-0" />
                    </a>
                    {entry.missing && (
                      <Badge variant="destructive" className="mt-1">
                        File hilang di storage
                      </Badge>
                    )}
                  </TableCell>
                  <TableCell>
                    <Badge variant="secondary">{DOC_TYPE_LABEL[entry.source]}</Badge>
                    {entry.documentHref ? (
                      <a
                        href={entry.documentHref}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="block text-xs text-muted-foreground hover:underline mt-1"
                      >
                        {entry.documentCode}
                      </a>
                    ) : (
                      <div className="text-xs text-muted-foreground mt-1">-</div>
                    )}
                  </TableCell>
                  <TableCell>
                    <Badge variant="outline">{entry.bucket === "legacy" ? "Legacy" : "VPS"}</Badge>
                  </TableCell>
                  <TableCell>{entry.size !== null ? formatFileSize(entry.size) : "-"}</TableCell>
                  <TableCell>{entry.uploadedAt ? formatDateWithTime(entry.uploadedAt) : "-"}</TableCell>
                  <TableCell className="text-right">
                    <Button variant="outline" size="sm" onClick={() => setDeleteTarget([entry])}>
                      <Trash2 className="h-3 w-3" />
                    </Button>
                  </TableCell>
                </TableRow>
              ))
            ) : (
              <TableRow>
                <TableCell colSpan={7} className="text-center h-24">
                  Tidak ada file ditemukan sesuai filter.
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </div>

      <div className="mt-6 flex flex-col md:flex-row justify-between items-center gap-4">
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <span>Tampilkan</span>
          <Select value={String(limit)} onValueChange={(value) => handleFilterChange({ limit: value })}>
            <SelectTrigger className="w-[70px]">
              <SelectValue placeholder={limit} />
            </SelectTrigger>
            <SelectContent>
              {LIMIT_OPTIONS.map((opt) => (
                <SelectItem key={opt} value={String(opt)}>
                  {opt}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <span>dari {total} file.</span>
        </div>

        <CustomPagination
          currentPage={currentPage}
          totalPages={Math.max(1, Math.ceil(total / limit))}
          onPageChange={handlePageChange}
        />
      </div>

      <AlertDialog open={!!deleteTarget} onOpenChange={(open) => !open && !isDeleting && setDeleteTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Hapus {deleteTarget?.length ?? 0} file?</AlertDialogTitle>
            <AlertDialogDescription>
              Total ukuran yang akan dibebaskan:{" "}
              {formatFileSize((deleteTarget ?? []).reduce((sum, e) => sum + (e.size ?? 0), 0))}.{" "}
              File akan dihapus permanen dari storage
              {deleteTarget?.some((d) => d.documentId !== null)
                ? ", dan referensinya di dokumen terkait akan ikut dihapus otomatis."
                : "."}{" "}
              Tindakan ini tidak bisa dibatalkan.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isDeleting}>Batal</AlertDialogCancel>
            <AlertDialogAction
              onClick={(e) => {
                e.preventDefault();
                executeDelete();
              }}
              disabled={isDeleting}
            >
              {isDeleting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Ya, Hapus
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </Content>
  );
}
