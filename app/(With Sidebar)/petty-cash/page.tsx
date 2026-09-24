// src/app/(With Sidebar)/petty-cash/page.tsx
//
// "Pengajuan Saya" - daftar Input Pengajuan Petty Cash (tabel
// `petty_cash_pengajuan`, alur item-based BARU) milik user yang sedang
// login. Sebelumnya halaman ini menampilkan tabel `petty_cash_requests`
// (alur lama lump-sum) yang sudah tidak dipakai/di-link dari sidebar mana
// pun, sehingga pengajuan yang dibuat lewat /petty-cash/input-pengajuan
// (yang redirect ke sini) tampak "hilang" walau datanya tersimpan di DB.

"use client";

import { Content } from "@/components/content";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
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
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { useEffect, useMemo, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { fetchMyPengajuan } from "@/services/pettyCashPengajuanService";
import { PettyCashPengajuan } from "@/type";
import {
  PC_PENGAJUAN_STATUS_COLORS,
  PC_PENGAJUAN_STATUS_COLOR_DEFAULT,
  PC_PENGAJUAN_STATUS_OPTIONS,
} from "@/type/enum";
import { PcDocumentInfoPanel } from "@/components/petty-cash/PcDocumentInfoPanel";
import { formatCurrency } from "@/lib/utils";
import {
  Loader2,
  RefreshCcw,
  Eye,
  PlusCircle,
  Wallet,
  CalendarDays,
  ReceiptText,
  Search,
  ExternalLink,
} from "lucide-react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { toast } from "sonner";

const formatDate = (dateStr: string | Date) =>
  new Date(dateStr).toLocaleDateString("id-ID", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });

