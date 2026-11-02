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
import { SOUND_PRESETS, unlockAudio } from "@/lib/notifications/sound";
import {
  ANNOUNCER_CHIMES,
  ChimeDirection,
  playChime,
} from "@/lib/announcer/chimes";
import {
  AnnouncerSettings,
  DEFAULT_TEMPLATE,
  LOKASI_KOSONG,
  ejaanFromSettings,
} from "@/lib/announcer/settings";
import {
  AnnouncementTextData,
  DEFAULT_EJAAN,
  TEMPLATE_PLACEHOLDERS,
  buildAnnouncementText,
  indonesianVoices,
  voiceGender,
  voiceLabel,
} from "@/lib/announcer/speech";
import {
  GoogleVoice,
  googleVoiceLabel,
  googleVoiceSupportsPitch,
  sortGoogleVoices,
} from "@/lib/announcer/google-tts";

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

const ENGINE_OPTIONS = [
  { value: "google", label: "Google Cloud", hint: "suara HD, pakai kuota" },
  { value: "browser", label: "Browser saja", hint: "gratis, tanpa kuota" },
] as const;

const LOKASI_OPTIONS = [
  ...dataLokasi.map((l) => ({ value: l.value, label: l.label })),
  { value: LOKASI_KOSONG, label: "Approver tanpa lokasi" },
];

export const SAMPLE_ANNOUNCEMENT: Record<
  AnnouncementTextData["resource_type"],
  AnnouncementTextData
> = {
  material_request: {
    resource_type: "material_request",
    kode: "GMI/MR/XI/26/HO/571",
    approver_nama: "Agung",
    approver_sapaan: "Bapak",
    requested_by_nama: "Budi",
  },
  purchase_order: {
    resource_type: "purchase_order",
    kode: "GMI/PO/XI/26/308",
    approver_nama: "Siti",
    approver_sapaan: "Ibu",
    requested_by_nama: "Budi",
  },
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
  hint,
}: {
  label: string;
  value: number;
  display: string;
  min: number;
  max: number;
  step: number;
  onChange: (v: number) => void;
  hint?: string;
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
      {hint && <p className="text-xs text-muted-foreground">{hint}</p>}
    </div>
  );
}

function ChimeSelect({
  id,
  label,
  direction,
  value,
  volume,
  onChange,
}: {
  id: string;
  label: string;
  /** Arah yang cocok untuk posisi ini - grupnya ditaruh paling atas. */
  direction: ChimeDirection;
  value: string;
  volume: number;
  onChange: (value: string) => void;
}) {
  const groups = [
    {
      label:
        direction === "naik" ? "Nada naik (pembuka)" : "Nada turun (penutup)",
      items: ANNOUNCER_CHIMES.filter((c) => c.direction === direction),
    },
    {
      label: direction === "naik" ? "Nada turun" : "Nada naik",
      items: ANNOUNCER_CHIMES.filter((c) => c.direction !== direction),
    },
    { label: "Nada notifikasi", items: SOUND_PRESETS },
  ];

  return (
    <div className="space-y-1.5">
      <Label htmlFor={id}>{label}</Label>
      <div className="flex gap-1.5">
        <Select value={value} onValueChange={onChange}>
          <SelectTrigger id={id} className="min-w-0 flex-1">
            <SelectValue />
          </SelectTrigger>
          <SelectContent className="max-h-80">
            <SelectItem value="none">Tanpa nada</SelectItem>
            {groups.map((g) => (
              <SelectGroup key={g.label}>
                <SelectLabel>{g.label}</SelectLabel>
                {g.items.map((c) => (
                  <SelectItem key={c.id} value={c.id}>
                    {c.label}
                  </SelectItem>
                ))}
              </SelectGroup>
            ))}
          </SelectContent>
        </Select>
        <Button
          type="button"
          variant="outline"
          size="icon"
          className="h-9 w-9 shrink-0"
          title="Dengarkan"
          aria-label={`Dengarkan ${label.toLowerCase()}`}
          disabled={value === "none"}
          onClick={() => {
            unlockAudio();
            playChime(value, volume);
          }}
        >
          <Play className="h-4 w-4" />
        </Button>
      </div>
    </div>
  );
}

