// src/components/tiptap/mention-extensions.tsx
//
// Satu node Mention Tiptap yang dipakai untuk 4 jenis tag sekaligus (lihat
// MentionOptions.suggestions - Tiptap v3 mendukung banyak trigger char dalam
// 1 extension). Beda jenis dibedakan lewat custom attr `mentionType`, bukan
// 4 node terpisah, supaya cukup 1 skema buat parsing/render di manapun.

import Mention from "@tiptap/extension-mention";
import { PluginKey } from "@tiptap/pm/state";
import { createMentionSuggestion } from "./suggestion";
import {
  searchUserMentions,
  searchBarangMentions,
  searchVendorMentions,
  searchDocumentMentions,
  MentionListItem,
} from "@/services/mentionSearchService";
import { DiscussionMention, MentionType } from "@/type";

export const MENTION_LEGEND: {
  type: MentionType;
  char: string;
  label: string;
}[] = [
  { type: "user", char: "@", label: "Orang" },
  { type: "barang", char: "#", label: "Barang" },
  { type: "vendor", char: "$", label: "Vendor" },
  { type: "document", char: "/", label: "Dokumen" },
];

function charFor(type: MentionType): string {
  return MENTION_LEGEND.find((m) => m.type === type)?.char ?? "@";
}

// Dipanggil dari onStart/onExit tiap suggestion (lewat createMentionSuggestion)
// supaya rich-mention-editor.tsx tahu ada popup mention yang lagi kebuka -
// dipakai buat memutuskan tombol Enter kirim pesan atau pilih item suggestion.
export function createAppMentionExtension(
  onSuggestionOpenChange: (open: boolean) => void,
  options: { readOnly?: boolean } = {},
) {
  const makeSuggestion = (
    type: MentionType,
    fetchFn: (query: string) => Promise<MentionListItem[]>,
    emptyLabel: string,
  ) => ({
    char: charFor(type),
    pluginKey: new PluginKey(`${type}MentionSuggestion`),
    items: ({ query }: { query: string }) => fetchFn(query),
    command: ({ editor, range, props }: any) => {
      const item = props as MentionListItem;
      // Kalau sudah ada spasi tepat setelah posisi ini, jangan tambah spasi
      // dobel (pola sama seperti default command bawaan Mention extension).
      const nodeAfter = editor.view.state.selection.$to.nodeAfter;
      const overrideSpace = nodeAfter?.text?.startsWith(" ");
      if (overrideSpace) range.to += 1;

      editor
        .chain()
        .focus()
        .insertContentAt(range, [
          {
            type: "mention",
            attrs: {
              id: item.id,
              label: item.label,
              mentionType: type,
              sublabel: item.sublabel ?? null,
              href: item.href ?? null,
            },
          },
          { type: "text", text: " " },
        ])
        .run();

      editor.view.dom.ownerDocument.defaultView?.getSelection()?.collapseToEnd();
    },
    render: createMentionSuggestion(emptyLabel, onSuggestionOpenChange),
  });

  return Mention.extend({
    addAttributes() {
      return {
        ...this.parent?.(),
        mentionType: { default: "user" },
        sublabel: { default: null },
        href: { default: null },
      };
    },
  }).configure({
    renderHTML({ node }) {
      const type: MentionType = node.attrs.mentionType || "user";
      const text = `${charFor(type)}${node.attrs.label ?? node.attrs.id}`;
      // Chip cuma jadi link beneran di read-only view (RichContentView) -
      // di editor yang lagi diketik, <a href> beresiko ke-klik dan
      // navigasi ke luar secara tidak sengaja.
      if (options.readOnly && node.attrs.href) {
        return [
          "a",
          {
            href: node.attrs.href,
            class: `mention mention-${type}`,
            "data-mention-type": type,
            "data-id": node.attrs.id,
          },
          text,
        ];
      }
      return [
        "span",
        {
          class: `mention mention-${type}`,
          "data-mention-type": type,
          "data-id": node.attrs.id,
        },
        text,
      ];
    },
    renderText({ node }) {
      const type: MentionType = node.attrs.mentionType || "user";
      return `${charFor(type)}${node.attrs.label ?? node.attrs.id}`;
    },
    suggestions: [
      makeSuggestion("user", searchUserMentions, "User tidak ditemukan"),
      makeSuggestion("barang", searchBarangMentions, "Barang tidak ditemukan"),
      makeSuggestion("vendor", searchVendorMentions, "Vendor tidak ditemukan"),
      makeSuggestion(
        "document",
        searchDocumentMentions,
        "Dokumen tidak ditemukan",
      ),
    ],
  });
}

// Jalan-jalan di Tiptap JSON doc, kumpulkan semua node mention jadi
// DiscussionMention[] (dedup by id+type). Dipakai saat submit diskusi/catatan
// buat nyimpen `mentions` & nentuin siapa yang dinotif (cuma type "user").
export function extractMentions(
  doc: Record<string, unknown> | null | undefined,
): DiscussionMention[] {
  if (!doc) return [];
  const result: DiscussionMention[] = [];
  const seen = new Set<string>();

  const walk = (node: any) => {
    if (!node || typeof node !== "object") return;
    if (node.type === "mention" && node.attrs?.id) {
      const type: MentionType = node.attrs.mentionType || "user";
      const key = `${type}:${node.attrs.id}`;
      if (!seen.has(key)) {
        seen.add(key);
        result.push({
          id: String(node.attrs.id),
          nama: node.attrs.label ?? String(node.attrs.id),
          type,
          meta: {
            kode: node.attrs.sublabel ?? undefined,
            href: node.attrs.href ?? undefined,
          },
        });
      }
    }
    if (Array.isArray(node.content)) {
      node.content.forEach(walk);
    }
  };

  walk(doc);
  return result;
}
