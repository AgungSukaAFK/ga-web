// src/app/(With Sidebar)/petty-cash/templates/page.tsx

"use client";

import { useState, useEffect, useMemo } from "react";
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
  DialogFooter,
  DialogDescription,
} from "@/components/ui/dialog";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { createClient } from "@/lib/supabase/client";
import { toast } from "sonner";
import {
  Loader2,
  Plus,
  Trash2,
  Users,
  FileSignature,
  ArrowDown,
  Check,
  ChevronsUpDown,
  Eye,
  Pencil,
} from "lucide-react";
import {
  fetchPcTemplateList,
  createPcTemplate,
  updatePcTemplate,
  deletePcTemplate,
} from "@/services/pcApprovalTemplateService";
import { cn } from "@/lib/utils";

export default function PcTemplateManagementPage() {
  const supabase = createClient();
  const [templates, setTemplates] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  // Builder Jalur Approval (Master Data User)
  const [usersList, setUsersList] = useState<any[]>([]);

  // State Form Create & Edit
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null); // Jika null = Mode Create, Jika ada angka = Mode Edit
  const [formData, setFormData] = useState({
    template_name: "",
    description: "",
  });
  const [approvalPath, setApprovalPath] = useState<any[]>([]);

  // State Modal Detail (View Only)
  const [isViewModalOpen, setIsViewModalOpen] = useState(false);
  const [selectedTemplate, setSelectedTemplate] = useState<any>(null);

  // Popover / Dropdown State
  const [openCombobox, setOpenCombobox] = useState(false);
  const [searchUser, setSearchUser] = useState("");
  const [selectedUserId, setSelectedUserId] = useState("");

  const loadData = async () => {
    setLoading(true);
    try {
      // Kita panggil fetchPcTemplateList tapi kita tarik field approval_path juga agar bisa dilihat detailnya
      const { data, error } = await supabase
        .from("pc_approval_templates")
        .select("*")
        .order("created_at", { ascending: false });

      if (error) throw error;
      setTemplates(data || []);

      // Load user
      const { data: users } = await supabase
        .from("profiles")
        .select("id, nama, department, role");
      if (users) setUsersList(users);
    } catch (err: any) {
      toast.error("Gagal memuat", { description: err.message });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  // LOGIC DROPDOWN CARI USER
  const filteredUsers = useMemo(() => {
    if (!searchUser) return usersList.slice(0, 10);
    const lowerSearch = searchUser.toLowerCase();
    return usersList
      .filter(
        (u) =>
          u.nama?.toLowerCase().includes(lowerSearch) ||
          u.department?.toLowerCase().includes(lowerSearch),
      )
      .slice(0, 10);
  }, [usersList, searchUser]);

  const selectedUserObj = usersList.find((u) => u.id === selectedUserId);

  const handleAddUserToPath = () => {
    if (!selectedUserObj) return;
    setApprovalPath([
      ...approvalPath,
      {
        userid: selectedUserObj.id,
        nama: selectedUserObj.nama,
        department: selectedUserObj.department,
        role: selectedUserObj.role,
        status: "pending",
      },
    ]);
    setSelectedUserId("");
  };

  // AKSI BUKA MODAL
  const openCreateModal = () => {
    setEditingId(null);
    setFormData({ template_name: "", description: "" });
    setApprovalPath([]);
    setIsModalOpen(true);
  };

  const openEditModal = (tpl: any) => {
    setEditingId(tpl.id);
    setFormData({
      template_name: tpl.template_name,
      description: tpl.description || "",
    });
    setApprovalPath(tpl.approval_path || []);
    setIsModalOpen(true);
  };

  const openViewModal = (tpl: any) => {
    setSelectedTemplate(tpl);
    setIsViewModalOpen(true);
  };

  // LOGIC SIMPAN (Create / Update)
  const handleSave = async () => {
    if (!formData.template_name)
      return toast.error("Nama template wajib diisi");
    if (approvalPath.length === 0)
      return toast.error("Jalur persetujuan minimal 1 orang");

    setSaving(true);
    try {
      if (editingId) {
        await updatePcTemplate(editingId, {
          ...formData,
          approval_path: approvalPath,
        });
        toast.success("Template berhasil diperbarui!");
      } else {
        await createPcTemplate({ ...formData, approval_path: approvalPath });
        toast.success("Template berhasil dibuat!");
      }
      setIsModalOpen(false);
      loadData();
    } catch (err: any) {
      toast.error("Gagal menyimpan", { description: err.message });
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id: number) => {
    if (!confirm("Yakin ingin menghapus template ini?")) return;
    try {
      await deletePcTemplate(id);
      toast.success("Berhasil dihapus");
      loadData();
    } catch (err: any) {
      toast.error("Gagal menghapus", { description: err.message });
    }
  };

  return (
    <Content
      title="Master Template Approval Petty Cash"
      description="Kelola rute persetujuan khusus untuk pengajuan Kas Kecil."
      cardAction={
        <Button onClick={openCreateModal}>
          <Plus className="w-4 h-4 mr-2" /> Buat Template PC
        </Button>
      }
    >
      <div className="rounded-md border overflow-hidden">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Nama Template</TableHead>
              <TableHead>Deskripsi</TableHead>
              <TableHead className="text-center w-[120px]">
                Jumlah Step
              </TableHead>
              <TableHead className="text-right">Aksi</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {loading ? (
              <TableRow>
                <TableCell colSpan={4} className="text-center h-24">
                  <Loader2 className="animate-spin h-5 w-5 mx-auto text-primary" />
                </TableCell>
              </TableRow>
            ) : templates.length === 0 ? (
              <TableRow>
                <TableCell
                  colSpan={4}
                  className="text-center h-24 text-muted-foreground"
                >
                  Belum ada template Petty Cash.
                </TableCell>
              </TableRow>
            ) : (
              templates.map((tpl) => (
                <TableRow key={tpl.id}>
                  <TableCell className="font-semibold text-primary">
                    {tpl.template_name}
                  </TableCell>
                  <TableCell
                    className="text-muted-foreground text-sm max-w-[200px] truncate"
                    title={tpl.description}
                  >
                    {tpl.description || "-"}
                  </TableCell>
                  <TableCell className="text-center">
                    <span className="bg-muted px-2 py-0.5 rounded text-xs font-semibold">
                      {tpl.approval_path?.length || 0} Approver
                    </span>
                  </TableCell>
                  <TableCell className="text-right">
                    <div className="flex justify-end gap-1">
                      <Button
                        variant="ghost"
                        size="icon"
                        className="text-muted-foreground hover:text-primary"
                        onClick={() => openViewModal(tpl)}
                      >
                        <Eye className="h-4 w-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="text-blue-500 hover:text-blue-600 hover:bg-blue-50"
                        onClick={() => openEditModal(tpl)}
                      >
                        <Pencil className="h-4 w-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="text-red-500 hover:text-red-600 hover:bg-red-50"
                        onClick={() => handleDelete(tpl.id)}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>

      {/* ========================================== */}
      {/* MODAL 1: VIEW DETAIL (Read-Only) */}
      {/* ========================================== */}
      <Dialog open={isViewModalOpen} onOpenChange={setIsViewModalOpen}>
        <DialogContent className="max-w-md max-h-[85vh] flex flex-col">
          <DialogHeader className="shrink-0">
            <DialogTitle className="flex items-center gap-2">
              <Eye className="h-5 w-5 text-primary" />
              Detail Template
            </DialogTitle>
            <DialogDescription>
              Rincian alur persetujuan untuk template ini.
            </DialogDescription>
          </DialogHeader>

          {selectedTemplate && (
            <div className="space-y-4 overflow-y-auto pr-2 pb-2">
              <div className="bg-muted/30 p-3 rounded-lg border space-y-2">
                <div>
                  <span className="text-xs text-muted-foreground block font-medium">
                    Nama Template
                  </span>
                  <span className="text-sm font-semibold">
                    {selectedTemplate.template_name}
                  </span>
                </div>
                <div>
                  <span className="text-xs text-muted-foreground block font-medium">
                    Deskripsi
                  </span>
                  <span className="text-sm">
                    {selectedTemplate.description || "-"}
                  </span>
                </div>
              </div>

              <div>
                <span className="text-sm font-semibold text-primary flex items-center gap-2 mb-3">
                  <Users className="h-4 w-4" /> Urutan Approver (
                  {selectedTemplate.approval_path?.length})
                </span>
                <div className="space-y-2">
                  {selectedTemplate.approval_path?.map(
                    (user: any, idx: number) => (
                      <div key={idx} className="flex flex-col relative">
                        <div className="flex items-center gap-3 p-3 bg-background border rounded shadow-sm">
                          <div className="bg-primary/10 text-primary font-bold w-7 h-7 rounded-full flex items-center justify-center text-xs shrink-0">
                            {idx + 1}
                          </div>
                          <div className="overflow-hidden">
                            <p className="font-semibold text-sm truncate">
                              {user.nama}
                            </p>
                            <p className="text-xs text-muted-foreground truncate">
                              {user.department}
                            </p>
                          </div>
                        </div>
                        {idx !== selectedTemplate.approval_path.length - 1 && (
                          <ArrowDown className="h-4 w-4 text-muted-foreground mx-auto my-1" />
                        )}
                      </div>
                    ),
                  )}
                </div>
              </div>
            </div>
          )}
          <DialogFooter className="shrink-0 pt-2 border-t">
            <Button onClick={() => setIsViewModalOpen(false)}>Tutup</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ========================================== */}
      {/* MODAL 2: FORM CREATE & EDIT */}
      {/* ========================================== */}
      <Dialog open={isModalOpen} onOpenChange={setIsModalOpen}>
        <DialogContent className="max-w-2xl max-h-[90vh] flex flex-col">
          <DialogHeader className="shrink-0">
            <DialogTitle className="flex items-center gap-2">
              <FileSignature className="h-5 w-5 text-primary" />
              {editingId
                ? "Edit Template Petty Cash"
                : "Buat Template Petty Cash Baru"}
            </DialogTitle>
          </DialogHeader>

          <div className="grid gap-4 py-2 overflow-y-auto pr-2">
            <div className="grid gap-2">
              <Label>
                Nama Template <span className="text-red-500">*</span>
              </Label>
              <Input
                value={formData.template_name}
                onChange={(e) =>
                  setFormData({ ...formData, template_name: e.target.value })
                }
                placeholder="Contoh: Approval Kasbon Transport..."
              />
            </div>
            <div className="grid gap-2">
              <Label>Deskripsi (Opsional)</Label>
              <Textarea
                value={formData.description}
                onChange={(e) =>
                  setFormData({ ...formData, description: e.target.value })
                }
                placeholder="Deskripsi peruntukan template ini..."
              />
            </div>

            <div className="border-t pt-4 mt-2">
              <Label className="flex items-center gap-2 mb-3 text-primary">
                <Users className="h-4 w-4" /> Susun Jalur Persetujuan
              </Label>

              <div className="flex gap-2 items-end mb-4">
                <div className="flex-1">
                  <Label className="text-xs text-muted-foreground block mb-1">
                    Cari & Tambah Approver
                  </Label>
                  <Popover open={openCombobox} onOpenChange={setOpenCombobox}>
                    <PopoverTrigger asChild>
                      <Button
                        variant="outline"
                        role="combobox"
                        aria-expanded={openCombobox}
                        className="w-full justify-between h-10 bg-background"
                      >
                        {selectedUserObj ? (
                          <span className="truncate">
                            {selectedUserObj.nama} ({selectedUserObj.department}
                            )
                          </span>
                        ) : (
                          <span className="text-muted-foreground font-normal">
                            Ketik nama karyawan...
                          </span>
                        )}
                        <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent
                      className="w-[400px] p-0"
                      style={{ zIndex: 9999 }}
                    >
                      <Command shouldFilter={false}>
                        <CommandInput
                          placeholder="Cari berdasarkan nama atau departemen..."
                          value={searchUser}
                          onValueChange={setSearchUser}
                        />
                        <CommandList className="max-h-[220px] overflow-y-auto">
                          <CommandEmpty>Karyawan tidak ditemukan.</CommandEmpty>
                          <CommandGroup>
                            {filteredUsers.map((user) => (
                              <CommandItem
                                key={user.id}
                                value={user.id}
                                onSelect={() => {
                                  setSelectedUserId(
                                    user.id === selectedUserId ? "" : user.id,
                                  );
                                  setOpenCombobox(false);
                                  setSearchUser("");
                                }}
                              >
                                <div className="flex flex-col">
                                  <span className="font-medium text-sm">
                                    {user.nama}
                                  </span>
                                  <span className="text-xs text-muted-foreground">
                                    {user.department}
                                  </span>
                                </div>
                                <Check
                                  className={cn(
                                    "ml-auto h-4 w-4 text-primary",
                                    selectedUserId === user.id
                                      ? "opacity-100"
                                      : "opacity-0",
                                  )}
                                />
                              </CommandItem>
                            ))}
                          </CommandGroup>
                        </CommandList>
                      </Command>
                    </PopoverContent>
                  </Popover>
                </div>
                <Button
                  variant="secondary"
                  className="h-10"
                  onClick={handleAddUserToPath}
                  disabled={!selectedUserId}
                >
                  Tambahkan
                </Button>
              </div>

              {/* RENDER JALUR APPROVAL */}
              {approvalPath.length > 0 ? (
                <div className="space-y-2 p-4 bg-muted/30 rounded-lg border">
                  {approvalPath.map((user, idx) => (
                    <div key={idx} className="flex flex-col relative">
                      <div className="flex items-center justify-between p-3 bg-background border rounded shadow-sm">
                        <div className="flex items-center gap-3">
                          <div className="bg-primary/10 text-primary font-bold w-6 h-6 rounded-full flex items-center justify-center text-xs shrink-0">
                            {idx + 1}
                          </div>
                          <div className="overflow-hidden">
                            <p
                              className="font-semibold text-sm truncate"
                              title={user.nama}
                            >
                              {user.nama}
                            </p>
                            <p className="text-xs text-muted-foreground truncate">
                              {user.department}
                            </p>
                          </div>
                        </div>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-6 w-6 text-red-500 hover:text-red-600 hover:bg-red-50 shrink-0"
                          onClick={() =>
                            setApprovalPath(
                              approvalPath.filter((_, i) => i !== idx),
                            )
                          }
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                      {idx !== approvalPath.length - 1 && (
                        <ArrowDown className="h-4 w-4 text-muted-foreground mx-auto my-1" />
                      )}
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-center p-6 border border-dashed rounded-lg text-muted-foreground text-sm">
                  Belum ada approver dalam jalur ini.
                </div>
              )}
            </div>
          </div>

          <DialogFooter className="shrink-0 pt-4 border-t">
            <Button variant="outline" onClick={() => setIsModalOpen(false)}>
              Batal
            </Button>
            <Button onClick={handleSave} disabled={saving}>
              {saving ? (
                <Loader2 className="animate-spin h-4 w-4 mr-2" />
              ) : (
                <FileSignature className="h-4 w-4 mr-2" />
              )}
              {editingId ? "Simpan Perubahan" : "Buat Template"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Content>
  );
}
