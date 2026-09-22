"use client";

/**
 * components/custom-ringtone-settings.tsx
 *
 * UI untuk ringtone custom notifikasi - upload file audio ATAU rekam
 * langsung dari mic, maksimal 30 detik. Disimpan 100% LOKAL di IndexedDB
 * device ini (lihat lib/notifications/custom-sound-db.ts) - file audionya
 * TIDAK PERNAH di-upload ke server, jadi harus di-set ulang per device/
 * browser dan hilang kalau data situs di-clear.
 *
 * Begitu tersimpan, otomatis jadi soundType aktif ("custom") di
 * NotifSettings supaya langsung kepakai tanpa langkah tambahan.
 */

import { useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { useNotifSettings } from "@/lib/notifications/settings";
import { unlockAudio, playCustomSound } from "@/lib/notifications/sound";
import {
  saveCustomSound,
  deleteCustomSound,
  getCustomSound,
  type CustomSoundRecord,
} from "@/lib/notifications/custom-sound-db";
import { Mic, Square, UploadCloud, Play, Trash2, Loader2 } from "lucide-react";

const MAX_DURATION_SEC = 30;
const MAX_FILE_BYTES = 8 * 1024 * 1024; // 8MB - generus utk audio 30 detik

function formatDuration(sec: number): string {
  const s = Math.max(0, Math.round(sec));
  return `0:${String(s).padStart(2, "0")}`;
}

/** Baca durasi file audio (detik) via metadata <audio> - reject kalau invalid. */
function readAudioDuration(url: string): Promise<number> {
  return new Promise((resolve, reject) => {
    const audio = new Audio();
    const cleanup = () => {
      audio.removeEventListener("loadedmetadata", onLoaded);
      audio.removeEventListener("error", onError);
    };
    const onLoaded = () => {
      cleanup();
      // Beberapa codec (mis. webm/opus tanpa index) lapor Infinity/NaN
      // sampai di-seek dulu - anggap valid tapi tidak tervalidasi ketat.
      resolve(
        Number.isFinite(audio.duration) ? audio.duration : MAX_DURATION_SEC,
      );
    };
    const onError = () => {
      cleanup();
      reject(new Error("File audio tidak valid/rusak."));
    };
    audio.addEventListener("loadedmetadata", onLoaded);
    audio.addEventListener("error", onError);
    audio.src = url;
  });
}

type Pending = { blob: Blob; url: string; name: string; duration: number };

export function CustomRingtoneSettings() {
  const { settings, update } = useNotifSettings();

  const [current, setCurrent] = useState<CustomSoundRecord | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [pending, setPending] = useState<Pending | null>(null);

  const [recording, setRecording] = useState(false);
  const [elapsed, setElapsed] = useState(0);
  const recorderRef = useRef<MediaRecorder | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const stopTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    getCustomSound()
      .then(setCurrent)
      .finally(() => setLoading(false));

    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
      if (stopTimeoutRef.current) clearTimeout(stopTimeoutRef.current);
      streamRef.current?.getTracks().forEach((t) => t.stop());
    };
  }, []);

  const clearPending = () => {
    if (pending) URL.revokeObjectURL(pending.url);
    setPending(null);
  };

  const stopRecording = () => {
    recorderRef.current?.stop();
    if (timerRef.current) clearInterval(timerRef.current);
    if (stopTimeoutRef.current) clearTimeout(stopTimeoutRef.current);
  };

  const handleStartRecording = async () => {
    unlockAudio();
    clearPending();
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      streamRef.current = stream;
      chunksRef.current = [];

      const mimeType = MediaRecorder.isTypeSupported("audio/webm")
        ? "audio/webm"
        : MediaRecorder.isTypeSupported("audio/mp4")
          ? "audio/mp4"
          : "";
      const recorder = new MediaRecorder(
        stream,
        mimeType ? { mimeType } : undefined,
      );
      recorderRef.current = recorder;

      recorder.ondataavailable = (e) => {
        if (e.data.size > 0) chunksRef.current.push(e.data);
      };
      recorder.onstop = () => {
        stream.getTracks().forEach((t) => t.stop());
        setRecording(false);

        const blob = new Blob(chunksRef.current, {
          type: recorder.mimeType || "audio/webm",
        });
        if (blob.size === 0) {
          toast.error("Rekaman kosong, coba lagi.");
          return;
        }
        const url = URL.createObjectURL(blob);
        setPending({
          blob,
          url,
          name: `Rekaman ${new Date().toLocaleString("id-ID")}`,
          duration: elapsed,
        });
      };

      recorder.start();
      setRecording(true);
      setElapsed(0);
      timerRef.current = setInterval(() => {
        setElapsed((prev) => prev + 1);
      }, 1000);
      stopTimeoutRef.current = setTimeout(stopRecording, MAX_DURATION_SEC * 1000);
    } catch (error: any) {
      toast.error("Gagal mengakses microphone", {
        description:
          error?.name === "NotAllowedError"
            ? "Izin microphone ditolak. Aktifkan lewat pengaturan situs di browser."
            : error.message,
      });
    }
  };

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;

    if (file.size > MAX_FILE_BYTES) {
      toast.error("File terlalu besar", {
        description: `Maks ${Math.round(MAX_FILE_BYTES / 1024 / 1024)}MB.`,
      });
      return;
    }

    const url = URL.createObjectURL(file);
    try {
      const duration = await readAudioDuration(url);
      if (duration > MAX_DURATION_SEC + 1) {
        URL.revokeObjectURL(url);
        toast.error("Audio terlalu panjang", {
          description: `Maksimal ${MAX_DURATION_SEC} detik (file ini ${Math.round(duration)} detik).`,
        });
        return;
      }
      clearPending();
      setPending({ blob: file, url, name: file.name, duration });
    } catch (error: any) {
      URL.revokeObjectURL(url);
      toast.error("Gagal membaca file audio", { description: error.message });
    }
  };

  const handleSavePending = async () => {
    if (!pending) return;
    setSaving(true);
    try {
      await saveCustomSound(pending.blob, pending.name, pending.duration);
      const saved = await getCustomSound();
      setCurrent(saved);
      clearPending();
      update({ soundType: "custom" });
      toast.success("Ringtone custom disimpan & langsung aktif.");
    } catch (error: any) {
      toast.error("Gagal menyimpan ringtone", { description: error.message });
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    try {
      await deleteCustomSound();
      setCurrent(null);
      if (settings.soundType === "custom") {
        update({ soundType: "tritone" });
      }
      toast.success("Ringtone custom dihapus.");
    } catch (error: any) {
      toast.error("Gagal menghapus ringtone", { description: error.message });
    }
  };

  const handlePreviewCurrent = async () => {
    unlockAudio();
    const ok = await playCustomSound(settings.volume);
    if (!ok) toast.error("Ringtone custom tidak ditemukan.");
  };

  if (loading) {
    return (
      <div className="flex items-center gap-2 text-xs text-muted-foreground">
        <Loader2 className="h-3.5 w-3.5 animate-spin" /> Memuat ringtone
        custom...
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <p className="text-sm font-medium">Ringtone Custom</p>
      <p className="text-xs text-muted-foreground -mt-2">
        Upload file audio atau rekam suara langsung, maks {MAX_DURATION_SEC}{" "}
        detik. Tersimpan lokal di perangkat ini saja (tidak diunggah ke
        server) - perlu di-set ulang kalau ganti device/browser.
      </p>

      {/* Ringtone custom yang sudah tersimpan */}
      {current && !pending && (
        <div className="flex items-center justify-between gap-2 rounded-md border p-3">
          <div className="min-w-0">
            <p className="text-sm font-medium truncate">{current.name}</p>
            <p className="text-xs text-muted-foreground">
              {formatDuration(current.duration)} · tersimpan di device ini
              {settings.soundType === "custom" && (
                <span className="text-primary"> · aktif</span>
              )}
            </p>
          </div>
          <div className="flex items-center gap-1 shrink-0">
            {settings.soundType !== "custom" && (
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="h-8"
                onClick={() => update({ soundType: "custom" })}
              >
                Gunakan
              </Button>
            )}
            <Button
              type="button"
              variant="outline"
              size="icon"
              className="h-8 w-8"
              onClick={handlePreviewCurrent}
            >
              <Play className="h-4 w-4" />
            </Button>
            <Button
              type="button"
              variant="outline"
              size="icon"
              className="h-8 w-8 text-destructive hover:text-destructive"
              onClick={handleDelete}
            >
              <Trash2 className="h-4 w-4" />
            </Button>
          </div>
        </div>
      )}

      {/* Preview hasil rekam/upload SEBELUM disimpan */}
      {pending && (
        <div className="space-y-2 rounded-md border p-3">
          <p className="text-sm font-medium truncate">{pending.name}</p>
          <audio src={pending.url} controls className="w-full h-9" />
          <div className="flex justify-end gap-2">
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={clearPending}
              disabled={saving}
            >
              Batal
            </Button>
            <Button
              type="button"
              size="sm"
              onClick={handleSavePending}
              disabled={saving}
            >
              {saving && <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />}
              Simpan & Gunakan
            </Button>
          </div>
        </div>
      )}

      {/* Aksi: upload / rekam (disembunyikan selagi ada preview pending) */}
      {!pending && (
        <div className="flex flex-wrap items-center gap-2">
          <input
            ref={fileInputRef}
            type="file"
            accept="audio/*"
            className="hidden"
            onChange={handleFileSelect}
          />
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => fileInputRef.current?.click()}
            disabled={recording}
          >
            <UploadCloud className="mr-1.5 h-4 w-4" />
            Upload Audio
          </Button>

          {recording ? (
            <Button
              type="button"
              variant="destructive"
              size="sm"
              onClick={stopRecording}
            >
              <Square className="mr-1.5 h-3.5 w-3.5 fill-current" />
              Stop ({formatDuration(elapsed)}/{formatDuration(MAX_DURATION_SEC)})
            </Button>
          ) : (
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={handleStartRecording}
            >
              <Mic className="mr-1.5 h-4 w-4" />
              Rekam Suara
            </Button>
          )}

          {recording && (
            <span
              className={cn(
                "h-2 w-2 rounded-full bg-red-500 animate-pulse",
              )}
            />
          )}
        </div>
      )}
    </div>
  );
}
