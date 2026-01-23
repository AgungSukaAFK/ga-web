import Image from "next/image";
import React, {
  forwardRef,
  useEffect,
  useImperativeHandle,
  useState,
} from "react";

// Definisi tipe method yang bisa dipanggil dari parent (suggestion.ts)
export interface MentionListRef {
  onKeyDown: (props: { event: KeyboardEvent }) => boolean;
}

interface MentionListProps {
  items: any[];
  command: (props: any) => void;
}

const MentionList = forwardRef<MentionListRef, MentionListProps>(
  (props, ref) => {
    const [selectedIndex, setSelectedIndex] = useState(0);

    const selectItem = (index: number) => {
      const item = props.items[index];
      if (item) {
        props.command({ id: item.id, label: item.name });
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
        if (event.key === "Enter") {
          enterHandler();
          return true;
        }
        return false;
      },
    }));

    return (
      <div className="bg-popover text-popover-foreground border rounded-md shadow-md overflow-hidden p-1 min-w-[200px] z-50">
        {props.items.length ? (
          props.items.map((item: any, index: number) => (
            <button
              key={index}
              type="button"
              className={`w-full text-left px-3 py-2 text-sm rounded-sm flex items-center gap-2 ${
                index === selectedIndex
                  ? "bg-accent text-accent-foreground"
                  : ""
              }`}
              onClick={() => selectItem(index)}
            >
              <div className="w-6 h-6 rounded-full bg-muted flex items-center justify-center text-xs font-bold border">
                {item.avatar_url ? (
                  <Image
                    src={item.avatar_url}
                    alt={item.name}
                    width={24}
                    height={24}
                    className="rounded-full object-cover"
                  />
                ) : (
                  item.name.charAt(0).toUpperCase()
                )}
              </div>
              <span>{item.name}</span>
            </button>
          ))
        ) : (
          <div className="px-3 py-2 text-sm text-muted-foreground">
            User tidak ditemukan
          </div>
        )}
      </div>
    );
  },
);

// 🔑 WAJIB untuk menghilangkan react/display-name
MentionList.displayName = "MentionList";

export default MentionList;
