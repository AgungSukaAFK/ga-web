// src/app/material-request/[id]/discussion-section.tsx

"use client";

import { useRef, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { createClient } from "@/lib/supabase/client";
import { toast } from "sonner";
import { Send } from "lucide-react";
import { useRouter } from "next/navigation";
import { Discussion, DiscussionAttachment } from "@/type";
import { logActivity } from "@/services/logService";
import { sendNotification } from "@/lib/notifications/client";
import {
  RichMentionEditor,
  RichMentionEditorHandle,
} from "@/components/rich-mention-editor";
import { RichContentView } from "@/components/rich-content-view";
import { MessageAttachmentToolbar } from "@/components/message-attachment-toolbar";
import { DiscussionAttachmentView } from "@/components/discussion-attachment-view";
import { useImageAttachmentUpload } from "@/hooks/use-image-attachment-upload";
import { cn } from "@/lib/utils";

interface DiscussionSectionProps {
  mrId: string;
  initialDiscussions: Discussion[];
}

export function DiscussionSection({
  mrId,
  initialDiscussions,
}: DiscussionSectionProps) {
  const [discussions, setDiscussions] = useState(initialDiscussions);
  const editorRef = useRef<RichMentionEditorHandle>(null);
  const [isMessageEmpty, setIsMessageEmpty] = useState(true);
  const [pendingAttachment, setPendingAttachment] =
    useState<DiscussionAttachment | null>(null);
  const [isDraggingOver, setIsDraggingOver] = useState(false);
  const [loading, setLoading] = useState(false);
  const supabase = createClient();
  const router = useRouter();

  const { uploading, uploadFile } = useImageAttachmentUpload(
    `discussions/material-request/${mrId}`,
  );

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
      if (!user) throw new Error("Anda harus login untuk mengirim pesan.");

      const { data: profile } = await supabase
        .from("profiles")
        .select("nama")
        .eq("id", user.id)
        .single();
      const userName = profile?.nama || user.email || "Unknown User";

      const message = attachmentOverride ? "" : editorRef.current?.getText() ?? "";
      const content =
        !attachmentOverride && !isEmpty
          ? editorRef.current?.getJSON()
          : undefined;
      const mentions = attachmentOverride
        ? []
        : editorRef.current?.getMentions() ?? [];

      const newDiscussionEntry: Discussion = {
        user_id: user.id,
        user_name: userName,
        message,
        timestamp: new Date().toISOString(),
        ...(content ? { content } : {}),
        ...(mentions.length > 0 ? { mentions } : {}),
        ...(attachment ? { attachment } : {}),
      };

      const updatedDiscussions = [...discussions, newDiscussionEntry];

      const { error } = await supabase
        .from("material_requests")
        .update({ discussions: updatedDiscussions })
        .eq("id", mrId);

      if (error) throw error;

      await logActivity(
        user.id,
        "ADD_MR_DISCUSSION",
        "material_request",
        String(mrId),
        `${userName} menambahkan pesan diskusi pada MR ini.`,
        { message },
      );

      const userMentions = mentions.filter((m) => m.type === "user");
      await Promise.all(
        userMentions
          .filter((m) => m.id !== user.id)
          .map((m) =>
            sendNotification({
              userId: m.id,
              actorId: user.id,
              type: "mention",
              title: "Anda di-tag dalam diskusi",
              message: `${userName} men-tag Anda dalam diskusi MR.`,
              link: `/material-request/${mrId}`,
              resourceId: String(mrId),
              resourceType: "material_request",
            }),
          ),
      );

      setDiscussions(updatedDiscussions);
      editorRef.current?.clear();
      setIsMessageEmpty(true);
      if (!attachmentOverride) setPendingAttachment(null);
      toast.success("Pesan berhasil terkirim!");
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
    <Card>
      <CardHeader>
        <CardTitle>Diskusi</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="space-y-4">
          <div className="space-y-4 max-h-96 overflow-y-auto pr-2">
            {discussions.length > 0 ? (
              discussions.map((chat, index) => (
                <div key={index} className="flex items-start gap-3">
                  <Avatar>
                    <AvatarFallback>
                      {chat.user_name?.substring(0, 2).toUpperCase()}
                    </AvatarFallback>
                  </Avatar>
                  <div className="w-full rounded-lg bg-muted p-3">
                    <div className="flex justify-between items-center">
                      <p className="font-semibold text-sm">{chat.user_name}</p>
                      <p className="text-xs text-muted-foreground">
                        {new Date(chat.timestamp).toLocaleString("id-ID")}
                      </p>
                    </div>
                    {(chat.content || chat.message) && (
                      <div className="mt-1">
                        <RichContentView
                          content={chat.content}
                          text={chat.message}
                          mentions={chat.mentions}
                        />
                      </div>
                    )}
                    {chat.attachment && (
                      <DiscussionAttachmentView attachment={chat.attachment} />
                    )}
                  </div>
                </div>
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
                placeholder="Tulis pesan Anda di sini... (bisa drag & drop atau paste gambar)"
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
