// src/app/(With Sidebar)/feedback-management/page.tsx
//
// Daftar feedback yang dikirim user lewat /feedback - khusus admin departemen
// IT (isITAdmin). Akses data juga dijaga RLS tabel `feedbacks` (lihat
// supabase/migrations/0006_feedback.sql), jadi guard di sini cuma untuk tampilan.

"use client";

import { useEffect, useMemo, useState } from "react";
import { format } from "date-fns";
import { toast } from "sonner";
import {
  Loader2,
  Mail,
  MessageCircle,
  Paperclip,
  Search,
  ShieldAlert,
  Trash2,
} from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { isITAdmin } from "@/lib/constants/departments";
import { Content } from "@/components/content";
import { RichContentView } from "@/components/rich-content-view";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
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
import { Feedback, FeedbackStatus, Profile } from "@/type";

type StatusFilter = "semua" | FeedbackStatus;

const STATUS_LABEL: Record<FeedbackStatus, string> = {
  baru: "Baru",
  diproses: "Diproses",
  selesai: "Selesai",
};

const STATUS_CLASS: Record<FeedbackStatus, string> = {
  baru: "border-transparent bg-blue-500/15 text-blue-700 dark:text-blue-300",
  diproses:
    "border-transparent bg-amber-500/15 text-amber-700 dark:text-amber-300",
  selesai:
    "border-transparent bg-emerald-500/15 text-emerald-700 dark:text-emerald-300",
};

// "0812-3456 7890" / "+62812..." -> "62812..." untuk link wa.me
const toWaNumber = (raw: string) => {
  const digits = raw.replace(/\D/g, "");
  return digits.startsWith("0") ? `62${digits.slice(1)}` : digits;
};

function StatusBadge({ status }: { status: FeedbackStatus }) {
  return (
    <Badge variant="outline" className={STATUS_CLASS[status]}>
      {STATUS_LABEL[status]}
    </Badge>
  );
}

