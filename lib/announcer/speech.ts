"use client";

/**
 * lib/announcer/speech.ts
 *
 * Penyusun kalimat & pemutar Text-to-Speech Announcer Follow-up, pakai Web
 * Speech API bawaan browser (gratis, tanpa API key). Kualitas suara
 * tergantung browser/OS: Microsoft Edge di Windows punya suara Indonesia
 * natural ("Ardi"/"Gadis" Online (Natural), butuh internet), Chrome punya
 * "Google Bahasa Indonesia", macOS punya "Damayanti".
 *
 * Kalimat untuk DIUCAPKAN sengaja beda dari yang DITAMPILKAN: "MR" sering
 * dibaca "Mister" oleh TTS Indonesia, jadi diganti ejaan (default "em ar";
 * PO "P, O" - huruf kapital tunggal dibaca nama hurufnya "pé"; "pe" ditulis
 * biasa dibaca pepet /pə/ oleh suara Windows, & tanpa koma melebur jadi
 * "po"), bisa diubah per device;
 * kode dieja per digit ("lima, tujuh, satu"); nama huruf kapital semua
 * dijadikan Title Case supaya tidak dieja per huruf seperti singkatan.
 */

export type AnnouncementTextData = {
  resource_type: "material_request" | "purchase_order";
  kode: string;
  approver_nama: string | null;
  approver_sapaan: string | null;
  requested_by_nama: string | null;
};

export const TEMPLATE_PLACEHOLDERS: { key: string; label: string }[] = [
  { key: "jenis", label: "MR / PO" },
  { key: "sapaan", label: "Bapak/Ibu/Mas/Mba/Kak (kosong = dihapus)" },
  { key: "approver", label: "Nama approver" },
  { key: "kode", label: "Angka terakhir kode dokumen" },
  { key: "pemohon", label: "Nama yang menekan Follow-up" },
];

const DIGIT_WORDS = [
  "nol",
  "satu",
  "dua",
  "tiga",
  "empat",
  "lima",
  "enam",
  "tujuh",
  "delapan",
  "sembilan",
];

/** Bagian terakhir kode dokumen, mis. "GMI/MR/XI/26/HO/571" -> "571". */
export function kodeSuffix(kode: string): string {
  return kode.split("/").pop()?.trim() || kode;
}

const spellKode = (suffix: string) =>
  suffix
    .split("")
    .filter((ch) => ch.trim())
    .map((ch) => (/\d/.test(ch) ? DIGIT_WORDS[Number(ch)] : ch))
    .join(", ");

