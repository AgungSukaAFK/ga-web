"use client";

// Kamera langsung di halaman (getUserMedia) utk foto barang di halaman scan
// QR - SENGAJA tanpa input file sama sekali, supaya foto gak bisa diambil
// dari galeri/file lama (atribut `capture` di <input type="file"> cuma
// "saran" ke browser, di beberapa HP masih bisa pilih galeri). Hasil jepretan
// langsung dicetak watermark (lihat drawStamp, lib/photoStamp.ts).

import { useEffect, useRef, useState } from "react";
import { drawStamp } from "@/lib/photoStamp";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Camera, Loader2, RefreshCw } from "lucide-react";

export function CameraCaptureDialog({
  open,
  onOpenChange,
  title,
  // Dipanggil SAAT jepret (bukan saat dialog dibuka) supaya waktu di
  // watermark = waktu foto diambil.
  getStampLines,
  onCapture,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  getStampLines: () => string[];
  onCapture: (file: File) => void;
}) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const [status, setStatus] = useState<"starting" | "ready" | "error">(
    "starting",
  );
  const [errorMessage, setErrorMessage] = useState("");
  const [facingMode, setFacingMode] = useState<"environment" | "user">(
    "environment",
  );
  const [capturing, setCapturing] = useState(false);

  useEffect(() => {
    if (!open) return;
    let cancelled = false;

    const start = async () => {
      setStatus("starting");
      if (!navigator.mediaDevices?.getUserMedia) {
        setErrorMessage(
          "Browser ini tidak mendukung akses kamera. Buka halaman ini lewat Chrome/Safari terbaru (harus HTTPS).",
        );
        setStatus("error");
        return;
      }
      try {
        const stream = await navigator.mediaDevices.getUserMedia({
          video: {
            facingMode: { ideal: facingMode },
            width: { ideal: 1920 },
            height: { ideal: 1080 },
          },
          audio: false,
        });
        if (cancelled) {
          stream.getTracks().forEach((t) => t.stop());
          return;
        }
        streamRef.current = stream;
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
          await videoRef.current.play().catch(() => {});
        }
        setStatus("ready");
      } catch (err: any) {
        if (cancelled) return;
        setErrorMessage(
          err?.name === "NotAllowedError"
            ? "Izin kamera ditolak. Izinkan akses kamera di pengaturan browser lalu coba lagi."
            : "Kamera tidak bisa dibuka: " + (err?.message || "unknown error"),
        );
        setStatus("error");
      }
    };
    start();

    return () => {
      cancelled = true;
      streamRef.current?.getTracks().forEach((t) => t.stop());
      streamRef.current = null;
    };
  }, [open, facingMode]);

  const handleCapture = async () => {
    const video = videoRef.current;
    if (!video || !video.videoWidth) return;
    setCapturing(true);
    try {
      const canvas = document.createElement("canvas");
      canvas.width = video.videoWidth;
      canvas.height = video.videoHeight;
      const ctx = canvas.getContext("2d");
      if (!ctx) throw new Error("Canvas tidak tersedia");
      ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
      drawStamp(canvas, getStampLines());

      const blob = await new Promise<Blob | null>((resolve) =>
        canvas.toBlob(resolve, "image/jpeg", 0.85),
      );
      if (!blob) throw new Error("Gagal memproses foto");
      onCapture(
        new File([blob], `foto_${Date.now()}.jpg`, { type: "image/jpeg" }),
      );
      onOpenChange(false);
    } catch (err: any) {
      setErrorMessage(err?.message || "Gagal mengambil foto");
      setStatus("error");
    } finally {
      setCapturing(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg p-4">
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          <DialogDescription>
            Foto diambil langsung dari kamera. Waktu, lokasi, dan device akan
            tercetak otomatis di foto.
          </DialogDescription>
        </DialogHeader>

        <div className="relative aspect-[3/4] sm:aspect-video w-full overflow-hidden rounded-md bg-black">
          <video
            ref={videoRef}
            playsInline
            muted
            className="h-full w-full object-cover"
          />
          {status === "starting" && (
            <div className="absolute inset-0 flex items-center justify-center text-white">
              <Loader2 className="h-6 w-6 animate-spin" />
            </div>
          )}
          {status === "error" && (
            <div className="absolute inset-0 flex items-center justify-center p-6 text-center text-sm text-white">
              {errorMessage}
            </div>
          )}
        </div>

        <div className="flex gap-2">
          <Button
            variant="outline"
            size="icon"
            onClick={() =>
              setFacingMode((m) => (m === "environment" ? "user" : "environment"))
            }
            title="Ganti kamera depan/belakang"
            disabled={capturing}
          >
            <RefreshCw className="h-4 w-4" />
          </Button>
          <Button
            className="flex-1"
            onClick={handleCapture}
            disabled={status !== "ready" || capturing}
          >
            {capturing ? (
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            ) : (
              <Camera className="mr-2 h-4 w-4" />
            )}
            Ambil Foto
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
