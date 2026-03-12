// src/app/(With Sidebar)/petty-cash/page.tsx

"use client";

import { Content } from "@/components/content";
import { Button } from "@/components/ui/button";
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
import { useState, useEffect } from "react";
import { createClient } from "@/lib/supabase/client";
import { fetchMyPettyCash } from "@/services/pettyCashService";
import { PettyCashRequest } from "@/type";
import { PETTY_CASH_STATUS_COLORS } from "@/type/enum";
import {
  Loader2,
  RefreshCcw,
  Eye,
  PlusCircle,
  Wallet,
  CalendarDays,
  ReceiptText,
} from "lucide-react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";

const formatRupiah = (angka: number) => {
  return new Intl.NumberFormat("id-ID", {
    style: "currency",
    currency: "IDR",
    minimumFractionDigits: 0,
  }).format(angka);
};

const formatDate = (dateStr: string | Date) => {
  return new Date(dateStr).toLocaleDateString("id-ID", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
};

export default function MyPettyCashPage() {
  const router = useRouter();
  const supabase = createClient();

  const [requests, setRequests] = useState<PettyCashRequest[]>([]);
  const [loading, setLoading] = useState(true);

  // State untuk Dialog Detail
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [selectedPC, setSelectedPC] = useState<PettyCashRequest | null>(null);

  const loadData = async () => {
    setLoading(true);
    try {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) throw new Error("User tidak terautentikasi.");

      const data = await fetchMyPettyCash(user.id);
      setRequests(data);
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

  const handleViewDetails = (pc: PettyCashRequest) => {
    setSelectedPC(pc);
    setIsDialogOpen(true);
  };

  const getStatusBadge = (status: string) => {
    const colorClass =
      PETTY_CASH_STATUS_COLORS[status] || "bg-gray-100 text-gray-800";
    return (
      <Badge className={`${colorClass} whitespace-nowrap`}>{status}</Badge>
    );
  };

  return (
    <>
      <Content
        title="Petty Cash Saya"
        description="Kelola dan pantau status pengajuan dana kas kecil Anda."
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
            <Button size="sm" onClick={() => router.push("/petty-cash/buat")}>
              <PlusCircle className="h-4 w-4 mr-1" />
              Buat Pengajuan
            </Button>
          </div>
        }
      >
        {/* REVISI 1: overflow-x-auto pada wrapper agar responsif di layar kecil */}
        <div className="rounded-md border overflow-x-auto">
          {/* REVISI 2: Set min-w-[950px] agar tabel tidak menyusut di bawah batas wajarnya */}
          <Table className="min-w-[950px] table-fixed">
            <TableHeader>
              <TableRow>
                {/* Lebar kolom dibuat statis (absolut) agar saling mengunci */}
                <TableHead className="w-[110px]">Tanggal</TableHead>
                <TableHead className="w-[170px]">Kode PC</TableHead>
                <TableHead className="w-[160px]">Tipe</TableHead>
                <TableHead className="w-[240px]">Tujuan / Keterangan</TableHead>
                <TableHead className="w-[130px] text-right">Nominal</TableHead>
                <TableHead className="w-[140px] text-center">Status</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {loading ? (
                <TableRow>
                  <TableCell colSpan={6} className="text-center h-32">
                    <Loader2 className="animate-spin h-6 w-6 mx-auto text-primary" />
                    <span className="text-sm text-muted-foreground mt-2 block">
                      Memuat data...
                    </span>
                  </TableCell>
                </TableRow>
              ) : requests.length === 0 ? (
                <TableRow>
                  <TableCell
                    colSpan={6}
                    className="text-center h-32 text-muted-foreground flex-col items-center justify-center"
                  >
                    <Wallet className="h-8 w-8 mx-auto mb-2 text-muted-foreground/50" />
                    Belum ada pengajuan Petty Cash.
                  </TableCell>
                </TableRow>
              ) : (
                requests.map((pc) => (
                  <TableRow
                    key={pc.id}
                    className="cursor-pointer hover:bg-muted/50 transition-colors"
                    onClick={() => handleViewDetails(pc)}
                  >
                    <TableCell
                      className="whitespace-nowrap text-sm truncate"
                      title={formatDate(pc.created_at)}
                    >
                      {formatDate(pc.created_at)}
                    </TableCell>
                    <TableCell
                      className="font-semibold text-sm text-primary truncate"
                      title={pc.kode_pc}
                    >
                      {pc.kode_pc}
                    </TableCell>
                    <TableCell className="truncate text-sm" title={pc.type}>
                      {pc.type}
                    </TableCell>
                    <TableCell>
                      {/* REVISI 3: Wrapper kolom deskripsi dikunci ketat */}
                      <div className="flex flex-col overflow-hidden max-w-[220px]">
                        <span
                          className="truncate text-sm font-medium"
                          title={pc.purpose}
                        >
                          {pc.purpose}
                        </span>
                        <span
                          className="text-xs text-muted-foreground truncate mt-0.5"
                          title={`Cost Center: ${pc.cost_centers?.name || "Belum ditentukan"}`}
                        >
                          CC: {pc.cost_centers?.name || "-"}
                        </span>
                      </div>
                    </TableCell>
                    <TableCell className="text-right font-semibold text-sm">
                      {formatRupiah(pc.amount)}
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center justify-between gap-1">
                        {getStatusBadge(pc.status)}
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-7 w-7 text-muted-foreground hover:text-primary shrink-0"
                          onClick={(e) => {
                            e.stopPropagation();
                            handleViewDetails(pc);
                          }}
                        >
                          <Eye className="h-4 w-4" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </div>
      </Content>

      {/* DIALOG POPUP DETAIL (Disempurnakan layout scroll-nya) */}
      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent className="sm:max-w-lg max-h-[85vh] flex flex-col p-0 overflow-hidden">
          <DialogHeader className="px-6 pt-6 pb-4 border-b shrink-0 bg-background z-10">
            <DialogTitle className="flex items-center gap-2 text-lg">
              <ReceiptText className="h-5 w-5 text-primary" />
              Detail Pengajuan
            </DialogTitle>
            <DialogDescription className="font-medium text-primary">
              {selectedPC?.kode_pc}{" "}
              <span className="text-muted-foreground font-normal">
                • {selectedPC && formatDate(selectedPC.created_at)}
              </span>
            </DialogDescription>
          </DialogHeader>

          {selectedPC && (
            <div className="px-6 pb-6 pt-2 overflow-y-auto space-y-5">
              <div className="grid grid-cols-2 gap-4 text-sm bg-muted/30 p-4 rounded-lg border mt-2">
                <div className="space-y-1">
                  <span className="text-muted-foreground block text-xs font-medium">
                    Tipe Pengajuan
                  </span>
                  <span
                    className="font-semibold block truncate"
                    title={selectedPC.type}
                  >
                    {selectedPC.type}
                  </span>
                </div>
                <div className="space-y-1">
                  <span className="text-muted-foreground block text-xs font-medium">
                    Status
                  </span>
                  <span>{getStatusBadge(selectedPC.status)}</span>
                </div>
                <div className="space-y-1">
                  <span className="text-muted-foreground block text-xs font-medium">
                    Tgl Dibutuhkan
                  </span>
                  <span className="flex items-center gap-1 font-medium truncate">
                    <CalendarDays className="h-3 w-3 text-muted-foreground shrink-0" />
                    {formatDate(selectedPC.needed_date)}
                  </span>
                </div>
                <div className="space-y-1">
                  <span className="text-muted-foreground block text-xs font-medium">
                    Cost Center
                  </span>
                  <span
                    className="font-medium text-primary bg-primary/10 px-1.5 py-0.5 rounded w-fit block truncate max-w-full"
                    title={selectedPC.cost_centers?.name || ""}
                  >
                    {selectedPC.cost_centers?.name || "Menunggu GA"}
                  </span>
                </div>
              </div>

              <div className="bg-primary/10 border border-primary/20 p-4 rounded-lg flex items-center justify-between">
                <div>
                  <span className="text-xs font-medium text-primary block mb-1">
                    Nominal Pengajuan
                  </span>
                  <span className="text-2xl font-bold text-primary">
                    {formatRupiah(selectedPC.amount)}
                  </span>
                </div>
                {selectedPC.actual_amount !== null && (
                  <div className="text-right">
                    <span className="text-xs font-medium text-muted-foreground block mb-1">
                      Pemakaian Riil
                    </span>
                    <span className="text-lg font-bold text-foreground">
                      {formatRupiah(selectedPC.actual_amount)}
                    </span>
                  </div>
                )}
              </div>

              <div className="space-y-1.5">
                <span className="text-muted-foreground block text-xs font-medium">
                  Keterangan / Tujuan
                </span>
                <div className="p-3 bg-muted/50 rounded-md text-sm whitespace-pre-wrap break-words border text-foreground">
                  {selectedPC.purpose}
                </div>
              </div>

              <div className="pt-2">
                <Button
                  className="w-full"
                  onClick={() => router.push(`/petty-cash/${selectedPC.id}`)}
                >
                  Lihat Dokumen Penuh & Approval
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </>
  );
}
