// src/app/announcer/page.tsx
//
// Sengaja di luar "(With Sidebar)": layar penuh untuk PC announcer, akun
// role `announcer` tidak punya menu lain (lihat redirect di
// app/(With Sidebar)/layout.tsx).

import type { Metadata } from "next";
import AnnouncerClient from "./AnnouncerClient";

export const metadata: Metadata = {
  title: "Announcer Follow-up | Garuda Procure",
};

export default function AnnouncerPage() {
  return <AnnouncerClient />;
}
