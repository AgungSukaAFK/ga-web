"use client";

// Dialog ganti foto profil - ImageCropDialog (components/image-crop-dialog.tsx)
// dgn rasio 1:1, panduan lingkaran, & kamera. Hasil 512x512 WebP (umumnya
// < 100KB), bukan foto mentah yang bisa sampai 10MB.

import { CROP_MAX_FILE_BYTES, ImageCropDialog } from "./image-crop-dialog";

export const AVATAR_MAX_FILE_BYTES = CROP_MAX_FILE_BYTES;

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSave: (blob: Blob) => Promise<void>;
};

export function ProfileAvatarDialog({ open, onOpenChange, onSave }: Props) {
  return (
    <ImageCropDialog
      open={open}
      onOpenChange={onOpenChange}
      onSave={onSave}
      aspect={1}
      outputWidth={512}
      guide="circle"
      allowCamera
      title="Ganti Foto Profil"
      editTitle="Sesuaikan Foto"
      pickDescription="Pilih gambar maksimal 10 MB. Hasil akhir berbentuk persegi 1:1."
      cameraDescription="Posisikan wajah di tengah lalu ambil foto."
      saveLabel="Simpan Foto"
      errorTitle="Gagal menyimpan foto profil"
    />
  );
}
