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
import { ListSearchInput } from "@/components/list-search-input";
import { RowActionsMenu } from "@/components/row-actions-menu";
import { SortableTableHead } from "@/components/sortable-table-head";
import { StickyHeaderTable } from "@/components/sticky-header-table";
import { TablePaginationFooter } from "@/components/table-pagination-footer";
import { Button } from "@/components/ui/button";
import { DropdownMenuItem } from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  TableBody,
  TableCell,
  TableHead,
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
import { useListUrlParams } from "@/hooks/use-list-url-params";
import { useUrlSearchInput } from "@/hooks/use-url-search-input";
import { paginateRows, sortRows } from "@/lib/client-list";
import { formatCurrency } from "@/lib/utils";
import { toast } from "@/lib/toast";
import { PettyCashPengajuanItem, PettyCashPengajuanTemplate } from "@/type";
import { LIMIT_OPTIONS } from "@/type/enum";
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
  PlayCircle,
} from "lucide-react";

const totalOf = (items: PettyCashPengajuanItem[]) =>
  items.reduce((sum, it) => sum + it.subtotal, 0);

const SEARCH_FIELDS = ["Nama template", "Nama barang"];

const SORT_ACCESSORS: Record<
  string,
  (t: PettyCashPengajuanTemplate) => string | number
> = {
  nama: (t) => t.nama_template,
  jumlah: (t) => t.items?.length ?? 0,
  total: (t) => totalOf(t.items || []),
};

export default function PettyCashPengajuanTemplateClient() {
  const supabase = createClient();
  const router = useRouter();
  const {
    searchParams,
    page,
    limit,
    sort: sortParam,
    setParams,
    setFilters,
  } = useListUrlParams();
  const searchTerm = searchParams.get("search") || "";
  const [searchInput, setSearchInput] = useUrlSearchInput(
    searchTerm,
    (value) => setFilters({ search: value }),
  );

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
  const [deleteTarget, setDeleteTarget] =
    useState<PettyCashPengajuanTemplate | null>(null);

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

  const query = searchTerm.trim().toLowerCase();
  const filteredTemplates = templates.filter(
    (t) =>
      !query ||
      t.nama_template.toLowerCase().includes(query) ||
      (t.items || []).some((it) => it.part_name.toLowerCase().includes(query)),
  );
  const {
    rows: visibleTemplates,
    currentPage,
    offset,
  } = paginateRows(
    sortRows(filteredTemplates, sortParam, SORT_ACCESSORS),
    page,
    limit,
  );
  const sortProps = {
    currentSort: sortParam,
    onSortChange: (sort: string | undefined) => setFilters({ sort }),
  };

  return (
    <>
      <Content
        title="Template Pengajuan"
        description="Simpan daftar barang yang sering diajukan berulang (kebutuhan rutin/konstan) supaya tidak perlu input ulang tiap kali - hanya milik Anda sendiri."
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
        <div className="mb-6">
          <ListSearchInput
            placeholder="Cari template atau barang..."
            value={searchInput}
            onChange={setSearchInput}
            searchableFields={SEARCH_FIELDS}
          />
        </div>

        <StickyHeaderTable
          className="min-w-[700px]"
          containerClassName="rounded-md border overflow-x-auto"
          header={
            <TableRow>
              <TableHead className="w-[50px]">No</TableHead>
              <SortableTableHead sortKey="nama" {...sortProps}>
                Nama Template
              </SortableTableHead>
              <SortableTableHead
                sortKey="jumlah"
                defaultDirection="desc"
                className="w-[150px] text-right"
                {...sortProps}
              >
                Jumlah Barang
              </SortableTableHead>
              <SortableTableHead
                sortKey="total"
                defaultDirection="desc"
                className="w-[170px] text-right"
                {...sortProps}
              >
                Total Estimasi
              </SortableTableHead>
              <TableHead className="w-[70px] text-right">Aksi</TableHead>
            </TableRow>
          }
        >
          <TableBody>
            {loading ? (
              <TableRow>
                <TableCell colSpan={5} className="h-24 text-center">
                  <Loader2 className="animate-spin h-6 w-6 mx-auto text-primary" />
                </TableCell>
              </TableRow>
            ) : visibleTemplates.length === 0 ? (
              <TableRow>
                <TableCell
                  colSpan={5}
                  className="h-24 text-center text-muted-foreground"
                >
                  {templates.length === 0
                    ? "Belum ada template. Buat template pertama Anda."
                    : "Tidak ada data ditemukan."}
                </TableCell>
              </TableRow>
            ) : (
              visibleTemplates.map((t, index) => (
                <TableRow key={t.id}>
                  <TableCell>{offset + index + 1}</TableCell>
                  <TableCell className="font-semibold text-sm">
                    {t.nama_template}
                  </TableCell>
                  <TableCell className="text-right text-sm tabular-nums">
                    {t.items?.length ?? 0}
                  </TableCell>
                  <TableCell className="text-right font-medium text-sm tabular-nums">
                    {formatCurrency(totalOf(t.items || []))}
                  </TableCell>
                  <TableCell className="text-right">
                    <RowActionsMenu>
                      <DropdownMenuItem onSelect={() => handleUse(t)}>
                        <PlayCircle className="mr-2 h-4 w-4" /> Gunakan
                      </DropdownMenuItem>
                      <DropdownMenuItem onSelect={() => openEdit(t)}>
                        <Pencil className="mr-2 h-4 w-4" /> Edit
                      </DropdownMenuItem>
                      <DropdownMenuItem
                        className="text-destructive focus:text-destructive"
                        onSelect={() => setDeleteTarget(t)}
                      >
                        <Trash2 className="mr-2 h-4 w-4" /> Hapus
                      </DropdownMenuItem>
                    </RowActionsMenu>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </StickyHeaderTable>

        <TablePaginationFooter
          currentPage={currentPage}
          totalItems={filteredTemplates.length}
          limit={limit}
          limitOptions={LIMIT_OPTIONS}
          itemLabel="template"
          onPageChange={(value) => setParams({ page: value })}
          onLimitChange={(value) => setFilters({ limit: value })}
          className="mt-6"
        />
      </Content>

      <ConfirmDialog
        open={!!deleteTarget}
        onOpenChange={(open) => !open && setDeleteTarget(null)}
        title={`Hapus Template "${deleteTarget?.nama_template ?? ""}"?`}
        description="Template ini akan dihapus permanen. Aksi ini tidak bisa dibatalkan."
        confirmText="Hapus"
        cancelText="Batal"
        onConfirm={() => deleteTarget && handleDelete(deleteTarget)}
      />

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen} modal={false}>
        <DialogContent className="sm:max-w-3xl max-h-[88vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>
              {editing ? `Edit Template: ${editing.nama_template}` : "Template Baru"}
            </DialogTitle>
            <DialogDescription>
              Daftar barang di sini akan otomatis dimuat ke Input Pengajuan
              saat Anda memilih &quot;Gunakan&quot; - company, COA & tanggal
              dibutuhkan tetap diisi baru tiap kali submit.
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
