// app/api/announcer/tts/route.ts
//
// Google Cloud Text-to-Speech untuk Announcer Follow-up (app/announcer).
// GOOGLE_TTS_API_KEY cuma dipakai di sini (server) - TIDAK BOLEH pernah ada
// di kode client.
//
//   GET  -> { voices: suara id-ID, usage: pemakaian & batas kuota }
//   POST -> audio MP3 satu kalimat { text, voice, rate, pitch }; pemakaian
//           terbaru dikirim di header X-TTS-Usage
//
// Khusus akun announcer/admin. Karakter yang dikirim ke Google dibatasi per
// hari & per bulan (GOOGLE_TTS_DAILY_CHAR_LIMIT / _MONTHLY_CHAR_LIMIT) lewat
// RPC di supabase/migrations/0017_announcer_tts.sql. Default bulanan 1 juta =
// perkiraan kuota gratis Chirp 3 HD (cek halaman harga Google). Kalau
// ditolak/gagal, client memakai suara cadangan - pengumuman tetap jalan.

import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";

const API_KEY = process.env.GOOGLE_TTS_API_KEY;
const DAILY_CHAR_LIMIT =
  Number(process.env.GOOGLE_TTS_DAILY_CHAR_LIMIT) || 30_000;
const MONTHLY_CHAR_LIMIT =
  Number(process.env.GOOGLE_TTS_MONTHLY_CHAR_LIMIT) || 1_000_000;
const TTS_BASE = "https://texttospeech.googleapis.com/v1";
const MAX_TEXT_LENGTH = 300;
// Cuma suara Bahasa Indonesia.
const VOICE_NAME = /^id-ID-[A-Za-z0-9-]+$/;

type GoogleVoice = { name: string; gender: string };
type Usage = {
  today: number;
  month: number;
  dailyLimit: number;
  monthlyLimit: number;
};

// Daftar suara jarang berubah - cukup diambil sekali sehari per instance.
const VOICES_TTL_MS = 24 * 60 * 60 * 1000;
let voicesCache: { at: number; voices: GoogleVoice[] } | null = null;

// Kalimat yang sama dalam waktu dekat (mis. 2 PC announcer di lokasi yang
// sama) tidak memanggil Google dua kali.
const AUDIO_TTL_MS = 10 * 60 * 1000;
const AUDIO_CACHE_MAX = 50;
const audioCache = new Map<string, { at: number; audio: Buffer }>();

const clamp = (v: number, min: number, max: number) =>
  Math.min(max, Math.max(min, v));

const json = (body: object, status = 200) =>
  NextResponse.json(body, { status });

const toUsage = (row: { today?: number; month?: number }): Usage => ({
  today: Number(row.today) || 0,
  month: Number(row.month) || 0,
  dailyLimit: DAILY_CHAR_LIMIT,
  monthlyLimit: MONTHLY_CHAR_LIMIT,
});

async function isAnnouncerOrAdmin() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return false;
  const { data } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .single();
  return data?.role === "announcer" || data?.role === "admin";
}

async function googleErrorMessage(res: Response) {
  try {
    const body = await res.json();
    return body?.error?.message || `Google TTS HTTP ${res.status}`;
  } catch {
    return `Google TTS HTTP ${res.status}`;
  }
}

async function getUsage(): Promise<Usage | null> {
  const { data, error } = await createAdminClient().rpc(
    "get_announcer_tts_usage",
  );
  if (error) {
    console.error("[announcer/tts] Gagal baca pemakaian:", error.message);
    return null;
  }
  return toUsage(data ?? {});
}

/**
 * Catat pemakaian sebelum memanggil Google. Kalau RPC gagal (mis. migrasi
 * 0017 belum dijalankan) TTS tetap jalan - batas kuota di GCP Console tetap
 * berlaku - tapi sisa kuota tidak bisa ditampilkan.
 */
