// src/app/(With Sidebar)/mr-template/MrTemplateClient.tsx
//
// "Template MR" - katalog BERSAMA barang MR rutin yang disediakan GA (level
// approver) / admin. Requester tinggal pilih template di halaman Buat MR
// (atau lewat ?template=<id>) supaya tidak perlu input barang manual -
// sisanya tetap bisa diedit sebelum diajukan.

"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Content } from "@/components/content";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
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
import {
  SearchableSelect,
  SearchableSelectTrigger,
  SearchableSelectValue,
  SearchableSelectContent,
  SearchableSelectItem,
} from "@/components/ui/searchable-select";
import { ConfirmDialog } from "@/components/confirm-dialog";
import { CurrencyInput } from "@/components/ui/currency-input";
import {
  RichMentionEditor,
  RichMentionEditorHandle,
} from "@/components/rich-mention-editor";
import { parseRichValue, stringifyRichContent } from "@/lib/rich-content";
import { createClient } from "@/lib/supabase/client";
import { canManageMrTemplate } from "@/lib/constants/departments";
import { MR_KATEGORI_OPTIONS } from "@/lib/constants/mr";
import { formatCurrency } from "@/lib/utils";
import { toast } from "sonner";
import { Barang, MrTemplate, Order } from "@/type";
import {
  fetchMrTemplates,
  createMrTemplate,
  updateMrTemplate,
  deleteMrTemplate,
} from "@/services/mrTemplateService";
import { logActivity } from "@/services/logService";
import { BarangSearchCombobox } from "../purchase-order/BarangSearchCombobox";
import {
  Loader2,
  RefreshCcw,
  Plus,
  Pencil,
  Trash2,
  FileStack,
  PlayCircle,
  Search,
} from "lucide-react";

const NO_KATEGORI = "__none__";

const totalOf = (orders: Order[]) =>
  orders.reduce(
    (sum, o) => sum + (Number(o.qty) || 0) * (Number(o.estimasi_harga) || 0),
    0,
  );

