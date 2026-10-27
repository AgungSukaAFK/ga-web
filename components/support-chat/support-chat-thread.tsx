"use client";

// Isi 1 percakapan Chat Admin (panel kanan): header, daftar pesan realtime,
// dan kotak ketik. Dipakai halaman user & admin IT - bedanya cuma di
// `asAdmin` (sisi bubble, penanda dibaca) dan tombol aksi di `headerActions`.

import { Fragment, useEffect, useRef, useState } from "react";
import { format, isSameDay } from "date-fns";
import { id as localeId } from "date-fns/locale";
import { toast } from "@/lib/toast";
import { ArrowLeft, Loader2 } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";
import { DiscussionMessageBubble } from "@/components/discussion-message-bubble";
import { NoteWithLinks } from "@/components/note-with-links";
import {
  fetchSupportMessages,
  markSupportTicketRead,
  sendSupportMessage,
  SupportAttachmentInput,
} from "@/services/supportChatService";
import { SupportStatusBadge } from "./support-ticket-list";
import { SupportAttachmentView, SupportComposer } from "./support-composer";
import { SupportMessage, SupportTicket } from "@/type";

export function SupportChatThread({
  ticket,
  currentUser,
  asAdmin,
  headerInfo,
  headerActions,
  onBack,
}: {
  ticket: SupportTicket;
  currentUser: { id: string; nama: string | null };
  asAdmin: boolean;
  headerInfo?: React.ReactNode;
  headerActions?: React.ReactNode;
  onBack?: () => void;
}) {
  const [messages, setMessages] = useState<SupportMessage[]>([]);
  const [loading, setLoading] = useState(true);
  const bottomRef = useRef<HTMLDivElement>(null);
  const ticketId = ticket.id;

  const appendMessage = (msg: SupportMessage) =>
    setMessages((prev) =>
      prev.some((m) => m.id === msg.id) ? prev : [...prev, msg],
    );

  useEffect(() => {
    const supabase = createClient();
    let cancelled = false;
    let channel: ReturnType<typeof supabase.channel> | null = null;

    setLoading(true);
    setMessages([]);
    fetchSupportMessages(ticketId)
      .then((data) => {
        if (!cancelled) setMessages(data);
      })
      .catch((err) =>
        toast.error("Gagal memuat pesan", { description: err.message }),
      )
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    markSupportTicketRead(ticketId);

    (async () => {
      const {
        data: { session },
      } = await supabase.auth.getSession();
      if (session?.access_token) {
        await supabase.realtime.setAuth(session.access_token);
      }
      if (cancelled) return;
      channel = supabase
        .channel(`support-thread-${ticketId}`)
        .on(
          "postgres_changes",
          {
            event: "INSERT",
            schema: "public",
            table: "support_messages",
            filter: `ticket_id=eq.${ticketId}`,
          },
          (payload) => {
            const msg = payload.new as SupportMessage;
            appendMessage(msg);
            // Pesan dari pihak lawan saat percakapan sedang dibuka langsung
            // dianggap terbaca.
            if (msg.sender_id !== currentUser.id && !document.hidden) {
              markSupportTicketRead(ticketId);
            }
          },
        )
        .subscribe();
    })();

    const onVisible = () => {
      if (!document.hidden) markSupportTicketRead(ticketId);
    };
    document.addEventListener("visibilitychange", onVisible);

    return () => {
      cancelled = true;
      document.removeEventListener("visibilitychange", onVisible);
      if (channel) supabase.removeChannel(channel);
    };
  }, [ticketId, currentUser.id]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ block: "end" });
  }, [messages.length, loading]);

  const handleSend = async (
    pesan: string,
    lampiran: SupportAttachmentInput | null,
  ) => {
    try {
      const msg = await sendSupportMessage({
        ticket,
        senderId: currentUser.id,
        senderName: currentUser.nama || "User",
        asAdmin,
        pesan,
        lampiran,
      });
      appendMessage(msg);
      return true;
    } catch (err: any) {
      toast.error("Gagal mengirim pesan", { description: err.message });
      return false;
    }
  };

  const hint =
    ticket.status === "selesai"
      ? asAdmin
        ? "Percakapan ini sudah selesai. Membalas akan membukanya kembali."
        : "Percakapan ini sudah selesai. Kirim pesan kalau masih ada kendala - percakapan akan dibuka kembali."
      : undefined;

  return (
    <div className="flex h-full min-h-0 flex-col">
      <div className="flex items-start gap-2 border-b p-3">
        {onBack && (
          <Button
            variant="ghost"
            size="icon"
            className="shrink-0 md:hidden"
            onClick={onBack}
            aria-label="Kembali ke daftar percakapan"
          >
            <ArrowLeft className="h-4 w-4" />
          </Button>
        )}
        <div className="min-w-0 flex-1 space-y-1">
          <div className="flex flex-wrap items-center gap-2">
            <h2 className="truncate text-base font-semibold">{ticket.subjek}</h2>
            <SupportStatusBadge status={ticket.status} />
          </div>
          <p className="text-xs text-muted-foreground">
            #{ticket.id} · {ticket.kategori} · dibuat{" "}
            {format(new Date(ticket.created_at), "d MMM yyyy HH:mm", {
              locale: localeId,
            })}
          </p>
          {headerInfo}
        </div>
        {headerActions && (
          <div className="flex shrink-0 flex-wrap items-center justify-end gap-1">
            {headerActions}
          </div>
        )}
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto px-3 py-4">
        {loading ? (
          <div className="flex h-full items-center justify-center text-muted-foreground">
            <Loader2 className="h-5 w-5 animate-spin" />
          </div>
        ) : (
          <div className="space-y-3">
            {messages.map((m, i) => {
              const prev = messages[i - 1];
              const newDay =
                !prev ||
                !isSameDay(new Date(prev.created_at), new Date(m.created_at));
              return (
                <Fragment key={m.id}>
                  {newDay && (
                    <div className="flex justify-center py-1">
                      <span className="rounded-full bg-muted px-3 py-0.5 text-[11px] text-muted-foreground">
                        {format(new Date(m.created_at), "EEEE, d MMMM yyyy", {
                          locale: localeId,
                        })}
                      </span>
                    </div>
                  )}
                  {m.is_system ? (
                    <p className="text-center text-xs text-muted-foreground">
                      {m.pesan} ·{" "}
                      {format(new Date(m.created_at), "HH:mm")}
                    </p>
                  ) : (
                    <DiscussionMessageBubble
                      compact
                      isMine={m.sender_id === currentUser.id}
                      userId={m.sender_id}
                      userName={
                        m.is_admin
                          ? `${m.sender_nama || "Admin"} · Admin IT`
                          : m.sender_nama
                      }
                      timestamp={m.created_at}
                    >
                      {m.pesan && (
                        <p className="whitespace-pre-wrap break-words text-sm">
                          <NoteWithLinks text={m.pesan} />
                        </p>
                      )}
                      {m.lampiran_url && (
                        <SupportAttachmentView
                          url={m.lampiran_url}
                          nama={m.lampiran_nama}
                          tipe={m.lampiran_tipe}
                        />
                      )}
                    </DiscussionMessageBubble>
                  )}
                </Fragment>
              );
            })}
            <div ref={bottomRef} />
          </div>
        )}
      </div>

      <SupportComposer userId={currentUser.id} onSend={handleSend} hint={hint} />
    </div>
  );
}
