// src/app/(With Sidebar)/request-new-item/page.tsx

"use client";

import { Content } from "@/components/content";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
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
import { createClient } from "@/lib/supabase/client";
import { useState, useEffect } from "react";
import { toast } from "sonner";
import { Loader2, Send, RefreshCcw, Eye, FileText, Info } from "lucide-react";
import { useRouter } from "next/navigation";
import { formatDateFriendly } from "@/lib/utils";
import { ItemRequest } from "@/type";

export default function RequestNewItemPage() {
  const router = useRouter();
  const supabase = createClient();
  const [loading, setLoading] = useState(false);

  // State untuk Riwayat
  const [myRequests, setMyRequests] = useState<ItemRequest[]>([]);
  const [loadingHistory, setLoadingHistory] = useState(true);

  // State untuk Dialog Detail
  const [isViewDialogOpen, setIsViewDialogOpen] = useState(false);
  const [selectedRequest, setSelectedRequest] = useState<ItemRequest | null>(
    null,
  );

  const [formData, setFormData] = useState({
    proposed_name: "",
    proposed_category: "",
    proposed_uom: "",
    description: "",
  });

  // Load Riwayat Request
  const fetchMyRequests = async () => {
    setLoadingHistory(true);
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (user) {
      const { data, error } = await supabase
        .from("item_requests")
        .select("*")
        .eq("requester_id", user.id)
        .order("created_at", { ascending: false });

      if (!error && data) {
        setMyRequests(data as any);
      }
    }
    setLoadingHistory(false);
  };

  useEffect(() => {
    fetchMyRequests();
  }, []);

  const handleSubmit = async () => {
    if (
      !formData.proposed_name ||
      !formData.proposed_category ||
      !formData.proposed_uom
    ) {
      toast.error("Nama, Kategori, dan UoM wajib diisi.");
      return;
    }

    setLoading(true);
    try {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) throw new Error("User tidak ditemukan");

      const { error } = await supabase.from("item_requests").insert({
        requester_id: user.id,
        proposed_name: formData.proposed_name,
        proposed_category: formData.proposed_category,
        proposed_uom: formData.proposed_uom,
        description: formData.description,
        status: "pending",
      });

      if (error) throw error;

      toast.success("Request barang berhasil dikirim!");
      setFormData({
        proposed_name: "",
        proposed_category: "",
        proposed_uom: "",
        description: "",
      });
      fetchMyRequests(); // Refresh tabel
    } catch (error: any) {
      toast.error("Gagal mengirim request", { description: error.message });
    } finally {
      setLoading(false);
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "approved":
        return (
          <Badge className="bg-green-500 hover:bg-green-600">Disetujui</Badge>
        );
      case "rejected":
        return <Badge variant="destructive">Ditolak</Badge>;
      default:
        return <Badge variant="secondary">Menunggu</Badge>;
    }
  };

  // Handler untuk membuka dialog
  const handleViewDetails = (req: ItemRequest) => {
    setSelectedRequest(req);
    setIsViewDialogOpen(true);
  };

  return (
    <>
      <Content
        title="Request Barang Baru"
        description="Ajukan penambahan item baru ke database Master Barang."
      >
        <div className="max-w-2xl space-y-4">
          <div className="grid gap-2">
            <Label>Nama Barang (Usulan)</Label>
            <Input
              placeholder="Contoh: Laptop Dell Latitude 5420"
              value={formData.proposed_name}
              onChange={(e) =>
                setFormData({ ...formData, proposed_name: e.target.value })
              }
              disabled={loading}
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="grid gap-2">
              <Label>Kategori</Label>
              <Input
                placeholder="Contoh: IT Asset"
                value={formData.proposed_category}
                onChange={(e) =>
                  setFormData({
                    ...formData,
                    proposed_category: e.target.value,
                  })
                }
                disabled={loading}
              />
            </div>
            <div className="grid gap-2">
              <Label>Satuan (UoM)</Label>
              <Input
                placeholder="Pcs, Unit"
                value={formData.proposed_uom}
                onChange={(e) =>
                  setFormData({ ...formData, proposed_uom: e.target.value })
                }
                disabled={loading}
              />
            </div>
          </div>

          <div className="grid gap-2">
            <Label>Keterangan / Link Referensi</Label>
            <Textarea
              placeholder="Sertakan link pembelian atau spesifikasi..."
              rows={3}
              value={formData.description}
              onChange={(e) =>
                setFormData({ ...formData, description: e.target.value })
              }
              disabled={loading}
            />
          </div>

          <div className="pt-2">
            <Button onClick={handleSubmit} disabled={loading}>
              {loading ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : (
                <Send className="mr-2 h-4 w-4" />
              )}
              Kirim Request
            </Button>
          </div>
        </div>
      </Content>

      <Content
        title="Riwayat Pengajuan Saya"
        size="lg"
        cardAction={
          <Button variant="ghost" size="sm" onClick={fetchMyRequests}>
            <RefreshCcw className="h-4 w-4" />
          </Button>
        }
      >
        <div className="rounded-md border overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Tanggal</TableHead>
                <TableHead>Nama Barang</TableHead>
                <TableHead>Kategori</TableHead>
                <TableHead>Detail</TableHead>
                <TableHead>Status</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {loadingHistory ? (
                <TableRow>
                  <TableCell colSpan={5} className="text-center h-24">
                    <Loader2 className="animate-spin mx-auto text-primary" />
                  </TableCell>
                </TableRow>
              ) : myRequests.length === 0 ? (
                <TableRow>
                  <TableCell
                    colSpan={5}
                    className="text-center h-24 text-muted-foreground"
                  >
                    Belum ada riwayat pengajuan.
                  </TableCell>
                </TableRow>
              ) : (
                myRequests.map((req) => (
                  <TableRow
                    key={req.id}
                    className="cursor-pointer hover:bg-muted/50 transition-colors"
                    onClick={() => handleViewDetails(req)}
                  >
                    <TableCell className="whitespace-nowrap">
                      {formatDateFriendly(req.created_at)}
                    </TableCell>
                    <TableCell
                      className="font-medium max-w-[200px] truncate"
                      title={req.proposed_name}
                    >
                      {req.proposed_name}
                    </TableCell>
                    <TableCell>{req.proposed_category}</TableCell>

                    {/* KOLOM DETAIL DENGAN TOMBOL VIEW */}
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <span className="text-xs font-semibold px-2 py-0.5 bg-muted rounded w-fit border">
                          {req.proposed_uom}
                        </span>
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-7 px-2 text-xs text-primary hover:text-primary"
                          onClick={(e) => {
                            e.stopPropagation();
                            handleViewDetails(req);
                          }}
                        >
                          <Eye className="h-3 w-3 mr-1" /> Lihat
                        </Button>
                      </div>
                    </TableCell>

                    <TableCell>
                      <div className="flex flex-col gap-1 items-start">
                        {getStatusBadge(req.status)}
                        {req.admin_notes && (
                          <span
                            className="text-[10px] text-amber-600 bg-amber-50 px-1.5 py-0.5 rounded flex items-center gap-1 border border-amber-200 truncate max-w-[120px]"
                            title={req.admin_notes}
                          >
                            <Info className="h-3 w-3" /> Ada Catatan
                          </span>
                        )}
                      </div>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </div>
      </Content>

      {/* DIALOG POPUP DETAIL YANG SUDAH DIBERESIN OVERFLOW-NYA */}
      <Dialog open={isViewDialogOpen} onOpenChange={setIsViewDialogOpen}>
        {/* FIX 1: set max-h-[85vh] dan flex-col agar bentuknya rapi dan tidak lewat dari layar */}
        <DialogContent className="sm:max-w-md max-h-[85vh] flex flex-col">
          <DialogHeader className="shrink-0">
            <DialogTitle className="flex items-center gap-2">
              <FileText className="h-5 w-5 text-primary" />
              Detail Pengajuan Barang
            </DialogTitle>
            <DialogDescription>
              Rincian usulan item baru ke master data.
            </DialogDescription>
          </DialogHeader>
          {selectedRequest && (
            <div className="space-y-4 py-2 overflow-y-auto pr-2">
              <div className="grid grid-cols-2 gap-4 text-sm bg-muted/30 p-4 rounded-lg border">
                <div className="space-y-1">
                  <span className="text-muted-foreground block text-xs font-medium">
                    Nama Barang
                  </span>

                  {/* FIX 3: break-words agar teks tidak melebar ke samping */}
                  <span className="font-semibold break-words">
                    {selectedRequest.proposed_name}
                  </span>
                </div>
                <div className="space-y-1">
                  <span className="text-muted-foreground block text-xs font-medium">
                    Status
                  </span>
                  <span>{getStatusBadge(selectedRequest.status)}</span>
                </div>
                <div className="space-y-1">
                  <span className="text-muted-foreground block text-xs font-medium">
                    Kategori
                  </span>
                  <span className="break-words">
                    {selectedRequest.proposed_category}
                  </span>
                </div>
                <div className="space-y-1 overflow-hidden">
                  <span className="text-muted-foreground block text-xs font-medium">
                    Satuan (UoM)
                  </span>
                  <span className="font-mono bg-background px-1.5 py-0.5 rounded border text-xs break-words inline-block max-w-full">
                    {selectedRequest.proposed_uom}
                  </span>
                </div>
              </div>

              <div className="space-y-1.5">
                <span className="text-muted-foreground block text-xs font-medium">
                  Keterangan / Link Referensi
                </span>
                {/* FIX 4: break-words sangat krusial di sini kalau ada link yang sangat panjang */}
                <div className="p-3 bg-muted/50 rounded-md text-sm whitespace-pre-wrap break-words border">
                  {selectedRequest.description ? (
                    selectedRequest.description
                  ) : (
                    <span className="italic text-muted-foreground text-xs">
                      Tidak ada keterangan yang dilampirkan.
                    </span>
                  )}
                </div>
              </div>

              {selectedRequest.admin_notes && (
                <div className="space-y-1.5 pt-2">
                  <span className="text-amber-700 font-semibold text-xs flex items-center gap-1">
                    <Info className="h-3 w-3" /> Catatan Admin / General Affair
                  </span>
                  <div className="p-3 bg-amber-50 dark:bg-amber-950/20 text-amber-900 dark:text-amber-200 border border-amber-200 dark:border-amber-900 rounded-md text-sm italic break-words">
                    {selectedRequest.admin_notes}
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
