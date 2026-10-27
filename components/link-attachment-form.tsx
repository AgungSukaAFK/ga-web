"use client";

import { useState } from "react";
import { Link2, Plus } from "lucide-react";
import { toast } from "@/lib/toast";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { normalizeLinkUrl } from "@/lib/attachments";
import { Attachment } from "@/type";

// Form tambah lampiran berupa link (mis. Google Drive) untuk file yang terlalu
// besar diunggah. Hasilnya Attachment biasa dengan is_link: true.
export function LinkAttachmentForm({
  existingAttachments = [],
  onAdd,
  disabled,
}: {
  existingAttachments?: Attachment[];
  onAdd: (attachment: Attachment) => void;
  disabled?: boolean;
}) {
  const [name, setName] = useState("");
  const [url, setUrl] = useState("");

  const handleAdd = () => {
    const trimmedName = name.trim();
    const normalizedUrl = normalizeLinkUrl(url);
    if (!trimmedName) {
      toast.warning("Nama file wajib diisi.");
      return;
    }
    if (!normalizedUrl) {
      toast.warning("Link tidak valid. Contoh: https://drive.google.com/...");
      return;
    }
    if (existingAttachments.some((att) => att.url === normalizedUrl)) {
      toast.warning("Link ini sudah ditambahkan.");
      return;
    }
    onAdd({ url: normalizedUrl, name: trimmedName, is_link: true });
    setName("");
    setUrl("");
    toast.success("Link lampiran ditambahkan.");
  };

  return (
    <div className="flex flex-col gap-2">
      <p className="text-xs text-muted-foreground">
        Untuk file yang terlalu besar, unggah ke Google Drive lalu tempel
        link-nya di sini. Pastikan akses link sudah dibuka (Anyone with the
        link).
      </p>
      <Input
        placeholder="Nama file, mis. Foto kerusakan unit"
        value={name}
        onChange={(e) => setName(e.target.value)}
        disabled={disabled}
      />
      <Input
        type="url"
        placeholder="https://drive.google.com/..."
        value={url}
        onChange={(e) => setUrl(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === "Enter") {
            e.preventDefault();
            handleAdd();
          }
        }}
        disabled={disabled}
      />
      <Button
        type="button"
        variant="outline"
        onClick={handleAdd}
        disabled={disabled || !name.trim() || !url.trim()}
      >
        <Plus className="h-4 w-4" />
        <Link2 className="h-4 w-4" />
        Tambah Link
      </Button>
    </div>
  );
}
