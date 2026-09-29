// src/components/update-web/UpdatePostForm.tsx
//
// Form buat/edit postingan Update Web (admin only) - dipakai halaman
// /update-web/buat & /update-web/edit/[id] (dulu modal UpdatePostFormDialog).
// Pakai useState manual (BUKAN react-hook-form/zod - codebase ini tidak pakai
// library form).
//
// Draft: semua isian (judul, thumbnail, versi, poin, body) auto-save ke
// localStorage per user (+ per post utk mode edit) beberapa ratus ms setelah
// berhenti mengetik, jadi aman ditinggal & dilanjut nanti di browser yang
// sama. Draft dihapus otomatis setelah berhasil simpan, atau manual lewat
// tombol "Kosongkan draft" (pakai konfirmasi). Media yang sudah di-upload
// tetap ada di storage walau draft dihapus (sama seperti sebelumnya).
//
// Versi mode "create": "Otomatis" (server hitung next patch lewat RPC
// create_update_web_post) atau manual. Mode "edit": selalu manual.

"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { JSONContent } from "@tiptap/react";
import {
  ArrowLeft,
  Check,
  ClipboardPaste,
  Eye,
  ImagePlus,
  Loader2,
  Pencil,
  Plus,
  RefreshCw,
  Trash2,
  Eraser,
} from "lucide-react";
import { toast } from "sonner";
import { Content } from "@/components/content";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
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
import {
  ImageCropDialog,
  readImageFromClipboard,
} from "@/components/image-crop-dialog";
import {
  UpdatePostEditor,
  UpdatePostEditorHandle,
} from "@/components/tiptap/update-post-editor";
import { uploadAttachmentDirect } from "@/lib/uploadDirect";
import { getUploadErrorMessage } from "@/lib/attachments";
import { cn } from "@/lib/utils";
import {
  createUpdateWebPost,
  updateUpdateWebPost,
} from "@/services/updateWebService";
import { UpdateWebPost } from "@/type/update-web";
import { UpdatePostPreview } from "./UpdatePostPreview";

type Version = { major: number; minor: number; patch: number };

interface FormState {
  title: string;
  thumbnailUrl: string | null;
  highlights: string[];
  autoVersion: boolean;
  version: Version;
  content: JSONContent | null;
}

interface StoredDraft extends FormState {
  savedAt: string;
}

interface UpdatePostFormProps {
  mode: "create" | "edit";
  userId: string;
  initialPost?: UpdateWebPost | null;
  // Versi tertinggi yang sudah ada - buat preview "akan jadi vX.Y.Z" di mode
  // create. Server tetap yang menghitung ulang scr atomic saat submit.
  latestVersion: Version | null;
}

const EMPTY_DOC: JSONContent = { type: "doc", content: [] };
const AUTOSAVE_DELAY_MS = 600;

function nextAutoVersion(latest: Version | null): Version {
  if (!latest) return { major: 1, minor: 0, patch: 0 };
  return { major: latest.major, minor: latest.minor, patch: latest.patch + 1 };
}

function draftKey(mode: "create" | "edit", userId: string, postId?: number) {
  return mode === "create"
    ? `update-web:draft:create:${userId}`
    : `update-web:draft:edit:${postId}:${userId}`;
}

// localStorage bisa throw (private mode, kuota penuh) - jangan sampai bikin
// form error, cukup draft-nya tidak tersimpan.
function readDraft(key: string): StoredDraft | null {
  try {
    const raw = localStorage.getItem(key);
    return raw ? (JSON.parse(raw) as StoredDraft) : null;
  } catch {
    return null;
  }
}

function writeDraft(key: string, draft: StoredDraft): boolean {
  try {
    localStorage.setItem(key, JSON.stringify(draft));
    return true;
  } catch {
    return false;
  }
}

function removeDraft(key: string) {
  try {
    localStorage.removeItem(key);
  } catch {
    // abaikan
  }
}

