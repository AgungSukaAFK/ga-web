// src/app/(With Sidebar)/petty-cash/template-pengajuan/PettyCashPengajuanTemplateClient.tsx
//
// "Template Pengajuan" Petty Cash - daftar barang siap pakai milik SENDIRI
// (per-user, BUKAN katalog bersama seperti Barang Petty Cash) untuk
// kebutuhan yang bisa diprediksi & relatif konstan (mis. "ATK Bulanan") -
// requester bikin & kelola template-nya sendiri di sini, lalu tinggal
// "Gunakan" saat submit Input Pengajuan berikutnya (lewat
// ?template=<id>, lihat InputPengajuanClient.tsx) daripada input ulang
// barang yang sama tiap kali.

"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Content } from "@/components/content";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { ConfirmDialog } from "@/components/confirm-dialog";
import { createClient } from "@/lib/supabase/client";
import { formatCurrency } from "@/lib/utils";
import { toast } from "sonner";
import { PettyCashPengajuanItem, PettyCashPengajuanTemplate } from "@/type";
import {
  fetchMyPengajuanTemplates,
  createPengajuanTemplate,
  updatePengajuanTemplate,
  deletePengajuanTemplate,
} from "@/services/pettyCashPengajuanTemplateService";
import { PcItemsEditor } from "@/components/petty-cash/PcItemsEditor";
import {
  Loader2,
  RefreshCcw,
  Plus,
  Pencil,
  Trash2,
  FileSignature,
  PlayCircle,
} from "lucide-react";

const totalOf = (items: PettyCashPengajuanItem[]) =>
  items.reduce((sum, it) => sum + it.subtotal, 0);

