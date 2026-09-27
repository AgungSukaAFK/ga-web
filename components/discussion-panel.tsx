// src/components/discussion-panel.tsx
//
// Panel diskusi generik (dipakai MR/PO lewat discussion-component.tsx, dan
// Petty Cash lewat halaman detail pengajuan/voucher/deklarasi) - render list
// pesan (bubble + rich content + lampiran gambar/sticker) + komposer (rich
// editor, drag&drop/paste/toolbar upload gambar, sticker). Komponen ini
// SEPENUHNYA controlled & tidak menyimpan/mengirim ke DB sendiri - caller yang
// nentuin cara persist lewat `onSubmit` (langsung .update() kolom `discussions`
// untuk MR/PO, atau RPC untuk Petty Cash), lalu re-render dengan `discussions`
// yang sudah ter-update (optimistic append atau refetch, terserah caller).

"use client";

import { useEffect, useRef, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { DiscussionMessageBubble } from "@/components/discussion-message-bubble";
import { createClient } from "@/lib/supabase/client";
import { toast } from "sonner";
import { Send } from "lucide-react";
import { Discussion, DiscussionAttachment, DiscussionSubmitPayload } from "@/type";
import {
  RichMentionEditor,
  RichMentionEditorHandle,
} from "@/components/rich-mention-editor";
import { RichContentView } from "@/components/rich-content-view";
import { MessageAttachmentToolbar } from "@/components/message-attachment-toolbar";
import { DiscussionAttachmentView } from "@/components/discussion-attachment-view";
import { useImageAttachmentUpload } from "@/hooks/use-image-attachment-upload";
import { cn } from "@/lib/utils";

interface DiscussionPanelProps {
  discussions: Discussion[] | null | undefined;
  onSubmit: (payload: DiscussionSubmitPayload) => Promise<void> | void;
  storagePathPrefix: string;
  currentUserId?: string | null;
  title?: string;
  placeholder?: string;
  emptyText?: string;
  className?: string;
}

export function DiscussionPanel({
  discussions,
  onSubmit,
  storagePathPrefix,
  currentUserId: currentUserIdProp,
  title = "Diskusi",
  placeholder = "Tulis pesan Anda di sini... (bisa drag & drop atau paste gambar)",
  emptyText = "Belum ada diskusi.",
  className,
}: DiscussionPanelProps) {
  const [fetchedUserId, setFetchedUserId] = useState<string | null>(null);
  const editorRef = useRef<RichMentionEditorHandle>(null);
  const [isMessageEmpty, setIsMessageEmpty] = useState(true);
  const [pendingAttachment, setPendingAttachment] =
    useState<DiscussionAttachment | null>(null);
  const [isDraggingOver, setIsDraggingOver] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  const { uploading, uploadFile } = useImageAttachmentUpload(storagePathPrefix);

  const currentUserId = currentUserIdProp ?? fetchedUserId;

  useEffect(() => {
    if (currentUserIdProp !== undefined) return;
    const supabase = createClient();
    supabase.auth.getUser().then(({ data }) => {
      setFetchedUserId(data.user?.id ?? null);
    });
  }, [currentUserIdProp]);

  const handleUploadFile = async (file: File) => {
    const attachment = await uploadFile(file);
    if (attachment) setPendingAttachment(attachment);
  };

  const submitMessage = async (attachmentOverride?: DiscussionAttachment) => {
    const isEmpty = editorRef.current?.isEmpty() ?? true;
    const attachment = attachmentOverride ?? pendingAttachment ?? undefined;
    if ((attachmentOverride ? false : isEmpty) && !attachment) return;

    setSubmitting(true);
    try {
      const message = attachmentOverride ? "" : editorRef.current?.getText() ?? "";
      const content =
        !attachmentOverride && !isEmpty ? editorRef.current?.getJSON() : undefined;
      const mentions = attachmentOverride
        ? []
        : editorRef.current?.getMentions() ?? [];

      await onSubmit({
        message,
        ...(content ? { content } : {}),
        ...(mentions.length > 0 ? { mentions } : {}),
        ...(attachment ? { attachment } : {}),
      });

      editorRef.current?.clear();
      setIsMessageEmpty(true);
      if (!attachmentOverride) setPendingAttachment(null);
      toast.success("Pesan berhasil terkirim!");
    } catch (error: any) {
      toast.error("Gagal mengirim pesan", { description: error.message });
    } finally {
      setSubmitting(false);
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    submitMessage();
  };

  const handleSendSticker = (emoji: string) => {
    submitMessage({ type: "sticker", emoji });
  };

  const list = discussions ?? [];

  return (
    <Card className={className}>
      <CardHeader>
        <CardTitle>{title}</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="space-y-4">
          <div className="space-y-4 max-h-96 overflow-y-auto pr-2">
            {list.length > 0 ? (
              list.map((chat, index) => (
                <DiscussionMessageBubble
                  key={index}
                  isMine={!!currentUserId && chat.user_id === currentUserId}
                  userName={chat.user_name}
                  timestamp={chat.timestamp}
                >
                  {(chat.content || chat.message) && (
                    <RichContentView
                      content={chat.content}
                      text={chat.message}
                      mentions={chat.mentions}
                    />
                  )}
                  {chat.attachment && (
                    <DiscussionAttachmentView attachment={chat.attachment} />
                  )}
                </DiscussionMessageBubble>
              ))
            ) : (
              <p className="text-sm text-center text-muted-foreground">
                {emptyText}
              </p>
            )}
          </div>
          <form onSubmit={handleSubmit} className="pt-4 border-t space-y-2">
            <div
              className={cn(
                "rounded-md",
                isDraggingOver &&
                  "outline-2 outline-dashed outline-primary/60 outline-offset-4",
              )}
              onDragOver={(e) => {
                e.preventDefault();
                setIsDraggingOver(true);
              }}
              onDragLeave={() => setIsDraggingOver(false)}
              onDrop={(e) => {
                e.preventDefault();
                setIsDraggingOver(false);
                const file = Array.from(e.dataTransfer.files).find((f) =>
                  f.type.startsWith("image/"),
                );
                if (file) handleUploadFile(file);
              }}
            >
              <RichMentionEditor
                ref={editorRef}
                placeholder={placeholder}
                disabled={submitting || uploading}
                onSubmit={() => submitMessage()}
                onPasteImage={handleUploadFile}
                onChange={() =>
                  setIsMessageEmpty(editorRef.current?.isEmpty() ?? true)
                }
              />
            </div>
            <div className="flex items-center justify-between gap-2">
              <MessageAttachmentToolbar
                pendingAttachment={pendingAttachment}
                onPendingAttachmentChange={setPendingAttachment}
                onSendSticker={handleSendSticker}
                uploading={uploading}
                onUploadFile={handleUploadFile}
                disabled={submitting}
              />
              <Button
                type="submit"
                size="icon"
                disabled={
                  submitting || uploading || (isMessageEmpty && !pendingAttachment)
                }
              >
                <Send className="h-4 w-4" />
              </Button>
            </div>
          </form>
        </div>
      </CardContent>
    </Card>
  );
}
