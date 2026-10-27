// src/app/(With Sidebar)/chat-admin-management/page.tsx
//
// Inbox Chat Admin - khusus admin departemen IT (isITAdmin). Semua
// percakapan user masuk ke sini sebagai inbox bersama: admin bisa "Ambil"
// percakapan (otomatis juga saat pertama membalas), mengalihkan ke admin IT
// lain, menandai selesai / membuka kembali, dan menghapus. Akses data dijaga
// RLS + RPC di supabase/migrations/0007_chat_admin.sql, guard di sini cuma tampilan.

"use client";

import { Suspense, useEffect, useMemo, useState } from "react";
import { toast } from "@/lib/toast";
import {
  CheckCircle2,
  Hand,
  Inbox,
  Loader2,
  RotateCcw,
  Search,
  ShieldAlert,
  Trash2,
} from "lucide-react";
import { isITAdmin } from "@/lib/constants/departments";
import { cn } from "@/lib/utils";
import { Content } from "@/components/content";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { SupportTicketList } from "@/components/support-chat/support-ticket-list";
import { SupportChatThread } from "@/components/support-chat/support-chat-thread";
import { useSupportTickets } from "@/components/support-chat/use-support-tickets";
import {
  assignSupportTicket,
  deleteSupportTicket,
  fetchITAdmins,
  ITAdmin,
  setSupportTicketStatus,
} from "@/services/supportChatService";
import { SupportTicketStatus } from "@/type";

type Filter = "semua" | SupportTicketStatus;
const UNASSIGNED = "__none__";

