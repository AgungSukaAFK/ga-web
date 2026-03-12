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

export function PcDiscussionSection({
  pcId,
  initialDiscussions,
}: {
  pcId: number;
  initialDiscussions: any[];
}) {
  const [discussions, setDiscussions] = useState(initialDiscussions || []);
  const [newMessage, setNewMessage] = useState("");
  const [loading, setLoading] = useState(false);
  const supabase = createClient();
  const router = useRouter();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newMessage.trim()) return;
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

      const newEntry = {
        user_id: user.id,
        user_name: profile?.nama || user.email || "Unknown User",
        message: newMessage,
        timestamp: new Date().toISOString(),
      };

      const updatedDiscussions = [...discussions, newEntry];

      const { error } = await supabase
        .from("petty_cash_requests")
        .update({ discussions: updatedDiscussions })
        .eq("id", pcId);

      if (error) throw error;

      setDiscussions(updatedDiscussions);
      setNewMessage("");
      toast.success("Pesan terkirim!");
      router.refresh();
    } catch (error: any) {
      toast.error("Gagal mengirim pesan", { description: error.message });
    } finally {
      setLoading(false);
    }
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
                <div key={idx} className="flex items-start gap-3">
                  <Avatar className="w-8 h-8">
                    <AvatarFallback className="text-xs">
                      {chat.user_name?.substring(0, 2).toUpperCase()}
                    </AvatarFallback>
                  </Avatar>
                  <div className="w-full rounded-lg bg-muted/50 p-3 border">
                    <div className="flex justify-between items-center mb-1">
                      <p className="font-semibold text-xs">{chat.user_name}</p>
                      <p className="text-[10px] text-muted-foreground">
                        {new Date(chat.timestamp).toLocaleString("id-ID")}
                      </p>
                    </div>
                    <p className="text-sm whitespace-pre-wrap">
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
          <form onSubmit={handleSubmit} className="flex gap-2 pt-4 border-t">
            <Textarea
              placeholder="Tulis catatan atau alasan di sini..."
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
