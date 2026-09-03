// src/app/(With Sidebar)/petty-cash/template-approval/PcApprovalTemplateClient.tsx
//
// Kelola template approval KHUSUS Petty Cash (tabel `pc_approval_templates`,
// terpisah dari `approval_templates` milik MR/PO - lihat
// services/pcApprovalTemplateService.ts). Hanya admin & departemen GA yang
// bisa membuka halaman ini maupun menambah/mengubah/menghapus template
// (lihat supabase/pc-approval-templates-access-setup.sql untuk RLS-nya).

"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { isGADepartment } from "@/lib/constants/departments";
import { Content } from "@/components/content";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
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
import { toast } from "sonner";
import {
  PcApprovalTemplate,
  PcTemplateFormInput,
  createPcTemplate,
  deletePcTemplate,
  fetchPcTemplates,
  updatePcTemplate,
} from "@/services/pcApprovalTemplateService";
import { PcApprovalType } from "@/type";
import {
  PC_APPROVAL_TYPE_OPTIONS,
  PC_APPROVAL_TYPE_COLORS,
  PC_APPROVAL_TYPE_COLOR_DEFAULT,
} from "@/type/enum";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { PcApprovalTemplateForm } from "./PcApprovalTemplateForm";
import { Loader2, Plus, Trash2, Edit, Search } from "lucide-react";
import { format } from "date-fns";
import { cn } from "@/lib/utils";

