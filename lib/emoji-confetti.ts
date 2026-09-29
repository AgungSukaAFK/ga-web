// src/lib/emoji-confetti.ts
//
// Efek konfetti "stiker" emoji buat reaction Update Web - dua meriam di pojok
// kiri-bawah & kanan-bawah layar menembak emoji yang dipilih + serpihan
// kertas warna-warni. Lintasannya: melesat cepat -> melambat & menyebar
// (hambatan udara) -> jatuh pelan sambil bergoyang & berputar ala kertas.
//
// Tanpa library: 1 <canvas> fixed full-screen (pointer-events none) yang
// dipakai bareng oleh semua ledakan & dilepas otomatis saat partikel habis.
// Emoji di-render sekali ke sprite offscreen (plus bayangan halus) supaya
// tiap frame cuma drawImage, bukan fillText. Parameter fisika sudah dituning
// relatif ke tinggi layar supaya terasa sama di HP maupun desktop.

type Side = "left" | "right";

interface Particle {
  kind: "emoji" | "paper";
  sprite?: HTMLCanvasElement;
  color?: string;
  x: number;
  y: number;
  vx: number;
  vy: number;
  size: number;
  drag: number;
  gravity: number;
  rot: number;
  vrot: number;
  flipPhase: number;
  flipSpeed: number;
  swayPhase: number;
  swaySpeed: number;
  swayAmp: number;
  age: number;
  delay: number;
  life: number;
}

const PAPER_COLORS = [
  "#FFD166",
  "#EF476F",
  "#06D6A0",
  "#118AB2",
  "#F78C6B",
  "#B388EB",
  "#FF8FAB",
  "#FFE66D",
];

const EMOJI_PER_SIDE = 26;
const PAPER_PER_SIDE = 30;
const SPRITE_PX = 96;
const FADE_SECONDS = 0.7;

let canvas: HTMLCanvasElement | null = null;
let ctx: CanvasRenderingContext2D | null = null;
let particles: Particle[] = [];
let rafId: number | null = null;
let lastTime = 0;
let dpr = 1;
const spriteCache = new Map<string, HTMLCanvasElement>();

const rand = (min: number, max: number) => min + Math.random() * (max - min);

function getSprite(emoji: string): HTMLCanvasElement {
  const cached = spriteCache.get(emoji);
  if (cached) return cached;
  const px = SPRITE_PX;
  const pad = px * 0.25;
  const c = document.createElement("canvas");
  c.width = c.height = px + pad * 2;
  const g = c.getContext("2d")!;
  g.font = `${px * 0.8}px "Apple Color Emoji","Segoe UI Emoji","Noto Color Emoji",sans-serif`;
  g.textAlign = "center";
  g.textBaseline = "middle";
  g.shadowColor = "rgba(0,0,0,0.22)";
  g.shadowBlur = px * 0.08;
  g.shadowOffsetY = px * 0.04;
  g.fillText(emoji, c.width / 2, c.height / 2 + px * 0.04);
  spriteCache.set(emoji, c);
  return c;
}

function resize() {
  if (!canvas) return;
  dpr = Math.min(window.devicePixelRatio || 1, 2);
  canvas.width = Math.round(window.innerWidth * dpr);
  canvas.height = Math.round(window.innerHeight * dpr);
}

function ensureCanvas() {
  if (canvas) return;
  canvas = document.createElement("canvas");
  canvas.setAttribute("aria-hidden", "true");
  Object.assign(canvas.style, {
    position: "fixed",
    inset: "0",
    width: "100vw",
    height: "100vh",
    pointerEvents: "none",
    zIndex: "2147483000",
  } satisfies Partial<CSSStyleDeclaration>);
  document.body.appendChild(canvas);
  ctx = canvas.getContext("2d");
  resize();
  window.addEventListener("resize", resize);
}

function teardown() {
  if (rafId !== null) cancelAnimationFrame(rafId);
  rafId = null;
  window.removeEventListener("resize", resize);
  canvas?.remove();
  canvas = null;
  ctx = null;
  particles = [];
}