function isContentEmpty(content: JSONContent | null): boolean {
  if (!content?.content?.length) return true;
  // Doc default Tiptap = 1 paragraf kosong.
  return content.content.every(
    (n) => n.type === "paragraph" && !(n.content?.length ?? 0),
  );
}

// Bandingkan isi form (tanpa savedAt) - dipakai buat nentuin perlu simpan
// draft atau tidak (isi = baseline -> tidak ada draft).
function snapshot(state: FormState): string {
  return JSON.stringify({
    ...state,
    title: state.title.trim(),
    highlights: state.highlights.map((h) => h.trim()).filter(Boolean),
    content: isContentEmpty(state.content) ? EMPTY_DOC : state.content,
  });
}

export function UpdatePostForm({
  mode,
  userId,
  initialPost,
  latestVersion,
}: UpdatePostFormProps) {
  const router = useRouter();
  const editorRef = useRef<UpdatePostEditorHandle>(null);
  const key = draftKey(mode, userId, initialPost?.id);

  const baseline = useMemo<FormState>(() => {
    if (mode === "edit" && initialPost) {
      return {
        title: initialPost.title,
        thumbnailUrl: initialPost.thumbnail_url ?? null,
        highlights:
          initialPost.highlights.length > 0 ? initialPost.highlights : [""],
        autoVersion: false,
        version: {
          major: initialPost.version_major,
          minor: initialPost.version_minor,
          patch: initialPost.version_patch,
        },
        content: (initialPost.content as JSONContent) ?? EMPTY_DOC,
      };
    }
    return {
      title: "",
      thumbnailUrl: null,
      highlights: [""],
      autoVersion: true,
      version: nextAutoVersion(latestVersion),
      content: EMPTY_DOC,
    };
  }, [mode, initialPost, latestVersion]);

  // Draft dibaca sekali saat mount (sebelum editor dibuat) supaya editor
  // langsung mulai dgn isi draft.
  const [restoredDraft] = useState<StoredDraft | null>(() =>
    typeof window === "undefined" ? null : readDraft(key),
  );
  const [form, setForm] = useState<FormState>(() =>
    restoredDraft
      ? {
          ...baseline,
          ...restoredDraft,
          highlights: restoredDraft.highlights?.length
            ? restoredDraft.highlights
            : [""],
        }
      : baseline,
  );
  const [savedAt, setSavedAt] = useState<string | null>(
    restoredDraft?.savedAt ?? null,
  );
  const [saveState, setSaveState] = useState<"idle" | "pending" | "saved">(
    restoredDraft ? "saved" : "idle",
  );
  const [editorKey, setEditorKey] = useState(0);
  const [tab, setTab] = useState<"write" | "preview">("write");
  const [submitting, setSubmitting] = useState(false);
  const [clearOpen, setClearOpen] = useState(false);

  // Thumbnail
  const [cropOpen, setCropOpen] = useState(false);
  const [cropFile, setCropFile] = useState<File | null>(null);
  const [thumbDragging, setThumbDragging] = useState(false);

  // Setelah submit sukses, jangan sampai timer autosave yang tertunda
  // menulis draft lagi.
  const doneRef = useRef(false);
  const baselineSnapshot = useMemo(() => snapshot(baseline), [baseline]);

  useEffect(() => {
    if (restoredDraft) {
      toast.info("Melanjutkan draft tersimpan", {
        id: "update-web-draft-restored",
        description: `Terakhir disimpan ${new Date(restoredDraft.savedAt).toLocaleString("id-ID")}.`,
      });
    }
  }, [restoredDraft]);

  // Auto-save draft (debounce).
  useEffect(() => {
    if (doneRef.current) return;
    const isBaseline = snapshot(form) === baselineSnapshot;
    if (isBaseline) {
      removeDraft(key);
      setSaveState("idle");
      setSavedAt(null);
      return;
    }
    setSaveState("pending");
    const timer = setTimeout(() => {
      if (doneRef.current) return;
      const now = new Date().toISOString();
      if (writeDraft(key, { ...form, savedAt: now })) {
        setSavedAt(now);
        setSaveState("saved");
      } else {
        setSaveState("idle");
      }
    }, AUTOSAVE_DELAY_MS);
    return () => clearTimeout(timer);
  }, [form, key, baselineSnapshot]);

  const patch = (partial: Partial<FormState>) =>
    setForm((prev) => ({ ...prev, ...partial }));

  const handleContentChange = useCallback((content: JSONContent) => {
    setForm((prev) => ({ ...prev, content }));
  }, []);

  // ---------------- Thumbnail ----------------

  const openCropWith = (file: File | null) => {
    setCropFile(file);
    setCropOpen(true);
  };

  const handleThumbDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setThumbDragging(false);
    const file = Array.from(e.dataTransfer.files ?? []).find((f) =>
      f.type.startsWith("image/"),
    );
    if (file) openCropWith(file);
    else if (e.dataTransfer.files?.length) toast.error("File harus berupa gambar.");
  };

  const handleThumbPaste = (e: React.ClipboardEvent) => {
    const file = Array.from(e.clipboardData.files ?? []).find((f) =>
      f.type.startsWith("image/"),
    );
    if (file) {
      e.preventDefault();
      openCropWith(file);
    }
  };

  const handleThumbPasteButton = async () => {
    const file = await readImageFromClipboard();
    if (file) openCropWith(file);
  };

  const handleThumbCropped = async (blob: Blob) => {
    const ext = blob.type === "image/webp" ? "webp" : "jpg";
    const file = new File([blob], `thumbnail.${ext}`, { type: blob.type });
    const result = await uploadAttachmentDirect(
      file,
      `update-web/thumbnails/${Date.now()}_thumbnail.${ext}`,
    ).catch((error) => {
      throw new Error(getUploadErrorMessage(error));
    });
    if (!result.success) throw new Error(result.message);
    patch({ thumbnailUrl: result.url });
  };

  // ---------------- Highlights ----------------

  const updateHighlight = (index: number, value: string) =>
    setForm((prev) => ({
      ...prev,
      highlights: prev.highlights.map((h, i) => (i === index ? value : h)),
    }));

  const addHighlight = () =>
    setForm((prev) => ({ ...prev, highlights: [...prev.highlights, ""] }));

  const removeHighlight = (index: number) =>
    setForm((prev) => ({
      ...prev,
      highlights: prev.highlights.filter((_, i) => i !== index),
    }));

  // ---------------- Clear / Submit ----------------

  const handleClear = () => {
    removeDraft(key);
    setForm(baseline);
    // Remount editor supaya history undo-nya ikut bersih.
    setEditorKey((k) => k + 1);
    setClearOpen(false);
    setTab("write");
    toast.success(
      mode === "create" ? "Draft dikosongkan." : "Perubahan dibuang.",
    );
  };

  const effectiveVersion =
    mode === "create" && form.autoVersion
      ? nextAutoVersion(latestVersion)
      : form.version;

  const handleSubmit = async () => {
    if (!form.title.trim()) {
      toast.error("Judul wajib diisi.");
      setTab("write");
      return;
    }
    const content = editorRef.current?.getJSON() ?? form.content;
    if (isContentEmpty(content)) {
      toast.error("Detail update tidak boleh kosong.");
      setTab("write");
      return;
    }
    const { major, minor, patch: p } = form.version;
    if (!form.autoVersion || mode === "edit") {
      if (
        ![major, minor, p].every((n) => Number.isInteger(n) && n >= 0)
      ) {
        toast.error("Nomor versi harus berupa angka bulat >= 0.");
        return;
      }
    }

    const highlights = form.highlights.map((h) => h.trim()).filter(Boolean);

    setSubmitting(true);
    try {
      if (mode === "create") {
        await createUpdateWebPost({
          title: form.title.trim(),
          thumbnail_url: form.thumbnailUrl,
          highlights,
          content: content as Record<string, unknown>,
          version: form.autoVersion ? null : `${major}.${minor}.${p}`,
        });
        toast.success("Postingan Update Web berhasil dibuat.");
      } else if (initialPost) {
        await updateUpdateWebPost(initialPost.id, {
          title: form.title.trim(),
          thumbnail_url: form.thumbnailUrl,
          highlights,
          content: content as Record<string, unknown>,
          version_major: major,
          version_minor: minor,
          version_patch: p,
        });
        toast.success("Postingan Update Web berhasil diperbarui.");
      }
      doneRef.current = true;
      removeDraft(key);
      router.push("/update-web");
    } catch (error: any) {
      toast.error("Gagal menyimpan postingan", { description: error.message });
      setSubmitting(false);
    }
  };

  const hasDraft = saveState !== "idle";

  // ---------------- Render ----------------

  const draftStatus = (
    <span className="flex items-center gap-1.5 text-xs text-muted-foreground">
      {saveState === "pending" ? (
        <>
          <Loader2 className="h-3 w-3 animate-spin" /> Menyimpan draft...
        </>
      ) : saveState === "saved" && savedAt ? (
        <>
          <Check className="h-3 w-3 text-emerald-600" /> Draft tersimpan{" "}
          {new Date(savedAt).toLocaleTimeString("id-ID", {
            hour: "2-digit",
            minute: "2-digit",
          })}
        </>
      ) : mode === "create" ? (
        "Isian otomatis disimpan sebagai draft"
      ) : (
        "Perubahan otomatis disimpan sebagai draft"
      )}
    </span>
  );

  return (
    <Content
      title={mode === "create" ? "Buat Update Web" : "Edit Update Web"}
      description={
        mode === "create"
          ? "Postingan akan langsung tampil ke semua user setelah dipublikasikan."
          : `Mengedit v${initialPost?.version} - perubahan tampil ke semua user setelah disimpan.`
      }
      cardAction={
        <Button variant="outline" asChild>
          <Link href="/update-web">
            <ArrowLeft className="h-4 w-4" /> Kembali
          </Link>
        </Button>
      }
    >
      <Tabs
        value={tab}
        onValueChange={(v) => setTab(v as "write" | "preview")}
        className="gap-4"
      >
        <div className="flex flex-wrap items-center justify-between gap-3">
          <TabsList>
            <TabsTrigger value="write">
              <Pencil className="h-3.5 w-3.5" /> Tulis
            </TabsTrigger>
            <TabsTrigger value="preview">
              <Eye className="h-3.5 w-3.5" /> Preview
            </TabsTrigger>
          </TabsList>
          {draftStatus}
        </div>

        {/* forceMount: editor tetap hidup saat pindah ke tab preview supaya
            history undo & posisi kursor tidak hilang. */}
        <TabsContent
          value="write"
          forceMount
          className={cn("space-y-6", tab !== "write" && "hidden")}
        >
          <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.1fr)]">
            {/* Kiri: metadata */}
            <div className="space-y-5">
              <div className="space-y-1.5">
                <Label htmlFor="update-title">Judul</Label>
                <Input
                  id="update-title"
                  value={form.title}
                  onChange={(e) => patch({ title: e.target.value })}
                  placeholder="Judul singkat update ini"
                  disabled={submitting}
                />
              </div>

              <div className="space-y-1.5">
                <Label>Versi</Label>
                {mode === "create" && (
                  <div className="flex items-center gap-2 pb-1">
                    <Checkbox
                      id="auto-version"
                      checked={form.autoVersion}
                      onCheckedChange={(checked) =>
                        patch({ autoVersion: !!checked })
                      }
                      disabled={submitting}
                    />
                    <label
                      htmlFor="auto-version"
                      className="text-sm text-muted-foreground"
                    >
                      Otomatis (akan jadi v
                      {nextAutoVersion(latestVersion).major}.
                      {nextAutoVersion(latestVersion).minor}.
                      {nextAutoVersion(latestVersion).patch})
                    </label>
                  </div>
                )}
                {(!form.autoVersion || mode === "edit") && (
                  <div className="flex items-center gap-2">
                    {(["major", "minor", "patch"] as const).map((part, i) => (
                      <div key={part} className="flex items-center gap-2">
                        {i > 0 && <span>.</span>}
                        <Input
                          type="number"
                          min={0}
                          className="w-20"
                          aria-label={`Versi ${part}`}
                          value={form.version[part]}
                          onChange={(e) =>
                            patch({
                              version: {
                                ...form.version,
                                [part]: Number(e.target.value),
                              },
                            })
                          }
                          disabled={submitting}
                        />
                      </div>
                    ))}
                  </div>
                )}
              </div>

              <div className="space-y-1.5">
                <Label>List Update Singkat</Label>
                <div className="space-y-2">
                  {form.highlights.map((h, i) => (
                    <div key={i} className="flex items-center gap-2">
                      <Input
                        value={h}
                        onChange={(e) => updateHighlight(i, e.target.value)}
                        placeholder={`Poin update ${i + 1}`}
                        disabled={submitting}
                        onKeyDown={(e) => {
                          if (e.key === "Enter") {
                            e.preventDefault();
                            addHighlight();
                          }
                        }}
                      />
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        onClick={() => removeHighlight(i)}
                        disabled={submitting || form.highlights.length === 1}
                        aria-label="Hapus poin"
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
            </div>

            {/* Kanan: thumbnail 16:9 */}
            <div className="space-y-1.5">
              <div className="flex items-center justify-between">
                <Label>Thumbnail (16:9)</Label>
                {!form.thumbnailUrl && (
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    className="h-7 text-xs"
                    onClick={handleThumbPasteButton}
                    disabled={submitting}
                  >
                    <ClipboardPaste className="h-3.5 w-3.5" /> Tempel
                  </Button>
                )}
              </div>
              <div
                role="button"
                tabIndex={0}
                aria-label="Thumbnail. Klik untuk memilih, seret & lepas, atau tempel gambar."
                onClick={() => !submitting && openCropWith(null)}
                onKeyDown={(e) =>
                  (e.key === "Enter" || e.key === " ") && openCropWith(null)
                }
                onPaste={handleThumbPaste}
                onDragOver={(e) => {
                  e.preventDefault();
                  setThumbDragging(true);
                }}
                onDragLeave={() => setThumbDragging(false)}
                onDrop={handleThumbDrop}
                className={cn(
                  "group relative aspect-video w-full cursor-pointer overflow-hidden rounded-xl border-2 border-dashed outline-none transition-colors focus-visible:ring-2 focus-visible:ring-ring",
                  thumbDragging
                    ? "border-primary bg-primary/5"
                    : form.thumbnailUrl
                      ? "border-transparent"
                      : "border-muted-foreground/25 hover:border-primary/50 hover:bg-muted/40",
                )}
              >
                {form.thumbnailUrl ? (
                  <>
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={form.thumbnailUrl}
                      alt="Thumbnail"
                      className="h-full w-full object-cover"
                    />
                    <div
                      className={cn(
                        "absolute inset-0 flex items-center justify-center gap-2 bg-black/50 opacity-0 transition-opacity group-hover:opacity-100 group-focus-visible:opacity-100",
                        thumbDragging && "opacity-100",
                      )}
                    >
                      {thumbDragging ? (
                        <p className="text-sm font-medium text-white">
                          Lepaskan untuk mengganti
                        </p>
                      ) : (
                        <>
                          <Button
                            type="button"
                            size="sm"
                            variant="secondary"
                            onClick={(e) => {
                              e.stopPropagation();
                              openCropWith(null);
                            }}
                            disabled={submitting}
                          >
                            <RefreshCw className="h-3.5 w-3.5" /> Ganti
                          </Button>
                          <Button
                            type="button"
                            size="sm"
                            variant="destructive"
                            onClick={(e) => {
                              e.stopPropagation();
                              patch({ thumbnailUrl: null });
                            }}
                            disabled={submitting}
                          >
                            <Trash2 className="h-3.5 w-3.5" /> Hapus
                          </Button>
                        </>
                      )}
                    </div>
                  </>
                ) : (
                  <div className="flex h-full flex-col items-center justify-center gap-2 p-4 text-center">
                    <div className="flex h-11 w-11 items-center justify-center rounded-full bg-primary/10 text-primary">
                      <ImagePlus className="h-5 w-5" />
                    </div>
                    <p className="text-sm font-medium">
                      {thumbDragging
                        ? "Lepaskan gambar di sini"
                        : "Seret & lepas, klik, atau tempel (Ctrl+V)"}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      Akan di-crop ke rasio 16:9 (1280×720)
                    </p>
                  </div>
                )}
              </div>
            </div>
          </div>

          <div className="space-y-1.5">
            <Label>Detail Update</Label>
            <UpdatePostEditor
              ref={editorRef}
              key={editorKey}
              initialContent={form.content}
              storagePathPrefix={`update-web/posts/${initialPost?.id ?? "draft"}`}
              disabled={submitting}
              onChange={handleContentChange}
            />
          </div>
        </TabsContent>

        <TabsContent value="preview">
          <UpdatePostPreview
            title={form.title}
            thumbnailUrl={form.thumbnailUrl}
            highlights={form.highlights.map((h) => h.trim()).filter(Boolean)}
            content={form.content}
            version={effectiveVersion}
            authorName={initialPost?.created_by_profile?.nama ?? null}
            createdAt={initialPost?.created_at ?? null}
          />
        </TabsContent>
      </Tabs>

      <div className="mt-6 flex flex-col-reverse gap-2 border-t pt-4 sm:flex-row sm:items-center sm:justify-between">
        <Button
          type="button"
          variant="ghost"
          className="text-destructive hover:text-destructive"
          onClick={() => setClearOpen(true)}
          disabled={submitting || !hasDraft}
        >
          <Eraser className="h-4 w-4" />
          {mode === "create" ? "Kosongkan draft" : "Buang perubahan"}
        </Button>
        <div className="flex flex-col-reverse gap-2 sm:flex-row">
          <Button
            type="button"
            variant="outline"
            onClick={() => setTab(tab === "write" ? "preview" : "write")}
            disabled={submitting}
          >
            {tab === "write" ? (
              <>
                <Eye className="h-4 w-4" /> Preview
              </>
            ) : (
              <>
                <Pencil className="h-4 w-4" /> Lanjut menulis
              </>
            )}
          </Button>
          <Button type="button" onClick={handleSubmit} disabled={submitting}>
            {submitting && <Loader2 className="h-4 w-4 animate-spin" />}
            {mode === "create" ? "Publikasikan" : "Simpan Perubahan"}
          </Button>
        </div>
      </div>

      <ImageCropDialog
        open={cropOpen}
        onOpenChange={(open) => {
          setCropOpen(open);
          if (!open) setCropFile(null);
        }}
        onSave={handleThumbCropped}
        initialFile={cropFile}
        aspect={16 / 9}
        outputWidth={1280}
        title="Pilih Thumbnail"
        editTitle="Sesuaikan Thumbnail"
        pickDescription="Pilih gambar maksimal 10 MB. Hasil akhir berasio 16:9 (1280×720)."
        saveLabel="Pakai Thumbnail"
        errorTitle="Gagal mengunggah thumbnail"
        contentClassName="max-h-[95vh] overflow-y-auto sm:max-w-2xl lg:max-w-4xl xl:max-w-5xl"
        viewportClassName="max-w-none"
      />

      <AlertDialog open={clearOpen} onOpenChange={setClearOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              {mode === "create" ? "Kosongkan draft?" : "Buang semua perubahan?"}
            </AlertDialogTitle>
            <AlertDialogDescription>
              {mode === "create"
                ? "Judul, thumbnail, poin update, dan detail yang sudah ditulis akan dihapus. Tindakan ini tidak bisa dibatalkan."
                : "Form akan dikembalikan ke isi postingan yang tersimpan saat ini. Perubahan yang belum disimpan akan hilang."}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Batal</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-white hover:bg-destructive/90"
              onClick={handleClear}
            >
              {mode === "create" ? "Kosongkan" : "Buang"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </Content>
  );
}
