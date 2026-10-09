// Helper client-side untuk foto barang dari kamera di halaman scan QR
// (/goods-receipt/[token]) - label device, alamat dari koordinat, dan
// watermark timestamp yang dicetak langsung ke fotonya.

// Browser TIDAK bisa baca nama device asli (mis. "HP Budi") - yang bisa
// cuma merk/model/OS/browser. Chromium (Android) kasih model lewat
// userAgentData high-entropy; Safari/Firefox fallback parse user agent.
export async function getDeviceLabel(): Promise<string> {
  const nav = navigator as Navigator & {
    userAgentData?: {
      brands?: { brand: string; version: string }[];
      getHighEntropyValues?: (
        hints: string[],
      ) => Promise<{ model?: string; platform?: string; platformVersion?: string }>;
    };
  };
  const ua = navigator.userAgent;

  if (nav.userAgentData?.getHighEntropyValues) {
    try {
      const hv = await nav.userAgentData.getHighEntropyValues([
        "model",
        "platform",
        "platformVersion",
      ]);
      const brand = nav.userAgentData.brands?.find(
        (b) => !/not.?a.?brand|chromium/i.test(b.brand),
      );
      const osVersion =
        hv.platform === "Android"
          ? hv.platformVersion?.split(".")[0]
          : hv.platformVersion;
      return [
        hv.model,
        [hv.platform, osVersion].filter(Boolean).join(" "),
        brand?.brand,
      ]
        .filter(Boolean)
        .join(" · ");
    } catch {
      // lanjut ke fallback user agent
    }
  }

  const ios = ua.match(/(iPhone|iPad|iPod).*?OS (\d+)[_.](\d+)/);
  if (ios) return `${ios[1]} · iOS ${ios[2]}.${ios[3]} · Safari`;
  const android = ua.match(/Android ([\d.]+);\s*([^;)]+)/);
  if (android) {
    const model = android[2].trim() === "K" ? "" : android[2].trim();
    return [model, `Android ${android[1]}`].filter(Boolean).join(" · ");
  }
  if (/Windows/.test(ua)) return "Windows";
  if (/Mac OS X/.test(ua)) return "macOS";
  return ua.slice(0, 120);
}

// Alamat dari koordinat pakai OpenStreetMap Nominatim (gratis, tanpa API
// key, max ~1 request/detik - cukup karena dipanggil sekali per halaman).
// Gagal = null, koordinat tetap jadi sumber utama lokasi.
export async function reverseGeocode(
  lat: number,
  lng: number,
): Promise<string | null> {
  try {
    const res = await fetch(
      `https://nominatim.openstreetmap.org/reverse?format=jsonv2&lat=${lat}&lon=${lng}&zoom=18&accept-language=id`,
      { headers: { Accept: "application/json" } },
    );
    if (!res.ok) return null;
    const data = await res.json();
    return typeof data?.display_name === "string" ? data.display_name : null;
  } catch {
    return null;
  }
}

export function formatStampTime(date: Date): string {
  return date.toLocaleString("id-ID", {
    weekday: "short",
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    timeZoneName: "short",
  });
}

function wrapLine(
  ctx: CanvasRenderingContext2D,
  text: string,
  maxWidth: number,
): string[] {
  const words = text.split(" ");
  const lines: string[] = [];
  let current = "";
  for (const word of words) {
    const next = current ? `${current} ${word}` : word;
    if (ctx.measureText(next).width > maxWidth && current) {
      lines.push(current);
      current = word;
    } else {
      current = next;
    }
  }
  if (current) lines.push(current);
  return lines;
}

// Cetak blok teks semi-transparan di bagian bawah foto (gaya aplikasi
// "Timestamp Camera"). Baris pertama (waktu) ditebalkan.
export function drawStamp(canvas: HTMLCanvasElement, lines: string[]) {
  const ctx = canvas.getContext("2d");
  if (!ctx) return;

  const fontSize = Math.max(14, Math.round(canvas.width * 0.026));
  const lineHeight = Math.round(fontSize * 1.3);
  const padding = Math.round(fontSize * 0.8);
  const maxTextWidth = canvas.width - padding * 2;

  const rendered: { text: string; bold: boolean }[] = [];
  lines.forEach((line, i) => {
    ctx.font = `${i === 0 ? "bold " : ""}${fontSize}px sans-serif`;
    for (const part of wrapLine(ctx, line, maxTextWidth)) {
      rendered.push({ text: part, bold: i === 0 });
    }
  });

  const boxHeight = rendered.length * lineHeight + padding * 2;
  ctx.fillStyle = "rgba(0, 0, 0, 0.55)";
  ctx.fillRect(0, canvas.height - boxHeight, canvas.width, boxHeight);

  ctx.fillStyle = "#ffffff";
  ctx.textBaseline = "top";
  rendered.forEach((r, i) => {
    ctx.font = `${r.bold ? "bold " : ""}${fontSize}px sans-serif`;
    ctx.fillText(
      r.text,
      padding,
      canvas.height - boxHeight + padding + i * lineHeight,
    );
  });
}
