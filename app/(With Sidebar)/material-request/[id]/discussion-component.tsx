// src/app/material-request/[id]/discussion-section.tsx
"use client";

import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { createClient } from "@/lib/supabase/client";
import { toast } from "sonner";
import { Send } from "lucide-react";
import { useRouter } from "next/navigation";
import { Discussion } from "@/type";

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
  const [loading, setLoading] = useState(false);
  const supabase = createClient();
  const router = useRouter();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (newMessage.trim() === "") return;

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

      const newDiscussionEntry: Discussion = {
        user_id: user.id,
        user_name: userName,
        message: newMessage,
        timestamp: new Date().toISOString(),
      };

      const updatedDiscussions = [...discussions, newDiscussionEntry];

      const { error } = await supabase
        .from("material_requests")
        .update({ discussions: updatedDiscussions })
        .eq("id", mrId);

      if (error) throw error;

      setDiscussions(updatedDiscussions);
      setNewMessage("");
      toast.success("Pesan berhasil terkirim!");
      router.refresh();
    } catch (error: any) {
      toast.error("Gagal mengirim pesan", { description: error.message });
    } finally {
      setLoading(false);
    }
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
                    <p className="text-sm mt-1 whitespace-pre-wrap">
                      {chat.message}
                    </p>
                  </div>
                </div>
              ))
            ) : (
              <p className="text-sm text-center text-muted-foreground">
                Belum ada diskusi.
              </p>
            )}
          </div>
          <form
            onSubmit={handleSubmit}
            className="flex items-start gap-3 pt-4 border-t"
          >
            <Textarea
              placeholder="Tulis pesan Anda di sini..."
              value={newMessage}
              onChange={(e) => setNewMessage(e.target.value)}
              rows={2}
              disabled={loading}
            />
            <Button type="submit" size="icon" disabled={loading}>
              <Send className="h-4 w-4" />
            </Button>
          </form>
        </div>
      </CardContent>
    </Card>
  );
}
