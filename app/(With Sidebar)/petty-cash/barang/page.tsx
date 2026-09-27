// src/app/(With Sidebar)/petty-cash/barang/page.tsx

import { Suspense } from "react";
import PettyCashBarangClient from "./PettyCashBarangClient";

export default function BarangPettyCashPage() {
  return (
    <Suspense>
      <PettyCashBarangClient />
    </Suspense>
  );
}
