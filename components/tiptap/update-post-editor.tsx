// src/components/tiptap/update-post-editor.tsx
//
// Rich text editor (Tiptap) khusus body postingan Update Web - beda dari
// components/rich-mention-editor.tsx (yang dipakai buat chat/diskusi, heading
// dimatikan & tanpa image/video/link) karena body update butuh heading buat
// struktur, plus gambar, video (upload sendiri atau embed link eksternal), &
// link biasa. Tidak reuse RichMentionEditor langsung supaya komponen chat itu
// tidak perlu ditambah banyak prop percabangan yang tidak relevan buat
// dirinya sendiri.
//
// Media bisa masuk lewat tombol toolbar, paste dari clipboard (Ctrl+V
// screenshot/file), atau drag & drop file ke area editor - semuanya lewat
// uploadMedia(). Paste link polos otomatis jadi link + popover buat ganti
// teks tampilannya; sintaks markdown `[teks](url)` juga dikenali (lihat
// update-link-extension.ts).

"use client";

import {
  forwardRef,
  useImperativeHandle,
  useRef,
  useState,
} from "react";
import { useEditor, EditorContent, JSONContent } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import Placeholder from "@tiptap/extension-placeholder";
import TiptapImage from "@tiptap/extension-image";
import {
  Bold,
  Italic,
  List,
  ListOrdered,
  Heading2,
  Heading3,
  Link as LinkIcon,
  Unlink,
  Image as ImageIcon,
  Video,
  Film,
  Loader2,
  ExternalLink,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { uploadAttachmentDirect } from "@/lib/uploadDirect";
import { getAttachmentSizeError, getUploadErrorMessage } from "@/lib/attachments";
import { UpdateVideo } from "./update-video-extension";
import { UpdateLink, looksLikeUrl, normalizeHref } from "./update-link-extension";

export interface UpdatePostEditorHandle {
  getJSON: () => JSONContent;
  isEmpty: () => boolean;
  clear: () => void;
  setContent: (content: JSONContent | null | undefined) => void;
  focus: () => void;
}

interface UpdatePostEditorProps {
  initialContent?: JSONContent | null;
  storagePathPrefix: string;
  placeholder?: string;
  disabled?: boolean;
  className?: string;
  onChange?: (content: JSONContent) => void;
}

type MediaKind = "image" | "video";
type LinkRange = { from: number; to: number } | null;

const EMBEDDABLE_VIDEO_HOST = /(^|\.)(youtube\.com|youtu\.be|vimeo\.com)$/i;

function isEmbeddableVideoUrl(url: string): boolean {
  try {
    return EMBEDDABLE_VIDEO_HOST.test(new URL(url).hostname);
  } catch {
    return false;
  }
}

function mediaKindOf(file: File): MediaKind | null {
  if (file.type.startsWith("image/")) return "image";
  if (file.type.startsWith("video/")) return "video";
  return null;
}

export const UpdatePostEditor = forwardRef<
  UpdatePostEditorHandle,
  UpdatePostEditorProps
>(function UpdatePostEditor(
  { initialContent, storagePathPrefix, placeholder, disabled, className, onChange },
  ref,
) {
  const [, forceRerender] = useState(0);
  const [uploading, setUploading] = useState<Record<MediaKind, number>>({
    image: 0,
    video: 0,
  });
  const [linkPopoverOpen, setLinkPopoverOpen] = useState(false);
  const [linkUrl, setLinkUrl] = useState("");
  const [linkText, setLinkText] = useState("");
  const [linkRange, setLinkRange] = useState<LinkRange>(null);
  const [hasExistingLink, setHasExistingLink] = useState(false);
  const [videoUrl, setVideoUrl] = useState("");
  const [videoPopoverOpen, setVideoPopoverOpen] = useState(false);
  const imageInputRef = useRef<HTMLInputElement>(null);
  const videoInputRef = useRef<HTMLInputElement>(null);

  // editorProps (handlePaste/handleDrop) cuma dibuat sekali saat editor
  // dibuat - akses fungsi/prop terbaru lewat ref.
  const onChangeRef = useRef(onChange);
  onChangeRef.current = onChange;
  const uploadMediaRef = useRef<(file: File, pos?: number) => void>(() => {});
  const openLinkEditorRef = useRef<(range: LinkRange) => void>(() => {});

  const editor = useEditor({
    immediatelyRender: false,
    extensions: [
      StarterKit.configure({
        heading: { levels: [2, 3] },
        link: false,
      }),
      Placeholder.configure({
        placeholder:
          placeholder ||
          "Tulis detail update di sini... (bisa paste gambar/video & link langsung)",
      }),
      TiptapImage.configure({
        HTMLAttributes: { class: "rounded-md max-w-full" },
      }),
      UpdateLink.configure({
        openOnClick: false,
        autolink: true,
        defaultProtocol: "https",
        HTMLAttributes: {
          class: "text-primary underline underline-offset-2",
        },
      }),
      UpdateVideo,
    ],
    content: initialContent ?? "",
    editable: !disabled,
    onUpdate({ editor }) {
      forceRerender((n) => n + 1);
      onChangeRef.current?.(editor.getJSON());
    },
    onSelectionUpdate() {
      forceRerender((n) => n + 1);
    },
    editorProps: {
      attributes: {
        class: cn(
          "min-h-72 rounded-md border border-input bg-transparent px-3 py-2 text-sm leading-relaxed",
          "focus:outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50",
          "[&_p]:m-0 [&_p+p]:mt-2 [&_h2]:text-lg [&_h2]:font-semibold [&_h3]:text-base [&_h3]:font-semibold",
          "[&_ul]:list-disc [&_ul]:pl-5 [&_ol]:list-decimal [&_ol]:pl-5",
          "[&_img.ProseMirror-selectednode]:ring-2 [&_img.ProseMirror-selectednode]:ring-primary",
          "[&_.update-video-wrapper]:relative [&_.update-video-wrapper]:my-2",
          "[&_.update-video-wrapper.aspect-video]:aspect-video [&_.update-video-wrapper_iframe]:absolute [&_.update-video-wrapper_iframe]:inset-0",
        ),
      },
      handlePaste(view, event) {
        const files = Array.from(event.clipboardData?.files ?? []).filter(
          (f) => mediaKindOf(f),
        );
        if (files.length > 0) {
          event.preventDefault();
          files.forEach((f) => uploadMediaRef.current(f));
          return true;
        }

        // Paste 1 URL polos tanpa seleksi -> sisipkan sbg link lalu buka
        // popover buat ganti teks tampilannya (link "dibungkus" teks).
        // Kalau ada seleksi, Link bawaan Tiptap yang nanganin (seleksi jadi
        // teks link-nya).
        const text = event.clipboardData?.getData("text/plain") ?? "";
        const { state } = view;
        if (state.selection.empty && looksLikeUrl(text)) {
          event.preventDefault();
          const href = normalizeHref(text.trim());
          const from = state.selection.from;
          const linkMark = state.schema.marks.link.create({ href });
          const tr = state.tr
            .replaceSelectionWith(state.schema.text(href, [linkMark]), false)
            .removeStoredMark(state.schema.marks.link);
          view.dispatch(tr);
          openLinkEditorRef.current({ from, to: from + href.length });
          return true;
        }
        return false;
      },
      handleDrop(view, event, _slice, moved) {
        if (moved) return false;
        const files = Array.from(event.dataTransfer?.files ?? []).filter(
          (f) => mediaKindOf(f),
        );
        if (files.length === 0) return false;
        event.preventDefault();
        const pos = view.posAtCoords({
          left: event.clientX,
          top: event.clientY,
        })?.pos;
        files.forEach((f) => uploadMediaRef.current(f, pos));
        return true;
      },
    },
  });

  useImperativeHandle(
    ref,
    () => ({
      getJSON: () => editor?.getJSON() ?? { type: "doc", content: [] },
      isEmpty: () => editor?.isEmpty ?? true,
      clear: () => editor?.commands.clearContent(true),
      setContent: (content) =>
        editor?.commands.setContent(content ?? "", { emitUpdate: true }),
      focus: () => editor?.commands.focus(),
    }),
    [editor],
  );

  const uploadMedia = async (file: File, pos?: number) => {
    if (!editor) return;
    const kind = mediaKindOf(file);
    if (!kind) {
      toast.error("File harus berupa gambar atau video");
      return;
    }
    const label = kind === "image" ? "gambar" : "video";
    const sizeError = getAttachmentSizeError(file);
    if (sizeError) {
      toast.error(`Ukuran ${label} terlalu besar`, { description: sizeError });
      return;
    }
    setUploading((u) => ({ ...u, [kind]: u[kind] + 1 }));
    try {
      // Screenshot dari clipboard namanya generik ("image.png") - tambah
      // timestamp supaya path unik.
      const name = file.name || `${kind}.${file.type.split("/")[1] ?? "bin"}`;
      const path = `${storagePathPrefix}/${Date.now()}_${name}`;
      const result = await uploadAttachmentDirect(file, path);
      if (!result.success) throw new Error(result.message);
      const chain = editor.chain().focus();
      if (pos !== undefined) chain.setTextSelection(pos);
      if (kind === "image") chain.setImage({ src: result.url });
      else chain.setVideo({ src: result.url, sourceType: "upload" });
      chain.run();
    } catch (error) {
      toast.error(`Gagal mengunggah ${label}`, {
        description: getUploadErrorMessage(error),
      });
    } finally {
      setUploading((u) => ({ ...u, [kind]: u[kind] - 1 }));
    }
  };
  uploadMediaRef.current = uploadMedia;

  // Buka popover link utk range tertentu (link yang baru di-paste) atau
  // berdasarkan seleksi sekarang (klik tombol toolbar).
  const openLinkEditor = (range: LinkRange) => {
    if (!editor) return;
    let r = range;
    if (!r) {
      const { from, to, empty } = editor.state.selection;
      if (editor.isActive("link")) {
        editor.chain().extendMarkRange("link").run();
        const sel = editor.state.selection;
        r = { from: sel.from, to: sel.to };
      } else if (!empty) {
        r = { from, to };
      }
    }
    const text = r ? editor.state.doc.textBetween(r.from, r.to, " ") : "";
    const href = r
      ? (editor.state.doc
          .nodeAt(r.from)
          ?.marks.find((m) => m.type.name === "link")?.attrs.href ?? "")
      : "";
    setLinkRange(r);
    setHasExistingLink(!!href);
    setLinkText(text);
    setLinkUrl(href);
    setLinkPopoverOpen(true);
  };
  openLinkEditorRef.current = openLinkEditor;

  if (!editor) return null;

  const pendingUploads = uploading.image + uploading.video;

  const handleFileInputChange =
    (kind: MediaKind) => (e: React.ChangeEvent<HTMLInputElement>) => {
      const files = Array.from(e.target.files ?? []);
      e.target.value = "";
      files.forEach((file) => {
        if (mediaKindOf(file) !== kind) {
          toast.error(kind === "image" ? "File bukan gambar" : "File bukan video");
          return;
        }
        uploadMedia(file);
      });
    };

  const applyLink = () => {
    const href = normalizeHref(linkUrl);
    if (!href) {
      toast.error("URL link wajib diisi");
      return;
    }
    const text = linkText.trim() || href;
    const node = {
      type: "text",
      text,
      marks: [{ type: "link", attrs: { href } }],
    };
    const chain = editor.chain().focus();
    if (linkRange) chain.insertContentAt(linkRange, node);
    else chain.insertContent(node);
    chain.unsetMark("link").run();
    setLinkPopoverOpen(false);
  };

  const removeLink = () => {
    if (linkRange) {
      editor
        .chain()
        .focus()
        .setTextSelection(linkRange)
        .unsetLink()
        .setTextSelection(linkRange.to)
        .run();
    }
    setLinkPopoverOpen(false);
  };

  const convertLinkToEmbed = () => {
    const href = normalizeHref(linkUrl);
    const chain = editor.chain().focus();
    if (linkRange) chain.deleteRange(linkRange);
    chain.setVideo({ src: href, sourceType: "embed" }).run();
    setLinkPopoverOpen(false);
  };

  const applyVideoLink = () => {
    const url = videoUrl.trim();
    if (!url) return;
    if (!/^https?:\/\//i.test(url)) {
      toast.error("Link video harus diawali http:// atau https://");
      return;
    }
    editor.commands.setVideo({ src: url, sourceType: "embed" });
    setVideoPopoverOpen(false);
    setVideoUrl("");
  };

  const toolbarButton = (
    active: boolean,
    onClick: () => void,
    icon: React.ReactNode,
    title: string,
  ) => (
    <Button
      type="button"
      variant="ghost"
      size="icon"
      className={cn("h-8 w-8", active && "bg-accent")}
      disabled={disabled}
      onMouseDown={(e) => e.preventDefault()}
      onClick={onClick}
      title={title}
    >
      {icon}
    </Button>
  );

  const activeLinkHref: string | undefined = editor.isActive("link")
    ? editor.getAttributes("link").href
    : undefined;

  return (
    <div className={cn("flex flex-col gap-1.5", className)}>
      <input
        ref={imageInputRef}
        type="file"
        accept="image/*"
        multiple
        className="hidden"
        onChange={handleFileInputChange("image")}
      />
      <input
        ref={videoInputRef}
        type="file"
        accept="video/*"
        className="hidden"
        onChange={handleFileInputChange("video")}
      />
      <div className="sticky top-0 z-10 flex flex-wrap items-center gap-1 rounded-md border bg-background/95 p-1 backdrop-blur supports-[backdrop-filter]:bg-background/80">
        {toolbarButton(
          editor.isActive("bold"),
          () => editor.chain().focus().toggleBold().run(),
          <Bold className="h-4 w-4" />,
          "Tebal (Ctrl+B)",
        )}
        {toolbarButton(
          editor.isActive("italic"),
          () => editor.chain().focus().toggleItalic().run(),
          <Italic className="h-4 w-4" />,
          "Miring (Ctrl+I)",
        )}
        {toolbarButton(
          editor.isActive("heading", { level: 2 }),
          () => editor.chain().focus().toggleHeading({ level: 2 }).run(),
          <Heading2 className="h-4 w-4" />,
          "Judul besar",
        )}
        {toolbarButton(
          editor.isActive("heading", { level: 3 }),
          () => editor.chain().focus().toggleHeading({ level: 3 }).run(),
          <Heading3 className="h-4 w-4" />,
          "Judul kecil",
        )}
        {toolbarButton(
          editor.isActive("bulletList"),
          () => editor.chain().focus().toggleBulletList().run(),
          <List className="h-4 w-4" />,
          "Daftar poin",
        )}
        {toolbarButton(
          editor.isActive("orderedList"),
          () => editor.chain().focus().toggleOrderedList().run(),
          <ListOrdered className="h-4 w-4" />,
          "Daftar bernomor",
        )}

        <div className="mx-1 h-5 w-px bg-border" />

        <Popover
          open={linkPopoverOpen}
          onOpenChange={(open) => {
            if (open) openLinkEditor(null);
            else setLinkPopoverOpen(false);
          }}
        >
          <PopoverTrigger asChild>
            <Button
              type="button"
              variant="ghost"
              size="icon"
              className={cn("h-8 w-8", editor.isActive("link") && "bg-accent")}
              disabled={disabled}
              onMouseDown={(e) => e.preventDefault()}
              title="Link"
            >
              <LinkIcon className="h-4 w-4" />
            </Button>
          </PopoverTrigger>
          <PopoverContent
            className="w-80 space-y-3"
            align="start"
            onCloseAutoFocus={(e) => e.preventDefault()}
          >
            <div className="space-y-1.5">
              <Label className="text-xs">Teks tampilan</Label>
              <Input
                value={linkText}
                onChange={(e) => setLinkText(e.target.value)}
                onFocus={(e) => e.currentTarget.select()}
                placeholder="mis. Lihat dokumentasi"
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    e.preventDefault();
                    applyLink();
                  }
                }}
              />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">URL</Label>
              <Input
                value={linkUrl}
                onChange={(e) => setLinkUrl(e.target.value)}
                placeholder="https://..."
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    e.preventDefault();
                    applyLink();
                  }
                }}
              />
            </div>
            <p className="text-[11px] leading-snug text-muted-foreground">
              Tip: bisa juga ketik <code>[teks](https://url)</code> langsung di
              editor, atau blok teks lalu paste link.
            </p>
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div className="flex gap-1">
                {hasExistingLink && (
                  <Button
                    type="button"
                    size="sm"
                    variant="ghost"
                    onClick={removeLink}
                    title="Hapus link (teks tetap)"
                  >
                    <Unlink className="h-3.5 w-3.5" />
                  </Button>
                )}
                {isEmbeddableVideoUrl(normalizeHref(linkUrl)) && (
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    onClick={convertLinkToEmbed}
                  >
                    <Film className="h-3.5 w-3.5" /> Jadikan video
                  </Button>
                )}
              </div>
              <Button type="button" size="sm" onClick={applyLink}>
                Terapkan
              </Button>
            </div>
          </PopoverContent>
        </Popover>

        <Button
          type="button"
          variant="ghost"
          size="icon"
          className="h-8 w-8"
          disabled={disabled}
          onMouseDown={(e) => e.preventDefault()}
          onClick={() => imageInputRef.current?.click()}
          title="Upload gambar"
        >
          {uploading.image > 0 ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <ImageIcon className="h-4 w-4" />
          )}
        </Button>

        <Button
          type="button"
          variant="ghost"
          size="icon"
          className="h-8 w-8"
          disabled={disabled}
          onMouseDown={(e) => e.preventDefault()}
          onClick={() => videoInputRef.current?.click()}
          title="Upload video"
        >
          {uploading.video > 0 ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <Video className="h-4 w-4" />
          )}
        </Button>

        <Popover open={videoPopoverOpen} onOpenChange={setVideoPopoverOpen}>
          <PopoverTrigger asChild>
            <Button
              type="button"
              variant="ghost"
              size="icon"
              className="h-8 w-8"
              disabled={disabled}
              onMouseDown={(e) => e.preventDefault()}
              title="Embed video dari link (YouTube, dll)"
            >
              <Film className="h-4 w-4" />
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-72 space-y-2" align="start">
            <p className="text-xs text-muted-foreground">
              Tempel link video eksternal (YouTube, Vimeo, dll).
            </p>
            <div className="flex gap-2">
              <Input
                value={videoUrl}
                onChange={(e) => setVideoUrl(e.target.value)}
                placeholder="https://youtube.com/watch?v=..."
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    e.preventDefault();
                    applyVideoLink();
                  }
                }}
              />
              <Button type="button" size="sm" onClick={applyVideoLink}>
                Sisipkan
              </Button>
            </div>
          </PopoverContent>
        </Popover>

        {pendingUploads > 0 && (
          <span className="ml-auto flex items-center gap-1.5 pr-1 text-xs text-muted-foreground">
            <Loader2 className="h-3 w-3 animate-spin" />
            Mengunggah {pendingUploads} media...
          </span>
        )}
      </div>

      {activeLinkHref && (
        <div className="flex items-center gap-2 rounded-md bg-muted/60 px-2 py-1 text-xs text-muted-foreground">
          <LinkIcon className="h-3 w-3 shrink-0" />
          <a
            href={activeLinkHref}
            target="_blank"
            rel="noopener noreferrer"
            className="min-w-0 flex-1 truncate hover:underline"
          >
            {activeLinkHref}
          </a>
          <ExternalLink className="h-3 w-3 shrink-0" />
          <button
            type="button"
            className="shrink-0 font-medium text-primary hover:underline"
            onMouseDown={(e) => e.preventDefault()}
            onClick={() => openLinkEditor(null)}
          >
            Edit
          </button>
        </div>
      )}

      <EditorContent editor={editor} />
      <p className="text-[11px] text-muted-foreground">
        Paste (Ctrl+V) atau seret gambar/video langsung ke editor untuk
        mengunggah. Paste link untuk menyisipkan link & atur teksnya.
      </p>
    </div>
  );
});
