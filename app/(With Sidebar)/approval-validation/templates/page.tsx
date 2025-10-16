// src/app/(With Sidebar)/settings/approval-templates/page.tsx

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
import { Loader2, Plus, Trash2, Edit } from "lucide-react";
import { Approval } from "@/type";

export default function ApprovalTemplatesPage() {
  const [templates, setTemplates] = useState<ApprovalTemplate[]>([]);
  const [loading, setLoading] = useState(true);

  // REVISI: State untuk mengontrol form, bisa 'new', objek template, atau null
  const [activeForm, setActiveForm] = useState<"new" | ApprovalTemplate | null>(
    null
  );

  const [isAlertOpen, setIsAlertOpen] = useState(false);
  const [deletingTemplateId, setDeletingTemplateId] = useState<number | null>(
    null
  );

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
      isEditing ? "Memperbarui template..." : "Menyimpan template baru..."
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

  return (
    <>
      {/* REVISI: Konten daftar template sekarang mengambil 7 dari 12 kolom di layar medium ke atas */}
      <Content
        title="Manajemen Template Approval"
        description="Buat dan atur alur persetujuan standar untuk mempercepat proses validasi."
        cardAction={
          <Button onClick={handleOpenCreate}>
            <Plus className="mr-2 h-4 w-4" /> Buat Template Baru
          </Button>
        }
        size="md"
      >
        <div className="border rounded-md">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Nama Template</TableHead>
                <TableHead>Jumlah Approver</TableHead>
                <TableHead className="text-right">Aksi</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {loading ? (
                <TableRow>
                  <TableCell colSpan={3} className="text-center h-24">
                    <Loader2 className="mx-auto h-6 w-6 animate-spin" />
                  </TableCell>
                </TableRow>
              ) : templates.length > 0 ? (
                templates.map((template) => (
                  <TableRow
                    key={template.id}
                    className={
                      activeForm !== "new" && activeForm?.id === template.id
                        ? "bg-muted/50"
                        : ""
                    }
                  >
                    <TableCell className="font-medium">
                      {template.template_name}
                    </TableCell>
                    <TableCell>{template.approval_path.length} orang</TableCell>
                    <TableCell className="text-right">
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
                  <TableCell colSpan={3} className="text-center h-24">
                    Belum ada template dibuat.
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </div>
      </Content>

      {/* REVISI: Form sekarang dirender secara kondisional di sebelah kanan */}
      {activeForm && (
        <Content
          title={activeForm === "new" ? "Buat Template Baru" : "Edit Template"}
          size="md"
          className="col-span-12 md:col-span-5"
        >
          <TemplateForm
            key={activeForm === "new" ? "new" : activeForm.id} // Kunci unik untuk mereset form
            initialData={activeForm === "new" ? null : activeForm}
            onSave={handleSaveTemplate}
            onCancel={handleCancelForm}
          />
        </Content>
      )}

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
