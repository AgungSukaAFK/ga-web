import { ReactRenderer } from "@tiptap/react";
import tippy, { Instance as TippyInstance } from "tippy.js";
import MentionList, { MentionListRef } from "./MentionList";
import { createClient } from "@/lib/supabase/client";

/**
 * Fetch user list from Supabase based on query
 */
const fetchUsers = async (query: string) => {
  const supabase = createClient();

  const { data, error } = await supabase
    .from("profiles")
    .select("id, name, avatar_url")
    .ilike("name", `%${query}%`)
    .limit(5);

  if (error) {
    console.error("Error fetching users:", error);
    return [];
  }

  return data ?? [];
};

/**
 * Mention suggestion configuration for Tiptap
 */
const mentionSuggestion = {
  items: async ({ query }: { query: string }) => {
    return await fetchUsers(query);
  },

  render: () => {
    let component: ReactRenderer<MentionListRef> | null = null;
    let popup: TippyInstance[] | null = null;

    return {
      onStart: (props: any) => {
        component = new ReactRenderer(MentionList, {
          props,
          editor: props.editor,
        });

        if (!props.clientRect) {
          return;
        }

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
        component?.updateProps(props);

        if (!props.clientRect) {
          return;
        }

        popup?.[0].setProps({
          getReferenceClientRect: props.clientRect,
        });
      },

      onKeyDown(props: any) {
        if (props.event.key === "Escape") {
          popup?.[0].hide();
          return true;
        }

        return component?.ref?.onKeyDown(props) ?? false;
      },

      onExit() {
        popup?.[0].destroy();
        component?.destroy();
      },
    };
  },
};

export default mentionSuggestion;
