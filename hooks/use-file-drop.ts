"use client";

import { useEffect, useRef, useState, type DragEvent } from "react";
import { toast } from "@/lib/toast";

interface UseFileDropOptions {
  onFiles: (files: File[]) => void;
  multiple?: boolean;
  /** Format sama dgn atribut `accept` (".csv", "image/*"). Browser tidak
   * menerapkannya ke file hasil drop, jadi dicek manual di sini. */
  accept?: string;
  disabled?: boolean;
}

const isFileDrag = (dataTransfer: DataTransfer | null) =>
  !!dataTransfer?.types.includes("Files");

function matchesAccept(file: File, accept: string) {
  return accept.split(",").some((raw) => {
    const token = raw.trim().toLowerCase();
    if (token.startsWith(".")) return file.name.toLowerCase().endsWith(token);
    if (token.endsWith("/*")) return file.type.startsWith(token.slice(0, -1));
    return file.type === token;
  });
}

export function useFileDrop({
  onFiles,
  multiple,
  accept,
  disabled,
}: UseFileDropOptions) {
  const [isDragging, setIsDragging] = useState(false);
  // dragenter/dragleave juga jalan tiap pindah ke elemen anak, dan
  // relatedTarget di Safari selalu null - jadi kedalamannya dihitung manual.
  const depth = useRef(0);

  // File yang di-drop meleset dari area ini bakal dibuka browser di tab yang
  // sama dan isi form hilang. Area drop lain (editor, diskusi) sudah
  // preventDefault duluan, jadi tidak ikut terblokir.
  useEffect(() => {
    const blockMissedDrop = (e: globalThis.DragEvent) => {
      if (e.defaultPrevented || !isFileDrag(e.dataTransfer)) return;
      e.preventDefault();
      if (e.dataTransfer) e.dataTransfer.dropEffect = "none";
    };
    window.addEventListener("dragover", blockMissedDrop);
    window.addEventListener("drop", blockMissedDrop);
    return () => {
      window.removeEventListener("dragover", blockMissedDrop);
      window.removeEventListener("drop", blockMissedDrop);
    };
  }, []);

  const handleDrop = (e: DragEvent) => {
    if (!isFileDrag(e.dataTransfer)) return;
    e.preventDefault();
    depth.current = 0;
    setIsDragging(false);
    if (disabled) return;

    const items = Array.from(e.dataTransfer.items).filter(
      (item) => item.kind === "file",
    );
    const dropped = items
      .filter((item) => !item.webkitGetAsEntry()?.isDirectory)
      .map((item) => item.getAsFile())
      .filter((file): file is File => !!file);

    if (dropped.length < items.length) {
      toast.error("Folder tidak bisa diunggah", {
        description: "Pilih file-nya satu per satu.",
      });
    }

    const accepted = accept
      ? dropped.filter((file) => matchesAccept(file, accept))
      : dropped;
    if (accepted.length < dropped.length) {
      toast.error("Format file tidak didukung", {
        description: `Format yang diterima: ${accept}`,
      });
    }
    if (accepted.length === 0) return;

    if (!multiple && accepted.length > 1) {
      toast.warning("Di sini hanya bisa satu file", {
        description: `Yang dipakai: ${accepted[0].name}`,
      });
    }
    onFiles(multiple ? accepted : accepted.slice(0, 1));
  };

  return {
    isDragging: isDragging && !disabled,
    dropProps: {
      onDragEnter: (e: DragEvent) => {
        if (disabled || !isFileDrag(e.dataTransfer)) return;
        e.preventDefault();
        depth.current += 1;
        setIsDragging(true);
      },
      onDragOver: (e: DragEvent) => {
        if (disabled || !isFileDrag(e.dataTransfer)) return;
        e.preventDefault();
        e.dataTransfer.dropEffect = "copy";
      },
      onDragLeave: () => {
        if (depth.current === 0) return;
        depth.current -= 1;
        if (depth.current === 0) setIsDragging(false);
      },
      onDrop: handleDrop,
    },
  };
}