async function consumeQuota(
  chars: number,
): Promise<{ ok: boolean; reason: string | null; usage: Usage | null }> {
  const { data, error } = await createAdminClient().rpc(
    "consume_announcer_tts_chars",
    {
      p_chars: chars,
      p_daily_limit: DAILY_CHAR_LIMIT,
      p_monthly_limit: MONTHLY_CHAR_LIMIT,
    },
  );
  if (error) {
    console.error("[announcer/tts] Gagal cek kuota:", error.message);
    return { ok: true, reason: null, usage: null };
  }
  return { ok: !!data?.ok, reason: data?.reason ?? null, usage: toUsage(data) };
}

export async function GET() {
  if (!API_KEY) return json({ error: "not_configured" }, 503);
  if (!(await isAnnouncerOrAdmin())) return json({ error: "forbidden" }, 403);

  if (!voicesCache || Date.now() - voicesCache.at > VOICES_TTL_MS) {
    const res = await fetch(`${TTS_BASE}/voices?languageCode=id-ID`, {
      headers: { "X-Goog-Api-Key": API_KEY },
    });
    if (!res.ok) return json({ error: await googleErrorMessage(res) }, 502);
    const body = await res.json();
    voicesCache = {
      at: Date.now(),
      voices: (body.voices ?? [])
        .filter((v: any) => VOICE_NAME.test(v.name))
        .map((v: any) => ({ name: v.name, gender: v.ssmlGender })),
    };
  }

  return json({ voices: voicesCache.voices, usage: await getUsage() });
}

export async function POST(request: Request) {
  if (!API_KEY) return json({ error: "not_configured" }, 503);
  if (!(await isAnnouncerOrAdmin())) return json({ error: "forbidden" }, 403);

  let payload: Record<string, unknown>;
  try {
    payload = await request.json();
  } catch {
    return json({ error: "Invalid JSON body." }, 400);
  }

  const text = String(payload.text ?? "").trim();
  const voice = String(payload.voice ?? "");
  if (!text || text.length > MAX_TEXT_LENGTH || !VOICE_NAME.test(voice)) {
    return json({ error: "Teks atau suara tidak valid." }, 400);
  }
  const speakingRate = clamp(Number(payload.rate) || 1, 0.25, 2);
  // Suara Chirp 3 HD menolak parameter pitch (HTTP 400).
  const pitch = voice.includes("Chirp")
    ? 0
    : clamp(Number(payload.pitch) || 0, -20, 20);

  const cacheKey = `${voice}|${speakingRate}|${pitch}|${text}`;
  const cached = audioCache.get(cacheKey);
  if (cached && Date.now() - cached.at < AUDIO_TTL_MS) {
    return audioResponse(cached.audio, null);
  }

  const quota = await consumeQuota(text.length);
  if (!quota.ok) {
    return json({ error: quota.reason, usage: quota.usage }, 429);
  }

  const res = await fetch(`${TTS_BASE}/text:synthesize`, {
    method: "POST",
    headers: { "X-Goog-Api-Key": API_KEY, "Content-Type": "application/json" },
    body: JSON.stringify({
      input: { text },
      voice: { languageCode: "id-ID", name: voice },
      audioConfig: {
        audioEncoding: "MP3",
        speakingRate,
        ...(pitch ? { pitch } : {}),
      },
    }),
  });
  if (!res.ok) {
    const message = await googleErrorMessage(res);
    console.error("[announcer/tts] Synthesize gagal:", message);
    return json({ error: message, usage: quota.usage }, 502);
  }

  const { audioContent } = await res.json();
  const audio = Buffer.from(audioContent, "base64");

  audioCache.set(cacheKey, { at: Date.now(), audio });
  if (audioCache.size > AUDIO_CACHE_MAX) {
    audioCache.delete(audioCache.keys().next().value!);
  }

  return audioResponse(audio, quota.usage);
}

function audioResponse(audio: Buffer, usage: Usage | null) {
  const headers: Record<string, string> = {
    "Content-Type": "audio/mpeg",
    "Cache-Control": "private, no-store",
  };
  if (usage) headers["X-TTS-Usage"] = JSON.stringify(usage);
  return new NextResponse(new Uint8Array(audio), { headers });
}
