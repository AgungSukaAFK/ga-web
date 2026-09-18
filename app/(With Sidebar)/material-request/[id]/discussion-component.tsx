// src/app/material-request/[id]/discussion-section.tsx
"use client";

import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { createClient } from "@/lib/supabase/client";
import { toast } from "sonner";
import { Send } from "lucide-react";
import { useRouter } from "next/navigation";
import { Discussion, DiscussionAttachment, DiscussionMention } from "@/type";
import { logActivity } from "@/services/logService";
import { sendNotification } from "@/lib/notifications/client";
import { MentionTextarea } from "@/components/mention-textarea";
import { MessageWithMentions } from "@/components/message-with-mentions";
import { MessageAttachmentToolbar } from "@/components/message-attachment-toolbar";
import { DiscussionAttachmentView } from "@/components/discussion-attachment-view";

interface DiscussionSectionProps {
  mrId: string;
  initialDiscussions: Discussion[];
}

export function DiscussionSection({
  mrId,
  initialDiscussions,
}: DiscussionSectionProps) {
  const [discussions, setDiscussions] = useState(initialDiscussions);
  const [newMessage, setNewMessage] = useState("");
  const [pendingMentions, setPendingMentions] = useState<DiscussionMention[]>(
    [],
  );
  const [pendingAttachment, setPendingAttachment] =
    useState<DiscussionAttachment | null>(null);
  const [loading, setLoading] = useState(false);
  const supabase = createClient();
  const router = useRouter();

  const submitMessage = async (attachmentOverride?: DiscussionAttachment) => {
    const message = attachmentOverride ? "" : newMessage;
    const attachment = attachmentOverride ?? pendingAttachment ?? undefined;
    if (message.trim() === "" && !attachment) return;

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

      // Hanya notifikasi/simpan mention yang tag-nya masih ada di pesan final
      // (kalau user hapus "@Nama"-nya lagi sebelum kirim, ga usah dinotif).
      const finalMentions = pendingMentions.filter(
        (m, index, arr) =>
          message.includes(`@${m.nama}`) &&
          arr.findIndex((x) => x.id === m.id) === index,
      );

      const newDiscussionEntry: Discussion = {
        user_id: user.id,
        user_name: userName,
        message,
        timestamp: new Date().toISOString(),
        ...(finalMentions.length > 0 ? { mentions: finalMentions } : {}),
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

      await Promise.all(
        finalMentions
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
      setNewMessage("");
      setPendingMentions([]);
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
                    {chat.message && (
                      <p className="text-sm mt-1 whitespace-pre-wrap">
                        <MessageWithMentions
                          text={chat.message}
                          mentions={chat.mentions}
                        />
                      </p>
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
          <form onSubmit={handleSubmit} className="pt-4 border-t space-y-1.5">
            <div className="flex items-start gap-3">
              <MentionTextarea
                placeholder="Tulis pesan Anda di sini..."
                value={newMessage}
                onValueChange={setNewMessage}
                onMentionAdd={(mention) =>
                  setPendingMentions((prev) =>
                    prev.some((m) => m.id === mention.id)
                      ? prev
                      : [...prev, mention],
                  )
                }
                onSubmit={() => submitMessage()}
                rows={2}
                disabled={loading}
              />
              <MessageAttachmentToolbar
                pathPrefix={`discussions/material-request/${mrId}`}
                pendingAttachment={pendingAttachment}
                onPendingAttachmentChange={setPendingAttachment}
                onSendSticker={handleSendSticker}
                disabled={loading}
              />
              <Button
                type="submit"
                size="icon"
                disabled={
                  loading || (newMessage.trim() === "" && !pendingAttachment)
                }
              >
                <Send className="h-4 w-4" />
              </Button>
            </div>
            <p className="text-xs text-muted-foreground">
              Tips: ketik <span className="font-medium">@</span> lalu nama
              user untuk mention/tag - orang yang ditag akan mendapat
              notifikasi. Enter untuk kirim, Shift+Enter untuk baris baru.
            </p>
          </form>
        </div>
      </CardContent>
    </Card>
  );
}
