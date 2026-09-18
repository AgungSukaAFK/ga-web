"use server";

// Pencarian GIF pakai Tenor API v2 (gratis, dapat API key di
// https://developers.google.com/tenor/guides/quickstart lalu diset sebagai
// TENOR_API_KEY di .env). Key ini server-only (bukan NEXT_PUBLIC) supaya
// tidak kelihatan di bundle client.
const TENOR_BASE_URL = "https://tenor.googleapis.com/v2";
const CLIENT_KEY = "ga-web-discussion";

export interface GifResult {
  id: string;
  url: string;
  previewUrl: string;
}

type GifSearchResponse =
  | { success: true; results: GifResult[] }
  | { success: false; message: string };

function mapResults(results: any[]): GifResult[] {
  return results
    .map((item) => {
      const gif = item.media_formats?.gif?.url;
      const preview =
        item.media_formats?.tinygif?.url ??
        item.media_formats?.nanogif?.url ??
        gif;
      if (!gif || !preview) return null;
      return { id: item.id as string, url: gif as string, previewUrl: preview as string };
    })
    .filter((r): r is GifResult => r !== null);
}

// query kosong -> tampilkan GIF trending (endpoint /featured Tenor).
export async function searchGifs(query: string): Promise<GifSearchResponse> {
  const apiKey = process.env.TENOR_API_KEY;
  if (!apiKey) {
    return {
      success: false,
      message: "Fitur GIF belum aktif (TENOR_API_KEY belum diset di .env).",
    };
  }

  const endpoint = query.trim() ? "search" : "featured";
  const params = new URLSearchParams({
    key: apiKey,
    client_key: CLIENT_KEY,
    limit: "24",
    media_filter: "gif,tinygif,nanogif",
    contentfilter: "high",
  });
  if (query.trim()) params.set("q", query.trim());

  try {
    const res = await fetch(`${TENOR_BASE_URL}/${endpoint}?${params.toString()}`, {
      cache: "no-store",
    });
    if (!res.ok) {
      return { success: false, message: `Gagal memuat GIF (${res.status}).` };
    }
    const data = await res.json();
    return { success: true, results: mapResults(data.results ?? []) };
  } catch (error: any) {
    return {
      success: false,
      message: error?.message || "Gagal memuat GIF. Periksa koneksi internet.",
    };
  }
}
