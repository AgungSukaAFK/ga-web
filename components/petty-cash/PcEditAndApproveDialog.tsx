// src/components/petty-cash/PcEditAndApproveDialog.tsx
//
// Dialog "Edit & Setujui" - approver bisa mengedit SELURUH field yang bisa
// diedit sebuah dokumen Petty Cash (Pengajuan/Voucher/Deklarasi) SEBELUM
// approve step dia sendiri. Versi sebelum edit otomatis dicatat sebagai
// entri baru di `revisions[]` oleh service pemanggil (lihat
// editAndApprove*Step di services/pettyCash*Service.ts, yang membangun
// patch-nya lewat buildEditAndApproveUpdate, lib/pcApprovalFlow.ts) - dialog
// ini sendiri cuma mengumpulkan nilai baru & memanggil `onSubmit`.

"use client";

import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { toast } from "sonner";
import {
  PcItemsEditor,
  hasUnresolvedCoa,
} from "@/components/petty-cash/PcItemsEditor";
import { uploadAttachmentDirect } from "@/lib/uploadDirect";
import {
  getAttachmentSizeError,
  getUploadErrorMessage,
} from "@/lib/attachments";
import { Attachment, PettyCashBudget, PettyCashPengajuanItem } from "@/type";
import { getLocalDateString } from "@/lib/utils";
import { fetchActiveBudgets } from "@/services/pettyCashBudgetService";
import { Loader2, UploadCloud, X, PencilLine } from "lucide-react";

const WEEK_OPTIONS = [1, 2, 3, 4, 5];

export interface PcEditAndApproveEdits {
  needed_date?: string;
  week_of_month?: number | null;
  notes: string | null;
  items: PettyCashPengajuanItem[];
  attachments: Attachment[];
  // Cuma terisi kalau showBudget=true (docLabel "Pengajuan") - lihat
  // komentar budget_id di EditPengajuanEdits, services/pettyCashPengajuanService.ts.
  budget_id?: number | null;
}

interface PcEditAndApproveDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  docLabel: string; // "Pengajuan" | "Voucher" | "Deklarasi"
  kode: string;
  companyCode: string; // dipakai nentuin coaMode/lockedCoa sama seperti saat dokumen dibuat
  showNeededDate?: boolean; // false utk Deklarasi (tidak punya needed_date)
  // true HANYA utk docLabel "Pengajuan" - approver Pengajuan boleh ganti
  // Budget yang auto-terisi (lihat komentar budget_id, PettyCashPengajuan,
  // type/index.ts). Voucher/Deklarasi tidak punya kontrol ini (budget_id
  // Voucher cuma disalin dari Pengajuan asalnya, tidak diedit lagi di sini).
  showBudget?: boolean;
  initial: {
    needed_date?: string | Date;
    week_of_month?: number | null;
    notes: string | null;
    items: PettyCashPengajuanItem[];
    attachments: Attachment[];
    budget_id?: number | null;
  };
  onSubmit: (edits: PcEditAndApproveEdits) => Promise<void> | void;
}

