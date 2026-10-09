import {
  Atkinson_Hyperlegible,
  Geist,
  Inter,
  Nunito,
  Plus_Jakarta_Sans,
  Poppins,
  Roboto,
} from "next/font/google";

// Font default di-preload; sisanya hanya diunduh browser kalau dipilih user.
const geist = Geist({
  variable: "--font-geist-sans",
  display: "swap",
  subsets: ["latin"],
});
const inter = Inter({
  variable: "--font-inter",
  display: "swap",
  subsets: ["latin"],
  preload: false,
});
const jakarta = Plus_Jakarta_Sans({
  variable: "--font-jakarta",
  display: "swap",
  subsets: ["latin"],
  preload: false,
});
const poppins = Poppins({
  variable: "--font-poppins",
  display: "swap",
  subsets: ["latin"],
  weight: ["300", "400", "500", "600", "700"],
  preload: false,
});
const nunito = Nunito({
  variable: "--font-nunito",
  display: "swap",
  subsets: ["latin"],
  preload: false,
});
const roboto = Roboto({
  variable: "--font-roboto",
  display: "swap",
  subsets: ["latin"],
  preload: false,
});
const atkinson = Atkinson_Hyperlegible({
  variable: "--font-atkinson",
  display: "swap",
  subsets: ["latin"],
  weight: ["400", "700"],
  preload: false,
});

export const fontVariables = [
  geist,
  inter,
  jakarta,
  poppins,
  nunito,
  roboto,
  atkinson,
]
  .map((f) => f.variable)
  .join(" ");