export default function FeedbackManagementPage() {
  const supabase = useMemo(() => createClient(), []);

  const [profile, setProfile] = useState<Profile | null>(null);
  const [checkingAccess, setCheckingAccess] = useState(true);
  const [feedbacks, setFeedbacks] = useState<Feedback[]>([]);
  const [loading, setLoading] = useState(true);

  const [statusFilter, setStatusFilter] = useState<StatusFilter>("semua");
  const [search, setSearch] = useState("");

  const [selected, setSelected] = useState<Feedback | null>(null);
  const [editStatus, setEditStatus] = useState<FeedbackStatus>("baru");
  const [editCatatan, setEditCatatan] = useState("");
  const [saving, setSaving] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [deleting, setDeleting] = useState(false);

  const canAccess = isITAdmin(profile);

  const fetchFeedbacks = async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from("feedbacks")
      .select("*")
      .order("created_at", { ascending: false });
    if (error) {
      toast.error("Gagal mengambil data feedback", {
        description: error.message,
      });
    } else {
      setFeedbacks((data as Feedback[]) || []);
    }
    setLoading(false);
  };

  useEffect(() => {
    const init = async () => {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (user) {
        const { data } = await supabase
          .from("profiles")
          .select("*")
          .eq("id", user.id)
          .single();
        setProfile(data);
        if (isITAdmin(data)) fetchFeedbacks();
      }
      setCheckingAccess(false);
    };
    init();
  }, [supabase]);

  const counts = useMemo(() => {
    const c = { semua: feedbacks.length, baru: 0, diproses: 0, selesai: 0 };
    feedbacks.forEach((f) => c[f.status]++);
    return c;
  }, [feedbacks]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return feedbacks.filter((f) => {
      if (statusFilter !== "semua" && f.status !== statusFilter) return false;
      if (!q) return true;
      return [f.user_nama, f.user_email, f.user_department, f.kategori]
        .filter(Boolean)
        .some((v) => v!.toLowerCase().includes(q));
    });
  }, [feedbacks, statusFilter, search]);

  const openDetail = (f: Feedback) => {
    setSelected(f);
    setEditStatus(f.status);
    setEditCatatan(f.catatan_admin || "");
  };

  const handleSave = async () => {
    if (!selected || !profile) return;
    setSaving(true);
    const patch = {
      status: editStatus,
      catatan_admin: editCatatan.trim() || null,
      handled_by: profile.id,
    };
    const { error } = await supabase
      .from("feedbacks")
      .update(patch)
      .eq("id", selected.id);
    setSaving(false);
    if (error) {
      toast.error("Gagal menyimpan", { description: error.message });
      return;
    }
    setFeedbacks((prev) =>
      prev.map((f) => (f.id === selected.id ? { ...f, ...patch } : f)),
    );
    toast.success("Feedback diperbarui.");
    setSelected(null);
  };

  const handleDelete = async () => {
    if (!selected) return;
    setDeleting(true);
    const { error } = await supabase
      .from("feedbacks")
      .delete()
      .eq("id", selected.id);
    setDeleting(false);
    if (error) {
      toast.error("Gagal menghapus", { description: error.message });
      return;
    }
    setFeedbacks((prev) => prev.filter((f) => f.id !== selected.id));
    toast.success("Feedback dihapus.");
    setDeleteOpen(false);
    setSelected(null);
  };

  if (checkingAccess) {
    return (
      <Content title="Feedback User">
        <div className="flex h-32 items-center justify-center">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </div>
      </Content>
    );
  }

  if (!canAccess) {
    return (
      <Content title="Feedback User">
        <div className="flex flex-col items-center gap-2 py-10 text-center text-muted-foreground">
          <ShieldAlert className="h-8 w-8" />
          <p>Halaman ini khusus admin departemen IT.</p>
        </div>
      </Content>
    );
  }

  return (
    <>
      <Content
        title="Feedback User"
        description="Saran, laporan bug, dan pertanyaan yang dikirim user lewat halaman Feedback."
      >
        <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <Tabs
            value={statusFilter}
            onValueChange={(v) => setStatusFilter(v as StatusFilter)}
          >
            <TabsList>
              <TabsTrigger value="semua">Semua ({counts.semua})</TabsTrigger>
              <TabsTrigger value="baru">Baru ({counts.baru})</TabsTrigger>
              <TabsTrigger value="diproses">
                Diproses ({counts.diproses})
              </TabsTrigger>
              <TabsTrigger value="selesai">
                Selesai ({counts.selesai})
              </TabsTrigger>
            </TabsList>
          </Tabs>
          <div className="relative sm:w-72">
            <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
            <Input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Cari nama, departemen, kategori..."
              className="pl-8"
            />
          </div>
        </div>

        <div className="rounded-md border bg-card">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-[150px]">Tanggal</TableHead>
                <TableHead>Pengirim</TableHead>
                <TableHead>Kategori</TableHead>
                <TableHead className="w-[110px]">Status</TableHead>
                <TableHead className="w-[90px] text-right">Aksi</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {loading ? (
                <TableRow>
                  <TableCell colSpan={5} className="h-24 text-center">
                    <Loader2 className="mx-auto h-5 w-5 animate-spin text-muted-foreground" />
                  </TableCell>
                </TableRow>
              ) : filtered.length === 0 ? (
                <TableRow>
                  <TableCell
                    colSpan={5}
                    className="h-24 text-center text-muted-foreground"
                  >
                    Belum ada feedback.
                  </TableCell>
                </TableRow>
              ) : (
                filtered.map((f) => (
                  <TableRow
                    key={f.id}
                    className="cursor-pointer"
                    onClick={() => openDetail(f)}
                  >
                    <TableCell className="text-xs text-muted-foreground">
                      {format(new Date(f.created_at), "dd MMM yyyy, HH:mm")}
                    </TableCell>
                    <TableCell>
                      <div className="font-medium">{f.user_nama || "-"}</div>
                      <div className="text-xs text-muted-foreground">
                        {f.user_department || "-"}
                      </div>
                    </TableCell>
                    <TableCell className="text-sm">
                      <div className="flex items-center gap-1.5">
                        {f.kategori}
                        {f.lampiran_url && (
                          <Paperclip className="h-3.5 w-3.5 text-muted-foreground" />
                        )}
                      </div>
                    </TableCell>
                    <TableCell>
                      <StatusBadge status={f.status} />
                    </TableCell>
                    <TableCell className="text-right">
                      <Button variant="outline" size="sm">
                        Lihat
                      </Button>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </div>
      </Content>

      <Dialog
        open={!!selected}
        onOpenChange={(open) => !open && setSelected(null)}
      >
        <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-2xl">
          {selected && (
            <>
              <DialogHeader>
                <DialogTitle className="flex flex-wrap items-center gap-2">
                  {selected.kategori}
                  <StatusBadge status={selected.status} />
                </DialogTitle>
                <DialogDescription>
                  Dikirim{" "}
                  {format(new Date(selected.created_at), "dd MMM yyyy, HH:mm")}
                </DialogDescription>
              </DialogHeader>

              <div className="space-y-4">
                <div className="grid grid-cols-1 gap-3 rounded-md border bg-muted/40 p-3 text-sm sm:grid-cols-2">
                  <div>
                    <div className="text-xs text-muted-foreground">Nama</div>
                    <div className="font-medium">
                      {selected.user_nama || "-"}
                    </div>
                  </div>
                  <div>
                    <div className="text-xs text-muted-foreground">
                      Departemen
                    </div>
                    <div className="font-medium">
                      {selected.user_department || "-"}
                    </div>
                  </div>
                  <div>
                    <div className="text-xs text-muted-foreground">Email</div>
                    {selected.user_email ? (
                      <a
                        href={`mailto:${selected.user_email}`}
                        className="inline-flex items-center gap-1 font-medium text-primary hover:underline"
                      >
                        <Mail className="h-3.5 w-3.5" />
                        {selected.user_email}
                      </a>
                    ) : (
                      "-"
                    )}
                  </div>
                  <div>
                    <div className="text-xs text-muted-foreground">
                      WhatsApp
                    </div>
                    <a
                      href={`https://wa.me/${toWaNumber(selected.whatsapp)}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-1 font-medium text-primary hover:underline"
                    >
                      <MessageCircle className="h-3.5 w-3.5" />
                      {selected.whatsapp}
                    </a>
                  </div>
                </div>

                <div className="space-y-1.5">
                  <Label>Pesan</Label>
                  <div className="rounded-md border p-3">
                    <RichContentView
                      content={selected.pesan}
                      className="prose prose-sm dark:prose-invert max-w-none"
                    />
                  </div>
                </div>

                {selected.lampiran_url && (
                  <div className="space-y-1.5">
                    <Label>Lampiran</Label>
                    <a
                      href={selected.lampiran_url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex items-center gap-2 rounded-md border bg-muted/40 p-2 text-sm text-primary hover:underline"
                    >
                      <Paperclip className="h-4 w-4 flex-shrink-0" />
                      <span className="truncate">
                        {selected.lampiran_nama || "Lihat lampiran"}
                      </span>
                    </a>
                  </div>
                )}

                <div className="space-y-1.5">
                  <Label>Status</Label>
                  <Select
                    value={editStatus}
                    onValueChange={(v) => setEditStatus(v as FeedbackStatus)}
                  >
                    <SelectTrigger className="sm:w-56">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {(Object.keys(STATUS_LABEL) as FeedbackStatus[]).map(
                        (s) => (
                          <SelectItem key={s} value={s}>
                            {STATUS_LABEL[s]}
                          </SelectItem>
                        ),
                      )}
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-1.5">
                  <Label htmlFor="catatan-admin">Catatan Internal IT</Label>
                  <Textarea
                    id="catatan-admin"
                    value={editCatatan}
                    onChange={(e) => setEditCatatan(e.target.value)}
                    placeholder="Contoh: sudah dicek, bug di halaman PO, fix di rilis berikutnya"
                    rows={3}
                  />
                </div>
              </div>

              <DialogFooter className="gap-2 sm:justify-between">
                <Button
                  type="button"
                  variant="ghost"
                  className="text-destructive hover:text-destructive"
                  onClick={() => setDeleteOpen(true)}
                >
                  <Trash2 className="mr-2 h-4 w-4" />
                  Hapus
                </Button>
                <div className="flex gap-2">
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => setSelected(null)}
                  >
                    Tutup
                  </Button>
                  <Button type="button" onClick={handleSave} disabled={saving}>
                    {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                    Simpan
                  </Button>
                </div>
              </DialogFooter>
            </>
          )}
        </DialogContent>
      </Dialog>

      <AlertDialog open={deleteOpen} onOpenChange={setDeleteOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Hapus feedback ini?</AlertDialogTitle>
            <AlertDialogDescription>
              Feedback akan dihapus permanen dan tidak bisa dikembalikan.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={deleting}>Batal</AlertDialogCancel>
            <AlertDialogAction
              onClick={(e) => {
                e.preventDefault();
                handleDelete();
              }}
              disabled={deleting}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {deleting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Hapus
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
