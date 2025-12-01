// src/app/(With Sidebar)/barang/requests/page.tsx

"use client";

import { Content } from "@/components/content";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
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
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { createClient } from "@/lib/supabase/client";
import { ItemRequest } from "@/type";
import { Check, Loader2, X, History } from "lucide-react";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { formatDateFriendly } from "@/lib/utils";

export default function ManageItemRequestsPage() {
  const [requests, setRequests] = useState<ItemRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [filterStatus, setFilterStatus] = useState<string>("pending"); // 'pending' | 'all'

  // State Dialog Approve
  const [selectedReq, setSelectedReq] = useState<ItemRequest | null>(null);
  const [isApproveOpen, setIsApproveOpen] = useState(false);
  const [finalData, setFinalData] = useState({
    part_number: "",
    part_name: "",
    category: "",
    uom: "",
  });

  const supabase = createClient();

  const fetchRequests = async () => {
    setLoading(true);
    let query = supabase
      .from("item_requests")
      .select(`*, users_with_profiles!requester_id(nama, department)`)
      .order("created_at", { ascending: false });

    if (filterStatus === "pending") {
      query = query.eq("status", "pending");
    }

    const { data, error } = await query;

    if (error) {
      toast.error("Gagal memuat request");
    } else {
      setRequests(data as any);
    }
    setLoading(false);
  };

  useEffect(() => {
    fetchRequests();
  }, [filterStatus]);

  const handleOpenApprove = (req: ItemRequest) => {
    setSelectedReq(req);
    setFinalData({
      part_number: "",
      part_name: req.proposed_name,
      category: req.proposed_category,
      uom: req.proposed_uom,
    });
    setIsApproveOpen(true);
  };

  const handleConfirmApprove = async () => {
    if (!selectedReq) return;
    if (!finalData.part_number) {
      toast.error("Part Number wajib diisi.");
      return;
    }

    try {
      const { error: barangError } = await supabase.from("barang").insert({
        part_number: finalData.part_number,
        part_name: finalData.part_name,
        category: finalData.category,
        uom: finalData.uom,
        vendor: null,
        is_asset: false,
      });

      if (barangError) throw barangError;

      const {
        data: { user },
      } = await supabase.auth.getUser();
      await supabase
        .from("item_requests")
        .update({
          status: "approved",
          processed_by: user?.id,
          processed_at: new Date().toISOString(),
          admin_notes: `Added as Part Number: ${finalData.part_number}`,
        })
        .eq("id", selectedReq.id);

      toast.success("Barang berhasil ditambahkan!");
      setIsApproveOpen(false);
      fetchRequests();
    } catch (error: any) {
      if (error.code === "23505") {
        toast.error("Part Number sudah ada di database.");
      } else {
        toast.error("Gagal memproses: " + error.message);
      }
    }
  };

  const handleReject = async (id: number) => {
    const reason = prompt("Masukkan alasan penolakan:");
    if (!reason) return;

    const {
      data: { user },
    } = await supabase.auth.getUser();
    const { error } = await supabase
      .from("item_requests")
      .update({
        status: "rejected",
        processed_by: user?.id,
        processed_at: new Date().toISOString(),
        admin_notes: reason,
      })
      .eq("id", id);

    if (error) toast.error("Gagal menolak request");
    else {
      toast.success("Request ditolak.");
      fetchRequests();
    }
  };

  return (
    <>
      <Content
        title="Incoming Item Requests"
        description="Kelola permintaan barang baru dari user."
        size="lg"
        cardAction={
          <Select value={filterStatus} onValueChange={setFilterStatus}>
            <SelectTrigger className="w-[150px]">
              <SelectValue placeholder="Filter" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="pending">Pending (Baru)</SelectItem>
              <SelectItem value="all">Semua Riwayat</SelectItem>
            </SelectContent>
          </Select>
        }
      >
        <div className="rounded-md border overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Tanggal</TableHead>
                <TableHead>Requester</TableHead>
                <TableHead>Usulan Nama</TableHead>
                <TableHead>Keterangan</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Tanggal Pengusulan</TableHead>
                <TableHead className="text-right">Aksi</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {loading ? (
                <TableRow>
                  <TableCell colSpan={6} className="text-center h-24">
                    <Loader2 className="animate-spin mx-auto" />
                  </TableCell>
                </TableRow>
              ) : requests.length === 0 ? (
                <TableRow>
                  <TableCell
                    colSpan={6}
                    className="text-center h-24 text-muted-foreground"
                  >
                    Tidak ada data.
                  </TableCell>
                </TableRow>
              ) : (
                requests.map((req) => (
                  <TableRow key={req.id}>
                    <TableCell className="text-sm text-muted-foreground">
                      {formatDateFriendly(req.created_at)}
                    </TableCell>
                    <TableCell>
                      <div className="font-medium">
                        {req.users_with_profiles?.nama || "Unknown"}
                      </div>
                      <div className="text-xs text-muted-foreground">
                        {req.users_with_profiles?.department}
                      </div>
                    </TableCell>
                    <TableCell>
                      {req.proposed_name}
                      <div className="text-xs text-muted-foreground">
                        {req.proposed_category} | {req.proposed_uom}
                      </div>
                    </TableCell>
                    <TableCell
                      className="max-w-xs truncate"
                      title={req.description || ""}
                    >
                      {req.description || "-"}
                    </TableCell>
                    <TableCell>
                      {req.status === "pending" ? (
                        <Badge variant="secondary">Pending</Badge>
                      ) : req.status === "approved" ? (
                        <Badge className="bg-green-500">Approved</Badge>
                      ) : (
                        <Badge variant="destructive">Rejected</Badge>
                      )}
                    </TableCell>
                    <TableCell>{formatDateFriendly(req.created_at)}</TableCell>
                    <TableCell className="text-right space-x-2">
                      {req.status === "pending" && (
                        <>
                          <Button
                            size="sm"
                            variant="default"
                            onClick={() => handleOpenApprove(req)}
                          >
                            <Check className="h-4 w-4 mr-1" /> Process
                          </Button>
                          <Button
                            size="sm"
                            variant="destructive"
                            onClick={() => handleReject(req.id)}
                          >
                            <X className="h-4 w-4" />
                          </Button>
                        </>
                      )}
                      {req.status !== "pending" && (
                        <span className="text-xs text-muted-foreground italic">
                          {req.admin_notes
                            ? `Note: ${req.admin_notes}`
                            : "Selesai"}
                        </span>
                      )}
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </div>
      </Content>

      <Dialog open={isApproveOpen} onOpenChange={setIsApproveOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Tambahkan ke Master Barang</DialogTitle>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="grid gap-2">
              <Label>Part Number (Wajib)</Label>
              <Input
                placeholder="Generate/Input Part Number"
                value={finalData.part_number}
                onChange={(e) =>
                  setFinalData({ ...finalData, part_number: e.target.value })
                }
              />
            </div>
            <div className="grid gap-2">
              <Label>Nama Barang</Label>
              <Input
                value={finalData.part_name}
                onChange={(e) =>
                  setFinalData({ ...finalData, part_name: e.target.value })
                }
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="grid gap-2">
                <Label>Kategori</Label>
                <Input
                  value={finalData.category}
                  onChange={(e) =>
                    setFinalData({ ...finalData, category: e.target.value })
                  }
                />
              </div>
              <div className="grid gap-2">
                <Label>UoM</Label>
                <Input
                  value={finalData.uom}
                  onChange={(e) =>
                    setFinalData({ ...finalData, uom: e.target.value })
                  }
                />
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsApproveOpen(false)}>
              Batal
            </Button>
            <Button onClick={handleConfirmApprove}>Simpan ke Database</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
