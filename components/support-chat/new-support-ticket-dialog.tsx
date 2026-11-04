"use client";

// Form singkat mulai percakapan baru dengan admin IT - kategori, subjek, dan
// pesan pertama (+ lampiran opsional). Sisanya lanjut di thread chat.

import { useState } from "react";
import { toast } from "@/lib/toast";
import { Loader2, Send } from "lucide-react";
import { Button } from "@/components/ui/button";
import { FileDropzone } from "@/components/file-dropzone";
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
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { getAttachmentSizeError, getUploadErrorMessage } from "@/lib/attachments";
import {
  createSupportTicket,
  SUPPORT_KATEGORI,
  SupportAttachmentInput,
} from "@/services/supportChatService";
import {
  AttachmentChip,
  MAX_SUPPORT_MESSAGE_LENGTH,
  uploadSupportAttachment,
} from "./support-composer";

export function NewSupportTicketDialog({
  open,
  onOpenChange,
  currentUser,
  onCreated,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  currentUser: { id: string; nama: string | null };
  onCreated: (ticketId: number) => void;
}) {
  const [kategori, setKategori] = useState("");
  const [subjek, setSubjek] = useState("");
  const [pesan, setPesan] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [saving, setSaving] = useState(false);

  const reset = () => {
    setKategori("");
    setSubjek("");
    setPesan("");
    setFile(null);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!kategori || !subjek.trim() || !pesan.trim()) {
      toast.error("Kategori, subjek, dan pesan wajib diisi.");
      return;
    }
    setSaving(true);
    try {
      let lampiran: SupportAttachmentInput | null = null;
      if (file) {
        try {
          lampiran = await uploadSupportAttachment(file, currentUser.id);
        } catch (err) {
          throw new Error(getUploadErrorMessage(err));
        }
      }
      const ticketId = await createSupportTicket({
        kategori,
        subjek: subjek.trim(),
        pesan: pesan.trim(),
        lampiran,
        senderName: currentUser.nama || "User",
      });
      toast.success("Pesan terkirim ke admin IT.");
      reset();
      onOpenChange(false);
      onCreated(ticketId);
    } catch (err: any) {
      toast.error("Gagal memulai percakapan", { description: err.message });
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={(o) => !saving && onOpenChange(o)}>
      <DialogContent className="sm:max-w-lg">
        <form onSubmit={handleSubmit} className="space-y-4">
          <DialogHeader>
            <DialogTitle>Percakapan Baru</DialogTitle>
            <DialogDescription>
              Ceritakan kendala atau pertanyaan Anda. Admin IT akan membalas di
              percakapan ini.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-2">
            <Label>Kategori</Label>
            <Select value={kategori} onValueChange={setKategori} disabled={saving}>
              <SelectTrigger className="w-full">
                <SelectValue placeholder="Pilih kategori..." />
              </SelectTrigger>
              <SelectContent>
                {SUPPORT_KATEGORI.map((k) => (
                  <SelectItem key={k} value={k}>
                    {k}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label htmlFor="support-subjek">Subjek</Label>
            <Input
              id="support-subjek"
              value={subjek}
              onChange={(e) => setSubjek(e.target.value)}
              placeholder="Contoh: Tidak bisa membuka halaman PO"
              maxLength={150}
              disabled={saving}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="support-pesan">Pesan</Label>
            <Textarea
              id="support-pesan"
              value={pesan}
              onChange={(e) => setPesan(e.target.value)}
              placeholder="Jelaskan kendalanya: apa yang dilakukan, apa yang muncul, sejak kapan..."
              maxLength={MAX_SUPPORT_MESSAGE_LENGTH}
              className="min-h-28 max-h-60"
              disabled={saving}
            />
          </div>

          <div className="space-y-2">
            {file ? (
              <AttachmentChip
                file={file}
                onRemove={() => setFile(null)}
                disabled={saving}
              />
            ) : (
              <FileDropzone
                onFiles={(files) => {
                  const sizeError = getAttachmentSizeError(files[0]);
                  if (sizeError) {
                    toast.error("Ukuran file terlalu besar", {
                      description: sizeError,
                    });
                    return;
                  }
                  setFile(files[0]);
                }}
                disabled={saving}
                title="Lampirkan screenshot / file (opsional)"
                hint="Seret & lepas atau klik untuk memilih"
              />
            )}
          </div>

          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
              disabled={saving}
            >
              Batal
            </Button>
            <Button type="submit" disabled={saving}>
              {saving ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : (
                <Send className="mr-2 h-4 w-4" />
              )}
              Kirim
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
