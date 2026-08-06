// src/app/(With Sidebar)/approval-validation/templates/page.tsx

"use client";

import { useEffect, useState } from "react";
import { Content } from "@/components/content";
import { Button } from "@/components/ui/button";
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
  ApprovalTemplate,
  createTemplate,
  deleteTemplate,
  fetchTemplates,
  updateTemplate,
} from "@/services/approvalTemplateService";
import { TemplateForm } from "./TemplateForm";
import { Loader2, Plus, Trash2, Edit, Search } from "lucide-react";
import { Approval } from "@/type";
import { Input } from "@/components/ui/input";

export default function ApprovalTemplatesPage() {
  const [templates, setTemplates] = useState<ApprovalTemplate[]>([]);
  const [loading, setLoading] = useState(true);

  // Modal buat/edit template. `null` = tertutup, "new" = mode buat baru,
  // objek template = mode edit.
  const [activeForm, setActiveForm] = useState<
    "new" | ApprovalTemplate | null
  >(null);

  // Modal detail jalur approval (muncul saat row diklik).
  const [detailTemplate, setDetailTemplate] =
    useState<ApprovalTemplate | null>(null);

  const [isAlertOpen, setIsAlertOpen] = useState(false);
  const [deletingTemplateId, setDeletingTemplateId] = useState<number | null>(
    null,
  );

  const [searchQuery, setSearchQuery] = useState("");

  const filteredTemplates = templates.filter((template) => {
    const query = searchQuery.trim().toLowerCase();
    if (!query) return true;
    const matchesName = template.template_name
      .toLowerCase()
      .includes(query);
    const matchesApprover = template.approval_path.some((app) =>
      (app.nama || "").toLowerCase().includes(query),
    );
    return matchesName || matchesApprover;
  });

  const loadTemplates = async () => {
    setLoading(true);
    try {
      const data = await fetchTemplates();
      setTemplates(data);
    } catch (error: any) {
      toast.error("Gagal memuat template", { description: error.message });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadTemplates();
  }, []);

  const handleOpenCreate = () => {
    setActiveForm("new");
  };

  const handleOpenEdit = (template: ApprovalTemplate) => {
    setDetailTemplate(null);
    setActiveForm(template);
  };

  const handleCancelForm = () => {
    setActiveForm(null);
  };

  const handleSaveTemplate = async (data: {
    template_name: string;
    description: string;
    approval_path: Approval[];
  }) => {
    const isEditing = activeForm && activeForm !== "new";
    const toastId = toast.loading(
      isEditing ? "Memperbarui template..." : "Menyimpan template baru...",
    );
    try {
      if (isEditing) {
        await updateTemplate((activeForm as ApprovalTemplate).id, data);
      } else {
        await createTemplate(data);
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
    setDeletingTemplateId(id);
    setIsAlertOpen(true);
  };

  const handleDelete = async () => {
    if (!deletingTemplateId) return;
    const toastId = toast.loading("Menghapus template...");
    try {
      await deleteTemplate(deletingTemplateId);
      toast.success("Template berhasil dihapus.", { id: toastId });
      await loadTemplates();
    } catch (error: any) {
      toast.error("Gagal menghapus template", {
        id: toastId,
        description: error.message,
      });
    } finally {
      setIsAlertOpen(false);
      setDeletingTemplateId(null);
    }
  };

  // Modal buat/edit tidak boleh ketutup gara-gara klik di luar atau Escape -
  // hanya tombol Batal / X yang boleh nutup, supaya progress ngisi form
  // (nyari & nyusun approver) ga ilang gara-gara ke-klik di luar.
  const preventOutsideClose = (e: Event) => e.preventDefault();

  return (
    <>
      <Content
        title="Manajemen Template Approval"
        description="Buat dan atur alur persetujuan standar untuk mempercepat proses validasi."
        cardAction={
          <Button onClick={handleOpenCreate}>
            <Plus className="mr-2 h-4 w-4" /> Buat Template Baru
          </Button>
        }
      >
        <div className="relative mb-4 max-w-sm">
          <Search className="absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Cari nama template atau nama approver..."
            className="pl-8"
          />
        </div>
        <div className="border rounded-md overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Nama Template</TableHead>
                <TableHead>Deskripsi</TableHead>
                <TableHead>Jalur Approval</TableHead>
                <TableHead className="w-[140px]">Jumlah Approver</TableHead>
                <TableHead className="text-right w-[120px]">Aksi</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {loading ? (
                <TableRow>
                  <TableCell colSpan={5} className="text-center h-24">
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
                      {template.template_name}
                    </TableCell>
                    <TableCell className="max-w-[320px] truncate text-muted-foreground">
                      {template.description || "-"}
                    </TableCell>
                    <TableCell>
                      <div className="flex flex-wrap gap-1 max-w-[360px]">
                        {template.approval_path.slice(0, 3).map((app, i) => (
                          <Badge
                            key={i}
                            variant="outline"
                            className="font-normal"
                          >
                            {i + 1}. {app.type || "?"}
                          </Badge>
                        ))}
                        {template.approval_path.length > 3 && (
                          <Badge variant="outline" className="font-normal">
                            +{template.approval_path.length - 3} lagi
                          </Badge>
                        )}
                      </div>
                    </TableCell>
                    <TableCell>{template.approval_path.length} orang</TableCell>
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
                  <TableCell colSpan={5} className="text-center h-24">
                    {searchQuery.trim()
                      ? "Tidak ada template yang cocok dengan pencarian."
                      : "Belum ada template dibuat."}
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </div>
      </Content>

      {/* Modal Buat/Edit Template */}
      <Dialog
        open={activeForm !== null}
        onOpenChange={(open) => !open && handleCancelForm()}
      >
        <DialogContent
          className="sm:max-w-3xl max-h-[85vh] overflow-y-auto"
          onInteractOutside={preventOutsideClose}
          onEscapeKeyDown={preventOutsideClose}
        >
          <DialogHeader>
            <DialogTitle>
              {activeForm === "new" ? "Buat Template Baru" : "Edit Template"}
            </DialogTitle>
            <DialogDescription>
              Susun urutan approver dan jenis approval-nya. Klik &quot;Batal&quot;
              atau &quot;X&quot; untuk menutup tanpa menyimpan.
            </DialogDescription>
          </DialogHeader>
          <TemplateForm
            key={activeForm === "new" ? "new" : activeForm?.id}
            initialData={activeForm === "new" ? null : activeForm}
            onSave={handleSaveTemplate}
            onCancel={handleCancelForm}
          />
        </DialogContent>
      </Dialog>

      {/* Modal Detail Jalur Approval (muncul saat row diklik) */}
      <Dialog
        open={!!detailTemplate}
        onOpenChange={(open) => !open && setDetailTemplate(null)}
      >
        <DialogContent className="sm:max-w-2xl max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{detailTemplate?.template_name}</DialogTitle>
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
                  <TableHead>Jenis Approval</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {detailTemplate?.approval_path.map((app, i) => (
                  <TableRow key={app.userid || i}>
                    <TableCell>{i + 1}</TableCell>
                    <TableCell className="font-medium">{app.nama}</TableCell>
                    <TableCell>{app.department || "-"}</TableCell>
                    <TableCell>
                      <Badge variant="outline" className="font-normal">
                        {app.type || "?"}
                      </Badge>
                    </TableCell>
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
              Tindakan ini tidak dapat dibatalkan. Template akan dihapus secara
              permanen.
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