export default function PettyCashPengajuanTemplateClient() {
  const supabase = createClient();
  const router = useRouter();

  const [userId, setUserId] = useState<string | null>(null);
  const [templates, setTemplates] = useState<PettyCashPengajuanTemplate[]>([]);
  const [loading, setLoading] = useState(true);

  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<PettyCashPengajuanTemplate | null>(
    null,
  );
  const [namaTemplate, setNamaTemplate] = useState("");
  const [items, setItems] = useState<PettyCashPengajuanItem[]>([]);
  const [saving, setSaving] = useState(false);

  const loadData = async () => {
    setLoading(true);
    try {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) throw new Error("Tidak terautentikasi.");
      setUserId(user.id);

      const data = await fetchMyPengajuanTemplates(user.id);
      setTemplates(data);
    } catch (error: any) {
      toast.error("Gagal memuat template", { description: error.message });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const openCreate = () => {
    setEditing(null);
    setNamaTemplate("");
    setItems([]);
    setDialogOpen(true);
  };

  const openEdit = (t: PettyCashPengajuanTemplate) => {
    setEditing(t);
    setNamaTemplate(t.nama_template);
    setItems(t.items || []);
    setDialogOpen(true);
  };

  const handleSave = async () => {
    if (!namaTemplate.trim()) {
      return toast.error("Nama template wajib diisi.");
    }
    if (items.length === 0) {
      return toast.error("Tambahkan minimal 1 barang.");
    }
    if (items.some((it) => !it.part_name.trim())) {
      return toast.error("Nama barang wajib diisi untuk semua baris.");
    }

    setSaving(true);
    try {
      if (editing) {
        await updatePengajuanTemplate(editing.id, {
          nama_template: namaTemplate.trim(),
          items,
        });
        toast.success(`Template "${namaTemplate}" berhasil diperbarui.`);
      } else if (userId) {
        await createPengajuanTemplate(namaTemplate.trim(), items, userId);
        toast.success(`Template "${namaTemplate}" berhasil dibuat.`);
      }
      setDialogOpen(false);
      await loadData();
    } catch (error: any) {
      toast.error("Gagal menyimpan template", { description: error.message });
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (t: PettyCashPengajuanTemplate) => {
    try {
      await deletePengajuanTemplate(t.id);
      toast.success(`Template "${t.nama_template}" berhasil dihapus.`);
      await loadData();
    } catch (error: any) {
      toast.error("Gagal menghapus template", { description: error.message });
    }
  };

  const handleUse = (t: PettyCashPengajuanTemplate) => {
    router.push(`/petty-cash/input-pengajuan?template=${t.id}`);
  };

  return (
    <>
      <Content
        title="Template Pengajuan"
        description="Simpan daftar barang yang sering diajukan berulang (kebutuhan rutin/konstan) supaya tidak perlu input ulang tiap kali - cuma milik Anda sendiri."
        cardAction={
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={loadData}
              disabled={loading}
            >
              <RefreshCcw
                className={`h-4 w-4 mr-1 ${loading ? "animate-spin" : ""}`}
              />
              Refresh
            </Button>
            <Button size="sm" onClick={openCreate}>
              <Plus className="h-4 w-4 mr-1" /> Template Baru
            </Button>
          </div>
        }
      >
        <div className="rounded-md border overflow-x-auto">
          <Table className="min-w-[700px]">
            <TableHeader>
              <TableRow>
                <TableHead>Nama Template</TableHead>
                <TableHead className="w-[120px] text-center">
                  Jumlah Barang
                </TableHead>
                <TableHead className="w-[160px] text-right">
                  Total Estimasi
                </TableHead>
                <TableHead className="w-[180px] text-center">Aksi</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {loading ? (
                <TableRow>
                  <TableCell colSpan={4} className="text-center h-32">
                    <Loader2 className="animate-spin h-6 w-6 mx-auto text-primary" />
                  </TableCell>
                </TableRow>
              ) : templates.length === 0 ? (
                <TableRow>
                  <TableCell
                    colSpan={4}
                    className="text-center h-32 text-muted-foreground"
                  >
                    <div className="flex flex-col items-center gap-2">
                      <FileSignature className="h-8 w-8" />
                      Belum ada template. Buat template pertama Anda.
                    </div>
                  </TableCell>
                </TableRow>
              ) : (
                templates.map((t) => (
                  <TableRow key={t.id}>
                    <TableCell className="font-semibold text-sm">
                      {t.nama_template}
                    </TableCell>
                    <TableCell className="text-center text-sm">
                      {t.items?.length ?? 0}
                    </TableCell>
                    <TableCell className="text-right font-medium text-sm">
                      {formatCurrency(totalOf(t.items || []))}
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center justify-center gap-1">
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => handleUse(t)}
                        >
                          <PlayCircle className="h-4 w-4 mr-1" /> Gunakan
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8"
                          onClick={() => openEdit(t)}
                        >
                          <Pencil className="h-4 w-4" />
                        </Button>
                        <ConfirmDialog
                          title={`Hapus Template "${t.nama_template}"?`}
                          description="Template ini akan dihapus permanen. Aksi ini tidak bisa dibatalkan."
                          confirmText="Hapus"
                          cancelText="Batal"
                          onConfirm={() => handleDelete(t)}
                        >
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8 text-destructive hover:text-destructive"
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </ConfirmDialog>
                      </div>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </div>
      </Content>

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen} modal={false}>
        <DialogContent className="sm:max-w-3xl max-h-[88vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>
              {editing ? `Edit Template: ${editing.nama_template}` : "Template Baru"}
            </DialogTitle>
            <DialogDescription>
              Daftar barang di sini akan otomatis dimuat ke Input Pengajuan
              saat Anda pilih &quot;Gunakan&quot; - COA & tanggal dibutuhkan
              tetap diisi baru tiap kali submit.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="nama_template">
                Nama Template <span className="text-red-500">*</span>
              </Label>
              <Input
                id="nama_template"
                value={namaTemplate}
                onChange={(e) => setNamaTemplate(e.target.value)}
                placeholder="Ex: ATK Bulanan"
                disabled={saving}
              />
            </div>

            <div className="space-y-2">
              <Label>Daftar Barang</Label>
              <PcItemsEditor
                key={editing?.id ?? "new"}
                initialItems={items}
                onChange={setItems}
                coaMode="locked"
                lockedCoa={null}
              />
            </div>
          </div>

          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setDialogOpen(false)}
              disabled={saving}
            >
              Batal
            </Button>
            <Button onClick={handleSave} disabled={saving}>
              {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Simpan Template
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