function spawn(side: Side, sprites: HTMLCanvasElement[]) {
  const W = window.innerWidth;
  const H = window.innerHeight;
  // Layar lebar -> sebaran horizontal lebih jauh; HP portrait -> lebih tegak.
  const widthFactor = Math.min(1.5, Math.max(0.6, W / H));
  const dir = side === "left" ? 1 : -1;
  const originX = side === "left" ? 0 : W;

  const make = (kind: Particle["kind"]): Particle => {
    // Sudut dari horizontal, mengarah ke tengah layar.
    const angle = (rand(48, 80) * Math.PI) / 180;
    const speed = H * rand(2.2, 3.4);
    const isEmoji = kind === "emoji";
    return {
      kind,
      sprite: isEmoji
        ? sprites[Math.floor(Math.random() * sprites.length)]
        : undefined,
      color: isEmoji
        ? undefined
        : PAPER_COLORS[Math.floor(Math.random() * PAPER_COLORS.length)],
      x: originX + dir * rand(-10, 30),
      y: H + rand(5, 25),
      vx: dir * Math.cos(angle) * speed * widthFactor,
      vy: -Math.sin(angle) * speed,
      size: isEmoji ? rand(22, 46) : rand(9, 15),
      // Kertas lebih "melayang" (hambatan lebih besar, jatuh lebih pelan).
      drag: isEmoji ? rand(3.2, 3.6) : rand(3.9, 4.6),
      gravity: H * (isEmoji ? 0.55 : 0.5),
      rot: rand(0, Math.PI * 2),
      vrot: rand(-6, 6),
      flipPhase: rand(0, Math.PI * 2),
      flipSpeed: isEmoji ? rand(2, 4) : rand(6, 12),
      swayPhase: rand(0, Math.PI * 2),
      swaySpeed: rand(1.5, 3),
      swayAmp: isEmoji ? rand(20, 45) : rand(35, 70),
      age: 0,
      // Ditembak beruntun dalam ~0.2 dtk, terasa seperti "dor!" bukan
      // satu gumpalan statis.
      delay: Math.pow(Math.random(), 1.6) * 0.22,
      life: rand(4.2, 6),
    };
  };

  for (let i = 0; i < EMOJI_PER_SIDE; i++) particles.push(make("emoji"));
  for (let i = 0; i < PAPER_PER_SIDE; i++) particles.push(make("paper"));
}

// easeOutBack - efek "pop" kecil saat stiker muncul.
function popScale(t: number) {
  if (t >= 1) return 1;
  const c1 = 1.9;
  const c3 = c1 + 1;
  return 1 + c3 * Math.pow(t - 1, 3) + c1 * Math.pow(t - 1, 2);
}

function step(now: number) {
  if (!ctx || !canvas) return;
  // Clamp dt supaya tab yang sempat di-background tidak bikin lompatan.
  const dt = Math.min(0.033, (now - lastTime) / 1000 || 0.016);
  lastTime = now;
  const H = window.innerHeight;

  ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

  const alive: Particle[] = [];
  for (const p of particles) {
    if (p.delay > 0) {
      p.delay -= dt;
      alive.push(p);
      continue;
    }
    p.age += dt;

    // Hambatan udara eksponensial + gravitasi -> terminal velocity
    // gravity/drag, jadi jatuhnya pelan & natural.
    const k = Math.exp(-p.drag * dt);
    p.vx *= k;
    p.vy = p.vy * k + p.gravity * dt;
    // Goyangan kiri-kanan makin terasa saat sudah mulai jatuh.
    const falling = Math.min(1, Math.max(0, p.vy / (p.gravity / p.drag)));
    const sway =
      Math.cos(p.age * p.swaySpeed + p.swayPhase) * p.swayAmp * falling;
    p.x += (p.vx + sway) * dt;
    p.y += p.vy * dt;
    p.vrot *= Math.exp(-0.6 * dt);
    p.rot += p.vrot * dt;

    if (p.age > p.life || p.y > H + 80) continue;
    alive.push(p);

    const fadeStart = p.life - FADE_SECONDS;
    const alpha =
      p.age > fadeStart ? Math.max(0, 1 - (p.age - fadeStart) / FADE_SECONDS) : 1;
    const flip = Math.cos(p.age * p.flipSpeed + p.flipPhase);
    const pop = popScale(Math.min(1, p.age / 0.28));

    ctx.save();
    ctx.globalAlpha = alpha;
    ctx.translate(p.x, p.y);
    ctx.rotate(p.rot);

    if (p.kind === "emoji" && p.sprite) {
      // Wobble halus (bukan flip penuh) supaya emoji tetap terbaca.
      const sx = (0.78 + 0.22 * flip) * pop;
      const sy = (0.94 + 0.06 * Math.sin(p.age * p.flipSpeed)) * pop;
      ctx.scale(sx, sy);
      const drawSize = p.size * (p.sprite.width / SPRITE_PX);
      ctx.drawImage(p.sprite, -drawSize / 2, -drawSize / 2, drawSize, drawSize);
    } else if (p.color) {
      // Kertas: flip 3D penuh + kilap saat menghadap cahaya.
      ctx.scale(flip * pop, pop);
      const w = p.size;
      const h = p.size * 0.55;
      ctx.fillStyle = p.color;
      ctx.beginPath();
      ctx.roundRect(-w / 2, -h / 2, w, h, h * 0.25);
      ctx.fill();
      const shine = Math.max(0, flip) * 0.35;
      if (shine > 0.02) {
        ctx.fillStyle = `rgba(255,255,255,${shine})`;
        ctx.fill();
      }
    }
    ctx.restore();
  }
  particles = alive;

  if (particles.length === 0) {
    teardown();
    return;
  }
  rafId = requestAnimationFrame(step);
}

// `emoji` boleh array -> tiap stiker diambil acak dari daftar itu.
export function fireEmojiConfetti(emoji: string | string[]) {
  if (typeof window === "undefined") return;
  if (window.matchMedia?.("(prefers-reduced-motion: reduce)").matches) return;

  ensureCanvas();
  const sprites = (Array.isArray(emoji) ? emoji : [emoji]).map(getSprite);
  spawn("left", sprites);
  spawn("right", sprites);

  if (rafId === null) {
    lastTime = performance.now();
    rafId = requestAnimationFrame(step);
  }
}
