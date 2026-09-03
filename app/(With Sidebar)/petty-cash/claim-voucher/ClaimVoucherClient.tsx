// src/app/(With Sidebar)/petty-cash/claim-voucher/ClaimVoucherClient.tsx
//
// Requester mengajukan klaim pencairan atas Voucher miliknya yang sudah
// "Approved" - begitu diajukan, status Voucher naik jadi "Permintaan Klaim"
// (lihat submitVoucherClaim, services/pettyCashVoucherService.ts). Tahap
// setelah ini (siapa yang memproses "Permintaan Klaim" jadi dana cair)
// belum dibangun - halaman ini cuma menangani pengajuan klaimnya.

"use client";

import { useEffect, useState } from "react";
import { Content } from "@/components/content";
import { Button } from "@/components/ui/button";
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
import { PettyCashVoucher } from "@/type";
import {
  PC_VOUCHER_STATUS_COLORS,
  PC_VOUCHER_STATUS_COLOR_DEFAULT,
} from "@/type/enum";
import {
  fetchClaimableVouchers,
  fetchMyVouchers,
  submitVoucherClaim,
} from "@/services/pettyCashVoucherService";
import {
  Loader2,
  RefreshCcw,
  Wallet,
  ReceiptText,
  CalendarDays,
} from "lucide-react";

const formatDate = (dateStr: string | Date) =>
  new Date(dateStr).toLocaleDateString("id-ID", {
    day: "2-digit",
    month: "long",
    year: "numeric",
  });

const StatusBadge = ({ status }: { status: string }) => (
  <Badge
    className={`whitespace-nowrap ${
      PC_VOUCHER_STATUS_COLORS[status] || PC_VOUCHER_STATUS_COLOR_DEFAULT
    }`}
  >
    {status}
  </Badge>
);