const toTitleCase = (s: string) =>
  s.toLowerCase().replace(/(^|[\s'-])(\p{L})/gu, (_, sep, ch) => sep + ch.toUpperCase());

function fillTemplate(template: string, values: Record<string, string>) {
  return template
    .replace(/\{(\w+)\}/g, (match, key: string) =>
      key in values ? values[key] : match,
    )
    .replace(/\s+/g, " ")
    .replace(/\s+([,.!?])/g, "$1")
    .replace(/,(\s*,)+/g, ",")
    .replace(/^[\s,]+|[\s,]+$/g, "");
}

/** Cara mengucapkan jenis dokumen. */
export type EjaanJenis = { mr: string; po: string };

export const DEFAULT_EJAAN: EjaanJenis = { mr: "em ar", po: "P, O" };

export function buildAnnouncementText(
  template: string,
  data: AnnouncementTextData,
  mode: "speech" | "display",
  ejaan: EjaanJenis = DEFAULT_EJAAN,
): string {
  const isMR = data.resource_type === "material_request";
  const suffix = kodeSuffix(data.kode);
  const approver = data.approver_nama?.trim() || "approver";
  const pemohon = data.requested_by_nama?.trim() || "";

  if (mode === "display") {
    return fillTemplate(template, {
      jenis: isMR ? "MR" : "PO",
      sapaan: data.approver_sapaan ?? "",
      approver,
      kode: suffix,
      pemohon,
    });
  }

  return fillTemplate(template, {
    jenis: (isMR ? ejaan.mr : ejaan.po).trim() || (isMR ? "MR" : "PO"),
    sapaan: data.approver_sapaan ?? "",
    approver: toTitleCase(approver),
    kode: spellKode(suffix),
    pemohon: toTitleCase(pemohon),
  });
}

// ─────────────────────────────────────────────
// Voices
// ─────────────────────────────────────────────

export function getSynth(): SpeechSynthesis | null {
  if (typeof window === "undefined" || !("speechSynthesis" in window)) {
    return null;
  }
  return window.speechSynthesis;
}

/** Daftar suara - di Chrome/Edge baru terisi setelah event voiceschanged. */
export function loadVoices(timeoutMs = 3000): Promise<SpeechSynthesisVoice[]> {
  const synth = getSynth();
  if (!synth) return Promise.resolve([]);
  const initial = synth.getVoices();
  if (initial.length) return Promise.resolve(initial);

  return new Promise((resolve) => {
    const done = () => {
      clearTimeout(timer);
      synth.removeEventListener("voiceschanged", done);
      resolve(synth.getVoices());
    };
    const timer = setTimeout(done, timeoutMs);
    synth.addEventListener("voiceschanged", done);
  });
}

export const isIndonesianVoice = (v: SpeechSynthesisVoice) =>
  v.lang.toLowerCase().replace("_", "-").startsWith("id");

// Natural/neural (Edge) > Google (Chrome) > suara Indonesia lain.
const voiceScore = (v: SpeechSynthesisVoice) =>
  /natural|neural/i.test(v.name) ? 3 : /google/i.test(v.name) ? 2 : 1;

/** Suara Bahasa Indonesia saja, urut dari yang terbaik. */
export const indonesianVoices = (voices: SpeechSynthesisVoice[]) =>
  voices
    .filter(isIndonesianVoice)
    .sort((a, b) => voiceScore(b) - voiceScore(a));

// Suara Indonesia yang umum ada di Edge/Chrome/Windows/macOS.
const KNOWN_VOICES: { match: RegExp; nama: string; jenis: string }[] = [
  { match: /ardi/i, nama: "Ardi", jenis: "pria" },
  { match: /gadis/i, nama: "Gadis", jenis: "wanita" },
  { match: /andika/i, nama: "Andika", jenis: "pria" },
  { match: /damayanti/i, nama: "Damayanti", jenis: "wanita" },
  { match: /google/i, nama: "Google Bahasa Indonesia", jenis: "wanita" },
];

/** Label rapi untuk pilihan suara, mis. "Ardi (pria, natural, butuh internet)". */
export function voiceLabel(v: SpeechSynthesisVoice): string {
  const known = KNOWN_VOICES.find((k) => k.match.test(v.name));
  const nama =
    known?.nama ??
    v.name.replace(/\s*[-(].*(indonesia|indonesian).*$/i, "").trim();
  const detail = [
    known?.jenis,
    /natural|neural/i.test(v.name) ? "natural" : null,
    v.localService ? "offline" : "butuh internet",
  ].filter(Boolean);
  return `${nama || v.name} (${detail.join(", ")})`;
}

export function pickVoice(
  voices: SpeechSynthesisVoice[],
  voiceURI: string | null,
): SpeechSynthesisVoice | null {
  const indonesian = indonesianVoices(voices);
  if (voiceURI) {
    const chosen = indonesian.find((v) => v.voiceURI === voiceURI);
    if (chosen) return chosen;
  }
  return indonesian[0] ?? null;
}

/**
 * Suara cadangan saat `failed` gagal (mis. suara Online Edge tanpa
 * internet): suara Indonesia offline lain, kalau ada.
 */
export function pickFallbackVoice(
  voices: SpeechSynthesisVoice[],
  failed: SpeechSynthesisVoice | null,
): SpeechSynthesisVoice | null {
  return (
    voices.find(
      (v) => isIndonesianVoice(v) && v.localService && v.voiceURI !== failed?.voiceURI,
    ) ?? null
  );
}

// ─────────────────────────────────────────────
// Speak
// ─────────────────────────────────────────────

export type SpeakResult = "ok" | "error" | "timeout";

// Referensi utterance yang sedang diputar. Wajib disimpan: di Chrome,
// utterance yang ter-garbage-collect tidak pernah memicu onend, sehingga
// antrian pengumuman macet.
let currentUtterance: SpeechSynthesisUtterance | null = null;

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

export async function speak(
  text: string,
  opts: {
    voice: SpeechSynthesisVoice | null;
    rate: number;
    pitch: number;
    volume: number;
  },
): Promise<SpeakResult> {
  const synth = getSynth();
  if (!synth) return "error";

  // Bersihkan sisa antrian yang macet. Chrome kadang mengabaikan speak()
  // yang dipanggil tepat setelah cancel(), makanya diberi jeda.
  if (synth.speaking || synth.pending) {
    synth.cancel();
    await sleep(150);
  }

  return new Promise((resolve) => {
    const u = new SpeechSynthesisUtterance(text);
    if (opts.voice) {
      u.voice = opts.voice;
      u.lang = opts.voice.lang;
    } else {
      u.lang = "id-ID";
    }
    u.rate = opts.rate;
    u.pitch = opts.pitch;
    u.volume = Math.max(0, Math.min(1, opts.volume));

    let finished = false;
    const finish = (result: SpeakResult) => {
      if (finished) return;
      finished = true;
      clearTimeout(watchdog);
      clearInterval(unpause);
      if (currentUtterance === u) currentUtterance = null;
      resolve(result);
    };

    // Watchdog: speechSynthesis kadang macet diam-diam (onend tak pernah
    // datang). Batasnya dari perkiraan durasi kalimat + kelonggaran.
    const watchdog = setTimeout(
      () => {
        synth.cancel();
        finish("timeout");
      },
      Math.max(8000, (text.length * 110) / Math.max(0.3, opts.rate) + 5000),
    );
    // Chrome bisa mem-pause sendiri sintesis yang berjalan lama.
    const unpause = setInterval(() => {
      if (synth.paused) synth.resume();
    }, 1000);

    u.onend = () => finish("ok");
    u.onerror = (e) => {
      console.warn("[Announcer] TTS error:", e.error);
      finish("error");
    };

    currentUtterance = u;
    synth.speak(u);
  });
}

export function stopSpeaking() {
  getSynth()?.cancel();
}
