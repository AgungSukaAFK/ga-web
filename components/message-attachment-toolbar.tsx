"use client";

import { useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { ImageIcon, Loader2, X } from "lucide-react";
import { toast } from "sonner";
import { GifPicker } from "@/components/gif-picker";
import { EmojiStickerPicker } from "@/components/emoji-sticker-picker";
import { uploadAttachmentDirect } from "@/lib/uploadDirect";
import { getAttachmentSizeError, getUploadErrorMessage } from "@/lib/attachments";
import { DiscussionAttachment } from "@/type";

interface MessageAttachmentToolbarProps {
  pathPrefix: string;
  pendingAttachment: DiscussionAttachment | null;
  onPendingAttachmentChange: (attachment: DiscussionAttachment | null) => void;
  onSendSticker: (emoji: string) => void;
  disabled?: boolean;
}

export function MessageAttachmentToolbar({
  pathPrefix,
  pendingAttachment,
  onPendingAttachmentChange,
  onSendSticker,
  disabled,
}: MessageAttachmentToolbarProps) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;

    const sizeError = getAttachmentSizeError(file);
    if (sizeError) {
      toast.error("Ukuran gambar terlalu besar", { description: sizeError });
      return;
    }

    setUploading(true);
    try {
      const filePath = `${pathPrefix}/${Date.now()}_${file.name}`;
      const result = await uploadAttachmentDirect(file, filePath);
      if (!result.success) throw new Error(result.message);
      onPendingAttachmentChange({
        type: "image",
        url: result.url,
        name: file.name,
      });
    } catch (error) {
      toast.error("Gagal mengunggah gambar", {
        description: getUploadErrorMessage(error),
      });
    } finally {
      setUploading(false);
    }
  };

  return (
    <div className="flex flex-col gap-1.5">
      {pendingAttachment &&
        (pendingAttachment.type === "image" || pendingAttachment.type === "gif") && (
          <div className="relative inline-block w-fit">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={pendingAttachment.url}
              alt="Lampiran"
              className="h-20 w-20 object-cover rounded-md border"
            />
            <button
              type="button"
              onClick={() => onPendingAttachmentChange(null)}
              className="absolute -top-1.5 -right-1.5 bg-destructive text-destructive-foreground rounded-full p-0.5 shadow"
              title="Hapus lampiran"
            >
              <X className="h-3 w-3" />
            </button>
          </div>
        )}
      <div className="flex items-center gap-0.5">
        <input
          ref={fileInputRef}
          type="file"
          accept="image/*"
          className="hidden"
          onChange={handleFileChange}
        />
        <Button
          type="button"
          variant="ghost"
          size="icon"
          disabled={disabled || uploading}
          onClick={() => fileInputRef.current?.click()}
          title="Kirim gambar"
        >
          {uploading ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <ImageIcon className="h-4 w-4" />
          )}
        </Button>
        <GifPicker
          disabled={disabled || uploading}
          onSelect={(url) => onPendingAttachmentChange({ type: "gif", url })}
        />
        <EmojiStickerPicker
          disabled={disabled || uploading}
          onSelect={onSendSticker}
        />
      </div>
    </div>
  );
}