function ChatAdminManagementView() {
  const {
    profile,
    profileLoading,
    tickets,
    loading,
    refresh,
    selectedId,
    selected,
    select,
  } = useSupportTickets(true);
  const canAccess = isITAdmin(profile);

  const [admins, setAdmins] = useState<ITAdmin[]>([]);
  const [filter, setFilter] = useState<Filter>("menunggu");
  const [mineOnly, setMineOnly] = useState(false);
  const [search, setSearch] = useState("");
  const [busy, setBusy] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);

  useEffect(() => {
    if (!canAccess) return;
    fetchITAdmins()
      .then(setAdmins)
      .catch(() => setAdmins([]));
  }, [canAccess]);

  const adminNames = useMemo(
    () => Object.fromEntries(admins.map((a) => [a.id, a.nama])),
    [admins],
  );

  // Percakapan yang dibuka admin IT ini sendiri (lewat /chat-admin) tidak
  // masuk inbox-nya - dibalas admin IT lain, sama seperti percakapan user.
  const inbox = useMemo(
    () => tickets.filter((t) => t.user_id !== profile?.id),
    [tickets, profile?.id],
  );

  const counts = useMemo(() => {
    const c = { semua: inbox.length, menunggu: 0, dibalas: 0, selesai: 0 };
    inbox.forEach((t) => c[t.status]++);
    return c;
  }, [inbox]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return inbox.filter((t) => {
      if (filter !== "semua" && t.status !== filter) return false;
      if (mineOnly && t.assigned_to !== profile?.id) return false;
      if (!q) return true;
      return [
        t.user_nama,
        t.user_email,
        t.user_department,
        t.subjek,
        t.kategori,
        `#${t.id}`,
      ]
        .filter(Boolean)
        .some((v) => v!.toLowerCase().includes(q));
    });
  }, [inbox, filter, mineOnly, search, profile?.id]);

  if (profileLoading) {
    return (
      <div className="col-span-12 flex justify-center py-20 text-muted-foreground">
        <Loader2 className="h-6 w-6 animate-spin" />
      </div>
    );
  }

  if (!canAccess || !profile) {
    return (
      <Content title="Inbox Chat Admin">
        <div className="flex flex-col items-center gap-2 py-12 text-center text-muted-foreground">
          <ShieldAlert className="h-8 w-8" />
          <p>Halaman ini khusus admin departemen IT.</p>
        </div>
      </Content>
    );
  }

  const currentUser = { id: profile.id, nama: profile.nama ?? null };
  const actorName = profile.nama || "Admin";

  const run = async (fn: () => Promise<void>, success: string) => {
    setBusy(true);
    try {
      await fn();
      toast.success(success);
    } catch (err: any) {
      toast.error("Gagal", { description: err.message });
    } finally {
      setBusy(false);
    }
  };

  const handleDelete = async () => {
    if (!selected) return;
    await run(async () => {
      await deleteSupportTicket(selected.id);
      select(null);
      await refresh();
    }, "Percakapan dihapus.");
    setDeleteOpen(false);
  };

  return (
    <Content
      title="Inbox Chat Admin"
      description="Percakapan dari user ke admin departemen IT."
    >
      <div className="grid h-[calc(100svh-14rem)] min-h-[520px] overflow-hidden rounded-lg border md:grid-cols-[minmax(280px,360px)_1fr]">
        <div
          className={cn(
            "flex min-h-0 flex-col md:border-r",
            selectedId && "hidden md:flex",
          )}
        >
          <div className="space-y-2 border-b p-3">
            <Tabs value={filter} onValueChange={(v) => setFilter(v as Filter)}>
              <TabsList className="grid w-full grid-cols-4">
                <TabsTrigger value="menunggu" className="px-1 text-xs">
                  Menunggu ({counts.menunggu})
                </TabsTrigger>
                <TabsTrigger value="dibalas" className="px-1 text-xs">
                  Dibalas ({counts.dibalas})
                </TabsTrigger>
                <TabsTrigger value="selesai" className="px-1 text-xs">
                  Selesai ({counts.selesai})
                </TabsTrigger>
                <TabsTrigger value="semua" className="px-1 text-xs">
                  Semua
                </TabsTrigger>
              </TabsList>
            </Tabs>
            <div className="flex items-center gap-2">
              <div className="relative flex-1">
                <Search className="absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="Cari nama, dept, subjek, #id..."
                  className="h-9 pl-8"
                />
              </div>
              <Button
                variant={mineOnly ? "secondary" : "outline"}
                size="sm"
                className="h-9 shrink-0"
                onClick={() => setMineOnly((v) => !v)}
                aria-pressed={mineOnly}
              >
                Milik saya
              </Button>
            </div>
          </div>
          <div className="min-h-0 flex-1 overflow-y-auto">
            <SupportTicketList
              tickets={filtered}
              selectedId={selectedId}
              onSelect={select}
              asAdmin
              loading={loading}
              adminNames={adminNames}
              emptyText={
                filter === "menunggu" && !search && !mineOnly
                  ? "Tidak ada percakapan yang menunggu dibalas. 🎉"
                  : "Tidak ada percakapan yang cocok."
              }
            />
          </div>
        </div>

        <div className={cn("min-h-0", !selectedId && "hidden md:block")}>
          {selected ? (
            <SupportChatThread
              key={selected.id}
              ticket={selected}
              currentUser={currentUser}
              asAdmin
              onBack={() => select(null)}
              headerInfo={
                <div className="flex flex-wrap items-center gap-x-3 gap-y-1 pt-1 text-xs">
                  <span>
                    <span className="font-medium">{selected.user_nama || "-"}</span>
                    {selected.user_department && ` · ${selected.user_department}`}
                    {selected.user_email && (
                      <span className="text-muted-foreground">
                        {" "}
                        · {selected.user_email}
                      </span>
                    )}
                  </span>
                  <Select
                    value={selected.assigned_to ?? UNASSIGNED}
                    onValueChange={(v) =>
                      run(
                        () =>
                          assignSupportTicket(
                            selected,
                            v === UNASSIGNED ? null : v,
                            profile.id,
                          ),
                        "Penanggung jawab diperbarui.",
                      )
                    }
                    disabled={busy}
                  >
                    <SelectTrigger size="sm" className="h-7 w-auto gap-1 text-xs">
                      <span className="text-muted-foreground">Dipegang:</span>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value={UNASSIGNED}>Belum diambil</SelectItem>
                      {admins.map((a) => (
                        <SelectItem key={a.id} value={a.id}>
                          {a.nama || "-"}
                          {a.id === profile.id && " (saya)"}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              }
              headerActions={
                <>
                  {selected.assigned_to !== profile.id && (
                    <Button
                      variant="outline"
                      size="sm"
                      disabled={busy}
                      onClick={() =>
                        run(
                          () => assignSupportTicket(selected, profile.id, profile.id),
                          "Percakapan diambil.",
                        )
                      }
                    >
                      <Hand className="mr-1.5 h-4 w-4" />
                      Ambil
                    </Button>
                  )}
                  {selected.status === "selesai" ? (
                    <Button
                      variant="outline"
                      size="sm"
                      disabled={busy}
                      onClick={() =>
                        run(
                          () =>
                            setSupportTicketStatus({
                              ticket: selected,
                              action: "buka",
                              asAdmin: true,
                              actorName,
                            }),
                          "Percakapan dibuka kembali.",
                        )
                      }
                    >
                      <RotateCcw className="mr-1.5 h-4 w-4" />
                      Buka
                    </Button>
                  ) : (
                    <Button
                      variant="outline"
                      size="sm"
                      disabled={busy}
                      onClick={() =>
                        run(
                          () =>
                            setSupportTicketStatus({
                              ticket: selected,
                              action: "selesai",
                              asAdmin: true,
                              actorName,
                            }),
                          "Percakapan ditandai selesai.",
                        )
                      }
                    >
                      <CheckCircle2 className="mr-1.5 h-4 w-4" />
                      Selesai
                    </Button>
                  )}
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-8 w-8 text-destructive hover:text-destructive"
                    disabled={busy}
                    onClick={() => setDeleteOpen(true)}
                    aria-label="Hapus percakapan"
                    title="Hapus percakapan"
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </>
              }
            />
          ) : (
            <div className="flex h-full flex-col items-center justify-center gap-3 p-6 text-center text-muted-foreground">
              {selectedId && loading ? (
                <Loader2 className="h-5 w-5 animate-spin" />
              ) : (
                <>
                  <Inbox className="h-8 w-8" />
                  <p className="max-w-xs text-sm">
                    {selectedId
                      ? "Percakapan tidak ditemukan atau sudah dihapus."
                      : "Pilih percakapan di kiri untuk mulai membalas."}
                  </p>
                </>
              )}
            </div>
          )}
        </div>
      </div>

      <AlertDialog open={deleteOpen} onOpenChange={setDeleteOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Hapus percakapan ini?</AlertDialogTitle>
            <AlertDialogDescription>
              Seluruh pesan di percakapan #{selected?.id} akan dihapus permanen,
              termasuk dari sisi user. Tindakan ini tidak bisa dibatalkan.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={busy}>Batal</AlertDialogCancel>
            <AlertDialogAction
              onClick={(e) => {
                e.preventDefault();
                handleDelete();
              }}
              disabled={busy}
              className="bg-destructive text-white hover:bg-destructive/90 dark:bg-destructive/60 dark:hover:bg-destructive/50"
            >
              {busy && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Hapus
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </Content>
  );
}

export default function ChatAdminManagementPage() {
  return (
    <Suspense>
      <ChatAdminManagementView />
    </Suspense>
  );
}