export default function MrTemplateClient() {
  const supabase = createClient();
  const router = useRouter();
  const remarksEditorRef = useRef<RichMentionEditorHandle>(null);

  const [userId, setUserId] = useState<string | null>(null);
  const [checkingAccess, setCheckingAccess] = useState(true);
  const [templates, setTemplates] = useState<MrTemplate[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");

  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<MrTemplate | null>(null);
  const [namaTemplate, setNamaTemplate] = useState("");
  const [deskripsi, setDeskripsi] = useState("");
  const [kategori, setKategori] = useState("");
  const [orders, setOrders] = useState<Order[]>([]);
  const [saving, setSaving] = useState(false);
  // Remount BarangSearchCombobox tiap kali barang ditambahkan supaya
  // pencariannya kosong lagi.
  const [barangPickerKey, setBarangPickerKey] = useState(0);

  const loadData = async () => {
    setLoading(true);
    try {
      setTemplates(await fetchMrTemplates());
    } catch (error: any) {
      toast.error("Gagal memuat template", { description: error.message });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    const checkAccess = async () => {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) {
        router.push("/auth/login");
        return;
      }
      const { data: profile } = await supabase
        .from("profiles")
        .select("role, department")
        .eq("id", user.id)
        .single();

      if (!canManageMrTemplate(profile)) {
        toast.error("Akses ditolak.", {
          description:
            "Halaman ini khusus untuk General Affair level Approver/Admin.",
        });
        router.push("/dashboard");
        return;
      }
      setUserId(user.id);
      setCheckingAccess(false);
      loadData();
    };
    checkAccess();
  }, []);

  const filteredTemplates = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    if (!q) return templates;
    return templates.filter(
      (t) =>
        t.nama_template.toLowerCase().includes(q) ||
        (t.deskripsi || "").toLowerCase().includes(q) ||
        (t.orders || []).some(
          (o) =>
            o.name.toLowerCase().includes(q) ||
            (o.part_number || "").toLowerCase().includes(q),
        ),
    );
  }, [templates, searchQuery]);

  const openCreate = () => {
    setEditing(null);
    setNamaTemplate("");
    setDeskripsi("");
    setKategori("");
    setOrders([]);
    setDialogOpen(true);
  };

  const openEdit = (t: MrTemplate) => {
    setEditing(t);
    setNamaTemplate(t.nama_template);
    setDeskripsi(t.deskripsi || "");
    setKategori(t.kategori || "");
    setOrders(t.orders || []);
    setDialogOpen(true);
  };

  const handleAddBarang = (barang: Barang) => {
    if (orders.some((o) => o.barang_id === barang.id)) {
      toast.error("Barang ini sudah ada di daftar template.");
      return;
    }
    setOrders((prev) => [
      ...prev,
      {
        name: barang.part_name || "",
        part_number: barang.part_number,
        uom: barang.uom || "Pcs",
        barang_id: barang.id,
        qty: "1",
        estimasi_harga: barang.last_purchase_price || 0,
        note: "",
        url: "",
      },
    ]);
    setBarangPickerKey((k) => k + 1);
  };

  const updateOrder = (index: number, patch: Partial<Order>) => {
    setOrders((prev) =>
      prev.map((o, i) => (i === index ? { ...o, ...patch } : o)),
    );
  };

  const removeOrder = (index: number) => {
    setOrders((prev) => prev.filter((_, i) => i !== index));
  };

  const handleSave = async () => {
    if (!namaTemplate.trim()) {
      return toast.error("Nama template wajib diisi.");
    }
    if (orders.length === 0) {
      return toast.error("Tambahkan minimal 1 barang.");
    }
    if (orders.some((o) => !o.qty || Number(o.qty) <= 0)) {
      return toast.error("Quantity semua barang harus lebih dari 0.");
    }

    const payload = {
      nama_template: namaTemplate.trim(),
      deskripsi: deskripsi.trim() || null,
      kategori: kategori || null,
      remarks: remarksEditorRef.current?.isEmpty()
        ? null
        : stringifyRichContent(
            remarksEditorRef.current?.getJSON() ?? { type: "doc" },
          ),
      orders,
    };

    setSaving(true);
    try {
      if (editing) {
        await updateMrTemplate(editing.id, payload);
        if (userId) {
          logActivity(
            userId,
            "UPDATE_MR_TEMPLATE",
            "mr_template",
            String(editing.id),
            `Memperbarui Template MR "${payload.nama_template}" (${orders.length} barang)`,
            { nama_template: payload.nama_template, total_items: orders.length },
          );
        }
        toast.success(`Template "${payload.nama_template}" berhasil diperbarui.`);
      } else {
        const created = await createMrTemplate(payload);
        if (userId) {
          logActivity(
            userId,
            "CREATE_MR_TEMPLATE",
            "mr_template",
            String(created.id),
            `Membuat Template MR "${payload.nama_template}" (${orders.length} barang)`,
            { nama_template: payload.nama_template, total_items: orders.length },
          );
        }
        toast.success(`Template "${payload.nama_template}" berhasil dibuat.`);
      }
      setDialogOpen(false);
      await loadData();
    } catch (error: any) {
      toast.error("Gagal menyimpan template", { description: error.message });
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (t: MrTemplate) => {
    try {
      await deleteMrTemplate(t.id);
      if (userId) {
        logActivity(
          userId,
          "DELETE_MR_TEMPLATE",
          "mr_template",
          String(t.id),
          `Menghapus Template MR "${t.nama_template}"`,
          { nama_template: t.nama_template },
        );
      }
      toast.success(`Template "${t.nama_template}" berhasil dihapus.`);
      await loadData();
    } catch (error: any) {
      toast.error("Gagal menghapus template", { description: error.message });
    }
  };

  const handleUse = (t: MrTemplate) => {
    router.push(`/material-request/buat?template=${t.id}`);
  };

  if (checkingAccess) {
    return (
      <Content title="Template MR" size="lg">
        <div className="flex h-32 items-center justify-center">
          <Loader2 className="h-6 w-6 animate-spin text-primary" />
        </div>
      </Content>
    );
  }

  return (
    <>
      <Content
        title="Template MR"
        size="lg"
        description="Sediakan daftar barang untuk MR rutin. Requester tinggal pilih template saat Buat MR, barang-barangnya otomatis dimuat dan sisanya tetap bisa diedit."
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
        <div className="relative mb-4 md:w-1/2">
          <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
          <Input
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Cari nama template, deskripsi, atau barang..."
            className="pl-8"
          />
        </div>

        <div className="rounded-md border overflow-x-auto">
          <Table className="min-w-[800px]">
            <TableHeader>
              <TableRow>
                <TableHead>Nama Template</TableHead>
                <TableHead className="w-[140px]">Kategori</TableHead>
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
                  <TableCell colSpan={5} className="text-center h-32">
                    <Loader2 className="animate-spin h-6 w-6 mx-auto text-primary" />
                  </TableCell>
                </TableRow>
              ) : filteredTemplates.length === 0 ? (
                <TableRow>
                  <TableCell
                    colSpan={5}
                    className="text-center h-32 text-muted-foreground"
                  >
                    <div className="flex flex-col items-center gap-2">
                      <FileStack className="h-8 w-8" />
                      {templates.length === 0
                        ? "Belum ada template. Buat template MR pertama."
                        : "Tidak ada template yang cocok dengan pencarian."}
                    </div>
                  </TableCell>
                </TableRow>
              ) : (
                filteredTemplates.map((t) => (
                  <TableRow key={t.id}>
                    <TableCell>
                      <p className="font-semibold text-sm">{t.nama_template}</p>
                      {t.deskripsi && (
                        <p className="text-xs text-muted-foreground line-clamp-2">
                          {t.deskripsi}
                        </p>
                      )}
                    </TableCell>
                    <TableCell className="text-sm">
                      {t.kategori || "-"}
                    </TableCell>
                    <TableCell className="text-center text-sm">
                      {t.orders?.length ?? 0}
                    </TableCell>
                    <TableCell className="text-right font-medium text-sm">
                      {formatCurrency(totalOf(t.orders || []))}
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
                          description="Template ini akan dihapus permanen. MR yang sudah dibuat dari template ini tidak terpengaruh."
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

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent
          className="sm:max-w-4xl max-h-[88vh] overflow-y-auto"
          // Jangan ketutup gara-gara klik di luar / Escape - progress
          // nyusun daftar barang bisa hilang.
          onInteractOutside={(e) => e.preventDefault()}
          onEscapeKeyDown={(e) => e.preventDefault()}
        >
          <DialogHeader>
            <DialogTitle>
              {editing
                ? `Edit Template: ${editing.nama_template}`
                : "Template MR Baru"}
            </DialogTitle>
            <DialogDescription>
              Barang, kategori & remarks di sini otomatis dimuat ke form Buat
              MR saat requester memilih template ini. Harga estimasi akan
              diperbarui dari harga pembelian terakhir di database barang.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
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
                <Label>Kategori (Opsional)</Label>
                <SearchableSelect
                  value={kategori || NO_KATEGORI}
                  onValueChange={(v) => setKategori(v === NO_KATEGORI ? "" : v)}
                  disabled={saving}
                >
                  <SearchableSelectTrigger className="w-full">
                    <SearchableSelectValue placeholder="Pilih kategori..." />
                  </SearchableSelectTrigger>
                  <SearchableSelectContent>
                    <SearchableSelectItem value={NO_KATEGORI}>
                      - Biarkan requester memilih -
                    </SearchableSelectItem>
                    {MR_KATEGORI_OPTIONS.map((k) => (
                      <SearchableSelectItem key={k.value} value={k.value}>
                        {k.label}
                      </SearchableSelectItem>
                    ))}
                  </SearchableSelectContent>
                </SearchableSelect>
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="deskripsi">Deskripsi (Opsional)</Label>
              <Textarea
                id="deskripsi"
                value={deskripsi}
                onChange={(e) => setDeskripsi(e.target.value)}
                placeholder="Ex: Kebutuhan ATK rutin tiap awal bulan untuk kantor Head Office"
                rows={2}
                disabled={saving}
              />
            </div>

            <div className="space-y-2">
              <Label>Remarks Default (Opsional)</Label>
              <RichMentionEditor
                key={editing?.id ?? "new"}
                ref={remarksEditorRef}
                initialContent={parseRichValue(editing?.remarks)}
                placeholder="Remarks yang otomatis terisi di form Buat MR (requester tetap bisa ubah)..."
                disabled={saving}
              />
            </div>

            <div className="space-y-2">
              <Label>
                Daftar Barang <span className="text-red-500">*</span>
              </Label>
              <BarangSearchCombobox
                key={barangPickerKey}
                onSelect={handleAddBarang}
              />
              <div className="rounded-md border overflow-x-auto">
                <Table className="min-w-[700px]">
                  <TableHeader>
                    <TableRow>
                      <TableHead>Barang</TableHead>
                      <TableHead className="w-[110px]">Qty</TableHead>
                      <TableHead className="w-[170px]">Estimasi Harga</TableHead>
                      <TableHead className="w-[200px]">Catatan</TableHead>
                      <TableHead className="w-[50px]" />
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {orders.length === 0 ? (
                      <TableRow>
                        <TableCell
                          colSpan={5}
                          className="text-center h-20 text-sm text-muted-foreground"
                        >
                          Cari & pilih barang di atas untuk menambahkan.
                        </TableCell>
                      </TableRow>
                    ) : (
                      orders.map((o, index) => (
                        <TableRow key={o.barang_id ?? index}>
                          <TableCell>
                            <p className="text-sm font-medium">{o.name}</p>
                            <p className="text-xs font-mono text-muted-foreground">
                              {o.part_number || "-"}
                            </p>
                          </TableCell>
                          <TableCell>
                            <div className="flex items-center gap-1">
                              <Input
                                type="number"
                                min="1"
                                value={o.qty}
                                onChange={(e) =>
                                  updateOrder(index, { qty: e.target.value })
                                }
                                className="h-8"
                                disabled={saving}
                              />
                              <span className="text-xs text-muted-foreground">
                                {o.uom}
                              </span>
                            </div>
                          </TableCell>
                          <TableCell>
                            <CurrencyInput
                              value={o.estimasi_harga}
                              onValueChange={(value) =>
                                updateOrder(index, { estimasi_harga: value })
                              }
                            />
                          </TableCell>
                          <TableCell>
                            <Input
                              value={o.note}
                              onChange={(e) =>
                                updateOrder(index, { note: e.target.value })
                              }
                              placeholder="(Opsional)"
                              className="h-8"
                              disabled={saving}
                            />
                          </TableCell>
                          <TableCell>
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-8 w-8 text-destructive hover:text-destructive"
                              onClick={() => removeOrder(index)}
                              disabled={saving}
                            >
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </TableCell>
                        </TableRow>
                      ))
                    )}
                  </TableBody>
                </Table>
              </div>
              {orders.length > 0 && (
                <p className="text-right text-sm">
                  Total estimasi:{" "}
                  <span className="font-semibold">
                    {formatCurrency(totalOf(orders))}
                  </span>
                </p>
              )}
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
