import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";

interface MyAlertDialogProps {
  // Ubah nama interface agar tidak bentrok dengan nama komponen
  title?: string;
  description?: string;
  actionText?: string;
  cancelText?: string;
  onAction?: () => void;
  onCancel?: () => void;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function MyAlertDialog({
  title = "Apakah Anda yakin?", // Default title
  description = "Tindakan ini tidak bisa dibatalkan.", // Default description
  actionText = "Ya", // Default action button text
  cancelText = "Tidak", // Default cancel button text
  onAction = () => {}, // Default empty function
  onCancel = () => {}, // Default empty function
  open = false, // Tambahkan prop open untuk mengontrol visibilitas dialog
  onOpenChange, // Callback untuk mengubah status terbuka dialog
}: MyAlertDialogProps) {
  // Gunakan MyAlertDialogProps
  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent>
        <AlertDialogHeader>
          {/* Menggunakan prop `title` untuk judul dialog */}
          <AlertDialogTitle>{title}</AlertDialogTitle>
          {/* Menggunakan prop `description` untuk deskripsi dialog */}
          <AlertDialogDescription>{description}</AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          {/* Menggunakan prop `cancelText` dan mengaitkan `onCancel` */}
          <AlertDialogCancel onClick={onCancel}>{cancelText}</AlertDialogCancel>
          {/* Menggunakan prop `actionText` dan mengaitkan `onAction` */}
          <AlertDialogAction onClick={onAction}>{actionText}</AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
