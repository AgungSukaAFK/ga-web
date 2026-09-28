// src/components/update-web/UpdatePostFormDialog.tsx
//
// Dialog create/edit postingan Update Web (admin only). Pakai useState manual
// (BUKAN react-hook-form/zod - codebase ini tidak pakai library form, semua
// form lain juga useState manual, lihat riset di planning).
//
// Mode "create": versi bisa "Otomatis" (server hitung next patch lewat RPC
// create_update_web_post, lihat services/updateWebService.ts) atau manual
// override (3 input number). Mode "edit": versi selalu manual (admin langsung
// ubah angkanya kalau perlu rename, unique constraint di DB tetap menjaga).

"use client";

import { useEffect, useRef, useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Plus, Trash2, Loader2, ImagePlus, X } from "lucide-react";
import { toast } from "sonner";
import { JSONContent } from "@tiptap/react";
import {
  UpdatePostEditor,
  UpdatePostEditorHandle,
} from "@/components/tiptap/update-post-editor";
import { useImageAttachmentUpload } from "@/hooks/use-image-attachment-upload";
import {
  createUpdateWebPost,
  updateUpdateWebPost,
} from "@/services/updateWebService";
import { UpdateWebPost } from "@/type/update-web";

interface UpdatePostFormDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  mode: "create" | "edit";
  initialPost?: UpdateWebPost | null;
  // Versi tertinggi yang sudah ada (dari list yang sudah di-fetch caller) -
  // dipakai buat preview "akan jadi vX.Y.Z" di mode create, tanpa request
  // tambahan. Server tetap yang menghitung ulang scr atomic saat submit.
  latestVersion: {
    major: number;
    minor: number;
    patch: number;
  } | null;
  onSaved: (post: UpdateWebPost) => void;
}

function nextAutoVersion(
  latest: { major: number; minor: number; patch: number } | null,
) {
  if (!latest) return { major: 1, minor: 0, patch: 0 };
  return { major: latest.major, minor: latest.minor, patch: latest.patch + 1 };
}

