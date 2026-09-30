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
//
// Fitur "balas pesan" opt-in lewat `allowReply` - payload `reply_to` baru
// ikut tersimpan kalau caller-nya meneruskan field itu (MR/PO langsung dari
// payload, Update Web lewat p_reply_to di RPC). Petty Cash belum, karena RPC-nya
// belum menerima reply_to.

"use client";

import { useEffect, useRef, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { DiscussionMessageBubble } from "@/components/discussion-message-bubble";
import { createClient } from "@/lib/supabase/client";
import { toast } from "sonner";
import { Reply, Send, X } from "lucide-react";
import {
  Discussion,
  DiscussionAttachment,
  DiscussionSubmitPayload,
} from "@/type";
import { buildReplyRef, isReplyTarget } from "@/lib/discussion-reply";
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
  allowReply?: boolean;
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
  allowReply = false,
}: DiscussionPanelProps) {
  const [fetchedUserId, setFetchedUserId] = useState<string | null>(null);
  const editorRef = useRef<RichMentionEditorHandle>(null);
  const [isMessageEmpty, setIsMessageEmpty] = useState(true);
  const [pendingAttachment, setPendingAttachment] =
    useState<DiscussionAttachment | null>(null);
  const [isDraggingOver, setIsDraggingOver] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [replyTarget, setReplyTarget] = useState<Discussion | null>(null);
  const [highlightedIndex, setHighlightedIndex] = useState<number | null>(null);
  const messageRefs = useRef<(HTMLDivElement | null)[]>([]);
  const highlightTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const { uploading, uploadFile } = useImageAttachmentUpload(storagePathPrefix);

  const currentUserId = currentUserIdProp ?? fetchedUserId;

  useEffect(() => {
    if (currentUserIdProp !== undefined) return;
    const supabase = createClient();
    supabase.auth.getUser().then(({ data }) => {
      setFetchedUserId(data.user?.id ?? null);
    });
  }, [currentUserIdProp]);

  useEffect(
    () => () => {
      if (highlightTimer.current) clearTimeout(highlightTimer.current);
    },
    [],
  );

  const handleReply = (chat: Discussion) => {
    setReplyTarget(chat);
    editorRef.current?.focus();
  };

  const scrollToMessage = (index: number) => {
    const el = messageRefs.current[index];
    if (!el) return;
    el.scrollIntoView({ behavior: "smooth", block: "nearest" });
    setHighlightedIndex(index);
    if (highlightTimer.current) clearTimeout(highlightTimer.current);
    highlightTimer.current = setTimeout(() => setHighlightedIndex(null), 1500);
  };

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
        ...(replyTarget ? { reply_to: buildReplyRef(replyTarget) } : {}),
      });

      editorRef.current?.clear();
      setIsMessageEmpty(true);
      setReplyTarget(null);
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
              list.map((chat, index) => {
                const replyTo = chat.reply_to;
                const replyIndex = replyTo
                  ? list.findIndex((c) => isReplyTarget(c, replyTo))
                  : -1;
                return (
                  <div
                    key={index}
                    ref={(el) => {
                      messageRefs.current[index] = el;
                    }}
                  >
                    <DiscussionMessageBubble
                      isMine={!!currentUserId && chat.user_id === currentUserId}
                      userId={chat.user_id}
                      userName={chat.user_name}
                      timestamp={chat.timestamp}
                      replyTo={replyTo}
                      onReplyQuoteClick={
                        replyIndex >= 0
                          ? () => scrollToMessage(replyIndex)
                          : undefined
                      }
                      onReply={allowReply ? () => handleReply(chat) : undefined}
                      highlighted={highlightedIndex === index}
                    >
                      {(chat.content || chat.message) && (
                        <RichContentView
                          content={chat.content}
                          text={chat.message}
                          mentions={chat.mentions}
                        />
                      )}
                      {chat.attachment && (
                        <DiscussionAttachmentView
                          attachment={chat.attachment}
                        />
                      )}
                    </DiscussionMessageBubble>
                  </div>
                );
              })
            ) : (
              <p className="text-sm text-center text-muted-foreground">
                {emptyText}
              </p>
            )}
          </div>
          <form onSubmit={handleSubmit} className="pt-4 border-t space-y-2">
            {replyTarget && (
              <div className="flex items-start gap-2 rounded-md border-l-2 border-primary bg-muted/50 px-3 py-2 text-xs">
                <Reply className="mt-0.5 h-3.5 w-3.5 shrink-0 text-muted-foreground" />
                <div className="min-w-0 flex-1">
                  <p className="font-semibold">
                    Membalas {replyTarget.user_name || "-"}
                  </p>
                  <p className="truncate text-muted-foreground">
                    {buildReplyRef(replyTarget).excerpt || "(pesan)"}
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => setReplyTarget(null)}
                  aria-label="Batal membalas"
                  className="rounded p-0.5 text-muted-foreground hover:bg-muted hover:text-foreground"
                >
                  <X className="h-3.5 w-3.5" />
                </button>
              </div>
            )}
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
