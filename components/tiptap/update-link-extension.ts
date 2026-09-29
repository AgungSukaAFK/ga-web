// src/components/tiptap/update-link-extension.ts
//
// Link extension khusus editor Update Web - Link bawaan Tiptap + sintaks ala
// markdown `[teks](url)`, baik diketik (input rule, kepicu saat nutup ")")
// maupun di-paste (paste rule). Hasilnya teks "teks" yang dibungkus mark
// link ke url, bukan teks mentah markdown-nya.

import { InputRule, PasteRule } from "@tiptap/core";
import TiptapLink from "@tiptap/extension-link";

const MD_LINK_INPUT = /\[([^[\]]+)\]\((\S+?)\)$/;
const MD_LINK_PASTE = /\[([^[\]]+)\]\((https?:\/\/[^\s)]+)\)/g;

// Tambah https:// kalau user cuma nulis domain ("google.com").
export function normalizeHref(raw: string): string {
  const url = raw.trim();
  if (!url) return url;
  if (/^[a-z][a-z0-9+.-]*:/i.test(url)) return url;
  if (url.startsWith("/") || url.startsWith("#")) return url;
  return `https://${url}`;
}

// URL "tunggal" (tanpa spasi) - dipakai buat deteksi paste link polos.
export function looksLikeUrl(text: string): boolean {
  const t = text.trim();
  if (!t || /\s/.test(t)) return false;
  return /^https?:\/\/[^\s]+\.[^\s]+/i.test(t) || /^www\.[^\s]+\.[^\s]+/i.test(t);
}

export const UpdateLink = TiptapLink.extend({
  addInputRules() {
    return [
      new InputRule({
        find: MD_LINK_INPUT,
        handler: ({ state, range, match }) => {
          const [, text, href] = match;
          if (!text || !href) return null;
          const { tr, schema } = state;
          tr.replaceWith(
            range.from,
            range.to,
            schema.text(text, [
              schema.marks.link.create({ href: normalizeHref(href) }),
            ]),
          );
          tr.removeStoredMark(schema.marks.link);
        },
      }),
    ];
  },

  addPasteRules() {
    return [
      new PasteRule({
        find: MD_LINK_PASTE,
        handler: ({ state, range, match }) => {
          const [, text, href] = match;
          if (!text || !href) return null;
          const { tr, schema } = state;
          tr.replaceWith(
            range.from,
            range.to,
            schema.text(text, [schema.marks.link.create({ href })]),
          );
        },
      }),
      ...(this.parent?.() ?? []),
    ];
  },
});
