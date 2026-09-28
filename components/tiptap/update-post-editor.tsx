// src/components/tiptap/update-post-editor.tsx
//
// Rich text editor (Tiptap) khusus body postingan Update Web - beda dari
// components/rich-mention-editor.tsx (yang dipakai buat chat/diskusi, heading
// dimatikan & tanpa image/video/link) karena body update butuh heading buat
// struktur, plus gambar, video (upload sendiri atau embed link eksternal), &
// link biasa. Tidak reuse RichMentionEditor langsung supaya komponen chat itu
// tidak perlu ditambah banyak prop percabangan yang tidak relevan buat
// dirinya sendiri.

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
import TiptapLink from "@tiptap/extension-link";
import {
  Bold,
  Italic,
  List,
  ListOrdered,
  Heading2,
  Heading3,
  Link as LinkIcon,
  Image as ImageIcon,
  Video,
  Film,
  Loader2,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
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

export interface UpdatePostEditorHandle {
  getJSON: () => JSONContent;
  isEmpty: () => boolean;
  clear: () => void;
  focus: () => void;
}

interface UpdatePostEditorProps {
  initialContent?: JSONContent | null;
  storagePathPrefix: string;
  placeholder?: string;
  disabled?: boolean;
  className?: string;
}

export const UpdatePostEditor = forwardRef<
  UpdatePostEditorHandle,
  UpdatePostEditorProps
>(function UpdatePostEditor(
  { initialContent, storagePathPrefix, placeholder, disabled, className },
  ref,
) {
  const [, forceRerender] = useState(0);
  const [uploadingImage, setUploadingImage] = useState(false);
  const [uploadingVideo, setUploadingVideo] = useState(false);
  const [linkUrl, setLinkUrl] = useState("");
  const [linkPopoverOpen, setLinkPopoverOpen] = useState(false);
  const [videoUrl, setVideoUrl] = useState("");
  const [videoPopoverOpen, setVideoPopoverOpen] = useState(false);
  const imageInputRef = useRef<HTMLInputElement>(null);
  const videoInputRef = useRef<HTMLInputElement>(null);

  const editor = useEditor({
    immediatelyRender: false,
    extensions: [
      StarterKit.configure({
        heading: { levels: [2, 3] },
      }),
      Placeholder.configure({
        placeholder: placeholder || "Tulis detail update di sini...",
      }),
      TiptapImage.configure({
        HTMLAttributes: { class: "rounded-md max-w-full" },
      }),
      TiptapLink.configure({
        openOnClick: false,
        autolink: true,
        HTMLAttributes: {
          class: "text-primary underline underline-offset-2",
        },
      }),
      UpdateVideo,
    ],
    content: initialContent ?? "",
    editable: !disabled,
    onUpdate() {
      forceRerender((n) => n + 1);
    },
    onSelectionUpdate() {
      forceRerender((n) => n + 1);
    },
    editorProps: {
      attributes: {
        class: cn(
          "min-h-48 rounded-md border border-input bg-transparent px-3 py-2 text-sm leading-relaxed",
          "focus:outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50",
          "[&_p]:m-0 [&_p+p]:mt-2 [&_h2]:text-lg [&_h2]:font-semibold [&_h3]:text-base [&_h3]:font-semibold",
          "[&_ul]:list-disc [&_ul]:pl-5 [&_ol]:list-decimal [&_ol]:pl-5",
          "[&_.update-video-wrapper]:relative [&_.update-video-wrapper]:my-2",
          "[&_.update-video-wrapper.aspect-video]:aspect-video [&_.update-video-wrapper_iframe]:absolute [&_.update-video-wrapper_iframe]:inset-0",
        ),
      },
    },
  });

  useImperativeHandle(
    ref,
    () => ({
      getJSON: () => editor?.getJSON() ?? { type: "doc", content: [] },
      isEmpty: () => editor?.isEmpty ?? true,
      clear: () => editor?.commands.clearContent(true),
      focus: () => editor?.commands.focus(),
    }),
    [editor],
  );

  if (!editor) return null;

  const handleImageButtonClick = () => imageInputRef.current?.click();
  const handleVideoUploadButtonClick = () => videoInputRef.current?.click();

  const handleImageFileChange = async (
    e: React.ChangeEvent<HTMLInputElement>,
  ) => {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    if (!file.type.startsWith("image/")) {
      toast.error("File bukan gambar");
      return;
    }
    const sizeError = getAttachmentSizeError(file);
    if (sizeError) {
      toast.error("Ukuran gambar terlalu besar", { description: sizeError });
      return;
    }
    setUploadingImage(true);
    try {
      const path = `${storagePathPrefix}/${Date.now()}_${file.name}`;
      const result = await uploadAttachmentDirect(file, path);
      if (!result.success) throw new Error(result.message);
      editor.chain().focus().setImage({ src: result.url }).run();
    } catch (error) {
      toast.error("Gagal mengunggah gambar", {
        description: getUploadErrorMessage(error),
      });
    } finally {
      setUploadingImage(false);
    }
  };

  const handleVideoFileChange = async (
    e: React.ChangeEvent<HTMLInputElement>,
  ) => {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    if (!file.type.startsWith("video/")) {
      toast.error("File bukan video");
      return;
    }
    const sizeError = getAttachmentSizeError(file);
    if (sizeError) {
      toast.error("Ukuran video terlalu besar", { description: sizeError });
      return;
    }
    setUploadingVideo(true);
    try {
      const path = `${storagePathPrefix}/${Date.now()}_${file.name}`;
      const result = await uploadAttachmentDirect(file, path);
      if (!result.success) throw new Error(result.message);
      editor.commands.setVideo({ src: result.url, sourceType: "upload" });
    } catch (error) {
      toast.error("Gagal mengunggah video", {
        description: getUploadErrorMessage(error),
      });
    } finally {
      setUploadingVideo(false);
    }
  };

  const applyLink = () => {
    const url = linkUrl.trim();
    if (!url) {
      editor.chain().focus().extendMarkRange("link").unsetLink().run();
    } else {
      editor
        .chain()
        .focus()
        .extendMarkRange("link")
        .setLink({ href: url })
        .run();
    }
    setLinkPopoverOpen(false);
    setLinkUrl("");
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

  return (
    <div className={cn("flex flex-col gap-1.5", className)}>
      <input
        ref={imageInputRef}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={handleImageFileChange}
      />
      <input
        ref={videoInputRef}
        type="file"
        accept="video/*"
        className="hidden"
        onChange={handleVideoFileChange}
      />
      <div className="flex flex-wrap items-center gap-1 border-b pb-1">
        <Button
          type="button"
          variant="ghost"
          size="icon"
          className={cn("h-7 w-7", editor.isActive("bold") && "bg-accent")}
          disabled={disabled}
          onMouseDown={(e) => e.preventDefault()}
          onClick={() => editor.chain().focus().toggleBold().run()}
        >
          <Bold className="h-3.5 w-3.5" />
        </Button>
        <Button
          type="button"
          variant="ghost"
          size="icon"
          className={cn("h-7 w-7", editor.isActive("italic") && "bg-accent")}
          disabled={disabled}
          onMouseDown={(e) => e.preventDefault()}
          onClick={() => editor.chain().focus().toggleItalic().run()}
        >
          <Italic className="h-3.5 w-3.5" />
        </Button>
        <Button
          type="button"
          variant="ghost"
          size="icon"
          className={cn(
            "h-7 w-7",
            editor.isActive("heading", { level: 2 }) && "bg-accent",
          )}
          disabled={disabled}
          onMouseDown={(e) => e.preventDefault()}
          onClick={() =>
            editor.chain().focus().toggleHeading({ level: 2 }).run()
          }
        >
          <Heading2 className="h-3.5 w-3.5" />
        </Button>
        <Button
          type="button"
          variant="ghost"
          size="icon"
          className={cn(
            "h-7 w-7",
            editor.isActive("heading", { level: 3 }) && "bg-accent",
          )}
          disabled={disabled}
          onMouseDown={(e) => e.preventDefault()}
          onClick={() =>
            editor.chain().focus().toggleHeading({ level: 3 }).run()
          }
        >
          <Heading3 className="h-3.5 w-3.5" />
        </Button>
        <Button
          type="button"
          variant="ghost"
          size="icon"
          className={cn(
            "h-7 w-7",
            editor.isActive("bulletList") && "bg-accent",
          )}
          disabled={disabled}
          onMouseDown={(e) => e.preventDefault()}
          onClick={() => editor.chain().focus().toggleBulletList().run()}
        >
          <List className="h-3.5 w-3.5" />
        </Button>
        <Button
          type="button"
          variant="ghost"
          size="icon"
          className={cn(
            "h-7 w-7",
            editor.isActive("orderedList") && "bg-accent",
          )}
          disabled={disabled}
          onMouseDown={(e) => e.preventDefault()}
          onClick={() => editor.chain().focus().toggleOrderedList().run()}
        >
          <ListOrdered className="h-3.5 w-3.5" />
        </Button>

        <Popover
          open={linkPopoverOpen}
          onOpenChange={(open) => {
            setLinkPopoverOpen(open);
            if (open) setLinkUrl(editor.getAttributes("link").href ?? "");
          }}
        >
          <PopoverTrigger asChild>
            <Button
              type="button"
              variant="ghost"
              size="icon"
              className={cn(
                "h-7 w-7",
                editor.isActive("link") && "bg-accent",
              )}
              disabled={disabled}
              onMouseDown={(e) => e.preventDefault()}
            >
              <LinkIcon className="h-3.5 w-3.5" />
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-72 space-y-2" align="start">
            <p className="text-xs text-muted-foreground">
              Masukkan URL link. Kosongkan lalu terapkan untuk menghapus link.
            </p>
            <div className="flex gap-2">
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
          className="h-7 w-7"
          disabled={disabled || uploadingImage}
          onMouseDown={(e) => e.preventDefault()}
          onClick={handleImageButtonClick}
        >
          {uploadingImage ? (
            <Loader2 className="h-3.5 w-3.5 animate-spin" />
          ) : (
            <ImageIcon className="h-3.5 w-3.5" />
          )}
        </Button>

        <Button
          type="button"
          variant="ghost"
          size="icon"
          className="h-7 w-7"
          disabled={disabled || uploadingVideo}
          onMouseDown={(e) => e.preventDefault()}
          onClick={handleVideoUploadButtonClick}
          title="Upload video"
        >
          {uploadingVideo ? (
            <Loader2 className="h-3.5 w-3.5 animate-spin" />
          ) : (
            <Video className="h-3.5 w-3.5" />
          )}
        </Button>

        <Popover open={videoPopoverOpen} onOpenChange={setVideoPopoverOpen}>
          <PopoverTrigger asChild>
            <Button
              type="button"
              variant="ghost"
              size="icon"
              className="h-7 w-7"
              disabled={disabled}
              onMouseDown={(e) => e.preventDefault()}
              title="Embed video dari link (YouTube, dll)"
            >
              <Film className="h-3.5 w-3.5" />
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
      </div>
      <EditorContent editor={editor} />
    </div>
  );
});
