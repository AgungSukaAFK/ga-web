// src/components/petty-cash/PcAdminForceEditDialog.tsx
//
// Dialog "Edit Paksa (Admin)" - mirror PcEditAndApproveDialog.tsx (form
// tanggal/minggu/catatan/item/lampiran/budget-nya SENGAJA dibuat identik
// biar konsisten), TAPI:
//  - Dipakai admin, BISA dipanggil di status dokumen APA PUN (tidak perlu
//    giliran approval - beda dari "Edit & Setujui" yang cuma bisa dipakai
//    approver yang sedang gilirannya).
//  - Tambah field Company & Departemen (admin bisa pindahkan dokumen lintas
//    company/departemen - dipakai kalau requester salah pilih company/dept
//    saat submit).
//  - Wajib isi Alasan (tercatat permanen di jejak audit admin - lihat
//    services/pettyCashAdminService.ts).
//
// PERINGATAN yang ditampilkan di form: mengubah Company/Departemen di sini
// TIDAK otomatis meresolusi ulang Template Approval/Budget (itu cuma
// terjadi otomatis saat dokumen pertama kali dibuat) - kalau perlu, admin
// harus menyesuaikan Budget-nya juga secara manual lewat field Budget di
// bawah (khusus Pengajuan/Voucher).

"use client";

import { useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  RichMentionEditor,
  RichMentionEditorHandle,
} from "@/components/rich-mention-editor";
import { parseRichValue, stringifyRichContent } from "@/lib/rich-content";
import {
  SearchableSelect,
  SearchableSelectTrigger,
  SearchableSelectValue,
  SearchableSelectContent,
  SearchableSelectItem,
} from "@/components/ui/searchable-select";
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
import { AlertTriangle, Loader2, ShieldAlert, UploadCloud, X } from "lucide-react";

export interface PcAdminForceEditValues {
  needed_date?: string;
  week_of_month?: number | null;
  site: string | null;
  company_code: string;
  department: string;
  budget_id?: number | null;
  notes: string | null;
  items: PettyCashPengajuanItem[];
  attachments: Attachment[];
}

interface PcAdminForceEditDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  docLabel: string; // "Pengajuan" | "Voucher" | "Deklarasi"
  kode: string;
  showNeededDate?: boolean; // false utk Deklarasi
  showBudget?: boolean; // true utk Pengajuan/Voucher, false utk Deklarasi
  initial: {
    needed_date?: string | Date;
    week_of_month?: number | null;
    site: string | null;
    company_code: string;
    department: string;
    budget_id?: number | null;
    notes: string | null;
    items: PettyCashPengajuanItem[];
    attachments: Attachment[];
  };
  onSubmit: (edits: PcAdminForceEditValues, reason: string) => Promise<void>;
}

