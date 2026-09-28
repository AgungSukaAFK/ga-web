// src/components/tiptap/update-video-extension.tsx
//
// Custom Tiptap node "video" buat body postingan Update Web - dua varian
// (dibedakan attr `sourceType`, bukan 2 node terpisah, sama pola dgn mention
// yang dibedakan lewat `mentionType`, lihat components/tiptap/mention-extensions.tsx):
//   - "upload": file video yang diupload sendiri (lihat uploadAttachmentDirect
//     di lib/uploadDirect.ts) - diputar native lewat <video controls>.
//   - "embed": link video eksternal (YouTube/Vimeo/dll) - dinormalisasi ke URL
//     embed lalu dibungkus <iframe>. URL yang tidak dikenali polanya tetap
//     dipakai apa adanya (fallback), supaya link video-hosting lain selain
//     YouTube/Vimeo tetap bisa coba di-embed.

import { mergeAttributes, Node } from "@tiptap/core";

export interface VideoAttrs {
  src: string;
  sourceType: "upload" | "embed";
}

declare module "@tiptap/core" {
  interface Commands<ReturnType> {
    updateVideo: {
      setVideo: (attrs: VideoAttrs) => ReturnType;
    };
  }
}

export function normalizeVideoEmbedUrl(rawUrl: string): string {
  try {
    const url = new URL(rawUrl);
    const host = url.hostname.replace(/^www\./, "");

    if (host === "youtube.com" || host === "m.youtube.com") {
      if (url.pathname === "/watch") {
        const id = url.searchParams.get("v");
        if (id) return `https://www.youtube.com/embed/${id}`;
      }
      if (url.pathname.startsWith("/shorts/")) {
        const id = url.pathname.split("/")[2];
        if (id) return `https://www.youtube.com/embed/${id}`;
      }
      if (url.pathname.startsWith("/embed/")) return rawUrl;
    }

    if (host === "youtu.be") {
      const id = url.pathname.slice(1);
      if (id) return `https://www.youtube.com/embed/${id}`;
    }

    if (host === "vimeo.com") {
      const id = url.pathname.split("/").filter(Boolean)[0];
      if (id && /^\d+$/.test(id)) return `https://player.vimeo.com/video/${id}`;
    }

    return rawUrl;
  } catch {
    return rawUrl;
  }
}

export const UpdateVideo = Node.create({
  name: "video",
  group: "block",
  atom: true,
  draggable: true,

  addAttributes() {
    return {
      src: { default: null },
      sourceType: { default: "embed" },
    };
  },

  parseHTML() {
    return [
      {
        tag: "div[data-update-video]",
        getAttrs: (dom) => {
          if (typeof dom === "string") return false;
          return {
            src: dom.getAttribute("data-src"),
            sourceType: dom.getAttribute("data-source-type") || "embed",
          };
        },
      },
    ];
  },

  renderHTML({ HTMLAttributes, node }) {
    const src: string = node.attrs.src ?? "";
    const sourceType: string = node.attrs.sourceType ?? "embed";
    const wrapperAttrs = mergeAttributes(HTMLAttributes, {
      "data-update-video": "",
      "data-src": src,
      "data-source-type": sourceType,
      class:
        sourceType === "upload"
          ? "update-video-wrapper"
          : "update-video-wrapper aspect-video",
    });

    if (sourceType === "upload") {
      return [
        "div",
        wrapperAttrs,
        ["video", { src, controls: "true", class: "w-full rounded-md" }],
      ];
    }

    return [
      "div",
      wrapperAttrs,
      [
        "iframe",
        {
          src: normalizeVideoEmbedUrl(src),
          class: "w-full h-full rounded-md",
          allowfullscreen: "true",
          frameborder: "0",
        },
      ],
    ];
  },

  addCommands() {
    return {
      setVideo:
        (attrs: VideoAttrs) =>
        ({ commands }: any) =>
          commands.insertContent({ type: this.name, attrs }),
    };
  },
});
