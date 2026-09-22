"use client";

import { useEffect, useState } from "react";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Bell,
  Volume2,
  Play,
  Smartphone,
  Loader2,
  Download,
  CheckCircle2,
  Share,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import { createClient } from "@/lib/supabase/client";
import { useNotifSettings } from "@/lib/notifications/settings";
import {
  SOUND_PRESETS,
  playSound,
  playCustomSound,
  unlockAudio,
} from "@/lib/notifications/sound";
import {
  getPushSubscriptionStatus,
  subscribeToPush,
  unsubscribeFromPush,
  type PushSubscriptionStatus,
} from "@/lib/notifications/push";
import { useInstallPrompt } from "@/lib/pwa/use-install-prompt";
import { CustomRingtoneSettings } from "@/components/custom-ringtone-settings";

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
  const { canInstall, isStandalone, isIOS, promptInstall } = useInstallPrompt();

  const [pushStatus, setPushStatus] = useState<PushSubscriptionStatus | "loading">(
    "loading",
  );
  const [pushBusy, setPushBusy] = useState(false);

  useEffect(() => {
    getPushSubscriptionStatus().then(setPushStatus);
  }, []);

  const handleInstall = async () => {
    const accepted = await promptInstall();
    if (accepted) toast.success("Aplikasi berhasil di-install.");
  };

  const handlePushToggle = async (v: boolean) => {
    setPushBusy(true);
    try {
      if (v) {
        const supabase = createClient();
        const {
          data: { user },
        } = await supabase.auth.getUser();
        if (!user) throw new Error("Sesi login berakhir, silakan login ulang.");

        await subscribeToPush(user.id);
        setPushStatus("subscribed");
        toast.success("Notifikasi HP diaktifkan untuk perangkat ini.");
      } else {
        await unsubscribeFromPush();
        setPushStatus("unsubscribed");
        toast.success("Notifikasi HP dimatikan untuk perangkat ini.");
      }
    } catch (error: any) {
      toast.error("Gagal mengubah Notifikasi HP", {
        description: error.message,
      });
    } finally {
      setPushBusy(false);
    }
  };

  const handlePreview = () => {
    unlockAudio();
    if (settings.soundType === "custom") {
      playCustomSound(settings.volume);
    } else {
      playSound(settings.soundType, settings.volume);
    }
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

        <div className="border-t pt-3">
          <CustomRingtoneSettings />
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

      {!isStandalone && (
        <div className="space-y-3 rounded-lg border p-4">
          <div className="flex items-center gap-2">
            <Download className="h-4 w-4" />
            <p className="text-sm font-bold">Install Aplikasi</p>
          </div>
          {canInstall ? (
            <Row
              title="MR-PO GA LOURDES"
              description="Install ke HP/laptop supaya bisa dibuka dari ikon sendiri, layar penuh tanpa address bar - dan notifikasi HP bisa diaktifkan."
            >
              <Button type="button" size="sm" onClick={handleInstall}>
                <Download className="mr-1.5 h-4 w-4" />
                Install
              </Button>
            </Row>
          ) : isIOS ? (
            <p className="text-xs text-muted-foreground">
              Buka lewat <strong>Safari</strong>, ketuk tombol{" "}
              <Share className="inline h-3.5 w-3.5 -mt-0.5" /> Share di bar
              bawah, lalu pilih <strong>&quot;Add to Home Screen&quot;</strong>.
              Ini wajib dilakukan dulu di iPhone sebelum Notifikasi HP bisa
              diaktifkan.
            </p>
          ) : (
            <p className="text-xs text-muted-foreground">
              Buka menu browser (⋮ atau ikon install di address bar) lalu
              pilih &quot;Install app&quot; / &quot;Add to Home screen&quot;.
            </p>
          )}
        </div>
      )}

      {isStandalone && (
        <div className="flex items-center gap-2 rounded-lg border p-3 text-xs text-muted-foreground">
          <CheckCircle2 className="h-4 w-4 text-green-600 shrink-0" />
          Aplikasi sudah ter-install di perangkat ini.
        </div>
      )}

      <div className="space-y-3 rounded-lg border p-4">
        <div className="flex items-center gap-2">
          <Smartphone className="h-4 w-4" />
          <p className="text-sm font-bold">Notifikasi HP</p>
        </div>
        <Row
          title="Aktifkan di perangkat ini"
          description={
            pushStatus === "unsupported"
              ? 'Tidak didukung di browser ini. Di iPhone: buka lewat Safari, "Add to Home Screen" dulu, baru aktifkan dari ikonnya.'
              : "Tetap masuk walau browser/tab sudah ditutup - beda dari notifikasi browser biasa di atas."
          }
        >
          {pushBusy || pushStatus === "loading" ? (
            <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
          ) : (
            <Toggle
              checked={pushStatus === "subscribed"}
              onChange={handlePushToggle}
              disabled={pushStatus === "unsupported"}
            />
          )}
        </Row>
      </div>
    </div>
  );
}
