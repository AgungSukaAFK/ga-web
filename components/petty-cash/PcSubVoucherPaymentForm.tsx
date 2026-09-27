// src/components/petty-cash/PcSubVoucherPaymentForm.tsx
//
// Form "Selesaikan Pembayaran" Sub-Voucher (Finance/admin only) - dipakai
// BERSAMA oleh dialog antrian pembayaran (ApprovalPettyCashClient.tsx, sesi
// "Pembayaran Sub-Voucher") dan halaman detail Sub-Voucher
// (petty-cash/sub-voucher/[id]/page.tsx), sama pola dengan PcApprovalActions
// yang dipakai bareng oleh 3 halaman detail + halaman approval. Rincian item
// yang ditarik ditampilkan read-only, upload bukti transfer WAJIB (tombol
// submit disabled kalau belum ada file) - validasi sebenarnya tetap di RPC
// mark_petty_cash_sub_voucher_paid (SECURITY DEFINER, cek department/role
// Finance & keberadaan bukti transfer), ini cuma proteksi UI.
//
// `key={subVoucher.id}` WAJIB dipasang oleh pemanggil supaya state lokal
// (file yang sudah diunggah) ke-reset tiap Sub-Voucher yang dilihat beda -
// sama pola dengan PcAdminOverridePanel.

"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { uploadAttachmentDirect } from "@/lib/uploadDirect";
import { getAttachmentSizeError, getUploadErrorMessage } from "@/lib/attachments";
import { formatCurrency } from "@/lib/utils";
import { toast } from "sonner";
import { Attachment, PettyCashSubVoucher } from "@/type";
import { Landmark, Loader2, UploadCloud, X } from "lucide-react";

interface PcSubVoucherPaymentFormProps {
  subVoucher: PettyCashSubVoucher;
  processing: boolean;
  onSubmit: (paymentProof: Attachment[]) => Promise<void> | void;
}

export function PcSubVoucherPaymentForm({
  subVoucher,
  processing,
  onSubmit,
}: PcSubVoucherPaymentFormProps) {
  const [files, setFiles] = useState<Attachment[]>([]);
  const [uploading, setUploading] = useState(false);

  const handleUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
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
      const filePath = `petty-cash-sub-voucher-payment/${fileName}`;

      const result = await uploadAttachmentDirect(file, filePath);
      if (!result.success) throw new Error(result.message);

      setFiles((prev) => [...prev, { url: result.url, name: file.name }]);
      toast.success("Bukti transfer berhasil diunggah");
    } catch (error: any) {
      toast.error("Gagal mengunggah file", {
        description: getUploadErrorMessage(error),
      });
    } finally {
      setUploading(false);
      e.target.value = "";
    }
  };

  const removeFile = (index: number) =>
    setFiles((prev) => prev.filter((_, i) => i !== index));

  const inputId = `payment-proof-upload-${subVoucher.id}`;

  return (
    <div className="space-y-4">
      <div className="rounded-md border overflow-x-auto">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Nama Barang</TableHead>
              <TableHead className="w-[70px]">Qty</TableHead>
              <TableHead className="w-[120px] text-right">Subtotal</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {subVoucher.items.map((it, i) => (
              <TableRow key={i}>
                <TableCell className="font-medium text-sm">
                  {it.part_name}
                </TableCell>
                <TableCell className="text-sm">
                  {it.qty} {it.uom || ""}
                </TableCell>
                <TableCell className="text-right text-sm">
                  {formatCurrency(it.subtotal)}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>

      <div className="flex justify-end">
        <div className="text-right">
          <p className="text-xs text-muted-foreground">Total Dibayar</p>
          <p className="text-lg font-bold text-primary">
            {formatCurrency(subVoucher.amount)}
          </p>
        </div>
      </div>

      <div className="space-y-2">
        <p className="text-sm font-medium">
          Bukti Transfer/Pembayaran <span className="text-destructive">*</span>
        </p>
        <div className="p-4 border-2 border-dashed rounded-lg bg-muted/10 transition-colors hover:bg-muted/30">
          <div className="flex flex-col sm:flex-row items-center justify-between gap-4">
            <div className="text-sm text-muted-foreground text-center sm:text-left">
              <p className="font-medium text-foreground">Upload Bukti Transfer</p>
              <p className="text-xs">Format: JPG, PNG, PDF. Maks: 5MB.</p>
            </div>
            <Input
              type="file"
              className="hidden"
              id={inputId}
              onChange={handleUpload}
              disabled={uploading}
            />
            <Button
              asChild
              variant="outline"
              className="cursor-pointer shrink-0"
              disabled={uploading}
            >
              <label htmlFor={inputId}>
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

        {files.length > 0 && (
          <div className="grid gap-2">
            {files.map((file, index) => (
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
                  onClick={() => removeFile(index)}
                >
                  <X className="h-4 w-4" />
                </Button>
              </div>
            ))}
          </div>
        )}
      </div>

      <div className="flex justify-end">
        <Button
          onClick={() => onSubmit(files)}
          disabled={processing || uploading || files.length === 0}
        >
          {processing ? (
            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
          ) : (
            <Landmark className="mr-2 h-4 w-4" />
          )}
          Tandai Selesai Dibayar
        </Button>
      </div>
    </div>
  );
}
