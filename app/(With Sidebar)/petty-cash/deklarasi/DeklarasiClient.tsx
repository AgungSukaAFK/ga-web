// src/app/(With Sidebar)/petty-cash/deklarasi/DeklarasiClient.tsx
//
// Requester bikin Deklarasi dari salah satu Sub-Voucher miliknya (tarikan
// dana parsial, lihat services/pettyCashSubVoucherService.ts) yang belum
// pernah dideklarasikan. Item AWAL disalin dari Voucher INDUKnya (bukan
// dari sub-voucher-nya sendiri - sub-voucher cuma nominal, tidak punya
// rincian barang sendiri), tapi qty/harga satuan/catatan per baris BOLEH
// disesuaikan ke pemakaian riil (struk asli kadang beda dari rencana) -
// lihat createDeklarasiFromSubVoucher, services/pettyCashDeklarasiService.ts.
// Begitu dikirim, Deklarasi langsung masuk jalur approval-nya sendiri
// (Template Approval ber-approval_type "Approval Deklarasi").

"use client";

import { useEffect, useRef, useState } from "react";
import { Content } from "@/components/content";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  RichMentionEditor,
  RichMentionEditorHandle,
} from "@/components/rich-mention-editor";
import { stringifyRichContent } from "@/lib/rich-content";
import { CurrencyInput } from "@/components/ui/currency-input";
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
import { uploadAttachmentDirect } from "@/lib/uploadDirect";
import {
  getAttachmentSizeError,
  getUploadErrorMessage,
} from "@/lib/attachments";
import { formatCurrency } from "@/lib/utils";
import { toast } from "sonner";
import { Attachment, PettyCashDeklarasi, PettyCashSubVoucher } from "@/type";
import {
  PC_DEKLARASI_STATUS_COLORS,
  PC_DEKLARASI_STATUS_COLOR_DEFAULT,
} from "@/type/enum";
import {
  fetchMyDeklarasi,
  createDeklarasiFromSubVoucher,
} from "@/services/pettyCashDeklarasiService";
import { fetchSubVouchersForDeklarasi } from "@/services/pettyCashSubVoucherService";
import Link from "next/link";
import {
  Loader2,
  RefreshCcw,
  FileCheck2,
  FileText,
  CalendarDays,
  UploadCloud,
  X,
  Eye,
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
      PC_DEKLARASI_STATUS_COLORS[status] || PC_DEKLARASI_STATUS_COLOR_DEFAULT
    }`}
  >
    {status}
  </Badge>
);

type DeclareRow = {
  barang_id: number | null;
  part_name: string;
  category: string | null;
  uom: string | null;
  qty: string;
  unit_price: number;
  note: string;
  // COA baris ini - dibawa apa adanya dari item Voucher asalnya, TIDAK
  // bisa diubah di Deklarasi (lihat komentar coa di PettyCashPengajuanItem,
  // type/index.ts).
  coa: "GMI" | "GIS" | null;
};

export default function DeklarasiClient() {
  const notesEditorRef = useRef<RichMentionEditorHandle>(null);
  const supabase = createClient();

  const [userId, setUserId] = useState<string | null>(null);
  const [eligible, setEligible] = useState<PettyCashSubVoucher[]>([]);
  const [deklarasiList, setDeklarasiList] = useState<PettyCashDeklarasi[]>([]);
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const [uploading, setUploading] = useState(false);

  const [selected, setSelected] = useState<PettyCashSubVoucher | null>(null);
  const [rows, setRows] = useState<DeclareRow[]>([]);
  const [notes, setNotes] = useState("");
  const [attachments, setAttachments] = useState<Attachment[]>([]);

  const loadData = async () => {
    setLoading(true);
    try {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) throw new Error("Tidak terautentikasi.");
      setUserId(user.id);

      const [eligibleData, deklarasiData] = await Promise.all([
        fetchSubVouchersForDeklarasi(user.id),
        fetchMyDeklarasi(user.id),
      ]);
      setEligible(eligibleData);
      setDeklarasiList(deklarasiData);
    } catch (error: any) {
      toast.error("Gagal memuat data", { description: error.message });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const openDeclareForm = (subVoucher: PettyCashSubVoucher) => {
    setSelected(subVoucher);
    setRows(
      (subVoucher.petty_cash_voucher?.items ?? []).map((it) => ({
        barang_id: it.barang_id,
        part_name: it.part_name,
        category: it.category,
        uom: it.uom,
        qty: String(it.qty),
        unit_price: it.unit_price,
        note: it.note || "",
        coa: it.coa ?? null,
      })),
    );
    setNotes("");
    setAttachments([]);
  };

  const closeDeclareForm = () => {
    setSelected(null);
    setRows([]);
  };

  const updateRow = (index: number, patch: Partial<DeclareRow>) => {
    setRows((prev) =>
      prev.map((r, i) => (i === index ? { ...r, ...patch } : r)),
    );
  };

  const totalAmount = rows.reduce(
    (sum, r) => sum + (Number(r.qty) || 0) * (r.unit_price || 0),
    0,
  );

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const sizeError = getAttachmentSizeError(file);
    if (sizeError) {
      return toast.error("Ukuran file terlalu besar", {
        description: sizeError,
      });
    }

    setUploading(true);
    try {
      const fileExt = file.name.split(".").pop();
      const fileName = `${Date.now()}-${Math.random().toString(36).substring(2)}.${fileExt}`;
      const filePath = `petty-cash-deklarasi/${fileName}`;

      const result = await uploadAttachmentDirect(file, filePath);
      if (!result.success) throw new Error(result.message);

      setAttachments((prev) => [...prev, { url: result.url, name: file.name }]);
      toast.success("Lampiran berhasil diunggah");
    } catch (error: any) {
      toast.error("Gagal mengunggah file", {
        description: getUploadErrorMessage(error),
      });
    } finally {
      setUploading(false);
      e.target.value = "";
    }
  };

  const removeAttachment = (index: number) =>
    setAttachments((prev) => prev.filter((_, i) => i !== index));

  const handleSubmit = async () => {
    if (!selected || !userId) return;
    if (rows.some((r) => !Number(r.qty) || Number(r.qty) <= 0)) {
      return toast.error("Qty setiap barang wajib diisi dan lebih dari 0.");
    }

    setCreating(true);
    try {
      const deklarasi = await createDeklarasiFromSubVoucher(
        {
          sub_voucher_id: selected.id,
          voucher_id: selected.voucher_id,
          company_code: selected.petty_cash_voucher?.company_code || "",
          department: selected.petty_cash_voucher?.department || "",
          cost_center_id: selected.petty_cash_voucher?.cost_center_id ?? null,
          week_of_month: selected.petty_cash_voucher?.week_of_month ?? null,
          site: selected.petty_cash_voucher?.site ?? null,
          notes,
          items: rows.map((r) => ({
            barang_id: r.barang_id,
            part_name: r.part_name,
            category: r.category,
            uom: r.uom,
            qty: Number(r.qty),
            unit_price: r.unit_price,
            subtotal: Number(r.qty) * r.unit_price,
            note: r.note.trim() || null,
            coa: r.coa,
          })),
          total_amount: totalAmount,
          attachments,
        },
        userId,
      );
      toast.success(
        `Deklarasi ${deklarasi.kode_deklarasi} berhasil dikirim dan masuk jalur approval.`,
      );
      closeDeclareForm();
      await loadData();
    } catch (error: any) {
      toast.error("Gagal mengirim deklarasi", { description: error.message });
    } finally {
      setCreating(false);
    }
  };

  return (
    <>
      <Content
        title="Deklarasi Petty Cash"
        description="Laporkan pemakaian riil dana Petty Cash yang sudah dicairkan."
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
              <FileCheck2 className="h-4 w-4 text-primary" />
              Sub-Voucher Siap Dideklarasikan
            </h3>
            <div className="rounded-md border overflow-x-auto">
              <Table className="min-w-[700px]">
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-[200px]">
                      Kode Sub-Voucher
                    </TableHead>
                    <TableHead className="w-[180px]">Dari Voucher</TableHead>
                    <TableHead className="w-[150px] text-right">
                      Nominal Dicairkan
                    </TableHead>
                    <TableHead className="w-[140px]">Ditarik</TableHead>
                    <TableHead className="w-[160px] text-center">
                      Aksi
                    </TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {loading ? (
                    <TableRow>
                      <TableCell colSpan={5} className="text-center h-28">
                        <Loader2 className="animate-spin h-6 w-6 mx-auto text-primary" />
                      </TableCell>
                    </TableRow>
                  ) : eligible.length === 0 ? (
                    <TableRow>
                      <TableCell
                        colSpan={5}
                        className="text-center h-28 text-muted-foreground"
                      >
                        Belum ada Sub-Voucher yang siap dideklarasikan.
                      </TableCell>
                    </TableRow>
                  ) : (
                    eligible.map((sv) => (
                      <TableRow key={sv.id}>
                        <TableCell className="font-semibold text-sm">
                          {sv.kode_sub_voucher}
                        </TableCell>
                        <TableCell className="text-sm text-muted-foreground">
                          {sv.petty_cash_voucher?.kode_voucher || "-"}
                        </TableCell>
                        <TableCell className="text-right font-medium text-sm">
                          {formatCurrency(sv.amount)}
                        </TableCell>
                        <TableCell className="text-sm">
                          {formatDate(sv.created_at)}
                        </TableCell>
                        <TableCell className="text-center">
                          <Button
                            size="sm"
                            onClick={() => openDeclareForm(sv)}
                          >
                            Buat Deklarasi
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
              <FileText className="h-4 w-4 text-primary" />
              Deklarasi Saya
            </h3>
            <div className="rounded-md border overflow-x-auto">
              <Table className="min-w-[750px]">
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-[180px]">Kode Deklarasi</TableHead>
                    <TableHead className="w-[180px]">Dari Voucher</TableHead>
                    <TableHead className="w-[150px] text-right">
                      Nominal Riil
                    </TableHead>
                    <TableHead className="w-[140px]">Status</TableHead>
                    <TableHead className="w-[60px] text-center">
                      Aksi
                    </TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {loading ? (
                    <TableRow>
                      <TableCell colSpan={5} className="text-center h-28">
                        <Loader2 className="animate-spin h-6 w-6 mx-auto text-primary" />
                      </TableCell>
                    </TableRow>
                  ) : deklarasiList.length === 0 ? (
                    <TableRow>
                      <TableCell
                        colSpan={5}
                        className="text-center h-28 text-muted-foreground"
                      >
                        Belum ada Deklarasi yang dibuat.
                      </TableCell>
                    </TableRow>
                  ) : (
                    deklarasiList.map((d) => (
                      <TableRow key={d.id}>
                        <TableCell className="font-semibold text-sm">
                          {d.kode_deklarasi}
                        </TableCell>
                        <TableCell className="text-sm text-muted-foreground">
                          {d.petty_cash_voucher?.kode_voucher || "-"}
                        </TableCell>
                        <TableCell className="text-right font-medium text-sm">
                          {formatCurrency(d.total_amount)}
                        </TableCell>
                        <TableCell>
                          <StatusBadge status={d.status} />
                        </TableCell>
                        <TableCell className="text-center">
                          <Button
                            asChild
                            variant="ghost"
                            size="icon"
                            className="h-7 w-7 text-muted-foreground hover:text-primary"
                          >
                            <Link
                              href={`/petty-cash/deklarasi/${d.id}`}
                              target="_blank"
                            >
                              <Eye className="h-4 w-4" />
                            </Link>
                          </Button>
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

      {/* DIALOG FORM DEKLARASI - QTY/HARGA/CATATAN BOLEH DISESUAIKAN */}
      <Dialog
        open={!!selected}
        onOpenChange={(open) => !open && closeDeclareForm()}
      >
        <DialogContent className="sm:max-w-3xl max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>
              Deklarasi dari {selected?.kode_sub_voucher}
            </DialogTitle>
            <DialogDescription>
              Sesuaikan qty/harga satuan tiap barang ke pemakaian riil
              (berdasarkan struk asli).{" "}
              {selected && (
                <span className="inline-flex items-center gap-1">
                  <CalendarDays className="h-3 w-3" />
                  Ditarik {formatDate(selected.created_at)} - Nominal
                  Tarikan {formatCurrency(selected.amount)}
                </span>
              )}
            </DialogDescription>
          </DialogHeader>

          {selected && (
            <div className="space-y-4">
              <div className="overflow-x-auto rounded-md border">
                <Table className="min-w-[650px]">
                  <TableHeader>
                    <TableRow>
                      <TableHead className="min-w-[160px]">
                        Nama Barang
                      </TableHead>
                      <TableHead className="w-[90px]">Qty</TableHead>
                      <TableHead className="w-[150px]">
                        Harga Satuan
                      </TableHead>
                      <TableHead className="w-[120px] text-right">
                        Subtotal
                      </TableHead>
                      <TableHead className="min-w-[160px]">Catatan</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {rows.map((r, i) => (
                      <TableRow key={i}>
                        <TableCell>
                          <div className="font-medium">{r.part_name}</div>
                          {r.category && (
                            <div className="text-xs text-muted-foreground">
                              {r.category}
                            </div>
                          )}
                        </TableCell>
                        <TableCell>
                          <Input
                            type="number"
                            min={0}
                            value={r.qty}
                            onChange={(e) =>
                              updateRow(i, { qty: e.target.value })
                            }
                            className="h-9 w-20"
                          />
                        </TableCell>
                        <TableCell>
                          <CurrencyInput
                            value={r.unit_price}
                            onValueChange={(val) =>
                              updateRow(i, { unit_price: val })
                            }
                            className="h-9"
                          />
                        </TableCell>
                        <TableCell className="text-right font-mono text-sm">
                          {formatCurrency(
                            (Number(r.qty) || 0) * (r.unit_price || 0),
                          )}
                        </TableCell>
                        <TableCell>
                          <Input
                            value={r.note}
                            onChange={(e) =>
                              updateRow(i, { note: e.target.value })
                            }
                            placeholder="-"
                            className="h-9"
                          />
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>

              <div className="flex flex-wrap items-end justify-between gap-4">
                <div className="text-sm text-muted-foreground">
                  Nominal Tarikan (rencana):{" "}
                  <span className="font-medium text-foreground">
                    {formatCurrency(selected.amount)}
                  </span>
                </div>
                <div className="text-right">
                  <p className="text-xs text-muted-foreground">
                    Total Deklarasi (riil)
                  </p>
                  <p className="text-xl font-bold text-primary">
                    {formatCurrency(totalAmount)}
                  </p>
                </div>
              </div>

              <div className="space-y-2">
                <Label>
                  Catatan{" "}
                  <span className="text-xs font-normal text-muted-foreground">
                    (Opsional)
                  </span>
                </Label>
                <RichMentionEditor
                  ref={notesEditorRef}
                  placeholder="Konteks/keterangan tambahan, misal alasan selisih nominal..."
                  onChange={() =>
                    setNotes(
                      notesEditorRef.current?.isEmpty()
                        ? ""
                        : stringifyRichContent(
                            notesEditorRef.current?.getJSON() ?? {
                              type: "doc",
                            },
                          ),
                    )
                  }
                />
              </div>

              <div className="space-y-2">
                <Label>
                  Bukti Struk/Nota Asli{" "}
                  <span className="text-xs font-normal text-muted-foreground">
                    (Opsional)
                  </span>
                </Label>
                <div className="p-4 border-2 border-dashed rounded-lg bg-muted/10 transition-colors hover:bg-muted/30">
                  <div className="flex flex-col sm:flex-row items-center justify-between gap-4">
                    <div className="text-sm text-muted-foreground text-center sm:text-left">
                      <p className="font-medium text-foreground">
                        Upload Bukti Struk/Nota
                      </p>
                      <p className="text-xs">
                        Format: JPG, PNG, PDF. Maks: 5MB.
                      </p>
                    </div>
                    <Input
                      type="file"
                      className="hidden"
                      id="deklarasi-file-upload"
                      onChange={handleFileUpload}
                      disabled={uploading}
                    />
                    <Button
                      asChild
                      variant="outline"
                      className="cursor-pointer shrink-0"
                      disabled={uploading}
                    >
                      <label htmlFor="deklarasi-file-upload">
                        {uploading ? (
                          <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                        ) : (
                          <UploadCloud className="h-4 w-4 mr-2" />
                        )}
                        {uploading ? "Mengunggah..." : "Pilih File"}
                      </label>
                    </Button>
                  </div>
                </div>

                {attachments.length > 0 && (
                  <div className="grid gap-2">
                    {attachments.map((file, index) => (
                      <div
                        key={index}
                        className="flex items-center justify-between p-3 bg-background border rounded-md shadow-sm"
                      >
                        <a
                          href={file.url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-sm font-medium text-primary hover:underline truncate max-w-[85%]"
                        >
                          {file.name}
                        </a>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8 text-destructive hover:text-destructive/80 hover:bg-destructive/10"
                          onClick={() => removeAttachment(index)}
                        >
                          <X className="h-4 w-4" />
                        </Button>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          )}

          <DialogFooter>
            <Button
              variant="ghost"
              onClick={closeDeclareForm}
              disabled={creating}
            >
              Batal
            </Button>
            <Button onClick={handleSubmit} disabled={creating || uploading}>
              {creating && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Kirim Deklarasi
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
