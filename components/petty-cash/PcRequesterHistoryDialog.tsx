// src/components/petty-cash/PcRequesterHistoryDialog.tsx
//
// Tombol "Riwayat Pengaju" - dipasang di dialog approval (Pengajuan/Voucher/
// Deklarasi, lihat ApprovalPettyCashClient.tsx) supaya approver bisa cek
// seluruh riwayat Pengajuan Petty Cash requester yang sedang diajukan
// SEBELUM memutuskan approve/reject/edit, tanpa pindah halaman. Data diambil
// lazy (baru fetch pas dialog history dibuka) via fetchMyPengajuan(userId) -
// query yang sama dipakai halaman "Pengajuan Saya" milik requester sendiri,
// cuma di sini userId-nya requester yang diajukan approver, bukan user login.

"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { formatCurrency } from "@/lib/utils";
import { fetchMyPengajuan } from "@/services/pettyCashPengajuanService";
import { PettyCashPengajuan } from "@/type";
import {
  PC_PENGAJUAN_STATUS_COLOR_DEFAULT,
  PC_PENGAJUAN_STATUS_COLORS,
} from "@/type/enum";
import { History, Loader2, Wallet } from "lucide-react";

const formatDate = (dateStr: string | Date) =>
  new Date(dateStr).toLocaleDateString("id-ID", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });

interface PcRequesterHistoryDialogProps {
  userId: string;
  requesterName?: string | null;
}

export function PcRequesterHistoryDialog({
  userId,
  requesterName,
}: PcRequesterHistoryDialogProps) {
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [loaded, setLoaded] = useState(false);
  const [rows, setRows] = useState<PettyCashPengajuan[]>([]);

  const handleOpenChange = async (next: boolean) => {
    setOpen(next);
    if (next && !loaded) {
      setLoading(true);
      try {
        const data = await fetchMyPengajuan(userId);
        setRows(data);
        setLoaded(true);
      } finally {
        setLoading(false);
      }
    }
  };

  return (
    <>
      <Button variant="outline" size="sm" onClick={() => handleOpenChange(true)}>
        <History className="mr-2 h-4 w-4" /> Riwayat Pengaju
      </Button>

      <Dialog open={open} onOpenChange={handleOpenChange}>
        <DialogContent className="sm:max-w-2xl max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Riwayat Pengajuan {requesterName || ""}</DialogTitle>
            <DialogDescription>
              Seluruh Pengajuan Petty Cash yang pernah dibuat requester ini.
            </DialogDescription>
          </DialogHeader>

          <div className="rounded-md border overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-[100px]">Tanggal</TableHead>
                  <TableHead>Kode Pengajuan</TableHead>
                  <TableHead className="w-[130px]">Departemen</TableHead>
                  <TableHead className="w-[130px] text-right">Total</TableHead>
                  <TableHead className="w-[130px]">Status</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {loading ? (
                  <TableRow>
                    <TableCell colSpan={5} className="text-center h-32">
                      <Loader2 className="animate-spin h-6 w-6 mx-auto text-primary" />
                    </TableCell>
                  </TableRow>
                ) : rows.length === 0 ? (
                  <TableRow>
                    <TableCell
                      colSpan={5}
                      className="text-center h-32 text-muted-foreground"
                    >
                      <Wallet className="h-8 w-8 mx-auto mb-2 text-muted-foreground/50" />
                      Belum ada riwayat Pengajuan Petty Cash.
                    </TableCell>
                  </TableRow>
                ) : (
                  rows.map((pj) => (
                    <TableRow key={pj.id}>
                      <TableCell className="text-sm whitespace-nowrap">
                        {formatDate(pj.created_at)}
                      </TableCell>
                      <TableCell
                        className="font-semibold text-sm truncate"
                        title={pj.kode_pengajuan}
                      >
                        {pj.kode_pengajuan}
                      </TableCell>
                      <TableCell
                        className="text-sm truncate"
                        title={pj.department}
                      >
                        {pj.department}
                      </TableCell>
                      <TableCell className="text-right font-semibold text-sm">
                        {formatCurrency(pj.total_amount)}
                      </TableCell>
                      <TableCell>
                        <Badge
                          className={`${
                            PC_PENGAJUAN_STATUS_COLORS[pj.status] ||
                            PC_PENGAJUAN_STATUS_COLOR_DEFAULT
                          } whitespace-nowrap`}
                        >
                          {pj.status}
                        </Badge>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