export default function MyPettyCashPengajuanPage() {
  const router = useRouter();
  const supabase = createClient();

  const [pengajuan, setPengajuan] = useState<PettyCashPengajuan[]>([]);
  const [loading, setLoading] = useState(true);

  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("all");

  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [selected, setSelected] = useState<PettyCashPengajuan | null>(null);

  const loadData = async () => {
    setLoading(true);
    try {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) throw new Error("User tidak terautentikasi.");

      const data = await fetchMyPengajuan(user.id);
      setPengajuan(data);
    } catch (error: any) {
      toast.error("Gagal memuat data Petty Cash", {
        description: error.message,
      });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const filteredPengajuan = useMemo(() => {
    const q = search.trim().toLowerCase();
    return pengajuan.filter((pj) => {
      if (statusFilter !== "all" && pj.status !== statusFilter) return false;
      if (!q) return true;
      return (
        pj.kode_pengajuan.toLowerCase().includes(q) ||
        pj.department?.toLowerCase().includes(q) ||
        pj.notes?.toLowerCase().includes(q)
      );
    });
  }, [pengajuan, search, statusFilter]);

  const handleViewDetails = (pj: PettyCashPengajuan) => {
    setSelected(pj);
    setIsDialogOpen(true);
  };

  const getStatusBadge = (status: string) => {
    const colorClass =
      PC_PENGAJUAN_STATUS_COLORS[status] || PC_PENGAJUAN_STATUS_COLOR_DEFAULT;
    return (
      <Badge className={`${colorClass} whitespace-nowrap`}>{status}</Badge>
    );
  };

  return (
    <>
      <Content
        title="Pengajuan Petty Cash Saya"
        description="Kelola dan pantau status Input Pengajuan Petty Cash Anda."
        cardAction={
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={loadData}
              disabled={loading}
            >
              <RefreshCcw
                className={`h-4 w-4 mr-1 ${loading ? "animate-spin" : ""}`}
              />
              Refresh
            </Button>
            <Button
              size="sm"
              onClick={() => router.push("/petty-cash/input-pengajuan")}
            >
              <PlusCircle className="h-4 w-4 mr-1" />
              Input Pengajuan
            </Button>
          </div>
        }
      >
        <div className="flex flex-col sm:flex-row gap-2 mb-4">
          <div className="relative flex-1">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Cari kode pengajuan, departemen, atau catatan..."
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
              {PC_PENGAJUAN_STATUS_OPTIONS.map((s) => (
                <SelectItem key={s} value={s}>
                  {s}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="rounded-md border overflow-x-auto">
          <Table className="min-w-[900px] table-fixed">
            <TableHeader>
              <TableRow>
                <TableHead className="w-[110px]">Tanggal</TableHead>
                <TableHead className="w-[190px]">Kode Pengajuan</TableHead>
                <TableHead className="w-[140px]">Departemen</TableHead>
                <TableHead className="w-[90px] text-center">
                  Jml Barang
                </TableHead>
                <TableHead className="w-[140px] text-right">
                  Total Pengajuan
                </TableHead>
                <TableHead className="w-[140px]">Status</TableHead>
                <TableHead className="w-[70px] text-center">Aksi</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {loading ? (
                <TableRow>
                  <TableCell colSpan={7} className="text-center h-32">
                    <Loader2 className="animate-spin h-6 w-6 mx-auto text-primary" />
                    <span className="text-sm text-muted-foreground mt-2 block">
                      Memuat data...
                    </span>
                  </TableCell>
                </TableRow>
              ) : filteredPengajuan.length === 0 ? (
                <TableRow>
                  <TableCell
                    colSpan={7}
                    className="text-center h-32 text-muted-foreground"
                  >
                    <Wallet className="h-8 w-8 mx-auto mb-2 text-muted-foreground/50" />
                    {pengajuan.length === 0
                      ? "Belum ada pengajuan Petty Cash."
                      : "Tidak ada data yang cocok dengan filter."}
                  </TableCell>
                </TableRow>
              ) : (
                filteredPengajuan.map((pj) => (
                  <TableRow
                    key={pj.id}
                    className="cursor-pointer hover:bg-muted/50 transition-colors"
                    onClick={() => handleViewDetails(pj)}
                  >
                    <TableCell
                      className="whitespace-nowrap text-sm truncate"
                      title={formatDate(pj.created_at)}
                    >
                      {formatDate(pj.created_at)}
                    </TableCell>
                    <TableCell
                      className="font-semibold text-sm truncate text-primary"
                      title={pj.kode_pengajuan}
                    >
                      {pj.kode_pengajuan}
                    </TableCell>
                    <TableCell className="truncate text-sm" title={pj.department}>
                      {pj.department}
                    </TableCell>
                    <TableCell className="text-center text-sm">
                      {pj.items?.length ?? 0}
                    </TableCell>
                    <TableCell className="text-right font-semibold text-sm">
                      {formatCurrency(pj.total_amount)}
                    </TableCell>
                    <TableCell>{getStatusBadge(pj.status)}</TableCell>
                    <TableCell className="text-center">
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-7 w-7 text-muted-foreground hover:text-primary"
                        onClick={(e) => {
                          e.stopPropagation();
                          handleViewDetails(pj);
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
      </Content>

      {/* DIALOG DETAIL PENGAJUAN */}
      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent className="sm:max-w-3xl max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center justify-between gap-2">
              <span className="flex items-center gap-2">
                <ReceiptText className="h-5 w-5 text-primary" />
                {selected?.kode_pengajuan}
              </span>
              {selected && (
                <Link
                  href={`/petty-cash/pengajuan/${selected.id}`}
                  target="_blank"
                  className="text-xs font-normal text-primary hover:underline flex items-center gap-1"
                >
                  Detail Lengkap / Cetak <ExternalLink className="h-3 w-3" />
                </Link>
              )}
            </DialogTitle>
            <DialogDescription>
              {selected?.department} -{" "}
              {selected && (
                <span className="inline-flex items-center gap-1">
                  <CalendarDays className="h-3 w-3" />
                  Dibutuhkan {formatDate(selected.needed_date)}
                </span>
              )}
            </DialogDescription>
          </DialogHeader>

          {selected && (
            <div className="space-y-4">
              <div>{getStatusBadge(selected.status)}</div>
              <PcDocumentInfoPanel
                requesterName={selected.users_with_profiles?.nama}
                requesterEmail={selected.users_with_profiles?.email}
                department={selected.department}
                companyCode={selected.company_code}
                site={selected.site}
                budgetName={selected.petty_cash_budget?.name}
                budgetRemaining={selected.petty_cash_budget?.current_budget}
                neededDate={selected.needed_date}
                weekOfMonth={selected.week_of_month}
                notes={selected.notes}
                items={selected.items}
                totalAmount={selected.total_amount}
                attachments={selected.attachments}
                approvals={selected.approvals}
                discussions={selected.discussions}
                revisions={selected.revisions}
              />
            </div>
          )}
        </DialogContent>
      </Dialog>
    </>
  );
}
