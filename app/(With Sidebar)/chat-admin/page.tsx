// src/app/(With Sidebar)/chat-admin/page.tsx
//
// Chat dengan admin departemen IT dari sisi user - daftar percakapan milik
// sendiri (kiri) + isi chat (kanan). Tiap percakapan 1 topik dengan status,
// lihat supabase/migrations/0007_chat_admin.sql. Admin membalas dari
// /chat-admin-management.

"use client";

import { Suspense, useState } from "react";
import { toast } from "@/lib/toast";
import { CheckCircle2, Headset, Loader2, Plus } from "lucide-react";
import { Content } from "@/components/content";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { SupportTicketList } from "@/components/support-chat/support-ticket-list";
import { SupportChatThread } from "@/components/support-chat/support-chat-thread";
import { NewSupportTicketDialog } from "@/components/support-chat/new-support-ticket-dialog";
import { useSupportTickets } from "@/components/support-chat/use-support-tickets";
import { setSupportTicketStatus } from "@/services/supportChatService";

function ChatAdminView() {
  const {
    profile,
    profileLoading,
    tickets,
    loading,
    refresh,
    selectedId,
    selected,
    select,
  } = useSupportTickets(false);
  const [newOpen, setNewOpen] = useState(false);
  const [closing, setClosing] = useState(false);

  if (profileLoading) {
    return (
      <div className="col-span-12 flex justify-center py-20 text-muted-foreground">
        <Loader2 className="h-6 w-6 animate-spin" />
      </div>
    );
  }
  if (!profile) return null;

  const currentUser = { id: profile.id, nama: profile.nama ?? null };

  const handleClose = async () => {
    if (!selected) return;
    setClosing(true);
    try {
      await setSupportTicketStatus({
        ticket: selected,
        action: "selesai",
        asAdmin: false,
        actorName: profile.nama || "User",
      });
      toast.success("Percakapan ditandai selesai.");
    } catch (err: any) {
      toast.error("Gagal mengubah status", { description: err.message });
    } finally {
      setClosing(false);
    }
  };

  return (
    <Content
      title="Chat Admin"
      description="Tanya atau laporkan kendala aplikasi langsung ke admin departemen IT."
      cardAction={
        <Button onClick={() => setNewOpen(true)}>
          <Plus className="mr-2 h-4 w-4" />
          Percakapan Baru
        </Button>
      }
    >
      <div className="grid h-[calc(100svh-15rem)] min-h-[480px] overflow-hidden rounded-lg border md:grid-cols-[minmax(260px,340px)_1fr]">
        <div
          className={cn(
            "min-h-0 overflow-y-auto md:border-r",
            selectedId && "hidden md:block",
          )}
        >
          <SupportTicketList
            tickets={tickets}
            selectedId={selectedId}
            onSelect={select}
            asAdmin={false}
            loading={loading}
            emptyText="Belum ada percakapan. Klik “Percakapan Baru” untuk mulai chat dengan admin."
          />
        </div>

        <div className={cn("min-h-0", !selectedId && "hidden md:block")}>
          {selected ? (
            <SupportChatThread
              key={selected.id}
              ticket={selected}
              currentUser={currentUser}
              asAdmin={false}
              onBack={() => select(null)}
              headerActions={
                selected.status !== "selesai" && (
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={handleClose}
                    disabled={closing}
                  >
                    {closing ? (
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    ) : (
                      <CheckCircle2 className="mr-2 h-4 w-4" />
                    )}
                    Selesai
                  </Button>
                )
              }
            />
          ) : (
            <div className="flex h-full flex-col items-center justify-center gap-3 p-6 text-center text-muted-foreground">
              {selectedId && loading ? (
                <Loader2 className="h-5 w-5 animate-spin" />
              ) : (
                <>
                  <span className="flex h-12 w-12 items-center justify-center rounded-full bg-primary/10 text-primary">
                    <Headset className="h-6 w-6" />
                  </span>
                  <p className="max-w-xs text-sm">
                    {selectedId
                      ? "Percakapan tidak ditemukan."
                      : "Pilih percakapan di kiri, atau mulai percakapan baru dengan admin IT."}
                  </p>
                </>
              )}
            </div>
          )}
        </div>
      </div>

      <NewSupportTicketDialog
        open={newOpen}
        onOpenChange={setNewOpen}
        currentUser={currentUser}
        onCreated={async (id) => {
          await refresh();
          select(id);
        }}
      />
    </Content>
  );
}

export default function ChatAdminPage() {
  return (
    <Suspense>
      <ChatAdminView />
    </Suspense>
  );
}
