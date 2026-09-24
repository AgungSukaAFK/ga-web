// src/components/rich-mention-editor.tsx
//
// Rich text editor (Tiptap) buat semua field diskusi/catatan yang sebelumnya
// <Textarea> atau <MentionTextarea>. Dukung bold/italic/list + 4 jenis
// mention (lihat components/tiptap/mention-extensions.tsx): @ user, # barang,
// $ vendor, / dokumen.

"use client";

import {
  forwardRef,
  useEffect,
  useImperativeHandle,
  useRef,
  useState,
} from "react";
import { useEditor, EditorContent, Extension, JSONContent } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import Placeholder from "@tiptap/extension-placeholder";
import { Bold, Italic, List, ListOrdered } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import {
  createAppMentionExtension,
  extractMentions,
  MENTION_LEGEND,
} from "@/components/tiptap/mention-extensions";
import { DiscussionMention } from "@/type";

export interface RichMentionEditorHandle {
  getJSON: () => JSONContent;
  getText: () => string;
  getMentions: () => DiscussionMention[];
  isEmpty: () => boolean;
  clear: () => void;
  focus: () => void;
}

interface RichMentionEditorProps {
  initialContent?: JSONContent | string | null;
  placeholder?: string;
  disabled?: boolean;
  className?: string;
  showToolbar?: boolean;
  showLegend?: boolean;
  onSubmit?: () => void;
  onPasteImage?: (file: File) => void;
  onChange?: () => void;
}

function createSubmitOnEnter(
  getSuggestionOpen: () => boolean,
  getOnSubmit: () => (() => void) | undefined,
) {
  return Extension.create({
    name: "submitOnEnter",
    addKeyboardShortcuts() {
      return {
        Enter: () => {
          if (getSuggestionOpen()) return false;
          if (
            this.editor.isActive("bulletList") ||
            this.editor.isActive("orderedList")
          ) {
            return false;
          }
          const onSubmit = getOnSubmit();
          if (!onSubmit) return false;
          onSubmit();
          return true;
        },
      };
    },
  });
}

export const RichMentionEditor = forwardRef<
  RichMentionEditorHandle,
  RichMentionEditorProps
>(function RichMentionEditor(
  {
    initialContent,
    placeholder,
    disabled,
    className,
    showToolbar = true,
    showLegend = true,
    onSubmit,
    onPasteImage,
    onChange,
  },
  ref,
) {
  const suggestionOpenRef = useRef(false);
  const onSubmitRef = useRef(onSubmit);
  onSubmitRef.current = onSubmit;
  const onChangeRef = useRef(onChange);
  onChangeRef.current = onChange;
  const [, forceRerender] = useState(0);

  const editor = useEditor({
    immediatelyRender: false,
    extensions: [
      StarterKit.configure({ heading: false }),
      Placeholder.configure({
        placeholder: placeholder || "Tulis pesan...",
      }),
      createAppMentionExtension((open) => {
        suggestionOpenRef.current = open;
      }),
      createSubmitOnEnter(
        () => suggestionOpenRef.current,
        () => onSubmitRef.current,
      ),
    ],
    content: initialContent ?? "",
    editable: !disabled,
    onUpdate() {
      onChangeRef.current?.();
      // Rerender toolbar supaya state tombol (isActive) ikut update.
      forceRerender((n) => n + 1);
    },
    onSelectionUpdate() {
      forceRerender((n) => n + 1);
    },
    editorProps: {
      attributes: {
        class: cn(
          "min-h-16 rounded-md border border-input bg-transparent px-3 py-2 text-sm leading-relaxed",
          "focus:outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50",
          "[&_p]:m-0 [&_p+p]:mt-2 [&_ul]:list-disc [&_ul]:pl-5 [&_ul]:m-0 [&_ol]:list-decimal [&_ol]:pl-5 [&_ol]:m-0",
          "[&_.mention]:rounded [&_.mention]:px-1 [&_.mention]:py-0.5 [&_.mention]:font-medium [&_.mention]:text-sm",
          "[&_.mention-user]:bg-primary/10 [&_.mention-user]:text-primary",
          "[&_.mention-barang]:bg-amber-500/10 [&_.mention-barang]:text-amber-600 dark:[&_.mention-barang]:text-amber-400",
          "[&_.mention-vendor]:bg-emerald-500/10 [&_.mention-vendor]:text-emerald-600 dark:[&_.mention-vendor]:text-emerald-400",
          "[&_.mention-document]:bg-sky-500/10 [&_.mention-document]:text-sky-600 dark:[&_.mention-document]:text-sky-400",
        ),
      },
      handlePaste(_view, event) {
        if (!onPasteImage) return false;
        const item = Array.from(event.clipboardData?.items || []).find((i) =>
          i.type.startsWith("image/"),
        );
        const file = item?.getAsFile();
        if (file) {
          onPasteImage(file);
          return true;
        }
        return false;
      },
    },
  });

  useEffect(() => {
    if (!editor) return;
    editor.setEditable(!disabled);
  }, [editor, disabled]);

  useImperativeHandle(
    ref,
    () => ({
      getJSON: () => editor?.getJSON() ?? { type: "doc", content: [] },
      getText: () => editor?.getText() ?? "",
      getMentions: () => extractMentions(editor?.getJSON()),
      isEmpty: () => editor?.isEmpty ?? true,
      clear: () => editor?.commands.clearContent(true),
      focus: () => editor?.commands.focus(),
    }),
    [editor],
  );

  if (!editor) return null;

  return (
    <div className={cn("flex flex-col gap-1.5", className)}>
      {showToolbar && (
        <div className="flex items-center gap-1 border-b pb-1">
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
        </div>
      )}
      <EditorContent editor={editor} />
      {showLegend && (
        <p className="text-[11px] text-muted-foreground">
          {MENTION_LEGEND.map((m) => `${m.char} ${m.label}`).join(" · ")}
          {onSubmit ? " — Enter kirim, Shift+Enter baris baru." : ""}
        </p>
      )}
    </div>
  );
});
