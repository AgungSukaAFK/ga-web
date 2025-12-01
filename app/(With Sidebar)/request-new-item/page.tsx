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
import { createClient } from "@/lib/supabase/client";
import { useState, useEffect } from "react";
import { toast } from "sonner";
import { Loader2, Send, RefreshCcw } from "lucide-react";
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
        return <Badge className="bg-green-500">Disetujui</Badge>;
      case "rejected":
        return <Badge variant="destructive">Ditolak</Badge>;
      default:
        return <Badge variant="secondary">Menunggu</Badge>;
    }
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
                <TableHead>Status</TableHead>
                <TableHead>Catatan Admin</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {loadingHistory ? (
                <TableRow>
                  <TableCell colSpan={5} className="text-center h-24">
                    <Loader2 className="animate-spin mx-auto" />
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
                  <TableRow key={req.id}>
                    <TableCell>{formatDateFriendly(req.created_at)}</TableCell>
                    <TableCell className="font-medium">
                      {req.proposed_name}
                    </TableCell>
                    <TableCell>{req.proposed_category}</TableCell>
                    <TableCell>{getStatusBadge(req.status)}</TableCell>
                    <TableCell className="text-muted-foreground text-sm italic">
                      {req.admin_notes || "-"}
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </div>
      </Content>
    </>
  );
}
