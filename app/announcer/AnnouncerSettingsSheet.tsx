"use client";

import { useState } from "react";
import { Loader2, LogOut, Play, RotateCcw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Slider } from "@/components/ui/slider";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectLabel,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { cn } from "@/lib/utils";
import { dataLokasi } from "@/type/comboboxData";
import { SOUND_PRESETS } from "@/lib/notifications/sound";
import {
  AnnouncerSettings,
  DEFAULT_TEMPLATE,
  LOKASI_KOSONG,
} from "@/lib/announcer/settings";
import {
  AnnouncementTextData,
  TEMPLATE_PLACEHOLDERS,
  buildAnnouncementText,
  isIndonesianVoice,
} from "@/lib/announcer/speech";

// Urutan tampil Senin..Minggu, nilai = Date.getDay().
const DAYS: { value: number; label: string }[] = [
  { value: 1, label: "Sen" },
  { value: 2, label: "Sel" },
  { value: 3, label: "Rab" },
  { value: 4, label: "Kam" },
  { value: 5, label: "Jum" },
  { value: 6, label: "Sab" },
  { value: 0, label: "Min" },
];

const LOKASI_OPTIONS = [
  ...dataLokasi.map((l) => ({ value: l.value, label: l.label })),
  { value: LOKASI_KOSONG, label: "Approver tanpa lokasi" },
];

export const SAMPLE_ANNOUNCEMENT: AnnouncementTextData = {
  resource_type: "material_request",
  kode: "GMI/MR/XI/26/HO/571",
  approver_nama: "Agung",
  approver_sapaan: "Bapak",
  requested_by_nama: "Budi",
};

function Section({
  title,
  description,
  children,
}: {
  title: string;
  description?: string;
  children: React.ReactNode;
}) {
  return (
    <section className="space-y-3 border-t pt-4 first:border-t-0 first:pt-0">
      <div>
        <h3 className="text-sm font-semibold">{title}</h3>
        {description && (
          <p className="mt-0.5 text-xs text-muted-foreground">{description}</p>
        )}
      </div>
      {children}
    </section>
  );
}

function SliderRow({
  label,
  value,
  display,
  min,
  max,
  step,
  onChange,
}: {
  label: string;
  value: number;
  display: string;
  min: number;
  max: number;
  step: number;
  onChange: (v: number) => void;
}) {
  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between text-sm">
        <Label>{label}</Label>
        <span className="text-xs tabular-nums text-muted-foreground">
          {display}
        </span>
      </div>
      <Slider
        value={[value]}
        min={min}
        max={max}
        step={step}
        onValueChange={([v]) => onChange(v)}
      />
    </div>
  );
}

