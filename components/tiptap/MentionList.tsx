import React, {
  forwardRef,
  useEffect,
  useImperativeHandle,
  useState,
} from "react";
import { MentionListItem } from "@/services/mentionSearchService";

// Definisi tipe method yang bisa dipanggil dari parent (create-mention-suggestion.tsx)
export interface MentionListRef {
  onKeyDown: (props: { event: KeyboardEvent }) => boolean;
}

interface MentionListProps {
  items: MentionListItem[];
  command: (item: MentionListItem) => void;
  emptyLabel: string;
}

const MentionList = forwardRef<MentionListRef, MentionListProps>(
  (props, ref) => {
    const [selectedIndex, setSelectedIndex] = useState(0);

    const selectItem = (index: number) => {
      const item = props.items[index];
      if (item) {
        props.command(item);
      }
    };

    const upHandler = () => {
      setSelectedIndex(
        (selectedIndex + props.items.length - 1) % props.items.length,
      );
    };

    const downHandler = () => {
      setSelectedIndex((selectedIndex + 1) % props.items.length);
    };

    const enterHandler = () => {
      selectItem(selectedIndex);
    };

    useEffect(() => {
      setSelectedIndex(0);
    }, [props.items]);

    useImperativeHandle(ref, () => ({
      onKeyDown: ({ event }: { event: KeyboardEvent }) => {
        if (event.key === "ArrowUp") {
          upHandler();
          return true;
        }
        if (event.key === "ArrowDown") {
          downHandler();
          return true;
        }
        if (event.key === "Enter" || event.key === "Tab") {
          enterHandler();
          return true;
        }
        return false;
      },
    }));

    return (
      <div className="bg-popover text-popover-foreground border rounded-md shadow-md overflow-hidden p-1 min-w-[220px] max-h-64 overflow-y-auto z-50">
        {props.items.length ? (
          props.items.map((item, index) => (
            <button
              key={item.id}
              type="button"
              onMouseDown={(e) => e.preventDefault()}
              className={`w-full text-left px-3 py-2 text-sm rounded-sm flex flex-col gap-0.5 ${
                index === selectedIndex
                  ? "bg-accent text-accent-foreground"
                  : ""
              }`}
              onClick={() => selectItem(index)}
            >
              <span className="font-medium truncate">{item.label}</span>
              {item.sublabel && (
                <span className="text-xs text-muted-foreground truncate">
                  {item.sublabel}
                </span>
              )}
            </button>
          ))
        ) : (
          <div className="px-3 py-2 text-sm text-muted-foreground">
            {props.emptyLabel}
          </div>
        )}
      </div>
    );
  },
);

MentionList.displayName = "MentionList";

export default MentionList;
