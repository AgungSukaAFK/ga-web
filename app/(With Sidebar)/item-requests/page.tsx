// src/app/(With Sidebar)/item-requests/page.tsx

"use client";

import { useEffect, useState } from "react";
import { Content } from "@/components/content";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogDescription,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { createClient } from "@/lib/supabase/client";
import { toast } from "sonner";
import {
  Loader2,
  Check,
  ExternalLink,
  ArrowRight,
  Ban,
  User,
  Package,
  FileText,
  DollarSign,
  Link as LinkIcon,
  Tag,
} from "lucide-react";
import { ItemRequest } from "@/type";
import { format } from "date-fns";
import { CurrencyInput } from "@/components/ui/currency-input";
import { Checkbox } from "@/components/ui/checkbox";
import { Separator } from "@/components/ui/separator";
import { VendorSearchCombobox } from "../barang/tambah/VendorSearchCombobox";

export default function ItemRequestPage() {
  const [requests, setRequests] = useState<ItemRequest[]>([]);
  const [loading, setLoading] = useState(true);

  // State Dialogs
  const [selectedReq, setSelectedReq] = useState<ItemRequest | null>(null);
  const [isProcessOpen, setIsProcessOpen] = useState(false);
  const [isRejectOpen, setIsRejectOpen] = useState(false);
  const [rejectReason, setRejectReason] = useState("");

  // Form Finalisasi
  const [finalForm, setFinalForm] = useState({
    part_number: "",
    part_name: "",
    category: "",
    uom: "",
    vendor: "",
    price: 0,
    link: "",
    is_asset: false,
    admin_notes: "",
  });

  const supabase = createClient();

  // --- 1. FETCH REQUESTS ---
  const fetchRequests = async () => {
    setLoading(true);
    const { data: reqData, error: reqError } = await supabase
      .from("item_requests")
      .select("*")
      .eq("status", "pending")
      .order("created_at", { ascending: false });

    if (reqError) {
      console.error("Error fetching requests:", reqError);
      toast.error("Gagal mengambil data request");
      setLoading(false);
      return;
    }

    if (!reqData || reqData.length === 0) {
      setRequests([]);
      setLoading(false);
      return;
    }

    const uniqueUserIds = Array.from(
      new Set(reqData.map((r) => r.requester_id)),
    ).filter(Boolean);
    let profilesMap: Record<string, any> = {};

    if (uniqueUserIds.length > 0) {
      const { data: profilesData } = await supabase
        .from("profiles")
        .select("id, nama, department")
        .in("id", uniqueUserIds);

      if (profilesData) {
        profilesData.forEach((p) => {
          profilesMap[p.id] = p;
        });
      }
    }

    const mappedRequests = reqData.map((item: any) => {
      const profile = profilesMap[item.requester_id];
      return {
        ...item,
        requester_name: profile?.nama || "Unknown User",
        requester_dept: profile?.department || "-",
      };
    });

    setRequests(mappedRequests);
    setLoading(false);
  };

  useEffect(() => {
    fetchRequests();
  }, []);

  // --- 2. HANDLERS ---
  const handleOpenProcess = (req: ItemRequest) => {
    setSelectedReq(req);
    setFinalForm({
      part_number: "",
      part_name: req.proposed_name,
      category: req.proposed_category,
      uom: req.proposed_uom,
      vendor: "",
      price: 0,
      link: "",
      is_asset: false,
      admin_notes: "",
    });
    setIsProcessOpen(true);
  };

  const handleOpenReject = (req: ItemRequest) => {
    setSelectedReq(req);
    setRejectReason("");
    setIsRejectOpen(true);
  };

  // --- 3. ACTIONS ---
  const handleApprove = async () => {
    if (!selectedReq) return;
    if (!finalForm.part_number || !finalForm.part_name) {
      toast.warning("Part Number & Nama Barang wajib diisi.");
      return;
    }

    const toastId = toast.loading("Menyimpan...");

    try {
      const { error: insertError } = await supabase.from("barang").insert([
        {
          part_number: finalForm.part_number,
          part_name: finalForm.part_name,
          category: finalForm.category,
          uom: finalForm.uom,
          vendor: finalForm.vendor,
          last_purchase_price: finalForm.price,
          link: finalForm.link,
          is_asset: finalForm.is_asset,
          created_at: new Date(),
        },
      ]);

      if (insertError) {
        if (insertError.code === "23505")
          throw new Error("Part Number sudah ada.");
        throw insertError;
      }

      const { error: updateError } = await supabase
        .from("item_requests")
        .update({
          status: "approved",
          admin_notes: `Approved. PN: ${finalForm.part_number}. ${finalForm.admin_notes}`,
          processed_at: new Date(),
        })
        .eq("id", selectedReq.id);

      if (updateError) throw updateError;

      toast.success("Berhasil di-approve!", { id: toastId });
      setIsProcessOpen(false);
      fetchRequests();
    } catch (err: any) {
      toast.error(`Gagal: ${err.message}`, { id: toastId });
    }
  };

  const handleReject = async () => {
    if (!selectedReq) return;
    const notes = isRejectOpen ? rejectReason : finalForm.admin_notes;

    if (!notes) {
      toast.warning("Wajib mengisi alasan penolakan.");
      return;
    }

    const toastId = toast.loading("Menolak...");
    try {
      const { error } = await supabase
        .from("item_requests")
        .update({
          status: "rejected",
          admin_notes: notes,
          processed_at: new Date(),
        })
        .eq("id", selectedReq.id);

      if (error) throw error;
      toast.success("Request ditolak.", { id: toastId });
      setIsProcessOpen(false);
      setIsRejectOpen(false);
      fetchRequests();
    } catch (err: any) {
      toast.error(err.message, { id: toastId });
    }
  };

  return (
    <Content
      title="Daftar Permintaan Barang (Pending)"
      description="List request item baru yang perlu diproses atau ditolak."
      size="lg"
    >
      <div className="rounded-md border bg-card">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-[150px]">Tanggal</TableHead>
              <TableHead className="w-[200px]">Requester</TableHead>
              <TableHead>Item Proposed</TableHead>
              <TableHead>Kategori</TableHead>
              <TableHead>Desc</TableHead>
              <TableHead className="text-right">Aksi</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {loading ? (
              <TableRow>
                <TableCell colSpan={6} className="text-center h-24">
                  <Loader2 className="mx-auto h-6 w-6 animate-spin text-muted-foreground" />
                </TableCell>
              </TableRow>
            ) : requests.length === 0 ? (
              <TableRow>
                <TableCell
                  colSpan={6}
                  className="text-center h-24 text-muted-foreground"
                >
                  Tidak ada permintaan pending.
                </TableCell>
              </TableRow>
            ) : (
              requests.map((req) => (
                <TableRow key={req.id}>
                  <TableCell className="text-xs text-muted-foreground">
                    {format(new Date(req.created_at), "dd MMM yyyy HH:mm")}
                  </TableCell>
                  <TableCell>
                    <div className="flex flex-col">
                      <span className="font-medium text-sm">
                        {(req as any).requester_name}
                      </span>
                      <span className="text-[10px] text-muted-foreground">
                        {(req as any).requester_dept}
                      </span>
                    </div>
                  </TableCell>
                  <TableCell className="font-medium">
                    {req.proposed_name}
                  </TableCell>
                  <TableCell className="text-sm">
                    {req.proposed_category}
                  </TableCell>
                  <TableCell
                    className="max-w-[150px] truncate text-xs text-muted-foreground"
                    title={req.description || ""}
                  >
                    {req.description || "-"}
                  </TableCell>
                  <TableCell className="text-right">
                    <div className="flex justify-end gap-2">
                      <Button
                        size="sm"
                        variant="destructive"
                        onClick={() => handleOpenReject(req)}
                      >
                        Tolak
                      </Button>
                      <Button
                        size="sm"
                        className="bg-blue-600 hover:bg-blue-700"
                        onClick={() => handleOpenProcess(req)}
                      >
                        Proses <ArrowRight className="ml-1 h-3 w-3" />
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>

      {/* --- DIALOG REJECT --- */}
      <Dialog open={isRejectOpen} onOpenChange={setIsRejectOpen}>
        <DialogContent className="sm:max-w-[425px]">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-destructive">
              <Ban className="h-5 w-5" /> Tolak Permintaan
            </DialogTitle>
            <DialogDescription>
              Berikan alasan penolakan untuk{" "}
              <strong>{selectedReq?.proposed_name}</strong>.
            </DialogDescription>
          </DialogHeader>
          <div className="py-2">
            <Label>Alasan Penolakan</Label>
            <Textarea
              placeholder="Contoh: Barang duplikat atau tidak disetujui..."
              value={rejectReason}
              onChange={(e) => setRejectReason(e.target.value)}
              rows={3}
              className="mt-2"
            />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsRejectOpen(false)}>
              Batal
            </Button>
            <Button variant="destructive" onClick={handleReject}>
              Konfirmasi Tolak
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* --- DIALOG PROSES (REVISI: SINGLE COLUMN - 1 BARIS 1 INPUT) --- */}
      {/* Menggunakan max-w-3xl agar lebar tapi fokus di tengah (seperti formulir kertas) */}
      <Dialog open={isProcessOpen} onOpenChange={setIsProcessOpen}>
        <DialogContent className="max-w-3xl w-full max-h-[95vh] overflow-y-auto p-0 gap-0">
          {/* HEADER (Sticky) */}
          <DialogHeader className="p-6 border-b bg-background sticky top-0 z-20">
            <DialogTitle className="text-xl font-bold flex items-center gap-2">
              <Package className="h-5 w-5 text-primary" />
              Proses & Finalisasi Barang
            </DialogTitle>
            <DialogDescription>
              Review permintaan user dan lengkapi data Master Barang di bawah
              ini.
            </DialogDescription>
          </DialogHeader>

          <div className="p-6 md:p-8 space-y-8 bg-muted/5">
            {/* 1. CARD DATA REQUESTER (Highlight Box) */}
            <div className="bg-blue-50/50 border border-blue-100 rounded-lg p-5">
              <h4 className="text-xs font-bold uppercase tracking-wide text-blue-700 flex items-center gap-2 mb-3">
                <User className="h-3 w-3" /> Data Referensi User
              </h4>
              <div className="space-y-3">
                <div className="grid grid-cols-3 gap-4 text-sm">
                  <div>
                    <span className="text-xs text-muted-foreground block">
                      Proposed Name
                    </span>
                    <span className="font-medium text-blue-900">
                      {selectedReq?.proposed_name}
                    </span>
                  </div>
                  <div>
                    <span className="text-xs text-muted-foreground block">
                      Category
                    </span>
                    <span className="font-medium text-blue-900">
                      {selectedReq?.proposed_category}
                    </span>
                  </div>
                  <div>
                    <span className="text-xs text-muted-foreground block">
                      UoM
                    </span>
                    <span className="font-medium text-blue-900">
                      {selectedReq?.proposed_uom}
                    </span>
                  </div>
                </div>
                {selectedReq?.description && (
                  <div className="text-xs text-muted-foreground italic border-t border-blue-100 pt-2 mt-2">
                    "Note User: {selectedReq.description}"
                  </div>
                )}
              </div>
            </div>

            <Separator />

            {/* 2. FORM INPUT MASTER (Single Column / 1 Input per Row) */}
            {/* Menggunakan space-y-5 agar jarak antar input lega */}
            <div className="space-y-6">
              <div className="flex items-center gap-2 mb-4">
                <span className="bg-primary text-primary-foreground text-xs font-bold px-2 py-1 rounded">
                  FORM MASTER BARANG
                </span>
                <span className="text-xs text-muted-foreground ml-auto">
                  * Wajib Diisi
                </span>
              </div>

              {/* Input 1: Part Number */}
              <div className="space-y-2">
                <Label className="text-sm font-semibold">
                  Part Number (Kode Unik){" "}
                  <span className="text-red-500">*</span>
                </Label>
                <Input
                  placeholder="Contoh: EL-LPT-001"
                  value={finalForm.part_number}
                  onChange={(e) =>
                    setFinalForm({ ...finalForm, part_number: e.target.value })
                  }
                  className="h-11 bg-background font-mono border-muted-foreground/30 focus-visible:ring-2 focus-visible:ring-primary"
                />
                <p className="text-[11px] text-muted-foreground">
                  Pastikan Part Number belum pernah digunakan sebelumnya.
                </p>
              </div>

              {/* Input 2: Nama Barang */}
              <div className="space-y-2">
                <Label className="text-sm font-semibold">
                  Nama Barang Resmi <span className="text-red-500">*</span>
                </Label>
                <Input
                  value={finalForm.part_name}
                  onChange={(e) =>
                    setFinalForm({ ...finalForm, part_name: e.target.value })
                  }
                  className="h-11 bg-background border-muted-foreground/30"
                />
              </div>

              {/* Input 3: Kategori */}
              <div className="space-y-2">
                <Label className="text-sm font-semibold flex items-center gap-2">
                  <Tag className="h-3 w-3" /> Kategori Barang
                </Label>
                <Input
                  value={finalForm.category}
                  onChange={(e) =>
                    setFinalForm({ ...finalForm, category: e.target.value })
                  }
                  className="h-11 bg-background border-muted-foreground/30"
                />
              </div>

              {/* Input 4: UoM */}
              <div className="space-y-2">
                <Label className="text-sm font-semibold">Satuan (UoM)</Label>
                <Input
                  value={finalForm.uom}
                  onChange={(e) =>
                    setFinalForm({ ...finalForm, uom: e.target.value })
                  }
                  className="h-11 bg-background border-muted-foreground/30"
                  placeholder="PCS, UNIT, SET..."
                />
              </div>

              {/* Input 5: Vendor */}
              <div className="space-y-2">
                <Label className="text-sm font-semibold">
                  Vendor Default (Opsional)
                </Label>
                <div className="h-11">
                  <VendorSearchCombobox
                    defaultValue={finalForm.vendor}
                    onSelect={(val) =>
                      setFinalForm({ ...finalForm, vendor: val })
                    }
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-6">
                {/* Input 6: Harga */}
                <div className="space-y-2">
                  <Label className="text-sm font-semibold flex items-center gap-2">
                    <DollarSign className="h-3 w-3" /> Harga Referensi
                  </Label>
                  <CurrencyInput
                    value={finalForm.price}
                    onValueChange={(val) =>
                      setFinalForm({ ...finalForm, price: val })
                    }
                    className="h-11 bg-background border-muted-foreground/30"
                  />
                </div>

                {/* Input 7: Link */}
                <div className="space-y-2">
                  <Label className="text-sm font-semibold flex items-center gap-2">
                    <LinkIcon className="h-3 w-3" /> Link Pembelian
                  </Label>
                  <div className="relative">
                    <Input
                      value={finalForm.link}
                      onChange={(e) =>
                        setFinalForm({ ...finalForm, link: e.target.value })
                      }
                      placeholder="https://..."
                      className="h-11 pr-10 bg-background border-muted-foreground/30"
                    />
                    {finalForm.link && (
                      <a
                        href={finalForm.link}
                        target="_blank"
                        rel="noreferrer"
                        className="absolute right-3 top-1/2 -translate-y-1/2 bg-muted p-1 rounded hover:bg-muted/80"
                      >
                        <ExternalLink className="h-4 w-4" />
                      </a>
                    )}
                  </div>
                </div>
              </div>

              {/* Input 8: Checkbox Asset */}
              <div
                className="flex items-center space-x-3 p-4 border rounded-md bg-muted/10 cursor-pointer hover:bg-muted/20 transition-all"
                onClick={() =>
                  setFinalForm((p) => ({ ...p, is_asset: !p.is_asset }))
                }
              >
                <Checkbox
                  id="is-asset-final"
                  checked={finalForm.is_asset}
                  onCheckedChange={(c) =>
                    setFinalForm({ ...finalForm, is_asset: c as boolean })
                  }
                />
                <div className="grid gap-0.5">
                  <Label
                    htmlFor="is-asset-final"
                    className="cursor-pointer font-semibold text-sm"
                  >
                    Tandai sebagai Fixed Asset
                  </Label>
                  <span className="text-xs text-muted-foreground">
                    Barang ini akan dicatat sebagai aset perusahaan, bukan
                    barang habis pakai.
                  </span>
                </div>
              </div>

              {/* Input 9: Notes */}
              <div className="space-y-2">
                <Label className="text-sm font-semibold flex items-center gap-2">
                  <FileText className="h-3 w-3" /> Catatan Admin
                </Label>
                <Textarea
                  placeholder="Tulis catatan approval di sini..."
                  value={finalForm.admin_notes}
                  onChange={(e) =>
                    setFinalForm({ ...finalForm, admin_notes: e.target.value })
                  }
                  className="min-h-[100px] bg-background border-muted-foreground/30 resize-none p-3"
                />
              </div>
            </div>
          </div>

          {/* FOOTER (Sticky Bottom) */}
          <DialogFooter className="p-6 border-t bg-background sticky bottom-0 z-20 gap-3">
            <Button
              variant="outline"
              size="lg"
              className="h-12 px-6 flex-1 sm:flex-none"
              onClick={() => setIsProcessOpen(false)}
            >
              Batal
            </Button>
            <Button
              size="lg"
              className="h-12 px-8 bg-green-600 hover:bg-green-700 text-base font-semibold flex-1 sm:flex-none min-w-[200px]"
              onClick={handleApprove}
            >
              <Check className="mr-2 h-5 w-5" /> Simpan & Approve
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Content>
  );
}
