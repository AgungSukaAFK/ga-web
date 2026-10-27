// src/components/petty-cash/PcPengembalianForm.tsx
//
// Form "Kembalikan Sisa Dana" (requester) - dipakai dialog di halaman
// Deklarasi (DeklarasiClient.tsx, tabel "Sisa Dana Bisa Dikembalikan").
// Nominal default = seluruh sisa, boleh sebagian (sisanya bisa dikembalikan
// lagi nanti). Bukti setor/transfer WAJIB - validasi sebenarnya tetap di RPC
// create_petty_cash_pengembalian, ini cuma proteksi UI. Sama pola dengan
// PcSubVoucherPaymentForm (arah dananya saja yang kebalikan).
//
// `key={subVoucherId}` WAJIB dipasang oleh pemanggil supaya state lokal
// ke-reset tiap tarikan yang dipilih beda.

"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { CurrencyInput } from "@/components/ui/currency-input";
import { uploadAttachmentDirect } from "@/lib/uploadDirect";
import { getAttachmentSizeError, getUploadErrorMessage } from "@/lib/attachments";
import { formatCurrency } from "@/lib/utils";
import { toast } from "sonner";
import { Attachment } from "@/type";
import { Loader2, Undo2, UploadCloud, X } from "lucide-react";

interface PcPengembalianFormProps {
  subVoucherId: number;
  sisa: number;
  processing: boolean;
  onSubmit: (
    amount: number,
    notes: string,
    attachments: Attachment[],
  ) => Promise<void> | void;
}

export function PcPengembalianForm({
  subVoucherId,
  sisa,
  processing,
  onSubmit,
}: PcPengembalianFormProps) {
  const [amount, setAmount] = useState(sisa);
  const [notes, setNotes] = useState("");
  const [files, setFiles] = useState<Attachment[]>([]);
  const [uploading, setUploading] = useState(false);

  const amountError =
    amount <= 0
      ? "Nominal pengembalian harus lebih dari 0."
      : amount > sisa
        ? `Maksimal ${formatCurrency(sisa)} (sisa dana tarikan ini).`
        : null;

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
      const filePath = `petty-cash-pengembalian/${fileName}`;

      const result = await uploadAttachmentDirect(file, filePath);
      if (!result.success) throw new Error(result.message);

      setFiles((prev) => [...prev, { url: result.url, name: file.name }]);
      toast.success("Bukti setor berhasil diunggah");
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

  const inputId = `pengembalian-proof-upload-${subVoucherId}`;

  return (
    <div className="space-y-4">
      <div className="space-y-2">
        <Label>
          Nominal Dikembalikan <span className="text-destructive">*</span>
        </Label>
        <CurrencyInput value={amount} onValueChange={setAmount} />
        {amountError ? (
          <p className="text-xs text-destructive">{amountError}</p>
        ) : (
          <p className="text-xs text-muted-foreground">
            Sisa dana tarikan ini {formatCurrency(sisa)}. Boleh dikembalikan
            sebagian.
          </p>
        )}
      </div>

      <div className="space-y-2">
        <Label>
          Catatan{" "}
          <span className="text-xs font-normal text-muted-foreground">
            (Opsional)
          </span>
        </Label>
        <Textarea
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          placeholder="Misal: disetor tunai ke kasir Finance, transfer ke rekening ..."
          rows={2}
        />
      </div>

      <div className="space-y-2">
        <p className="text-sm font-medium">
          Bukti Setor/Transfer <span className="text-destructive">*</span>
        </p>
        <div className="p-4 border-2 border-dashed rounded-lg bg-muted/10 transition-colors hover:bg-muted/30">
          <div className="flex flex-col sm:flex-row items-center justify-between gap-4">
            <div className="text-sm text-muted-foreground text-center sm:text-left">
              <p className="font-medium text-foreground">Upload Bukti Setor</p>
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
          onClick={() => onSubmit(amount, notes, files)}
          disabled={
            processing || uploading || files.length === 0 || !!amountError
          }
        >
          {processing ? (
            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
          ) : (
            <Undo2 className="mr-2 h-4 w-4" />
          )}
          Kirim Pengembalian
        </Button>
      </div>
    </div>
  );
}
