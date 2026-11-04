"use client";

import { Loader2, UploadCloud } from "lucide-react";
import { useFileDrop } from "@/hooks/use-file-drop";
import { cn } from "@/lib/utils";

interface FileDropzoneProps {
  onFiles: (files: File[]) => void;
  id?: string;
  multiple?: boolean;
  accept?: string;
  disabled?: boolean;
  /** Sedang mengunggah: kotak terkunci dan menampilkan spinner. */
  loading?: boolean;
  title?: string;
  hint?: string;
  /** Untuk file yang baru diunggah saat form disubmit, supaya tetap kelihatan
   * apa yang sudah dipilih. */
  selectedFiles?: File[] | null;
  className?: string;
}

export function FileDropzone({
  onFiles,
  id,
  multiple,
  accept,
  disabled,
  loading,
  title = "Seret & lepas file, atau klik untuk memilih",
  hint,
  selectedFiles,
  className,
}: FileDropzoneProps) {
  const locked = disabled || loading;
  const { isDragging, dropProps } = useFileDrop({
    onFiles,
    multiple,
    accept,
    disabled: locked,
  });
  const selectedNames = selectedFiles?.map((file) => file.name).join(", ");

  return (
    <label
      {...dropProps}
      className={cn(
        "relative flex items-center gap-3 rounded-lg border-2 border-dashed px-4 py-3 transition-colors has-[:focus-visible]:ring-2 has-[:focus-visible]:ring-ring",
        locked ? "cursor-not-allowed opacity-60" : "cursor-pointer",
        isDragging
          ? "border-primary bg-primary/5"
          : "border-muted-foreground/25",
        !locked && !isDragging && "hover:border-primary/50 hover:bg-muted/40",
        className,
      )}
    >
      <input
        id={id}
        type="file"
        multiple={multiple}
        accept={accept}
        disabled={locked}
        className="sr-only"
        onChange={(e) => {
          const files = Array.from(e.target.files ?? []);
          // Reset supaya file yang sama bisa dipilih lagi.
          e.target.value = "";
          if (files.length > 0) onFiles(files);
        }}
      />
      {loading ? (
        <Loader2 className="h-5 w-5 shrink-0 animate-spin text-primary" />
      ) : (
        <UploadCloud className="h-5 w-5 shrink-0 text-primary" />
      )}
      <div className="min-w-0 text-sm">
        <p className="font-medium">
          {loading
            ? "Mengunggah..."
            : isDragging
              ? "Lepaskan file di sini"
              : title}
        </p>
        {selectedNames ? (
          <p className="truncate text-xs text-primary" title={selectedNames}>
            {selectedNames}
          </p>
        ) : (
          hint && <p className="text-xs text-muted-foreground">{hint}</p>
        )}
      </div>
    </label>
  );
}
