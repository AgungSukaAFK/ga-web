// src/lib/rich-content.ts
//
// Helper buat field catatan/remarks tunggal (kolom text biasa, bukan array
// Discussion) yang dipindah ke RichMentionEditor. Rich content (Tiptap JSON)
// disimpan sebagai string JSON di kolom yang sama - tanpa migrasi kolom.
// Kalau isi kolom masih plain text lama (sebelum field ini pakai rich
// editor), `parseRichValue` mengembalikannya apa adanya - Tiptap otomatis
// terima string biasa sebagai initial content (di-treat sebagai 1 paragraf).

import { JSONContent } from "@tiptap/react";

export function parseRichValue(
  raw: string | null | undefined,
): JSONContent | string {
  if (!raw) return "";
  try {
    const parsed = JSON.parse(raw);
    if (parsed && typeof parsed === "object" && parsed.type === "doc") {
      return parsed as JSONContent;
    }
  } catch {
    // bukan JSON - berarti plain text lama, biarkan apa adanya.
  }
  return raw;
}

export function stringifyRichContent(json: JSONContent): string {
  return JSON.stringify(json);
}

// Ekstrak plain text dari rich value - buat konteks yang butuh string biasa
// (preview line-clamp, export Excel/CSV, dst), bukan render rich HTML penuh.
// Jauh lebih ringan daripada RichContentView karena tidak bikin instance
// Tiptap editor, cukup jalan-jalan di JSON-nya langsung.
export function extractPlainText(raw: string | null | undefined): string {
  if (!raw) return "";
  try {
    const parsed = JSON.parse(raw);
    if (parsed && typeof parsed === "object" && parsed.type === "doc") {
      const parts: string[] = [];
      const walk = (node: any) => {
        if (!node || typeof node !== "object") return;
        if (node.type === "text") {
          parts.push(node.text ?? "");
          return;
        }
        if (node.type === "mention") {
          parts.push(node.attrs?.label ?? "");
          return;
        }
        if (Array.isArray(node.content)) {
          node.content.forEach(walk);
        }
        if (node.type === "paragraph" || node.type === "heading") {
          parts.push("\n");
        }
      };
      walk(parsed);
      return parts.join("").trim();
    }
  } catch {
    // bukan JSON - berarti plain text lama.
  }
  return raw;
}
