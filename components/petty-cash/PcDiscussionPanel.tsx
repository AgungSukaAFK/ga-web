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

import { useRef, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { toast } from "sonner";
import { Loader2, Send } from "lucide-react";
import {
  RichMentionEditor,
  RichMentionEditorHandle,
} from "@/components/rich-mention-editor";
import { RichContentView } from "@/components/rich-content-view";
import { DiscussionMention } from "@/type";
import { PcDiscussionPayload } from "@/services/pcDiscussionService";

interface PcDiscussionEntry {
  user_id?: string;
  user_name?: string;
  message?: string;
  content?: Record<string, unknown>;
  mentions?: DiscussionMention[];
  timestamp: string;
}

interface PcDiscussionPanelProps {
  discussions: PcDiscussionEntry[] | null | undefined;
  onSubmit: (payload: PcDiscussionPayload) => Promise<void>;
}

export function PcDiscussionPanel({
  discussions,
  onSubmit,
}: PcDiscussionPanelProps) {
  const editorRef = useRef<RichMentionEditorHandle>(null);
  const [isEmpty, setIsEmpty] = useState(true);
  const [submitting, setSubmitting] = useState(false);

  const submitMessage = async () => {
    if ((editorRef.current?.isEmpty() ?? true) || submitting) return;
    setSubmitting(true);
    try {
      await onSubmit({
        message: editorRef.current?.getText().trim() ?? "",
        content: editorRef.current?.getJSON(),
        mentions: editorRef.current?.getMentions(),
      });
      editorRef.current?.clear();
      setIsEmpty(true);
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
                    {(chat.content || chat.message) && (
                      <RichContentView
                        content={chat.content}
                        text={chat.message}
                        mentions={chat.mentions}
                      />
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
            <RichMentionEditor
              ref={editorRef}
              placeholder="Tulis pesan..."
              disabled={submitting}
              onSubmit={() => submitMessage()}
              onChange={() =>
                setIsEmpty(editorRef.current?.isEmpty() ?? true)
              }
            />
            <div className="flex justify-end">
              <Button type="submit" size="icon" disabled={submitting || isEmpty}>
                {submitting ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Send className="h-4 w-4" />
                )}
              </Button>
            </div>
          </form>
        </div>
      </CardContent>
    </Card>
  );
}
