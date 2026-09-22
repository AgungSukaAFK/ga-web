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
import { fetchMyPengajuan } from "@/services/pettyCashPengajuanService";
import { PettyCashPengajuan } from "@/type";
import {
  PC_PENGAJUAN_STATUS_COLORS,
  PC_PENGAJUAN_STATUS_COLOR_DEFAULT,
} from "@/type/enum";
import { formatCurrency } from "@/lib/utils";
import {
  Loader2,
  RefreshCcw,
  Eye,
  PlusCircle,
  Wallet,
  CalendarDays,
  ReceiptText,
  CheckCircle2,
  XCircle,
  Clock,
} from "lucide-react";
import { useRouter } from "next/navigation";
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
              ) : pengajuan.length === 0 ? (
                <TableRow>
                  <TableCell
                    colSpan={7}
                    className="text-center h-32 text-muted-foreground"
                  >
                    <Wallet className="h-8 w-8 mx-auto mb-2 text-muted-foreground/50" />
                    Belum ada pengajuan Petty Cash.
                  </TableCell>
                </TableRow>
              ) : (
                pengajuan.map((pj) => (
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
        <DialogContent className="sm:max-w-2xl max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <ReceiptText className="h-5 w-5 text-primary" />
              {selected?.kode_pengajuan}
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

              {selected.notes && (
                <div className="text-sm bg-muted/50 rounded-md p-3 border">
                  {selected.notes}
                </div>
              )}

              <div className="overflow-x-auto rounded-md border">
                <Table className="min-w-[500px]">
                  <TableHeader>
                    <TableRow>
                      <TableHead>Nama Barang</TableHead>
                      <TableHead className="w-[70px]">Qty</TableHead>
                      <TableHead className="w-[110px] text-right">
                        Harga Satuan
                      </TableHead>
                      <TableHead className="w-[120px] text-right">
                        Subtotal
                      </TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {selected.items.map((it, i) => (
                      <TableRow key={i}>
                        <TableCell>
                          <div className="font-medium">{it.part_name}</div>
                          {it.note && (
                            <div className="text-xs text-muted-foreground">
                              {it.note}
                            </div>
                          )}
                        </TableCell>
                        <TableCell>
                          {it.qty} {it.uom || ""}
                        </TableCell>
                        <TableCell className="text-right">
                          {formatCurrency(it.unit_price)}
                        </TableCell>
                        <TableCell className="text-right font-medium">
                          {formatCurrency(it.subtotal)}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
              <div className="flex justify-end">
                <div className="text-right">
                  <p className="text-xs text-muted-foreground">
                    Total Pengajuan
                  </p>
                  <p className="text-xl font-bold text-primary">
                    {formatCurrency(selected.total_amount)}
                  </p>
                </div>
              </div>

              <div className="space-y-2">
                <p className="text-xs font-medium text-muted-foreground">
                  Jalur Approval
                </p>
                <div className="space-y-1">
                  {selected.approvals.map((app, i) => (
                    <div
                      key={i}
                      className="flex items-center justify-between text-sm border rounded-md px-3 py-1.5"
                    >
                      <span>
                        {i + 1}. {app.nama}{" "}
                        <span className="text-xs text-muted-foreground">
                          ({app.department})
                        </span>
                      </span>
                      {app.status === "approved" ? (
                        <Badge className="bg-green-50 text-green-700 border-green-200 dark:bg-green-900/40 dark:text-green-300 dark:border-green-800">
                          <CheckCircle2 className="h-3 w-3 mr-1" /> Approved
                        </Badge>
                      ) : app.status === "rejected" ? (
                        <Badge variant="destructive">
                          <XCircle className="h-3 w-3 mr-1" /> Rejected
                        </Badge>
                      ) : (
                        <Badge variant="outline">
                          <Clock className="h-3 w-3 mr-1" /> Pending
                        </Badge>
                      )}
                    </div>
                  ))}
                </div>
              </div>

              {selected.attachments?.length > 0 && (
                <div className="space-y-2">
                  <p className="text-xs font-medium text-muted-foreground">
                    Lampiran
                  </p>
                  <div className="grid gap-2">
                    {selected.attachments.map((file, i) => (
                      <a
                        key={i}
                        href={file.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-sm text-primary hover:underline p-2 border rounded-md bg-background truncate block"
                      >
                        {file.name}
                      </a>
                    ))}
                  </div>
                </div>
              )}

              {selected.discussions?.length > 0 && (
                <div className="space-y-2">
                  <p className="text-xs font-medium text-muted-foreground">
                    Catatan
                  </p>
                  <div className="space-y-2">
                    {selected.discussions.map((d: any, i: number) => (
                      <div
                        key={i}
                        className="text-sm bg-muted/50 rounded-md p-3 border"
                      >
                        <div className="flex justify-between items-center mb-1">
                          <span className="font-semibold text-xs">
                            {d.user_name}
                          </span>
                          <span className="text-[10px] text-muted-foreground">
                            {new Date(d.timestamp).toLocaleString("id-ID")}
                          </span>
                        </div>
                        <p className="whitespace-pre-wrap">{d.message}</p>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}
        </DialogContent>
      </Dialog>
    </>
  );
}