export function PcEditAndApproveDialog({
  open,
  onOpenChange,
  docLabel,
  kode,
  companyCode,
  showNeededDate = true,
  showBudget = false,
  initial,
  onSubmit,
}: PcEditAndApproveDialogProps) {
  const isLourdes = companyCode === "LOURDES";
  const [neededDate, setNeededDate] = useState(
    initial.needed_date
      ? new Date(initial.needed_date).toISOString().split("T")[0]
      : getLocalDateString(),
  );
  const [weekOfMonth, setWeekOfMonth] = useState<number | null>(
    initial.week_of_month ?? null,
  );
  const [notes, setNotes] = useState(initial.notes ?? "");
  const [items, setItems] = useState<PettyCashPengajuanItem[]>(initial.items);
  const [attachments, setAttachments] = useState<Attachment[]>(
    initial.attachments ?? [],
  );
  const [uploading, setUploading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [budgetId, setBudgetId] = useState<number | null>(
    initial.budget_id ?? null,
  );
  const [budgetOptions, setBudgetOptions] = useState<PettyCashBudget[]>([]);

  useEffect(() => {
    if (!showBudget || !open) return;
    fetchActiveBudgets()
      .then(setBudgetOptions)
      .catch((error: any) =>
        toast.error("Gagal memuat daftar budget", {
          description: error.message,
        }),
      );
  }, [showBudget, open]);

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
      const filePath = `petty-cash-edit-approve/${fileName}`;
      const result = await uploadAttachmentDirect(file, filePath);
      if (!result.success) throw new Error(result.message);
      setAttachments((prev) => [...prev, { url: result.url, name: file.name }]);
    } catch (error: any) {
      toast.error("Gagal mengunggah file", {
        description: getUploadErrorMessage(error),
      });
    } finally {
      setUploading(false);
      e.target.value = "";
    }
  };

  const handleSubmit = async () => {
    if (items.length === 0) return toast.error("Minimal harus ada 1 barang.");
    if (items.some((it) => !it.part_name.trim()))
      return toast.error("Nama barang wajib diisi untuk semua baris.");
    if (items.some((it) => !it.qty || it.qty <= 0))
      return toast.error("Qty setiap barang wajib diisi dan lebih dari 0.");
    if (hasUnresolvedCoa(items))
      return toast.error("Setiap barang wajib punya COA (GMI/GIS).");

    setSubmitting(true);
    try {
      await onSubmit({
        needed_date: showNeededDate ? neededDate : undefined,
        week_of_month: showNeededDate ? weekOfMonth : initial.week_of_month,
        notes: notes.trim() || null,
        items,
        attachments,
        budget_id: showBudget ? budgetId : undefined,
      });
      onOpenChange(false);
    } catch (error: any) {
      toast.error("Gagal menyimpan & menyetujui", {
        description: error.message,
      });
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-3xl max-h-[88vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <PencilLine className="h-5 w-5 text-primary" />
            Edit & Setujui {docLabel}
          </DialogTitle>
          <DialogDescription>
            {kode} - perubahan di sini akan dicatat sebagai revisi baru dan
            langsung menyetujui giliran approval Anda.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          {showNeededDate && (
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Tanggal Dibutuhkan</Label>
                <Input
                  type="date"
                  value={neededDate}
                  onChange={(e) => setNeededDate(e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label>Minggu ke-</Label>
                <Select
                  value={weekOfMonth ? String(weekOfMonth) : ""}
                  onValueChange={(val) => setWeekOfMonth(Number(val))}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Pilih minggu" />
                  </SelectTrigger>
                  <SelectContent>
                    {WEEK_OPTIONS.map((w) => (
                      <SelectItem key={w} value={String(w)}>
                        Minggu ke-{w}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
          )}

          <div className="space-y-2">
            <Label>Catatan</Label>
            <Textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              rows={3}
              className="resize-none"
            />
          </div>

          {showBudget && (
            <div className="space-y-2">
              <Label>Budget</Label>
              <Select
                value={budgetId ? String(budgetId) : ""}
                onValueChange={(val) => setBudgetId(Number(val))}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Pilih budget..." />
                </SelectTrigger>
                <SelectContent>
                  {budgetOptions.map((b) => (
                    <SelectItem key={b.id} value={String(b.id)}>
                      {b.name} ({b.department}) - Sisa{" "}
                      {b.current_budget.toLocaleString("id-ID")}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <p className="text-xs text-muted-foreground">
                Budget yang menanggung Pengajuan ini - auto-terisi sesuai
                departemen requester, boleh diganti di sini kalau perlu.
              </p>
            </div>
          )}

          <div className="space-y-2">
            <Label>Daftar Barang</Label>
            <PcItemsEditor
              initialItems={items}
              onChange={setItems}
              coaMode={isLourdes ? "choose" : "locked"}
              lockedCoa={isLourdes ? null : (companyCode as "GMI" | "GIS")}
              coaSearchFilter={isLourdes ? null : (companyCode as "GMI" | "GIS")}
            />
          </div>

          <div className="space-y-2">
            <Label>Lampiran</Label>
            <div className="flex items-center gap-3">
              <Input
                type="file"
                className="hidden"
                id="edit-approve-file-upload"
                onChange={handleFileUpload}
                disabled={uploading}
              />
              <Button
                asChild
                variant="outline"
                size="sm"
                className="cursor-pointer"
                disabled={uploading}
              >
                <label htmlFor="edit-approve-file-upload">
                  {uploading ? (
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  ) : (
                    <UploadCloud className="h-4 w-4 mr-2" />
                  )}
                  Tambah Lampiran
                </label>
              </Button>
            </div>
            {attachments.length > 0 && (
              <div className="grid gap-2 pt-1">
                {attachments.map((file, index) => (
                  <div
                    key={index}
                    className="flex items-center justify-between p-2 bg-background border rounded-md text-sm"
                  >
                    <a
                      href={file.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-primary hover:underline truncate max-w-[85%]"
                    >
                      {file.name}
                    </a>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-7 w-7 text-destructive hover:text-destructive/80"
                      onClick={() =>
                        setAttachments((prev) =>
                          prev.filter((_, i) => i !== index),
                        )
                      }
                    >
                      <X className="h-4 w-4" />
                    </Button>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        <DialogFooter>
          <Button
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={submitting}
          >
            Batal
          </Button>
          <Button onClick={handleSubmit} disabled={submitting}>
            {submitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Simpan & Setujui
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