export default function PcApprovalTemplateClient() {
  const router = useRouter();
  const [templates, setTemplates] = useState<PcApprovalTemplate[]>([]);
  const [loading, setLoading] = useState(true);
  const [checkingAccess, setCheckingAccess] = useState(true);

  const [activeForm, setActiveForm] = useState<
    "new" | PcApprovalTemplate | null
  >(null);
  const [detailTemplate, setDetailTemplate] =
    useState<PcApprovalTemplate | null>(null);

  const [isAlertOpen, setIsAlertOpen] = useState(false);
  const [deletingId, setDeletingId] = useState<number | null>(null);

  const [searchQuery, setSearchQuery] = useState("");
  const [typeFilter, setTypeFilter] = useState<PcApprovalType | "all">("all");

  const filteredTemplates = templates.filter((template) => {
    if (typeFilter !== "all" && template.approval_type !== typeFilter)
      return false;
    const query = searchQuery.trim().toLowerCase();
    if (!query) return true;
    const matchesName = template.template_name.toLowerCase().includes(query);
    const matchesApprover = template.approval_path.some((app) =>
      (app.nama || "").toLowerCase().includes(query),
    );
    return matchesName || matchesApprover;
  });

  const loadTemplates = async () => {
    setLoading(true);
    try {
      const data = await fetchPcTemplates();
      setTemplates(data);
    } catch (error: any) {
      toast.error("Gagal memuat template", { description: error.message });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    const checkAccess = async () => {
      const supabase = createClient();
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

      const isAllowed =
        isGADepartment(profile?.department) || profile?.role === "admin";
      if (!isAllowed) {
        toast.error("Akses ditolak.", {
          description: "Halaman ini khusus untuk General Affair/Admin.",
        });
        router.push("/dashboard");
        return;
      }
      setCheckingAccess(false);
      loadTemplates();
    };
    checkAccess();
  }, []);

  const handleOpenCreate = () => setActiveForm("new");
  const handleOpenEdit = (template: PcApprovalTemplate) => {
    setDetailTemplate(null);
    setActiveForm(template);
  };
  const handleCancelForm = () => setActiveForm(null);

  const handleSaveTemplate = async (data: PcTemplateFormInput) => {
    const isEditing = activeForm && activeForm !== "new";
    const toastId = toast.loading(
      isEditing ? "Memperbarui template..." : "Menyimpan template baru...",
    );
    try {
      if (isEditing) {
        await updatePcTemplate((activeForm as PcApprovalTemplate).id, data);
      } else {
        await createPcTemplate(data);
      }
      toast.success("Template berhasil disimpan!", { id: toastId });
      handleCancelForm();
      await loadTemplates();
    } catch (error: any) {
      toast.error("Gagal menyimpan template", {
        id: toastId,
        description: error.message,
      });
    }
  };

  const openDeleteConfirm = (id: number) => {
    setDetailTemplate(null);
    setDeletingId(id);
    setIsAlertOpen(true);
  };

  const handleDelete = async () => {
    if (!deletingId) return;
    const toastId = toast.loading("Menghapus template...");
    try {
      await deletePcTemplate(deletingId);
      toast.success("Template berhasil dihapus.", { id: toastId });
      await loadTemplates();
    } catch (error: any) {
      toast.error("Gagal menghapus template", {
        id: toastId,
        description: error.message,
      });
    } finally {
      setIsAlertOpen(false);
      setDeletingId(null);
    }
  };

  // Modal buat/edit tidak boleh ketutup gara-gara klik di luar atau Escape -
  // sama seperti TemplateForm MR/PO, biar progress nyusun approver ga ilang.
  const preventOutsideClose = (e: Event) => e.preventDefault();

  if (checkingAccess) {
    return (
      <Content title="Template Approval Petty Cash">
        <Skeleton className="h-96 w-full" />
      </Content>
    );
  }

  return (
    <>
      <Content
        title="Template Approval Petty Cash"
        description="Kelola jalur persetujuan standar khusus pengajuan Petty Cash - terpisah dari template approval MR/PO."
        cardAction={
          <Button onClick={handleOpenCreate}>
            <Plus className="mr-2 h-4 w-4" /> Buat Template Baru
          </Button>
        }
      >
        <div className="mb-4 flex flex-col gap-2 sm:flex-row sm:items-center">
          <div className="relative max-w-sm flex-1">
            <Search className="absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Cari nama template atau nama approver..."
              className="pl-8"
            />
          </div>
          <Select
            value={typeFilter}
            onValueChange={(value) =>
              setTypeFilter(value as PcApprovalType | "all")
            }
          >
            <SelectTrigger className="sm:w-[220px]">
              <SelectValue placeholder="Filter tipe approval" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Semua Tipe Approval</SelectItem>
              {PC_APPROVAL_TYPE_OPTIONS.map((type) => (
                <SelectItem key={type} value={type}>
                  {type}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="border rounded-md overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Nama Template</TableHead>
                <TableHead className="w-[160px]">Tipe Approval</TableHead>
                <TableHead>Deskripsi</TableHead>
                <TableHead className="w-[140px]">Jumlah Approver</TableHead>
                <TableHead className="w-[160px]">Terakhir Diubah</TableHead>
                <TableHead className="text-right w-[120px]">Aksi</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {loading ? (
                <TableRow>
                  <TableCell colSpan={6} className="text-center h-24">
                    <Loader2 className="mx-auto h-6 w-6 animate-spin" />
                  </TableCell>
                </TableRow>
              ) : filteredTemplates.length > 0 ? (
                filteredTemplates.map((template) => (
                  <TableRow
                    key={template.id}
                    className="cursor-pointer"
                    onClick={() => setDetailTemplate(template)}
                  >
                    <TableCell className="font-medium">
                      <div className="flex flex-col items-start gap-1">
                        {template.template_name}
                        {template.auto_rules.length > 0 && (
                          <div className="flex flex-wrap gap-1">
                            {template.auto_rules.map((rule, i) => (
                              <Badge
                                key={i}
                                variant="outline"
                                className="font-normal text-[10px] text-primary border-primary/40"
                              >
                                Auto: {rule.department}
                              </Badge>
                            ))}
                          </div>
                        )}
                      </div>
                    </TableCell>
                    <TableCell>
                      <Badge
                        variant="outline"
                        className={cn(
                          "font-normal",
                          PC_APPROVAL_TYPE_COLORS[template.approval_type] ||
                            PC_APPROVAL_TYPE_COLOR_DEFAULT,
                        )}
                      >
                        {template.approval_type}
                      </Badge>
                    </TableCell>
                    <TableCell className="max-w-[320px] truncate text-muted-foreground">
                      {template.description || "-"}
                    </TableCell>
                    <TableCell>
                      <Badge variant="outline" className="font-normal">
                        {template.approval_path.length} orang
                      </Badge>
                    </TableCell>
                    <TableCell className="text-xs text-muted-foreground">
                      <div>{template.updated_by_profile?.nama || "-"}</div>
                      <div>
                        {format(
                          new Date(template.updated_at),
                          "dd/MM/yyyy HH:mm",
                        )}
                      </div>
                    </TableCell>
                    <TableCell
                      className="text-right"
                      onClick={(e) => e.stopPropagation()}
                    >
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => handleOpenEdit(template)}
                      >
                        <Edit className="h-4 w-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => openDeleteConfirm(template.id)}
                      >
                        <Trash2 className="h-4 w-4 text-destructive" />
                      </Button>
                    </TableCell>
                  </TableRow>
                ))
              ) : (
                <TableRow>
                  <TableCell colSpan={6} className="text-center h-24">
                    {searchQuery.trim() || typeFilter !== "all"
                      ? "Tidak ada template yang cocok dengan filter/pencarian."
                      : "Belum ada template Petty Cash dibuat."}
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </div>
      </Content>

      {/* Modal Buat/Edit Template */}
      {/* modal={false}: form ini punya Combobox (departemen auto-terapkan) -
          Dialog modal mengunci scroll body & ikut mem-block wheel-scroll di
          Popover Combobox yang di-portal terpisah, lihat komentar sama di
          PettyCashBarangClient.tsx. */}
      <Dialog
        open={activeForm !== null}
        onOpenChange={(open) => !open && handleCancelForm()}
        modal={false}
      >
        <DialogContent
          className="sm:max-w-2xl max-h-[85vh] overflow-y-auto"
          onInteractOutside={preventOutsideClose}
          onEscapeKeyDown={preventOutsideClose}
        >
          <DialogHeader>
            <DialogTitle>
              {activeForm === "new" ? "Buat Template Baru" : "Edit Template"}
            </DialogTitle>
            <DialogDescription>
              Susun urutan approver Petty Cash. Klik &quot;Batal&quot; atau
              &quot;X&quot; untuk menutup tanpa menyimpan.
            </DialogDescription>
          </DialogHeader>
          <PcApprovalTemplateForm
            key={activeForm === "new" ? "new" : activeForm?.id}
            initialData={activeForm === "new" ? null : activeForm}
            onSave={handleSaveTemplate}
            onCancel={handleCancelForm}
          />
        </DialogContent>
      </Dialog>

      {/* Modal Detail Jalur Approval */}
      <Dialog
        open={!!detailTemplate}
        onOpenChange={(open) => !open && setDetailTemplate(null)}
      >
        <DialogContent className="sm:max-w-2xl max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex flex-wrap items-center gap-2">
              {detailTemplate?.template_name}
              {detailTemplate && (
                <Badge
                  variant="outline"
                  className={cn(
                    "font-normal",
                    PC_APPROVAL_TYPE_COLORS[detailTemplate.approval_type] ||
                      PC_APPROVAL_TYPE_COLOR_DEFAULT,
                  )}
                >
                  {detailTemplate.approval_type}
                </Badge>
              )}
            </DialogTitle>
            <DialogDescription>
              {detailTemplate?.description || "Tidak ada deskripsi."}
            </DialogDescription>
          </DialogHeader>

          <div className="border rounded-md">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-[50px]">Urutan</TableHead>
                  <TableHead>Nama</TableHead>
                  <TableHead>Departemen</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {detailTemplate?.approval_path.map((app, i) => (
                  <TableRow key={app.userid || i}>
                    <TableCell>{i + 1}</TableCell>
                    <TableCell className="font-medium">{app.nama}</TableCell>
                    <TableCell>{app.department || "-"}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>

          <DialogFooter className="sm:justify-between">
            <Button
              variant="outline"
              className="text-destructive hover:text-destructive"
              onClick={() =>
                detailTemplate && openDeleteConfirm(detailTemplate.id)
              }
            >
              <Trash2 className="mr-2 h-4 w-4" /> Hapus
            </Button>
            <Button
              onClick={() => detailTemplate && handleOpenEdit(detailTemplate)}
            >
              <Edit className="mr-2 h-4 w-4" /> Edit Template
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <AlertDialog open={isAlertOpen} onOpenChange={setIsAlertOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Apakah Anda Yakin?</AlertDialogTitle>
            <AlertDialogDescription>
              Tindakan ini tidak dapat dibatalkan. Template akan dihapus
              secara permanen.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Batal</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDelete}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Ya, Hapus
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
