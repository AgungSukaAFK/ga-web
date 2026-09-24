// src/components/rich-content-view.tsx
//
// Render read-only untuk isi Discussion.content (Tiptap JSON) atau field
// catatan yang sudah dipindah ke rich text. Kalau `content` tidak ada (entri
// lama sebelum fitur ini ada), fallback ke MessageWithMentions/NoteWithLinks
// yang sudah ada supaya histori lama tidak perlu dimigrasi.

"use client";

import { useEditor, EditorContent, JSONContent } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import { cn } from "@/lib/utils";
import { createAppMentionExtension } from "@/components/tiptap/mention-extensions";
import { MessageWithMentions } from "@/components/message-with-mentions";
import { DiscussionMention } from "@/type";

interface RichContentViewProps {
  content?: JSONContent | Record<string, unknown> | string | null;
  text?: string;
  mentions?: DiscussionMention[];
  className?: string;
}

export function RichContentView({
  content,
  text,
  mentions,
  className,
}: RichContentViewProps) {
  if (content) {
    return (
      <RichContentReadOnly
        content={content as JSONContent | string}
        className={className}
      />
    );
  }
  if (text) {
    return (
      <p className={cn("text-sm whitespace-pre-wrap", className)}>
        <MessageWithMentions text={text} mentions={mentions} />
      </p>
    );
  }
  return null;
}

function RichContentReadOnly({
  content,
  className,
}: {
  content: JSONContent | string;
  className?: string;
}) {
  const editor = useEditor({
    immediatelyRender: false,
    editable: false,
    extensions: [
      StarterKit.configure({ heading: false }),
      // Suggestion tidak relevan buat read-only, tapi node mention-nya tetap
      // harus terdaftar biar JSON yang mengandung node mention bisa di-parse.
      createAppMentionExtension(() => {}, { readOnly: true }),
    ],
    content,
    editorProps: {
      attributes: {
        class: cn(
          "text-sm [&_p]:leading-relaxed [&_ul]:list-disc [&_ul]:pl-5 [&_ol]:list-decimal [&_ol]:pl-5",
          "[&_.mention]:rounded [&_.mention]:px-1 [&_.mention]:py-0.5 [&_.mention]:font-medium [&_.mention]:text-sm",
          "[&_a.mention]:hover:underline [&_a.mention]:cursor-pointer",
          "[&_.mention-user]:bg-primary/10 [&_.mention-user]:text-primary",
          "[&_.mention-barang]:bg-amber-500/10 [&_.mention-barang]:text-amber-600 dark:[&_.mention-barang]:text-amber-400",
          "[&_.mention-vendor]:bg-emerald-500/10 [&_.mention-vendor]:text-emerald-600 dark:[&_.mention-vendor]:text-emerald-400",
          "[&_.mention-document]:bg-sky-500/10 [&_.mention-document]:text-sky-600 dark:[&_.mention-document]:text-sky-400",
        ),
      },
    },
  });

  if (!editor) return null;

  return <EditorContent editor={editor} className={className} />;
}
