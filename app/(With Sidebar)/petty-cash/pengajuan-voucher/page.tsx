import { Suspense } from "react";
import PengajuanVoucherClient from "./PengajuanVoucherClient";

export default function PengajuanVoucherPage() {
  return (
    <Suspense>
      <PengajuanVoucherClient />
    </Suspense>
  );
}
