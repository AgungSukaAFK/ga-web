"use client";

import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Bell, Volume2, Play } from "lucide-react";
import { cn } from "@/lib/utils";
import { useNotifSettings } from "@/lib/notifications/settings";
import { SOUND_PRESETS, playSound, unlockAudio } from "@/lib/notifications/sound";

// Switch sederhana (proyek belum punya komponen Switch).
function Toggle({
  checked,
  onChange,
  disabled,
}: {
  checked: boolean;
  onChange: (v: boolean) => void;
  disabled?: boolean;
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      disabled={disabled}
      onClick={() => onChange(!checked)}
      className={cn(
        "relative inline-flex h-6 w-11 shrink-0 items-center rounded-full transition-colors",
        checked ? "bg-primary" : "bg-input",
        disabled && "opacity-50 cursor-not-allowed",
      )}
    >
      <span
        className={cn(
          "inline-block h-5 w-5 transform rounded-full bg-background shadow transition-transform",
          checked ? "translate-x-5" : "translate-x-0.5",
        )}
      />
    </button>
  );
}

function Row({
  title,
  description,
  children,
}: {
  title: string;
  description?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="flex items-center justify-between gap-3">
      <div className="min-w-0 space-y-0.5">
        <p className="text-sm font-medium">{title}</p>
        {description && (
          <p className="text-xs text-muted-foreground">{description}</p>
        )}
      </div>
      <div className="shrink-0">{children}</div>
    </div>
  );
}

export function NotificationSettings() {
  const { settings, update } = useNotifSettings();

  const handlePreview = () => {
    unlockAudio();
    playSound(settings.soundType, settings.volume);
  };

  const handleBrowserToggle = (v: boolean) => {
    update({ browser: v });
    // Saat dinyalakan, minta izin browser (butuh gesture — ini dari klik).
    if (v && typeof window !== "undefined" && "Notification" in window) {
      if (Notification.permission === "default") {
        Notification.requestPermission();
      }
    }
  };

  const soundDisabled = !settings.enabled || !settings.sound;

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2">
        <Bell className="h-4 w-4" />
        <Label className="text-base font-bold">Pengaturan Notifikasi</Label>
      </div>

      <div className="space-y-4 rounded-lg border p-4">
        {/* Master */}
        <Row
          title="Notifikasi realtime"
          description="Tampilkan alert (suara, browser, popup) saat ada notif baru."
        >
          <Toggle
            checked={settings.enabled}
            onChange={(v) => update({ enabled: v })}
          />
        </Row>

        {/* Sound on/off */}
        <Row title="Suara notifikasi" description="Bunyikan saat notif masuk.">
          <Toggle
            checked={settings.sound}
            onChange={(v) => update({ sound: v })}
            disabled={!settings.enabled}
          />
        </Row>

        {/* Volume */}
        <div className="space-y-2">
          <div className="flex items-center justify-between gap-3">
            <div className="flex min-w-0 items-center gap-2">
              <Volume2 className="h-4 w-4 shrink-0 text-muted-foreground" />
              <p className="text-sm font-medium">Volume</p>
            </div>
            <span className="shrink-0 text-xs text-muted-foreground tabular-nums">
              {Math.round(settings.volume * 100)}%
            </span>
          </div>
          <input
            type="range"
            min={0}
            max={100}
            value={Math.round(settings.volume * 100)}
            disabled={soundDisabled}
            onChange={(e) => update({ volume: Number(e.target.value) / 100 })}
            className={cn(
              "w-full accent-primary cursor-pointer",
              soundDisabled && "opacity-50 cursor-not-allowed",
            )}
          />
        </div>

        {/* Pilihan sound + preview */}
        <div className="space-y-2">
          <p className="text-sm font-medium">Pilihan suara</p>
          <div className="flex items-center gap-2">
            <Select
              value={settings.soundType}
              onValueChange={(v) =>
                update({ soundType: v as typeof settings.soundType })
              }
              disabled={soundDisabled}
            >
              <SelectTrigger className="min-w-0 flex-1">
                <SelectValue placeholder="Pilih suara" />
              </SelectTrigger>
              <SelectContent>
                {SOUND_PRESETS.map((p) => (
                  <SelectItem key={p.id} value={p.id}>
                    {p.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={handlePreview}
              disabled={soundDisabled}
              className="shrink-0"
            >
              <Play className="mr-1 h-4 w-4" />
              Coba
            </Button>
          </div>
        </div>

        {/* Browser notification */}
        <Row
          title="Notifikasi browser"
          description="Muncul di OS saat tab tidak sedang dibuka/fokus."
        >
          <Toggle
            checked={settings.browser}
            onChange={handleBrowserToggle}
            disabled={!settings.enabled}
          />
        </Row>
      </div>
    </div>
  );
}
