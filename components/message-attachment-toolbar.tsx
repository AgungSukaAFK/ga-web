"use client";

import { useRef } from "react";
import { Button } from "@/components/ui/button";
import { ImageIcon, Loader2, X } from "lucide-react";
import { EmojiStickerPicker } from "@/components/emoji-sticker-picker";
import { DiscussionAttachment } from "@/type";

interface MessageAttachmentToolbarProps {
  pendingAttachment: DiscussionAttachment | null;
  onPendingAttachmentChange: (attachment: DiscussionAttachment | null) => void;
  onSendSticker: (emoji: string) => void;
  uploading: boolean;
  onUploadFile: (file: File) => void;
  disabled?: boolean;
}

export function MessageAttachmentToolbar({
  pendingAttachment,
  onPendingAttachmentChange,
  onSendSticker,
  uploading,
  onUploadFile,
  disabled,
}: MessageAttachmentToolbarProps) {
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    onUploadFile(file);
  };

  return (
    <div className="flex flex-col gap-1.5">
      {pendingAttachment && pendingAttachment.type === "image" && (
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
        <EmojiStickerPicker
          disabled={disabled || uploading}
          onSelect={onSendSticker}
        />
      </div>
    </div>
  );
}
