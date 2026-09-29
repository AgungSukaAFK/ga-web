"use client";

// Dialog crop gambar generik: pilih sumber (browse / drag-drop / paste
// clipboard / kamera opsional) -> editor crop dgn rasio tetap (geser, zoom,
// putar) -> hasil di-render ke canvas WebP di browser. Jadi yang di-upload
// cuma file kecil, bukan foto mentah yang bisa sampai 10MB.
// Sengaja tanpa library cropper supaya bundle tetap ringan.
//
// Dipakai oleh:
//   - components/profile-avatar-dialog.tsx (1:1, 512x512, panduan lingkaran)
//   - thumbnail Update Web (16:9, 1280x720, dialog lebar di desktop)

import { useCallback, useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import {
  Camera,
  ClipboardPaste,
  ImagePlus,
  Loader2,
  RotateCcw,
  RotateCw,
  Upload,
  ZoomIn,
  ZoomOut,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { cn } from "@/lib/utils";

export const CROP_MAX_FILE_BYTES = 10 * 1024 * 1024;
const MIN_ZOOM = 1;
const MAX_ZOOM = 5;

type Stage = "pick" | "camera" | "edit";
type Point = { x: number; y: number };

export type ImageCropDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  // Dipanggil dgn hasil crop final. Dialog menunggu promise-nya selesai
  // (tombol "Simpan" loading) lalu menutup diri kalau tidak throw.
  onSave: (blob: Blob) => Promise<void>;
  // Rasio lebar/tinggi area crop (1 = persegi, 16/9 = thumbnail).
  aspect?: number;
  // Lebar hasil akhir (px). Tinggi = outputWidth / aspect.
  outputWidth?: number;
  // "circle" = panduan lingkaran (avatar); hasil tetap persegi penuh.
  guide?: "circle" | "rect";
  allowCamera?: boolean;
  // File yang langsung dibuka di editor saat dialog dibuka (mis. hasil
  // drag-drop / paste di luar dialog) - lewati tahap "pick".
  initialFile?: File | null;
  title?: string;
  editTitle?: string;
  pickDescription?: string;
  cameraDescription?: string;
  saveLabel?: string;
  errorTitle?: string;
  contentClassName?: string;
  viewportClassName?: string;
};

function clampNum(v: number, min: number, max: number) {
  return Math.min(max, Math.max(min, v));
}

// Validasi file mentah sebelum dibaca - return pesan error atau null.
function validateFile(file: File): string | null {
  if (!file.type.startsWith("image/")) return "File harus berupa gambar.";
  if (file.size > CROP_MAX_FILE_BYTES)
    return `Ukuran file ${(file.size / 1024 / 1024).toFixed(1)} MB, maksimal 10 MB.`;
  return null;
}

export function ImageCropDialog({
  open,
  onOpenChange,
  onSave,
  aspect = 1,
  outputWidth = 512,
  guide = "rect",
  allowCamera = false,
  initialFile,
  title = "Pilih Gambar",
  editTitle = "Sesuaikan Gambar",
  pickDescription = "Pilih gambar maksimal 10 MB.",
  cameraDescription = "Posisikan objek di tengah lalu ambil foto.",
  saveLabel = "Simpan",
  errorTitle = "Gagal menyimpan gambar",
  contentClassName,
  viewportClassName,
}: ImageCropDialogProps) {
  const outputHeight = Math.round(outputWidth / aspect);

  const [stage, setStage] = useState<Stage>("pick");
  const [isDragging, setIsDragging] = useState(false);
  const [saving, setSaving] = useState(false);

  // --- Gambar sumber ---
  const [src, setSrc] = useState<string | null>(null);
  const [natural, setNatural] = useState<{ w: number; h: number } | null>(null);
  const imgRef = useRef<HTMLImageElement>(null);

  // --- State editor ---
  const [zoom, setZoom] = useState(1);
  const [rotation, setRotation] = useState(0); // kelipatan 90
  const [offset, setOffset] = useState<Point>({ x: 0, y: 0 });
  // Lebar viewport crop (px CSS); tinggi = lebar / aspect.
  const [viewport, setViewport] = useState(0);
  const viewportH = viewport / aspect;
  const viewportRef = useRef<HTMLDivElement>(null);
  const pointers = useRef(new Map<number, Point>());
  const pinch = useRef<{ dist: number; zoom: number } | null>(null);

  // --- Kamera ---
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const [cameraReady, setCameraReady] = useState(false);

  const fileInputRef = useRef<HTMLInputElement>(null);
  const captureInputRef = useRef<HTMLInputElement>(null);

  const stopCamera = useCallback(() => {
    streamRef.current?.getTracks().forEach((t) => t.stop());
    streamRef.current = null;
    setCameraReady(false);
  }, []);

  // Object URL di-revoke tiap ganti gambar / unmount supaya memori foto
  // besar tidak tertahan.
  useEffect(() => {
    return () => {
      if (src) URL.revokeObjectURL(src);
    };
  }, [src]);

  // Reset total saat dialog ditutup.
  useEffect(() => {
    if (!open) {
      stopCamera();
      setStage("pick");
      setSrc(null);
      setNatural(null);
      setSaving(false);
    }
  }, [open, stopCamera]);

  useEffect(() => stopCamera, [stopCamera]);

  const loadFile = useCallback(
    (file: File) => {
      const error = validateFile(file);
      if (error) {
        toast.error(error);
        return;
      }
      stopCamera();
      setNatural(null);
      setZoom(1);
      setRotation(0);
      setOffset({ x: 0, y: 0 });
      setSrc(URL.createObjectURL(file));
      setStage("edit");
    },
    [stopCamera],
  );

  useEffect(() => {
    if (open && initialFile) loadFile(initialFile);
  }, [open, initialFile, loadFile]);

  // Ctrl+V / Cmd+V di mana saja selama dialog terbuka (kecuali saat kamera).
  useEffect(() => {
    if (!open || stage === "camera") return;
    const onPaste = (e: ClipboardEvent) => {
      const file = Array.from(e.clipboardData?.files ?? []).find((f) =>
        f.type.startsWith("image/"),
      );
      if (file) {
        e.preventDefault();
        loadFile(file);
      }
    };
    document.addEventListener("paste", onPaste);
    return () => document.removeEventListener("paste", onPaste);
  }, [open, stage, loadFile]);

  // Tombol "Tempel" - Clipboard API async butuh izin & belum didukung semua
  // browser (mis. Firefox), jadi fallback-nya arahkan ke Ctrl+V.
  const handlePasteButton = async () => {
    const file = await readImageFromClipboard();
    if (file) loadFile(file);
  };

  const startCamera = async () => {
    // getUserMedia hanya ada di konteks aman (https/localhost). Kalau tidak
    // tersedia, pakai input capture bawaan HP.
    if (!navigator.mediaDevices?.getUserMedia) {
      captureInputRef.current?.click();
      return;
    }
    setStage("camera");
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: {
          facingMode: "user",
          width: { ideal: 1280 },
          height: { ideal: 1280 },
        },
        audio: false,
      });
      streamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        await videoRef.current.play();
        setCameraReady(true);
      }
    } catch (err: any) {
      setStage("pick");
      toast.error("Tidak bisa mengakses kamera", {
        description:
          err?.name === "NotAllowedError"
            ? "Izin kamera ditolak. Aktifkan lewat pengaturan browser."
            : "Pastikan perangkat punya kamera dan tidak sedang dipakai aplikasi lain.",
      });
    }
  };

  const capturePhoto = () => {
    const video = videoRef.current;
    if (!video || !video.videoWidth) return;
    const canvas = document.createElement("canvas");
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    const ctx = canvas.getContext("2d")!;
    // Preview kamera depan ditampilkan mirror, hasil foto disamakan dgn yang
    // dilihat user.
    ctx.translate(canvas.width, 0);
    ctx.scale(-1, 1);
    ctx.drawImage(video, 0, 0);
    canvas.toBlob(
      (blob) => {
        if (blob) loadFile(new File([blob], "camera.jpg", { type: blob.type }));
      },
      "image/jpeg",
      0.92,
    );
  };

  // ---------------- Editor ----------------

  // Ukuran viewport crop (px CSS), responsif ke lebar dialog.
  useEffect(() => {
    if (stage !== "edit" || !viewportRef.current) return;
    const el = viewportRef.current;
    const ro = new ResizeObserver(([entry]) =>
      setViewport(entry.contentRect.width),
    );
    ro.observe(el);
    return () => ro.disconnect();
  }, [stage]);

  // Skala dasar = gambar "cover" viewport pada zoom 1 (memperhitungkan
  // rotasi 90/270 yang menukar sisi gambar).
  const baseScaleFor = useCallback(
    (rot: number) => {
      if (!natural || !viewport) return 1;
      const sideways = rot % 180 !== 0;
      const w = sideways ? natural.h : natural.w;
      const h = sideways ? natural.w : natural.h;
      return Math.max(viewport / w, viewportH / h);
    },
    [natural, viewport, viewportH],
  );
  const scale = baseScaleFor(rotation) * zoom;

  // Batasi geseran supaya gambar selalu menutupi seluruh area crop.
  const clampOffset = useCallback(
    (off: Point, z: number, rot: number): Point => {
      if (!natural || !viewport) return off;
      const s = baseScaleFor(rot) * z;
      const sideways = rot % 180 !== 0;
      const w = (sideways ? natural.h : natural.w) * s;
      const h = (sideways ? natural.w : natural.h) * s;
      const maxX = Math.max(0, (w - viewport) / 2);
      const maxY = Math.max(0, (h - viewportH) / 2);
      return {
        x: clampNum(off.x, -maxX, maxX),
        y: clampNum(off.y, -maxY, maxY),
      };
    },
    [natural, viewport, viewportH, baseScaleFor],
  );

  // Zoom dgn titik fokus (posisi kursor/tengah pinch relatif ke pusat
  // viewport) supaya bagian yang ditunjuk tetap di tempat.
  const zoomTo = useCallback(
    (nextZoom: number, focus: Point = { x: 0, y: 0 }) => {
      const z = clampNum(nextZoom, MIN_ZOOM, MAX_ZOOM);
      const ratio = z / zoom;
      setZoom(z);
      setOffset((off) =>
        clampOffset(
          {
            x: focus.x - (focus.x - off.x) * ratio,
            y: focus.y - (focus.y - off.y) * ratio,
          },
          z,
          rotation,
        ),
      );
    },
    [clampOffset, rotation, zoom],
  );

  const rotate = (delta: number) => {
    const next = (rotation + delta + 360) % 360;
    setRotation(next);
    setOffset((off) => clampOffset(off, zoom, next));
  };

  // Viewport berubah ukuran -> offset lama bisa keluar batas.
  useEffect(() => {
    setOffset((off) => clampOffset(off, zoom, rotation));
  }, [viewport]);

  const relToCenter = (clientX: number, clientY: number): Point => {
    const rect = viewportRef.current!.getBoundingClientRect();
    return {
      x: clientX - rect.left - rect.width / 2,
      y: clientY - rect.top - rect.height / 2,
    };
  };

  const onPointerDown = (e: React.PointerEvent) => {
    e.currentTarget.setPointerCapture(e.pointerId);
    pointers.current.set(e.pointerId, { x: e.clientX, y: e.clientY });
    if (pointers.current.size === 2) {
      const [a, b] = Array.from(pointers.current.values());
      pinch.current = { dist: Math.hypot(a.x - b.x, a.y - b.y), zoom };
    }
  };

  const onPointerMove = (e: React.PointerEvent) => {
    const prev = pointers.current.get(e.pointerId);
    if (!prev) return;
    const curr = { x: e.clientX, y: e.clientY };
    pointers.current.set(e.pointerId, curr);

    if (pointers.current.size === 2 && pinch.current) {
      const [a, b] = Array.from(pointers.current.values());
      const dist = Math.hypot(a.x - b.x, a.y - b.y);
      const mid = relToCenter((a.x + b.x) / 2, (a.y + b.y) / 2);
      zoomTo((pinch.current.zoom * dist) / pinch.current.dist, mid);
    } else if (pointers.current.size === 1) {
      setOffset((off) =>
        clampOffset(
          { x: off.x + curr.x - prev.x, y: off.y + curr.y - prev.y },
          zoom,
          rotation,
        ),
      );
    }
  };

  const onPointerUp = (e: React.PointerEvent) => {
    pointers.current.delete(e.pointerId);
    if (pointers.current.size < 2) pinch.current = null;
  };

  // Wheel harus listener native non-passive supaya bisa preventDefault
  // (kalau tidak, halaman/dialog ikut scroll).
  useEffect(() => {
    const el = viewportRef.current;
    if (stage !== "edit" || !el) return;
    const onWheel = (e: WheelEvent) => {
      e.preventDefault();
      const focus = relToCenter(e.clientX, e.clientY);
      zoomTo(zoom * Math.exp(-e.deltaY * 0.0015), focus);
    };
    el.addEventListener("wheel", onWheel, { passive: false });
    return () => el.removeEventListener("wheel", onWheel);
  }, [stage, zoom, zoomTo]);

  const onKeyDown = (e: React.KeyboardEvent) => {
    const step = e.shiftKey ? 20 : 5;
    const moves: Record<string, Point> = {
      ArrowLeft: { x: step, y: 0 },
      ArrowRight: { x: -step, y: 0 },
      ArrowUp: { x: 0, y: step },
      ArrowDown: { x: 0, y: -step },
    };
    if (moves[e.key]) {
      e.preventDefault();
      setOffset((off) =>
        clampOffset(
          { x: off.x + moves[e.key].x, y: off.y + moves[e.key].y },
          zoom,
          rotation,
        ),
      );
    } else if (e.key === "+" || e.key === "=") {
      zoomTo(zoom + 0.2);
    } else if (e.key === "-") {
      zoomTo(zoom - 0.2);
    }
  };

  const resetEditor = () => {
    setZoom(1);
    setRotation(0);
    setOffset({ x: 0, y: 0 });
  };

  // Render area crop ke canvas outputWidth x outputHeight dgn transform yang
  // sama persis seperti preview CSS (translate -> rotate -> scale).
  const renderCrop = (): Promise<Blob> =>
    new Promise((resolve, reject) => {
      const img = imgRef.current;
      if (!img || !natural || !viewport) return reject(new Error("no image"));
      const canvas = document.createElement("canvas");
      canvas.width = outputWidth;
      canvas.height = outputHeight;
      const ctx = canvas.getContext("2d")!;
      const k = outputWidth / viewport;
      ctx.imageSmoothingEnabled = true;
      ctx.imageSmoothingQuality = "high";
      ctx.fillStyle = "#fff"; // latar utk PNG transparan
      ctx.fillRect(0, 0, outputWidth, outputHeight);
      ctx.translate(
        outputWidth / 2 + offset.x * k,
        outputHeight / 2 + offset.y * k,
      );
      ctx.rotate((rotation * Math.PI) / 180);
      ctx.scale(scale * k, scale * k);
      ctx.drawImage(img, -natural.w / 2, -natural.h / 2, natural.w, natural.h);

      // Safari lama belum bisa encode WebP (toBlob diam-diam jadi PNG) ->
      // fallback JPEG supaya tetap kecil.
      canvas.toBlob(
        (webp) => {
          if (webp && webp.type === "image/webp") return resolve(webp);
          canvas.toBlob(
            (jpg) => (jpg ? resolve(jpg) : reject(new Error("encode gagal"))),
            "image/jpeg",
            0.88,
          );
        },
        "image/webp",
        0.85,
      );
    });

  const handleSave = async () => {
    setSaving(true);
    try {
      const blob = await renderCrop();
      await onSave(blob);
      onOpenChange(false);
    } catch (err: any) {
      toast.error(errorTitle, { description: err?.message });
    } finally {
      setSaving(false);
    }
  };

  // ---------------- Render ----------------

  const onDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    const file = e.dataTransfer.files?.[0];
    if (file) loadFile(file);
  };

  return (
    <Dialog open={open} onOpenChange={(v) => !saving && onOpenChange(v)}>
      <DialogContent className={cn("sm:max-w-md", contentClassName)}>
        <DialogHeader>
          <DialogTitle>{stage === "edit" ? editTitle : title}</DialogTitle>
          <DialogDescription>
            {stage === "edit"
              ? "Geser untuk mengatur posisi, scroll / pinch / slider untuk zoom."
              : stage === "camera"
                ? cameraDescription
                : pickDescription}
          </DialogDescription>
        </DialogHeader>

        {/* Input tersembunyi */}
        <input
          ref={fileInputRef}
          type="file"
          accept="image/*"
          className="hidden"
          onChange={(e) => {
            const file = e.target.files?.[0];
            if (file) loadFile(file);
            e.target.value = "";
          }}
        />
        {allowCamera && (
          <input
            ref={captureInputRef}
            type="file"
            accept="image/*"
            capture="user"
            className="hidden"
            onChange={(e) => {
              const file = e.target.files?.[0];
              if (file) loadFile(file);
              e.target.value = "";
            }}
          />
        )}

        {stage === "pick" && (
          <div className="space-y-3">
            <div
              role="button"
              tabIndex={0}
              onClick={() => fileInputRef.current?.click()}
              onKeyDown={(e) =>
                (e.key === "Enter" || e.key === " ") &&
                fileInputRef.current?.click()
              }
              onDragOver={(e) => {
                e.preventDefault();
                setIsDragging(true);
              }}
              onDragLeave={() => setIsDragging(false)}
              onDrop={onDrop}
              className={cn(
                "flex cursor-pointer flex-col items-center justify-center gap-3 rounded-xl border-2 border-dashed px-6 py-10 text-center transition-colors",
                isDragging
                  ? "border-primary bg-primary/5"
                  : "border-muted-foreground/25 hover:border-primary/50 hover:bg-muted/40",
              )}
            >
              <div className="flex h-12 w-12 items-center justify-center rounded-full bg-primary/10 text-primary">
                <ImagePlus className="h-6 w-6" />
              </div>
              <div>
                <p className="text-sm font-medium">
                  {isDragging
                    ? "Lepaskan gambar di sini"
                    : "Seret & lepas gambar, atau klik untuk memilih"}
                </p>
                <p className="mt-1 text-xs text-muted-foreground">
                  Bisa juga tempel langsung dengan Ctrl+V
                </p>
              </div>
            </div>

            <div
              className={cn(
                "grid gap-2",
                allowCamera ? "grid-cols-3" : "grid-cols-2",
              )}
            >
              <Button
                variant="outline"
                onClick={() => fileInputRef.current?.click()}
              >
                <Upload className="h-4 w-4" /> File
              </Button>
              <Button variant="outline" onClick={handlePasteButton}>
                <ClipboardPaste className="h-4 w-4" /> Tempel
              </Button>
              {allowCamera && (
                <Button variant="outline" onClick={startCamera}>
                  <Camera className="h-4 w-4" /> Kamera
                </Button>
              )}
            </div>
          </div>
        )}

        {stage === "camera" && (
          <div className="space-y-3">
            <div className="relative mx-auto aspect-square w-full overflow-hidden rounded-xl bg-black">
              <video
                ref={videoRef}
                playsInline
                muted
                className="h-full w-full -scale-x-100 object-cover"
              />
              {!cameraReady && (
                <div className="absolute inset-0 flex items-center justify-center text-white/80">
                  <Loader2 className="h-6 w-6 animate-spin" />
                </div>
              )}
              {guide === "circle" && (
                <div className="pointer-events-none absolute inset-[4%] rounded-full shadow-[0_0_0_9999px_rgba(0,0,0,0.35)]" />
              )}
            </div>
            <div className="flex justify-between gap-2">
              <Button
                variant="outline"
                onClick={() => {
                  stopCamera();
                  setStage("pick");
                }}
              >
                Kembali
              </Button>
              <Button onClick={capturePhoto} disabled={!cameraReady}>
                <Camera className="h-4 w-4" /> Ambil Foto
              </Button>
            </div>
          </div>
        )}

        {stage === "edit" && src && (
          <div className="space-y-4">
            <div
              ref={viewportRef}
              tabIndex={0}
              aria-label="Area crop gambar. Gunakan panah untuk menggeser, + / - untuk zoom."
              onPointerDown={onPointerDown}
              onPointerMove={onPointerMove}
              onPointerUp={onPointerUp}
              onPointerCancel={onPointerUp}
              onKeyDown={onKeyDown}
              style={{ aspectRatio: aspect }}
              className={cn(
                "relative mx-auto w-full max-w-[20rem] cursor-grab touch-none select-none overflow-hidden rounded-xl bg-muted outline-none focus-visible:ring-2 focus-visible:ring-ring active:cursor-grabbing",
                viewportClassName,
              )}
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                ref={imgRef}
                src={src}
                alt="Gambar yang akan di-crop"
                draggable={false}
                onLoad={(e) =>
                  setNatural({
                    w: e.currentTarget.naturalWidth,
                    h: e.currentTarget.naturalHeight,
                  })
                }
                onError={() => {
                  toast.error("Format gambar tidak didukung browser ini.", {
                    description: "Coba gunakan JPG, PNG, atau WebP.",
                  });
                  setSrc(null);
                  setStage("pick");
                }}
                className={cn(
                  "pointer-events-none absolute left-1/2 top-1/2 max-w-none origin-center",
                  !natural && "invisible",
                )}
                style={
                  natural
                    ? {
                        width: natural.w,
                        height: natural.h,
                        transform: `translate(-50%, -50%) translate(${offset.x}px, ${offset.y}px) rotate(${rotation}deg) scale(${scale})`,
                      }
                    : undefined
                }
              />
              {!natural && (
                <div className="absolute inset-0 flex items-center justify-center">
                  <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
                </div>
              )}
              {/* Panduan (lingkaran utk avatar) + grid 3x3. Hasil tetap
                  persegi panjang penuh sesuai rasio. */}
              {guide === "circle" && (
                <>
                  <div className="pointer-events-none absolute inset-0 rounded-full shadow-[0_0_0_9999px_rgba(0,0,0,0.45)]" />
                  <div className="pointer-events-none absolute inset-0 rounded-full border-2 border-white/80" />
                </>
              )}
              {guide === "rect" && (
                <div className="pointer-events-none absolute inset-0 rounded-xl border-2 border-white/70" />
              )}
              <div className="pointer-events-none absolute inset-0 grid grid-cols-3 grid-rows-3 opacity-40">
                {Array.from({ length: 9 }).map((_, i) => (
                  <div key={i} className="border-[0.5px] border-white/60" />
                ))}
              </div>
            </div>

            <div className="mx-auto flex max-w-xl items-center gap-2">
              <Button
                size="icon"
                variant="ghost"
                onClick={() => zoomTo(zoom - 0.25)}
                disabled={zoom <= MIN_ZOOM}
                aria-label="Perkecil"
              >
                <ZoomOut className="h-4 w-4" />
              </Button>
              <input
                type="range"
                min={MIN_ZOOM}
                max={MAX_ZOOM}
                step={0.01}
                value={zoom}
                onChange={(e) => zoomTo(Number(e.target.value))}
                aria-label="Zoom"
                className="h-1.5 flex-1 cursor-pointer accent-primary"
              />
              <Button
                size="icon"
                variant="ghost"
                onClick={() => zoomTo(zoom + 0.25)}
                disabled={zoom >= MAX_ZOOM}
                aria-label="Perbesar"
              >
                <ZoomIn className="h-4 w-4" />
              </Button>
              <span className="w-11 text-right text-xs tabular-nums text-muted-foreground">
                {Math.round(zoom * 100)}%
              </span>
            </div>

            <div className="flex flex-wrap items-center justify-center gap-2">
              <Button size="sm" variant="outline" onClick={() => rotate(-90)}>
                <RotateCcw className="h-4 w-4" /> Putar
              </Button>
              <Button size="sm" variant="outline" onClick={() => rotate(90)}>
                <RotateCw className="h-4 w-4" /> Putar
              </Button>
              <Button size="sm" variant="ghost" onClick={resetEditor}>
                Reset
              </Button>
            </div>
          </div>
        )}

        {stage === "edit" && (
          <DialogFooter className="gap-2 sm:justify-between">
            <Button
              variant="outline"
              onClick={() => {
                setSrc(null);
                setStage("pick");
              }}
              disabled={saving}
            >
              Ganti Gambar
            </Button>
            <Button onClick={handleSave} disabled={saving || !natural}>
              {saving ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" /> Menyimpan...
                </>
              ) : (
                saveLabel
              )}
            </Button>
          </DialogFooter>
        )}
      </DialogContent>
    </Dialog>
  );
}

// Baca gambar pertama dari clipboard lewat Clipboard API async. Butuh izin
// & belum didukung semua browser (mis. Firefox) -> fallback arahkan ke Ctrl+V.
export async function readImageFromClipboard(): Promise<File | null> {
  try {
    if (!navigator.clipboard?.read) throw new Error("unsupported");
    const items = await navigator.clipboard.read();
    for (const item of items) {
      const type = item.types.find((t) => t.startsWith("image/"));
      if (type) {
        const blob = await item.getType(type);
        return new File([blob], "clipboard", { type });
      }
    }
    toast.error("Tidak ada gambar di clipboard.");
  } catch {
    toast.info("Tekan Ctrl+V (Cmd+V di Mac) untuk menempel gambar.");
  }
  return null;
}
