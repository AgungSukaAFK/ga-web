// src/app/(With Sidebar)/po-management/edit/[id]/PoManagementClientContent.tsx

"use client";

import { use } from "react";
import { PoEditForm } from "@/app/(With Sidebar)/purchase-order/edit/PoEditForm";

// Form-nya dipakai bersama dengan Edit PO dari detail PO
// (purchase-order/edit/[id]) - mode "admin" menambah kontrol Status PO,
// status Jalur Approval & edit bebas item. Cek role admin ada di PoEditForm.
export function PoManagementEditClientContent({
  params: paramsPromise,
}: {
  params: Promise<{ id: string }>;
}) {
  const params = use(paramsPromise);
  return <PoEditForm poId={parseInt(params.id)} mode="admin" />;
}