export default function ClaimVoucherClient() {
  const supabase = createClient();

  const [profile, setProfile] = useState<{ id: string; nama: string } | null>(
    null,
  );
  const [claimable, setClaimable] = useState<PettyCashVoucher[]>([]);
  const [allVouchers, setAllVouchers] = useState<PettyCashVoucher[]>([]);
  const [loading, setLoading] = useState(true);
  const [claiming, setClaiming] = useState(false);

  const [selected, setSelected] = useState<PettyCashVoucher | null>(null);

  const loadData = async () => {
    setLoading(true);
    try {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) throw new Error("Tidak terautentikasi.");

      const { data: prof, error } = await supabase
        .from("profiles")
        .select("id, nama")
        .eq("id", user.id)
        .single();
      if (error) throw error;
      setProfile({ id: prof.id, nama: prof.nama || "" });

      const [claimableData, allData] = await Promise.all([
        fetchClaimableVouchers(user.id),
        fetchMyVouchers(user.id),
      ]);
      setClaimable(claimableData);
      setAllVouchers(
        allData.filter((v) => v.status !== "Approved" && v.status !== "In Approval"),
      );
    } catch (error: any) {
      toast.error("Gagal memuat data", { description: error.message });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const handleClaim = async () => {
    if (!selected || !profile) return;
    setClaiming(true);
    try {
      await submitVoucherClaim(selected, profile.id, profile.nama);
      toast.success(
        `Klaim ${selected.kode_voucher} berhasil diajukan.`,
      );
      setSelected(null);
      await loadData();
    } catch (error: any) {
      toast.error("Gagal mengajukan klaim", { description: error.message });
    } finally {
      setClaiming(false);
    }
  };

  return (
    <>
      <Content
        title="Claim Voucher"
        description="Ajukan klaim pencairan atas Voucher Anda yang sudah disetujui."
        cardAction={
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
        }
      >
        <div className="space-y-8">
          <div>
            <h3 className="text-sm font-semibold mb-2 flex items-center gap-2">
              <Wallet className="h-4 w-4 text-primary" />
              Voucher Siap Diklaim
            </h3>
            <div className="rounded-md border overflow-x-auto">
              <Table className="min-w-[700px]">
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-[180px]">Kode Voucher</TableHead>
                    <TableHead className="w-[180px]">Dari Pengajuan</TableHead>
                    <TableHead className="w-[150px] text-right">
                      Total Voucher
                    </TableHead>
                    <TableHead className="w-[140px] text-center">
                      Aksi
                    </TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {loading ? (
                    <TableRow>
                      <TableCell colSpan={4} className="text-center h-28">
                        <Loader2 className="animate-spin h-6 w-6 mx-auto text-primary" />
                      </TableCell>
                    </TableRow>
                  ) : claimable.length === 0 ? (
                    <TableRow>
                      <TableCell
                        colSpan={4}
                        className="text-center h-28 text-muted-foreground"
                      >
                        Belum ada Voucher yang siap diklaim.
                      </TableCell>
                    </TableRow>
                  ) : (
                    claimable.map((v) => (
                      <TableRow key={v.id}>
                        <TableCell className="font-semibold text-sm">
                          {v.kode_voucher}
                        </TableCell>
                        <TableCell className="text-sm text-muted-foreground">
                          {v.petty_cash_pengajuan?.kode_pengajuan || "-"}
                        </TableCell>
                        <TableCell className="text-right font-medium text-sm">
                          {formatCurrency(v.total_amount)}
                        </TableCell>
                        <TableCell className="text-center">
                          <Button size="sm" onClick={() => setSelected(v)}>
                            Ajukan Klaim
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </div>
          </div>

          <div>
            <h3 className="text-sm font-semibold mb-2 flex items-center gap-2">
              <ReceiptText className="h-4 w-4 text-primary" />
              Riwayat Klaim
            </h3>
            <div className="rounded-md border overflow-x-auto">
              <Table className="min-w-[700px]">
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-[180px]">Kode Voucher</TableHead>
                    <TableHead className="w-[180px]">Dari Pengajuan</TableHead>
                    <TableHead className="w-[150px] text-right">
                      Total Voucher
                    </TableHead>
                    <TableHead className="w-[140px]">Status</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {loading ? (
                    <TableRow>
                      <TableCell colSpan={4} className="text-center h-28">
                        <Loader2 className="animate-spin h-6 w-6 mx-auto text-primary" />
                      </TableCell>
                    </TableRow>
                  ) : allVouchers.length === 0 ? (
                    <TableRow>
                      <TableCell
                        colSpan={4}
                        className="text-center h-28 text-muted-foreground"
                      >
                        Belum ada riwayat klaim.
                      </TableCell>
                    </TableRow>
                  ) : (
                    allVouchers.map((v) => (
                      <TableRow key={v.id}>
                        <TableCell className="font-semibold text-sm">
                          {v.kode_voucher}
                        </TableCell>
                        <TableCell className="text-sm text-muted-foreground">
                          {v.petty_cash_pengajuan?.kode_pengajuan || "-"}
                        </TableCell>
                        <TableCell className="text-right font-medium text-sm">
                          {formatCurrency(v.total_amount)}
                        </TableCell>
                        <TableCell>
                          <StatusBadge status={v.status} />
                        </TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </div>
          </div>
        </div>
      </Content>

      {/* DIALOG KONFIRMASI KLAIM */}
      <Dialog
        open={!!selected}
        onOpenChange={(open) => !open && setSelected(null)}
      >
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Ajukan Klaim {selected?.kode_voucher}</DialogTitle>
            <DialogDescription>
              Status Voucher akan berubah menjadi &quot;Permintaan
              Klaim&quot; - pastikan Anda siap menerima pencairan dana ini.
            </DialogDescription>
          </DialogHeader>

          {selected && (
            <div className="bg-primary/10 border border-primary/20 p-4 rounded-lg flex items-center justify-between">
              <div>
                <span className="text-xs font-medium text-primary block mb-1">
                  Total Voucher
                </span>
                <span className="text-2xl font-bold text-primary">
                  {formatCurrency(selected.total_amount)}
                </span>
              </div>
              <span className="text-xs text-muted-foreground flex items-center gap-1">
                <CalendarDays className="h-3 w-3" />
                {formatDate(selected.needed_date)}
              </span>
            </div>
          )}

          <DialogFooter>
            <Button
              variant="ghost"
              onClick={() => setSelected(null)}
              disabled={claiming}
            >
              Batal
            </Button>
            <Button onClick={handleClaim} disabled={claiming}>
              {claiming && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Ajukan Klaim
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
