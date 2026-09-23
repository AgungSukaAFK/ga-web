// src/components/petty-cash/PcDiscussionPanel.tsx
//
// Panel diskusi INTERAKTIF (baca + kirim pesan) untuk halaman detail
// dokumen Petty Cash (Pengajuan/Voucher/Deklarasi, lihat
// petty-cash/{pengajuan,voucher,deklarasi}/[id]/page.tsx). Beda dari
// riwayat diskusi read-only yang sudah ada di PcDocumentInfoPanel (dipakai
// di dialog ringkas/preview) - panel ini yang punya kotak kirim pesan.
// SIAPA PUN yang login boleh kirim pesan di sini (bukan dibatasi pemilik/
// approver yang gilirannya pending) - lihat komentar di
// services/pcDiscussionService.ts & supabase/petty-cash-discussion-rpc-setup.sql
// untuk kenapa itu aman (RPC yang cuma bisa sentuh kolom `discussions`).
//
// print:hidden - diskusi bukan bagian dokumen resmi yang dicetak (halaman
// pemanggil juga sudah bungkus seluruh Content dengan .no-print, ini
// lapisan jaga-jaga kedua kalau komponen ini dipakai di tempat lain nanti).

"use client";

import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { toast } from "sonner";
import { Loader2, Send } from "lucide-react";

interface PcDiscussionEntry {
  user_id?: string;
  user_name?: string;
  message?: string;
  timestamp: string;
}

interface PcDiscussionPanelProps {
  discussions: PcDiscussionEntry[] | null | undefined;
  onSubmit: (message: string) => Promise<void>;
}

export function PcDiscussionPanel({
  discussions,
  onSubmit,
}: PcDiscussionPanelProps) {
  const [message, setMessage] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!message.trim() || submitting) return;
    setSubmitting(true);
    try {
      await onSubmit(message.trim());
      setMessage("");
    } catch (error: any) {
      toast.error("Gagal mengirim pesan", { description: error.message });
    } finally {
      setSubmitting(false);
    }
  };

  const list = discussions ?? [];

  return (
    <Card className="print:hidden">
      <CardHeader>
        <CardTitle className="text-base">Diskusi</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="space-y-4">
          <div className="space-y-3 max-h-80 overflow-y-auto pr-2">
            {list.length > 0 ? (
              list.map((chat, idx) => (
                <div key={idx} className="flex items-start gap-3">
                  <Avatar className="w-8 h-8">
                    <AvatarFallback className="text-xs">
                      {(chat.user_name || "?").substring(0, 2).toUpperCase()}
                    </AvatarFallback>
                  </Avatar>
                  <div className="w-full rounded-lg bg-muted/50 p-3 border">
                    <div className="flex justify-between items-center mb-1 gap-2">
                      <p className="font-semibold text-xs truncate">
                        {chat.user_name || "-"}
                      </p>
                      <p className="text-[10px] text-muted-foreground shrink-0">
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
          <form onSubmit={handleSubmit} className="pt-4 border-t flex gap-2">
            <Textarea
              placeholder="Tulis pesan..."
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.shiftKey) {
                  e.preventDefault();
                  handleSubmit(e);
                }
              }}
              rows={2}
              disabled={submitting}
              className="flex-1"
            />
            <Button
              type="submit"
              size="icon"
              disabled={submitting || !message.trim()}
            >
              {submitting ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Send className="h-4 w-4" />
              )}
            </Button>
          </form>
        </div>
      </CardContent>
    </Card>
  );
}
