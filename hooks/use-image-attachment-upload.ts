"use client";

import { useState } from "react";
import { toast } from "sonner";
import { uploadAttachmentDirect } from "@/lib/uploadDirect";
import { getAttachmentSizeError, getUploadErrorMessage } from "@/lib/attachments";
import { DiscussionAttachment } from "@/type";

// Dipakai bareng oleh tombol upload, drag & drop, dan paste dari clipboard -
// biar state "uploading" (spinner) dan validasi ukuran/error-nya satu sumber,
// ga kedobelan di tiap entry point.
export function useImageAttachmentUpload(pathPrefix: string) {
  const [uploading, setUploading] = useState(false);

  const uploadFile = async (file: File): Promise<DiscussionAttachment | null> => {
    if (!file.type.startsWith("image/")) {
      toast.error("File bukan gambar", {
        description: "Hanya file gambar yang didukung di lampiran diskusi.",
      });
      return null;
    }

    const sizeError = getAttachmentSizeError(file);
    if (sizeError) {
      toast.error("Ukuran gambar terlalu besar", { description: sizeError });
      return null;
    }

    setUploading(true);
    try {
      const filePath = `${pathPrefix}/${Date.now()}_${file.name}`;
      const result = await uploadAttachmentDirect(file, filePath);
      if (!result.success) throw new Error(result.message);
      return { type: "image", url: result.url, name: file.name };
    } catch (error) {
      toast.error("Gagal mengunggah gambar", {
        description: getUploadErrorMessage(error),
      });
      return null;
    } finally {
      setUploading(false);
    }
  };

  return { uploading, uploadFile };
}
