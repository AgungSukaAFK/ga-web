import { toast as sonnerToast, type ExternalToast } from "sonner";
import { ToastCopyButton } from "@/components/ui/toast-copy-button";

// Pengganti `toast` dari sonner - API sama persis, bedanya toast
// success/error/info/warning/message otomatis dapat tombol Salin (lihat
// components/ui/toast-copy-button.tsx). Tombol tutup (X) diaktifkan global
// lewat <Toaster closeButton> di app/layout.tsx. Import toast dari SINI,
// bukan langsung dari "sonner", supaya toast baru ikut dapat tombol Salin.
//
// toast.loading sengaja tidak - pesannya sementara & nanti diganti
// success/error lewat `id` yang sama (yang memang dapat tombol Salin). Toast
// yang sudah mengisi slot `cancel` sendiri dibiarkan apa adanya.

type ToastFn = typeof sonnerToast.success;

const withCopy = (data?: ExternalToast): ExternalToast =>
  data?.cancel ? data : { ...data, cancel: <ToastCopyButton /> };

const wrap =
  (fn: ToastFn): ToastFn =>
  (message, data) =>
    fn(message, withCopy(data));

export const toast: typeof sonnerToast = Object.assign(
  wrap(sonnerToast),
  sonnerToast,
  {
    success: wrap(sonnerToast.success),
    error: wrap(sonnerToast.error),
    info: wrap(sonnerToast.info),
    warning: wrap(sonnerToast.warning),
    message: wrap(sonnerToast.message),
  },
);
