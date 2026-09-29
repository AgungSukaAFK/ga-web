"use client";

// Foto profil di sapaan dashboard. Tiap klik ganti bentuk: bulat -> kotak
// rounded -> kotak tajam -> bulat (dianimasikan, bentuk terakhir diingat per
// browser). Easter egg: klik 5x dalam < 2 detik -> hujan konfetti emoji acak
// + modal.

import { useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { UserAvatar } from "@/components/user-avatar";
import { fireEmojiConfetti } from "@/lib/emoji-confetti";

const SHAPES = [
  { key: "circle", radius: "50%", label: "bulat" },
  { key: "rounded", radius: "24%", label: "kotak rounded" },
  { key: "square", radius: "0px", label: "kotak tajam" },
] as const;

const STORAGE_KEY = "dashboard-avatar-shape";
const EASTER_EGG_CLICKS = 5;
const EASTER_EGG_WINDOW_MS = 2000;

const EMOJI_POOL = [
  "🎉",
  "🥳",
  "🎊",
  "✨",
  "🔥",
  "🚀",
  "😆",
  "🤩",
  "😎",
  "🫶",
  "💯",
  "🌈",
  "⭐",
  "🍕",
  "🍩",
  "🎈",
  "🦄",
  "🐣",
  "🍀",
  "💥",
  "🤪",
  "😂",
  "👑",
  "💎",
  "🍿",
  "🎯",
  "🪩",
  "🧃",
  "🐱",
  "🦖",
];

const EASTER_EGG_MESSAGES = [
  {
    title: "Wah, semangat banget ngekliknya! 🤩",
    desc: "Fotomu diklik 5 kali dalam kurang dari 2 detik. Energi ini cocok buat approve MR yang numpuk. 😄",
  },
  {
    title: "Easter egg ditemukan! 🥳",
    desc: "Selamat, kamu menemukan rahasia kecil di dashboard. Jangan bilang siapa-siapa ya. 🤫",
  },
  {
    title: "Pelan-pelan, bos! 😆",
    desc: "Fotonya nggak ke mana-mana kok. Tapi karena sudah usaha, ini konfetti buat kamu. 🎉",
  },
];

function pickEmojis(count: number) {
  const pool = [...EMOJI_POOL];
  for (let i = pool.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [pool[i], pool[j]] = [pool[j], pool[i]];
  }
  return pool.slice(0, count);
}

type Props = {
  userId?: string | null;
  name?: string | null;
  src?: string | null;
};

export function DashboardProfileAvatar({ userId, name, src }: Props) {
  const [shapeIndex, setShapeIndex] = useState(0);
  const [eggOpen, setEggOpen] = useState(false);
  const [message, setMessage] = useState(EASTER_EGG_MESSAGES[0]);
  const buttonRef = useRef<HTMLButtonElement>(null);
  const clicks = useRef<number[]>([]);

  useEffect(() => {
    try {
      const saved = SHAPES.findIndex(
        (s) => s.key === localStorage.getItem(STORAGE_KEY),
      );
      if (saved >= 0) setShapeIndex(saved);
    } catch {
      // localStorage bisa diblok browser - pakai default bulat.
    }
  }, []);

  const celebrate = () => {
    fireEmojiConfetti(pickEmojis(8));
  };

  const handleClick = () => {
    const next = (shapeIndex + 1) % SHAPES.length;
    setShapeIndex(next);
    try {
      localStorage.setItem(STORAGE_KEY, SHAPES[next].key);
    } catch {}

    // Efek "squish" kecil saat berubah bentuk.
    if (!window.matchMedia?.("(prefers-reduced-motion: reduce)").matches) {
      buttonRef.current?.animate(
        [
          { transform: "scale(1) rotate(0deg)" },
          { transform: "scale(0.82) rotate(-8deg)", offset: 0.35 },
          { transform: "scale(1.08) rotate(4deg)", offset: 0.7 },
          { transform: "scale(1) rotate(0deg)" },
        ],
        { duration: 450, easing: "ease-out" },
      );
    }

    const now = Date.now();
    clicks.current = [
      ...clicks.current.filter((t) => now - t < EASTER_EGG_WINDOW_MS),
      now,
    ];
    if (clicks.current.length >= EASTER_EGG_CLICKS) {
      clicks.current = [];
      setMessage(
        EASTER_EGG_MESSAGES[
          Math.floor(Math.random() * EASTER_EGG_MESSAGES.length)
        ],
      );
      setEggOpen(true);
      celebrate();
    }
  };

  const shape = SHAPES[shapeIndex];
  const radiusStyle = {
    borderRadius: shape.radius,
    transition: "border-radius 400ms cubic-bezier(0.34, 1.56, 0.64, 1)",
  };

  return (
    <>
      <button
        ref={buttonRef}
        type="button"
        onClick={handleClick}
        aria-label={`Foto profil (bentuk ${shape.label}). Klik untuk ubah bentuk.`}
        title="Klik untuk ubah bentuk"
        className="shrink-0 cursor-pointer select-none outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
        style={radiusStyle}
      >
        <UserAvatar
          userId={userId}
          name={name}
          src={src}
          className="h-14 w-14 border shadow-sm sm:h-16 sm:w-16"
          fallbackClassName="text-lg font-semibold"
          style={radiusStyle}
          profileCard={false}
        />
      </button>

      <Dialog open={eggOpen} onOpenChange={setEggOpen}>
        {/* Hanya bisa ditutup lewat tombol, bukan klik di luar / Escape. */}
        <DialogContent
          className="p-8 sm:max-w-xl"
          onInteractOutside={(e) => e.preventDefault()}
          onEscapeKeyDown={(e) => e.preventDefault()}
        >
          <DialogHeader className="items-center gap-3 text-center sm:text-center">
            <UserAvatar
              userId={userId}
              name={name}
              src={src}
              className="mb-2 h-36 w-36 border shadow-md sm:h-40 sm:w-40"
              fallbackClassName="text-5xl font-semibold"
              style={radiusStyle}
              profileCard={false}
            />
            <DialogTitle className="text-2xl sm:text-3xl">
              {message.title}
            </DialogTitle>
            <DialogDescription className="text-base">
              {message.desc}
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="mt-2 gap-2 sm:justify-center">
            <Button size="lg" variant="outline" onClick={celebrate}>
              Lagi! 🎉
            </Button>
            <Button size="lg" onClick={() => setEggOpen(false)}>
              Tutup
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
