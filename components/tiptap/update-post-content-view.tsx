// src/components/tiptap/update-post-content-view.tsx
//
// Render read-only body postingan Update Web (Tiptap JSON dari
// update_web_posts.content) - pakai extension set yang SAMA dgn
// update-post-editor.tsx (heading/gambar/video/link) supaya semua node bisa
// di-parse, cuma editable:false. Pola sama seperti RichContentReadOnly di
// components/rich-content-view.tsx.

"use client";

import { useEditor, EditorContent, JSONContent } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import TiptapImage from "@tiptap/extension-image";
import TiptapLink from "@tiptap/extension-link";
import { cn } from "@/lib/utils";
import { UpdateVideo } from "./update-video-extension";

interface UpdatePostContentViewProps {
  content: JSONContent | Record<string, unknown> | null | undefined;
  className?: string;
}

export function UpdatePostContentView({
  content,
  className,
}: UpdatePostContentViewProps) {
  const editor = useEditor({
    immediatelyRender: false,
    editable: false,
    extensions: [
      StarterKit.configure({ heading: { levels: [2, 3] } }),
      TiptapImage.configure({
        HTMLAttributes: { class: "rounded-md max-w-full" },
      }),
      TiptapLink.configure({
        openOnClick: true,
        HTMLAttributes: {
          class: "text-primary underline underline-offset-2",
          target: "_blank",
          rel: "noopener noreferrer",
        },
      }),
      UpdateVideo,
    ],
    content: (content as JSONContent) ?? { type: "doc", content: [] },
    editorProps: {
      attributes: {
        class: cn(
          "text-sm leading-relaxed [&_p]:m-0 [&_p+p]:mt-2",
          "[&_h2]:text-lg [&_h2]:font-semibold [&_h2]:mt-4 [&_h3]:text-base [&_h3]:font-semibold [&_h3]:mt-3",
          "[&_ul]:list-disc [&_ul]:pl-5 [&_ol]:list-decimal [&_ol]:pl-5",
          "[&_.update-video-wrapper]:relative [&_.update-video-wrapper]:my-3",
          "[&_.update-video-wrapper.aspect-video]:aspect-video [&_.update-video-wrapper_iframe]:absolute [&_.update-video-wrapper_iframe]:inset-0",
        ),
      },
    },
  });

  if (!editor) return null;

  return <EditorContent editor={editor} className={className} />;
}