export function PcAdminForceEditDialog({
  open,
  onOpenChange,
  docLabel,
  kode,
  showNeededDate = true,
  showBudget = false,
  initial,
  onSubmit,
}: PcAdminForceEditDialogProps) {
  const [companyCode, setCompanyCode] = useState(initial.company_code);
  const isLourdes = companyCode === "LOURDES";
  const [department, setDepartment] = useState(initial.department);
  const [site, setSite] = useState(initial.site ?? "");
  const [neededDate, setNeededDate] = useState(
    initial.needed_date
      ? new Date(initial.needed_date).toISOString().split("T")[0]
      : getLocalDateString(),
  );
  const [weekOfMonth, setWeekOfMonth] = useState<number | null>(
    initial.week_of_month ?? null,
  );
  const [notes, setNotes] = useState(initial.notes ?? "");
  const notesEditorRef = useRef<RichMentionEditorHandle>(null);
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
  const [reason, setReason] = useState("");

  // Reset seluruh state form tiap dialog dibuka ulang - dialog ini dipakai
  // berulang lewat satu instance yang sama di halaman detail (bukan
  // di-remount tiap kali), beda dari editInitial di PcApprovalActions yang
  // otomatis reset lewat `key={docId}` di pemanggilnya.
  useEffect(() => {
    if (!open) return;
    setCompanyCode(initial.company_code);
    setDepartment(initial.department);
    setSite(initial.site ?? "");
    setNeededDate(
      initial.needed_date
        ? new Date(initial.needed_date).toISOString().split("T")[0]
        : getLocalDateString(),
    );
    setWeekOfMonth(initial.week_of_month ?? null);
    setNotes(initial.notes ?? "");
    setItems(initial.items);
    setAttachments(initial.attachments ?? []);
    setBudgetId(initial.budget_id ?? null);
    setReason("");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  useEffect(() => {
    if (!showBudget || !open) return;
    fetchActiveBudgets(companyCode)
      .then(setBudgetOptions)
      .catch((error: any) =>
        toast.error("Gagal memuat daftar budget", {
          description: error.message,
        }),
      );
  }, [showBudget, open, companyCode]);

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
      const filePath = `petty-cash-admin-force-edit/${fileName}`;
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
    if (!companyCode.trim() || !department.trim())
      return toast.error("Company dan Departemen wajib diisi.");
    if (!reason.trim())
      return toast.error("Alasan edit paksa wajib diisi.", {
        description: "Tercatat permanen di jejak audit admin.",
      });

    setSubmitting(true);
    try {
      await onSubmit(
        {
          needed_date: showNeededDate ? neededDate : undefined,
          week_of_month: showNeededDate ? weekOfMonth : initial.week_of_month,
          site: site.trim() || null,
          company_code: companyCode.trim(),
          department: department.trim(),
          budget_id: showBudget ? budgetId : undefined,
          notes: notes.trim() || null,
          items,
          attachments,
        },
        reason.trim(),
      );
      onOpenChange(false);
    } catch (error: any) {
      toast.error("Gagal menyimpan edit paksa", { description: error.message });
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={(next) => !submitting && onOpenChange(next)}>
      <DialogContent className="sm:max-w-3xl max-h-[88vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-amber-700 dark:text-amber-400">
            <ShieldAlert className="h-5 w-5" />
            Edit Paksa {docLabel} (Admin)
          </DialogTitle>
          <DialogDescription>
            {kode} - berlaku di status apa pun, tidak memerlukan giliran
            approval. Setiap perubahan tercatat di jejak audit admin.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="flex gap-2 rounded-md border border-amber-300 dark:border-amber-800 bg-amber-50/50 dark:bg-amber-950/20 p-3 text-xs text-amber-800 dark:text-amber-300">
            <AlertTriangle className="h-4 w-4 shrink-0 mt-0.5" />
            <p>
              Mengubah Company/Departemen di sini TIDAK otomatis meresolusi
              ulang Template Approval maupun Budget - dokumen tetap memakai
              jalur approval yang sudah ada. Sesuaikan Budget secara manual
              di bawah kalau perlu.
            </p>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Company</Label>
              <Input
                value={companyCode}
                onChange={(e) => setCompanyCode(e.target.value.toUpperCase())}
              />
            </div>
            <div className="space-y-2">
              <Label>Departemen</Label>
              <Input
                value={department}
                onChange={(e) => setDepartment(e.target.value)}
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label>Site</Label>
            <Input
              value={site}
              onChange={(e) => setSite(e.target.value)}
              placeholder="Kosongkan kalau tidak ada"
            />
          </div>

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
                <SearchableSelect
                  value={weekOfMonth ? String(weekOfMonth) : ""}
                  onValueChange={(val) => setWeekOfMonth(Number(val))}
                >
                  <SearchableSelectTrigger>
                    <SearchableSelectValue placeholder="Pilih minggu" />
                  </SearchableSelectTrigger>
                  <SearchableSelectContent>
                    {[1, 2, 3, 4, 5].map((w) => (
                      <SearchableSelectItem key={w} value={String(w)}>
                        Minggu ke-{w}
                      </SearchableSelectItem>
                    ))}
                  </SearchableSelectContent>
                </SearchableSelect>
              </div>
            </div>
          )}

          <div className="space-y-2">
            <Label>Catatan</Label>
            <RichMentionEditor
              ref={notesEditorRef}
              initialContent={parseRichValue(notes)}
              onChange={() =>
                setNotes(
                  notesEditorRef.current?.isEmpty()
                    ? ""
                    : stringifyRichContent(
                        notesEditorRef.current?.getJSON() ?? { type: "doc" },
                      ),
                )
              }
            />
          </div>

          {showBudget && (
            <div className="space-y-2">
              <Label>Budget</Label>
              <SearchableSelect
                value={budgetId ? String(budgetId) : ""}
                onValueChange={(val) => setBudgetId(Number(val))}
              >
                <SearchableSelectTrigger>
                  <SearchableSelectValue placeholder="Pilih budget..." />
                </SearchableSelectTrigger>
                <SearchableSelectContent>
                  {budgetOptions.map((b) => (
                    <SearchableSelectItem key={b.id} value={String(b.id)}>
                      {b.name} ({b.department}
                      {b.site ? ` - ${b.site}` : ""}) - Sisa{" "}
                      {b.current_budget.toLocaleString("id-ID")}
                    </SearchableSelectItem>
                  ))}
                </SearchableSelectContent>
              </SearchableSelect>
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
                id="admin-force-edit-file-upload"
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
                <label htmlFor="admin-force-edit-file-upload">
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

          <div className="space-y-2 border-t pt-4">
            <Label>Alasan Edit Paksa (wajib)</Label>
            <Textarea
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder="Jelaskan kenapa dokumen ini perlu diedit paksa - tercatat permanen di jejak audit admin."
              rows={2}
            />
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
            Simpan Edit Paksa
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
