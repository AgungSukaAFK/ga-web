"use client";

import { useEffect, useRef, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { DiscussionMessageBubble } from "@/components/discussion-message-bubble";
import { createClient } from "@/lib/supabase/client";
import { toast } from "sonner";
import { Send } from "lucide-react";
import { useRouter } from "next/navigation";
import { Discussion, DiscussionAttachment } from "@/type";
import {
  RichMentionEditor,
  RichMentionEditorHandle,
} from "@/components/rich-mention-editor";
import { RichContentView } from "@/components/rich-content-view";
import { MessageAttachmentToolbar } from "@/components/message-attachment-toolbar";
import { DiscussionAttachmentView } from "@/components/discussion-attachment-view";
import { useImageAttachmentUpload } from "@/hooks/use-image-attachment-upload";
import { cn } from "@/lib/utils";

export function PcDiscussionSection({
  pcId,
  initialDiscussions,
}: {
  pcId: number;
  initialDiscussions: Discussion[];
}) {
  const [discussions, setDiscussions] = useState(initialDiscussions || []);
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);
  const editorRef = useRef<RichMentionEditorHandle>(null);
  const [isMessageEmpty, setIsMessageEmpty] = useState(true);
  const [pendingAttachment, setPendingAttachment] =
    useState<DiscussionAttachment | null>(null);
  const [isDraggingOver, setIsDraggingOver] = useState(false);
  const [loading, setLoading] = useState(false);
  const supabase = createClient();
  const router = useRouter();

  const { uploading, uploadFile } = useImageAttachmentUpload(
    `discussions/petty-cash/${pcId}`,
  );

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => {
      setCurrentUserId(data.user?.id ?? null);
    });
  }, []);

  const handleUploadFile = async (file: File) => {
    const attachment = await uploadFile(file);
    if (attachment) setPendingAttachment(attachment);
  };

  const submitMessage = async (attachmentOverride?: DiscussionAttachment) => {
    const isEmpty = editorRef.current?.isEmpty() ?? true;
    const attachment = attachmentOverride ?? pendingAttachment ?? undefined;
    if ((attachmentOverride ? false : isEmpty) && !attachment) return;
    setLoading(true);

    try {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) throw new Error("Anda harus login.");

      const { data: profile } = await supabase
        .from("profiles")
        .select("nama")
        .eq("id", user.id)
        .single();

      const message = attachmentOverride ? "" : editorRef.current?.getText() ?? "";
      const content =
        !attachmentOverride && !isEmpty
          ? editorRef.current?.getJSON()
          : undefined;
      const mentions = attachmentOverride
        ? []
        : editorRef.current?.getMentions() ?? [];

      const newEntry: Discussion = {
        user_id: user.id,
        user_name: profile?.nama || user.email || "Unknown User",
        message,
        timestamp: new Date().toISOString(),
        ...(content ? { content } : {}),
        ...(mentions.length > 0 ? { mentions } : {}),
        ...(attachment ? { attachment } : {}),
      };

      const updatedDiscussions = [...discussions, newEntry];

      const { error } = await supabase
        .from("petty_cash_requests")
        .update({ discussions: updatedDiscussions })
        .eq("id", pcId);

      if (error) throw error;

      setDiscussions(updatedDiscussions);
      editorRef.current?.clear();
      setIsMessageEmpty(true);
      if (!attachmentOverride) setPendingAttachment(null);
      toast.success("Pesan terkirim!");
      router.refresh();
    } catch (error: any) {
      toast.error("Gagal mengirim pesan", { description: error.message });
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    submitMessage();
  };

  const handleSendSticker = (emoji: string) => {
    submitMessage({ type: "sticker", emoji });
  };

  return (
    <Card className="print:hidden">
      <CardHeader>
        <CardTitle className="text-base">Diskusi Internal</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="space-y-4">
          <div className="space-y-4 max-h-80 overflow-y-auto pr-2">
            {discussions.length > 0 ? (
              discussions.map((chat, idx) => (
                <DiscussionMessageBubble
                  key={idx}
                  compact
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
                Belum ada diskusi.
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
                placeholder="Tulis catatan atau alasan di sini... (bisa drag & drop atau paste gambar)"
                disabled={loading || uploading}
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
                disabled={loading}
              />
              <Button
                type="submit"
                size="icon"
                disabled={loading || uploading || (isMessageEmpty && !pendingAttachment)}
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
