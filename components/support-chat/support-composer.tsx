"use client";

// Kotak ketik pesan Chat Admin: Enter = kirim (Shift+Enter = baris baru, di
// HP Enter tetap baris baru), lampiran 1 file lewat tombol klip atau paste
// dari clipboard. File di-upload ke storage VPS saat dikirim, bukan saat
// dipilih, supaya lampiran yang batal dipakai tidak nyampah di storage.

import { useRef, useState } from "react";
import { toast } from "@/lib/toast";
import { FileText, Loader2, Paperclip, SendHorizontal, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { useIsMobile } from "@/hooks/use-mobile";
import { uploadAttachmentDirect } from "@/lib/uploadDirect";
import {
  formatFileSize,
  getAttachmentSizeError,
  getUploadErrorMessage,
} from "@/lib/attachments";
import { SupportAttachmentInput } from "@/services/supportChatService";
import { cn } from "@/lib/utils";

export const MAX_SUPPORT_MESSAGE_LENGTH = 5000;

export async function uploadSupportAttachment(
  file: File,
  userId: string,
): Promise<SupportAttachmentInput> {
  const result = await uploadAttachmentDirect(
    file,
    `chat-admin/${userId}/${Date.now()}_${file.name}`,
  );
  if (!result.success) throw new Error(result.message);
  return {
    url: result.url,
    nama: file.name,
    tipe: file.type || "application/octet-stream",
  };
}

export function AttachmentChip({
  file,
  onRemove,
  disabled,
}: {
  file: File;
  onRemove: () => void;
  disabled?: boolean;
}) {
  return (
    <div className="flex items-center justify-between gap-2 rounded-md border bg-muted/50 px-2 py-1.5 text-sm">
      <div className="flex min-w-0 items-center gap-2">
        <Paperclip className="h-4 w-4 shrink-0" />
        <span className="truncate">{file.name}</span>
        <span className="shrink-0 text-xs text-muted-foreground">
          {formatFileSize(file.size)}
        </span>
      </div>
      <Button
        type="button"
        variant="ghost"
        size="icon"
        className="h-6 w-6 shrink-0"
        onClick={onRemove}
        disabled={disabled}
        aria-label="Hapus lampiran"
      >
        <X className="h-4 w-4" />
      </Button>
    </div>
  );
}

export function SupportComposer({
  userId,
  onSend,
  hint,
}: {
  userId: string;
  onSend: (
    pesan: string,
    lampiran: SupportAttachmentInput | null,
  ) => Promise<boolean>;
  hint?: string;
}) {
  const isMobile = useIsMobile();
  const [text, setText] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [sending, setSending] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const pickFile = (f: File | null | undefined) => {
    if (!f) return;
    const sizeError = getAttachmentSizeError(f);
    if (sizeError) {
      toast.error("Ukuran file terlalu besar", { description: sizeError });
      return;
    }
    setFile(f);
  };

  const canSend = !sending && (text.trim().length > 0 || !!file);

  const submit = async () => {
    if (!canSend) return;
    setSending(true);
    try {
      let lampiran: SupportAttachmentInput | null = null;
      if (file) {
        try {
          lampiran = await uploadSupportAttachment(file, userId);
        } catch (err) {
          toast.error("Gagal mengunggah lampiran", {
            description: getUploadErrorMessage(err),
          });
          return;
        }
      }
      const ok = await onSend(text.trim(), lampiran);
      if (ok) {
        setText("");
        setFile(null);
      }
    } finally {
      setSending(false);
      textareaRef.current?.focus();
    }
  };

  return (
    <div className="space-y-2 border-t bg-background p-3">
      {hint && <p className="text-xs text-muted-foreground">{hint}</p>}
      {file && (
        <AttachmentChip
          file={file}
          onRemove={() => setFile(null)}
          disabled={sending}
        />
      )}
      <div className="flex items-end gap-2">
        <input
          ref={fileInputRef}
          type="file"
          className="hidden"
          onChange={(e) => {
            pickFile(e.target.files?.[0]);
            e.target.value = "";
          }}
        />
        <Button
          type="button"
          variant="ghost"
          size="icon"
          className="shrink-0"
          onClick={() => fileInputRef.current?.click()}
          disabled={sending}
          aria-label="Lampirkan file"
          title="Lampirkan file"
        >
          <Paperclip className="h-4 w-4" />
        </Button>
        <Textarea
          ref={textareaRef}
          value={text}
          onChange={(e) => setText(e.target.value)}
          onKeyDown={(e) => {
            if (
              e.key === "Enter" &&
              !e.shiftKey &&
              !isMobile &&
              !e.nativeEvent.isComposing
            ) {
              e.preventDefault();
              submit();
            }
          }}
          onPaste={(e) => {
            const pasted = e.clipboardData.files?.[0];
            if (pasted) {
              e.preventDefault();
              pickFile(pasted);
            }
          }}
          rows={1}
          maxLength={MAX_SUPPORT_MESSAGE_LENGTH}
          placeholder="Tulis pesan..."
          disabled={sending}
          className="max-h-40 min-h-10 resize-none field-sizing-content"
        />
        <Button
          type="button"
          size="icon"
          className={cn("shrink-0", !canSend && "opacity-60")}
          onClick={submit}
          disabled={!canSend}
          aria-label="Kirim pesan"
        >
          {sending ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <SendHorizontal className="h-4 w-4" />
          )}
        </Button>
      </div>
    </div>
  );
}

export function SupportAttachmentView({
  url,
  nama,
  tipe,
}: {
  url: string;
  nama: string | null;
  tipe: string | null;
}) {
  if (tipe?.startsWith("image/")) {
    return (
      <a href={url} target="_blank" rel="noopener noreferrer">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={url}
          alt={nama || "Gambar"}
          className="mt-2 max-h-64 max-w-full rounded-md border object-contain"
        />
      </a>
    );
  }
  return (
    <a
      href={url}
      target="_blank"
      rel="noopener noreferrer"
      className="mt-2 flex items-center gap-2 rounded-md border bg-background/60 px-2 py-1.5 text-xs hover:bg-background"
    >
      <FileText className="h-4 w-4 shrink-0" />
      <span className="truncate">{nama || "Lampiran"}</span>
    </a>
  );
}