export function UpdatePostFormDialog({
  open,
  onOpenChange,
  mode,
  initialPost,
  latestVersion,
  onSaved,
}: UpdatePostFormDialogProps) {
  const editorRef = useRef<UpdatePostEditorHandle>(null);
  const [title, setTitle] = useState("");
  const [thumbnailUrl, setThumbnailUrl] = useState<string | null>(null);
  const [highlights, setHighlights] = useState<string[]>([""]);
  const [autoVersion, setAutoVersion] = useState(true);
  const [versionMajor, setVersionMajor] = useState(1);
  const [versionMinor, setVersionMinor] = useState(0);
  const [versionPatch, setVersionPatch] = useState(0);
  const [submitting, setSubmitting] = useState(false);

  const { uploading: uploadingThumbnail, uploadFile: uploadThumbnailFile } =
    useImageAttachmentUpload("update-web/thumbnails");

  useEffect(() => {
    if (!open) return;
    if (mode === "edit" && initialPost) {
      setTitle(initialPost.title);
      setThumbnailUrl(initialPost.thumbnail_url ?? null);
      setHighlights(
        initialPost.highlights.length > 0 ? initialPost.highlights : [""],
      );
      setVersionMajor(initialPost.version_major);
      setVersionMinor(initialPost.version_minor);
      setVersionPatch(initialPost.version_patch);
      setAutoVersion(false);
    } else {
      setTitle("");
      setThumbnailUrl(null);
      setHighlights([""]);
      const next = nextAutoVersion(latestVersion);
      setVersionMajor(next.major);
      setVersionMinor(next.minor);
      setVersionPatch(next.patch);
      setAutoVersion(true);
    }
  }, [open, mode, initialPost, latestVersion]);

  const handleThumbnailChange = async (
    e: React.ChangeEvent<HTMLInputElement>,
  ) => {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    const attachment = await uploadThumbnailFile(file);
    if (attachment?.type === "image") setThumbnailUrl(attachment.url);
  };

  const updateHighlight = (index: number, value: string) => {
    setHighlights((prev) => prev.map((h, i) => (i === index ? value : h)));
  };

  const addHighlight = () => setHighlights((prev) => [...prev, ""]);

  const removeHighlight = (index: number) =>
    setHighlights((prev) => prev.filter((_, i) => i !== index));

  const handleSubmit = async () => {
    if (!title.trim()) {
      toast.error("Judul wajib diisi.");
      return;
    }
    const isEmpty = editorRef.current?.isEmpty() ?? true;
    if (isEmpty) {
      toast.error("Detail update tidak boleh kosong.");
      return;
    }
    if (!autoVersion || mode === "edit") {
      if (
        !Number.isInteger(versionMajor) ||
        !Number.isInteger(versionMinor) ||
        !Number.isInteger(versionPatch) ||
        versionMajor < 0 ||
        versionMinor < 0 ||
        versionPatch < 0
      ) {
        toast.error("Nomor versi harus berupa angka bulat >= 0.");
        return;
      }
    }

    const content = editorRef.current?.getJSON() as JSONContent;
    const filteredHighlights = highlights.map((h) => h.trim()).filter(Boolean);

    setSubmitting(true);
    try {
      if (mode === "create") {
        const post = await createUpdateWebPost({
          title: title.trim(),
          thumbnail_url: thumbnailUrl,
          highlights: filteredHighlights,
          content: content as Record<string, unknown>,
          version: autoVersion
            ? null
            : `${versionMajor}.${versionMinor}.${versionPatch}`,
        });
        toast.success("Postingan Update Web berhasil dibuat.");
        onSaved(post);
      } else if (initialPost) {
        const post = await updateUpdateWebPost(initialPost.id, {
          title: title.trim(),
          thumbnail_url: thumbnailUrl,
          highlights: filteredHighlights,
          content: content as Record<string, unknown>,
          version_major: versionMajor,
          version_minor: versionMinor,
          version_patch: versionPatch,
        });
        toast.success("Postingan Update Web berhasil diperbarui.");
        onSaved(post);
      }
      onOpenChange(false);
    } catch (error: any) {
      toast.error("Gagal menyimpan postingan", { description: error.message });
    } finally {
      setSubmitting(false);
    }
  };

  const previewVersion = nextAutoVersion(latestVersion);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>
            {mode === "create" ? "Buat Update Web" : "Edit Update Web"}
          </DialogTitle>
          <DialogDescription>
            Postingan akan langsung tampil ke semua user setelah disimpan.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="space-y-1.5">
            <Label>Judul</Label>
            <Input
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Judul singkat update ini"
              disabled={submitting}
            />
          </div>

          <div className="space-y-1.5">
            <Label>Thumbnail</Label>
            {thumbnailUrl ? (
              <div className="relative w-fit">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={thumbnailUrl}
                  alt="Thumbnail"
                  className="h-32 w-56 rounded-md object-cover border"
                />
                <Button
                  type="button"
                  variant="destructive"
                  size="icon"
                  className="absolute -top-2 -right-2 h-6 w-6 rounded-full"
                  onClick={() => setThumbnailUrl(null)}
                  disabled={submitting}
                >
                  <X className="h-3 w-3" />
                </Button>
              </div>
            ) : (
              <label className="flex h-32 w-56 cursor-pointer flex-col items-center justify-center gap-1 rounded-md border border-dashed text-sm text-muted-foreground hover:bg-accent/50">
                {uploadingThumbnail ? (
                  <Loader2 className="h-5 w-5 animate-spin" />
                ) : (
                  <>
                    <ImagePlus className="h-5 w-5" />
                    Unggah thumbnail
                  </>
                )}
                <input
                  type="file"
                  accept="image/*"
                  className="hidden"
                  onChange={handleThumbnailChange}
                  disabled={submitting || uploadingThumbnail}
                />
              </label>
            )}
          </div>

          <div className="space-y-1.5">
            <Label>Versi</Label>
            {mode === "create" && (
              <div className="flex items-center gap-2 pb-1">
                <Checkbox
                  id="auto-version"
                  checked={autoVersion}
                  onCheckedChange={(checked) => setAutoVersion(!!checked)}
                  disabled={submitting}
                />
                <label
                  htmlFor="auto-version"
                  className="text-sm text-muted-foreground"
                >
                  Otomatis (akan jadi v{previewVersion.major}.
                  {previewVersion.minor}.{previewVersion.patch})
                </label>
              </div>
            )}
            {(!autoVersion || mode === "edit") && (
              <div className="flex items-center gap-2">
                <Input
                  type="number"
                  min={0}
                  className="w-20"
                  value={versionMajor}
                  onChange={(e) => setVersionMajor(Number(e.target.value))}
                  disabled={submitting}
                />
                <span>.</span>
                <Input
                  type="number"
                  min={0}
                  className="w-20"
                  value={versionMinor}
                  onChange={(e) => setVersionMinor(Number(e.target.value))}
                  disabled={submitting}
                />
                <span>.</span>
                <Input
                  type="number"
                  min={0}
                  className="w-20"
                  value={versionPatch}
                  onChange={(e) => setVersionPatch(Number(e.target.value))}
                  disabled={submitting}
                />
              </div>
            )}
          </div>

          <div className="space-y-1.5">
            <Label>List Update Singkat</Label>
            <div className="space-y-2">
              {highlights.map((h, i) => (
                <div key={i} className="flex items-center gap-2">
                  <Input
                    value={h}
                    onChange={(e) => updateHighlight(i, e.target.value)}
                    placeholder={`Poin update ${i + 1}`}
                    disabled={submitting}
                  />
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    onClick={() => removeHighlight(i)}
                    disabled={submitting || highlights.length === 1}
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              ))}
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={addHighlight}
                disabled={submitting}
              >
                <Plus className="h-4 w-4" /> Tambah Poin
              </Button>
            </div>
          </div>

          <div className="space-y-1.5">
            <Label>Detail Update</Label>
            <UpdatePostEditor
              ref={editorRef}
              key={mode === "edit" ? `edit-${initialPost?.id}` : "create"}
              initialContent={
                mode === "edit"
                  ? (initialPost?.content as JSONContent)
                  : undefined
              }
              storagePathPrefix={`update-web/posts/${initialPost?.id ?? "draft"}`}
              disabled={submitting}
            />
          </div>
        </div>

        <DialogFooter>
          <Button
            type="button"
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={submitting}
          >
            Batal
          </Button>
          <Button type="button" onClick={handleSubmit} disabled={submitting}>
            {submitting && <Loader2 className="h-4 w-4 animate-spin" />}
            Simpan
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