export function AnnouncerSettingsSheet({
  open,
  onOpenChange,
  settings,
  update,
  voices,
  onTest,
  onLogout,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  settings: AnnouncerSettings;
  update: (patch: Partial<AnnouncerSettings>) => void;
  voices: SpeechSynthesisVoice[];
  onTest: () => Promise<void>;
  onLogout: () => void;
}) {
  const [testing, setTesting] = useState(false);

  const indonesianVoices = voices.filter(isIndonesianVoice);
  const otherVoices = voices.filter((v) => !isIndonesianVoice(v));

  const toggleLokasi = (value: string, checked: boolean) =>
    update({
      lokasi: checked
        ? [...settings.lokasi, value]
        : settings.lokasi.filter((l) => l !== value),
    });

  const toggleDay = (day: number) =>
    update({
      activeDays: settings.activeDays.includes(day)
        ? settings.activeDays.filter((d) => d !== day)
        : [...settings.activeDays, day],
    });

  const handleTest = async () => {
    setTesting(true);
    try {
      await onTest();
    } finally {
      setTesting(false);
    }
  };

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="w-full gap-0 overflow-y-auto sm:max-w-lg">
        <SheetHeader className="border-b">
          <SheetTitle>Pengaturan Announcer</SheetTitle>
          <SheetDescription>
            Tersimpan di device ini saja. PC announcer lain punya pengaturannya
            sendiri.
          </SheetDescription>
        </SheetHeader>

        <div className="space-y-5 p-4">
          <Section
            title="Lokasi"
            description="Follow-up diumumkan kalau lokasi profil approver yang di-follow-up ada di daftar ini."
          >
            <div className="flex gap-2">
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() =>
                  update({ lokasi: LOKASI_OPTIONS.map((l) => l.value) })
                }
              >
                Pilih semua
              </Button>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => update({ lokasi: [] })}
              >
                Kosongkan
              </Button>
            </div>
            <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
              {LOKASI_OPTIONS.map((l) => (
                <div key={l.value} className="flex items-center gap-2">
                  <Checkbox
                    id={`lokasi-${l.value}`}
                    checked={settings.lokasi.includes(l.value)}
                    onCheckedChange={(v) => toggleLokasi(l.value, !!v)}
                  />
                  <Label
                    htmlFor={`lokasi-${l.value}`}
                    className={cn(
                      "cursor-pointer font-normal",
                      l.value === LOKASI_KOSONG && "italic",
                    )}
                  >
                    {l.label}
                  </Label>
                </div>
              ))}
            </div>
          </Section>

          <Section
            title="Jam & hari aktif"
            description="Mengikuti jam PC ini (WIB/WITA/WIT). Di luar jadwal, follow-up cuma dicatat tanpa suara."
          >
            <div className="flex items-end gap-3">
              <div className="flex-1 space-y-1.5">
                <Label htmlFor="announcer-start">Mulai</Label>
                <Input
                  id="announcer-start"
                  type="time"
                  value={settings.startTime}
                  onChange={(e) =>
                    e.target.value && update({ startTime: e.target.value })
                  }
                />
              </div>
              <div className="flex-1 space-y-1.5">
                <Label htmlFor="announcer-end">Selesai</Label>
                <Input
                  id="announcer-end"
                  type="time"
                  value={settings.endTime}
                  onChange={(e) =>
                    e.target.value && update({ endTime: e.target.value })
                  }
                />
              </div>
            </div>
            <div className="flex flex-wrap gap-1.5">
              {DAYS.map((d) => {
                const active = settings.activeDays.includes(d.value);
                return (
                  <Button
                    key={d.value}
                    type="button"
                    size="sm"
                    variant={active ? "default" : "outline"}
                    className="w-12"
                    aria-pressed={active}
                    onClick={() => toggleDay(d.value)}
                  >
                    {d.label}
                  </Button>
                );
              })}
            </div>
          </Section>

          <Section
            title="Suara"
            description="Daftar suara tergantung browser. Di Windows, Microsoft Edge punya suara Indonesia natural (Ardi / Gadis)."
          >
            <div className="space-y-1.5">
              <Label>Suara</Label>
              <Select
                value={settings.voiceURI ?? "auto"}
                onValueChange={(v) =>
                  update({ voiceURI: v === "auto" ? null : v })
                }
              >
                <SelectTrigger className="w-full">
                  <SelectValue placeholder="Pilih suara" />
                </SelectTrigger>
                <SelectContent className="max-h-80">
                  <SelectItem value="auto">
                    Otomatis (suara Indonesia terbaik)
                  </SelectItem>
                  {indonesianVoices.length > 0 && (
                    <SelectGroup>
                      <SelectLabel>Bahasa Indonesia</SelectLabel>
                      {indonesianVoices.map((v) => (
                        <SelectItem key={v.voiceURI} value={v.voiceURI}>
                          {v.name}
                        </SelectItem>
                      ))}
                    </SelectGroup>
                  )}
                  {otherVoices.length > 0 && (
                    <SelectGroup>
                      <SelectLabel>Bahasa lain</SelectLabel>
                      {otherVoices.map((v) => (
                        <SelectItem key={v.voiceURI} value={v.voiceURI}>
                          {v.name} ({v.lang})
                        </SelectItem>
                      ))}
                    </SelectGroup>
                  )}
                </SelectContent>
              </Select>
              {voices.length > 0 && indonesianVoices.length === 0 && (
                <p className="text-xs text-amber-600 dark:text-amber-400">
                  Browser ini tidak punya suara Bahasa Indonesia, jadi
                  pengucapannya akan aneh. Pakai Microsoft Edge atau Google
                  Chrome.
                </p>
              )}
            </div>

            <SliderRow
              label="Kecepatan"
              value={settings.rate}
              display={`${settings.rate.toFixed(2)}x`}
              min={0.5}
              max={1.5}
              step={0.05}
              onChange={(rate) => update({ rate })}
            />
            <SliderRow
              label="Nada"
              value={settings.pitch}
              display={settings.pitch.toFixed(2)}
              min={0.5}
              max={1.5}
              step={0.05}
              onChange={(pitch) => update({ pitch })}
            />
            <SliderRow
              label="Volume"
              value={settings.volume}
              display={`${Math.round(settings.volume * 100)}%`}
              min={0}
              max={1}
              step={0.05}
              onChange={(volume) => update({ volume })}
            />

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label>Nada pembuka</Label>
                <Select
                  value={settings.chime}
                  onValueChange={(v) =>
                    update({ chime: v as AnnouncerSettings["chime"] })
                  }
                >
                  <SelectTrigger className="w-full">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent className="max-h-80">
                    <SelectItem value="none">Tanpa nada</SelectItem>
                    {SOUND_PRESETS.map((p) => (
                      <SelectItem key={p.id} value={p.id}>
                        {p.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label>Diucapkan</Label>
                <Select
                  value={String(settings.repeat)}
                  onValueChange={(v) => update({ repeat: Number(v) })}
                >
                  <SelectTrigger className="w-full">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {[1, 2, 3].map((n) => (
                      <SelectItem key={n} value={String(n)}>
                        {n}x
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
          </Section>

          <Section
            title="Kalimat"
            description="Klik placeholder untuk menambahkannya ke kalimat."
          >
            <Textarea
              value={settings.template}
              onChange={(e) => update({ template: e.target.value })}
              rows={3}
            />
            <div className="flex flex-wrap gap-1.5">
              {TEMPLATE_PLACEHOLDERS.map((p) => (
                <button
                  key={p.key}
                  type="button"
                  title={p.label}
                  onClick={() =>
                    update({
                      template: `${settings.template.trimEnd()} {${p.key}}`,
                    })
                  }
                  className="rounded-md border bg-muted/50 px-2 py-0.5 font-mono text-xs hover:bg-muted"
                >
                  {`{${p.key}}`}
                </button>
              ))}
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className="h-6 px-2 text-xs"
                onClick={() => update({ template: DEFAULT_TEMPLATE })}
              >
                <RotateCcw className="mr-1 h-3 w-3" />
                Kembalikan default
              </Button>
            </div>
            <div className="space-y-1 rounded-md border bg-muted/30 p-3 text-xs">
              <p>
                <span className="text-muted-foreground">Tampil: </span>
                {buildAnnouncementText(
                  settings.template,
                  SAMPLE_ANNOUNCEMENT,
                  "display",
                )}
              </p>
              <p>
                <span className="text-muted-foreground">Diucapkan: </span>
                {buildAnnouncementText(
                  settings.template,
                  SAMPLE_ANNOUNCEMENT,
                  "speech",
                )}
              </p>
            </div>
            <Button
              type="button"
              onClick={handleTest}
              disabled={testing}
              className="w-full"
            >
              {testing ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : (
                <Play className="mr-2 h-4 w-4" />
              )}
              Tes Suara
            </Button>
          </Section>

          <Section
            title="Setup PC announcer"
            description="Supaya langsung bunyi setelah PC restart, tanpa perlu klik Mulai Standby."
          >
            <ol className="list-decimal space-y-1.5 pl-4 text-xs text-muted-foreground">
              <li>Login akun announcer di Microsoft Edge, lalu tutup Edge.</li>
              <li>
                Buat shortcut Edge di folder Startup Windows (Win+R, ketik{" "}
                <code className="rounded bg-muted px-1">shell:startup</code>).
              </li>
              <li>
                Di Properties shortcut, isi Target dengan:
                <code className="mt-1 block break-all rounded bg-muted p-1.5">
                  &quot;C:\Program Files (x86)\Microsoft\Edge\Application\msedge.exe&quot;
                  --kiosk {typeof window !== "undefined" ? `${window.location.origin}/announcer` : "/announcer"}{" "}
                  --edge-kiosk-type=fullscreen
                  --autoplay-policy=no-user-gesture-required
                </code>
              </li>
              <li>
                Matikan sleep di Windows (Settings, System, Power &amp; sleep
                ke Never) dan matikan Sleeping tabs di Edge.
              </li>
              <li>Pastikan jam &amp; zona waktu Windows sudah benar.</li>
            </ol>
          </Section>

          <div className="border-t pt-4">
            <Button
              type="button"
              variant="outline"
              className="w-full"
              onClick={onLogout}
            >
              <LogOut className="mr-2 h-4 w-4" />
              Keluar dari akun ini
            </Button>
          </div>
        </div>
      </SheetContent>
    </Sheet>
  );
}