export function AnnouncerSettingsSheet({
  open,
  onOpenChange,
  settings,
  update,
  voices,
  googleVoices,
  googleVoicesError,
  onTest,
  onLogout,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  settings: AnnouncerSettings;
  update: (patch: Partial<AnnouncerSettings>) => void;
  voices: SpeechSynthesisVoice[];
  /** null = masih dimuat. */
  googleVoices: GoogleVoice[] | null;
  googleVoicesError: string | null;
  /** `cadangan` = paksa suara browser, untuk memastikan cadangannya jalan. */
  onTest: (
    jenis: AnnouncementTextData["resource_type"],
    cadangan?: boolean,
  ) => Promise<void>;
  onLogout: () => void;
}) {
  const [testing, setTesting] = useState<string | null>(null);

  const sortedGoogleVoices = sortGoogleVoices(googleVoices ?? []);
  const googleVoiceGroups = [
    {
      label: "Pria",
      voices: sortedGoogleVoices.filter((v) => v.gender === "MALE"),
    },
    {
      label: "Wanita",
      voices: sortedGoogleVoices.filter((v) => v.gender === "FEMALE"),
    },
    {
      label: "Lainnya",
      voices: sortedGoogleVoices.filter(
        (v) => v.gender !== "MALE" && v.gender !== "FEMALE",
      ),
    },
  ];

  const voiceOptions = indonesianVoices(voices);
  const hasOfflineVoice = voiceOptions.some((v) => v.localService);
  const voiceGroups = [
    {
      label: "Pria",
      voices: voiceOptions.filter((v) => voiceGender(v) === "pria"),
    },
    {
      label: "Wanita",
      voices: voiceOptions.filter((v) => voiceGender(v) === "wanita"),
    },
    { label: "Lainnya", voices: voiceOptions.filter((v) => !voiceGender(v)) },
  ];
  const ejaan = ejaanFromSettings(settings);

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

  const handleTest = async (
    jenis: AnnouncementTextData["resource_type"],
    cadangan = false,
  ) => {
    setTesting(cadangan ? "cadangan" : jenis);
    try {
      await onTest(jenis, cadangan);
    } finally {
      setTesting(null);
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
            description="Cuma suara Bahasa Indonesia. Kalau Google gagal atau kuotanya habis, otomatis pakai suara cadangan dari browser."
          >
            <div className="space-y-1.5">
              <Label>Mesin suara</Label>
              <div className="grid grid-cols-2 gap-1.5">
                {ENGINE_OPTIONS.map((e) => (
                  <Button
                    key={e.value}
                    type="button"
                    variant={settings.engine === e.value ? "default" : "outline"}
                    aria-pressed={settings.engine === e.value}
                    onClick={() => update({ engine: e.value })}
                    className="h-auto flex-col gap-0 py-2"
                  >
                    <span>{e.label}</span>
                    <span className="text-[11px] font-normal opacity-80">
                      {e.hint}
                    </span>
                  </Button>
                ))}
              </div>
            </div>

            {settings.engine === "google" && (
              <div className="space-y-1.5">
                <Label>Suara Google</Label>
                {googleVoicesError ? (
                  <p className="rounded-md border border-amber-500/40 bg-amber-500/10 p-2 text-xs">
                    Daftar suara Google tidak bisa dimuat ({googleVoicesError}).
                    Pengumuman memakai suara cadangan.
                  </p>
                ) : (
                  <Select
                    value={settings.googleVoice}
                    onValueChange={(googleVoice) => update({ googleVoice })}
                    disabled={!googleVoices}
                  >
                    <SelectTrigger className="w-full">
                      <SelectValue
                        placeholder={googleVoices ? "Pilih suara" : "Memuat…"}
                      />
                    </SelectTrigger>
                    <SelectContent className="max-h-80">
                      {googleVoiceGroups.map(
                        (g) =>
                          g.voices.length > 0 && (
                            <SelectGroup key={g.label}>
                              <SelectLabel>{g.label}</SelectLabel>
                              {g.voices.map((v) => (
                                <SelectItem key={v.name} value={v.name}>
                                  {googleVoiceLabel(v.name)}
                                </SelectItem>
                              ))}
                            </SelectGroup>
                          ),
                      )}
                    </SelectContent>
                  </Select>
                )}
              </div>
            )}

            <div className="space-y-1.5">
              <Label>
                {settings.engine === "google"
                  ? "Suara cadangan (browser)"
                  : "Suara"}
              </Label>
              <Select
                value={
                  voiceOptions.some((v) => v.voiceURI === settings.voiceURI)
                    ? settings.voiceURI!
                    : "auto"
                }
                onValueChange={(v) =>
                  update({ voiceURI: v === "auto" ? null : v })
                }
              >
                <SelectTrigger className="w-full">
                  <SelectValue placeholder="Pilih suara" />
                </SelectTrigger>
                <SelectContent className="max-h-80">
                  <SelectItem value="auto">
                    Otomatis (suara terbaik yang tersedia)
                  </SelectItem>
                  {voiceGroups.map(
                    (g) =>
                      g.voices.length > 0 && (
                        <SelectGroup key={g.label}>
                          <SelectLabel>{g.label}</SelectLabel>
                          {g.voices.map((v) => (
                            <SelectItem key={v.voiceURI} value={v.voiceURI}>
                              {voiceLabel(v)}
                            </SelectItem>
                          ))}
                        </SelectGroup>
                      ),
                  )}
                </SelectContent>
              </Select>
              {voices.length > 0 && voiceOptions.length === 0 && (
                <p className="text-xs text-amber-600 dark:text-amber-400">
                  Browser ini tidak punya suara Bahasa Indonesia. Pakai
                  Microsoft Edge (disarankan) atau Google Chrome.
                </p>
              )}
              {voiceOptions.length > 0 && !hasOfflineVoice && (
                <p className="text-xs text-muted-foreground">
                  Belum ada suara Indonesia offline. Supaya tetap bersuara
                  walau Google & internet bermasalah, pasang paket suara di
                  Windows: Settings, Time &amp; language, Speech, Add voices,
                  Bahasa Indonesia.
                </p>
              )}
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label htmlFor="ejaan-mr">Ejaan MR</Label>
                <Input
                  id="ejaan-mr"
                  value={settings.ejaanMR}
                  placeholder={DEFAULT_EJAAN.mr}
                  onChange={(e) => update({ ejaanMR: e.target.value })}
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="ejaan-po">Ejaan PO</Label>
                <Input
                  id="ejaan-po"
                  value={settings.ejaanPO}
                  placeholder={DEFAULT_EJAAN.po}
                  onChange={(e) => update({ ejaanPO: e.target.value })}
                />
              </div>
              <p className="col-span-2 -mt-1 text-xs text-muted-foreground">
                Huruf kapital tunggal dibaca sebagai nama hurufnya (P =
                &quot;pé&quot;). Koma memberi jeda supaya huruf tidak melebur
                jadi satu suku kata.
              </p>
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
              hint={
                settings.engine === "google" &&
                !googleVoiceSupportsPitch(settings.googleVoice)
                  ? "Suara Google HD tidak bisa diubah nadanya; pengaturan ini cuma berlaku untuk suara cadangan."
                  : undefined
              }
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

            <div className="grid gap-3 sm:grid-cols-2">
              <ChimeSelect
                id="chime-open"
                label="Nada pembuka"
                direction="naik"
                value={settings.chime}
                volume={settings.volume}
                onChange={(chime) => update({ chime })}
              />
              <ChimeSelect
                id="chime-close"
                label="Nada penutup"
                direction="turun"
                value={settings.chimeClose}
                volume={settings.volume}
                onChange={(chimeClose) => update({ chimeClose })}
              />
            </div>
            <div className="flex items-center justify-between gap-3">
              <Label htmlFor="announcer-repeat">Kalimat diucapkan</Label>
              <Select
                value={String(settings.repeat)}
                onValueChange={(v) => update({ repeat: Number(v) })}
              >
                <SelectTrigger id="announcer-repeat" className="w-24">
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
                  SAMPLE_ANNOUNCEMENT.material_request,
                  "display",
                )}
              </p>
              {(["material_request", "purchase_order"] as const).map((j) => (
                <p key={j}>
                  <span className="text-muted-foreground">
                    Diucapkan ({j === "material_request" ? "MR" : "PO"}):{" "}
                  </span>
                  {buildAnnouncementText(
                    settings.template,
                    SAMPLE_ANNOUNCEMENT[j],
                    "speech",
                    ejaan,
                  )}
                </p>
              ))}
            </div>
            <div className="grid grid-cols-2 gap-2">
              {(["material_request", "purchase_order"] as const).map((j) => (
                <Button
                  key={j}
                  type="button"
                  onClick={() => handleTest(j)}
                  disabled={testing !== null}
                >
                  {testing === j ? (
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  ) : (
                    <Play className="mr-2 h-4 w-4" />
                  )}
                  Tes {j === "material_request" ? "MR" : "PO"}
                </Button>
              ))}
              {settings.engine === "google" && (
                <Button
                  type="button"
                  variant="outline"
                  className="col-span-2"
                  onClick={() => handleTest("material_request", true)}
                  disabled={testing !== null}
                >
                  {testing === "cadangan" ? (
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  ) : (
                    <Play className="mr-2 h-4 w-4" />
                  )}
                  Tes suara cadangan (tanpa Google)
                </Button>
              )}
            </div>
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
