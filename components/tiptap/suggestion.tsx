import { ReactRenderer } from "@tiptap/react";
import tippy, { Instance as TippyInstance } from "tippy.js";
import MentionList, { MentionListRef } from "./MentionList";
import { MentionListItem } from "@/services/mentionSearchService";

/**
 * Factory suggestion Tiptap generik - dipakai buat ke-4 jenis mention
 * (user/barang/vendor/dokumen), bedanya cuma di `emptyLabel` & fungsi fetch
 * item-nya (dikonfigurasi terpisah lewat `items` di tiap entry `suggestions`
 * pada mention-extensions.tsx). `onOpenChange` dipanggil true/false pas
 * popup muncul/hilang - dipakai rich-mention-editor.tsx supaya tombol Enter
 * tahu harus pilih item suggestion, bukan kirim pesan, selama popup terbuka.
 */
export function createMentionSuggestion(
  emptyLabel: string,
  onOpenChange?: (open: boolean) => void,
) {
  return () => {
    let component: ReactRenderer<MentionListRef> | null = null;
    let popup: TippyInstance[] | null = null;

    return {
      onStart: (props: any) => {
        onOpenChange?.(true);
        component = new ReactRenderer(MentionList, {
          props: { ...props, emptyLabel },
          editor: props.editor,
        });

        if (!props.clientRect) return;

        popup = tippy("body", {
          getReferenceClientRect: props.clientRect,
          appendTo: () => document.body,
          content: component.element,
          showOnCreate: true,
          interactive: true,
          trigger: "manual",
          placement: "bottom-start",
        });
      },

      onUpdate(props: any) {
        component?.updateProps({ ...props, emptyLabel });
        if (!props.clientRect) return;
        popup?.[0].setProps({ getReferenceClientRect: props.clientRect });
      },

      onKeyDown(props: any) {
        if (props.event.key === "Escape") {
          popup?.[0].hide();
          onOpenChange?.(false);
          return true;
        }
        return component?.ref?.onKeyDown(props) ?? false;
      },

      onExit() {
        onOpenChange?.(false);
        popup?.[0].destroy();
        component?.destroy();
      },
    };
  };
}

export type { MentionListItem };
