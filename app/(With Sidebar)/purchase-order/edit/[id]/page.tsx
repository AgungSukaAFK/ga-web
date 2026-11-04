// src/app/(With Sidebar)/purchase-order/edit/[id]/page.tsx

import { redirect } from "next/navigation";

// Edit PO sekarang terpusat di dokumen management admin
// (po-management/edit/[id]). Rute lama diarahkan ke detail PO supaya link lama
// tidak jadi 404.
export default async function EditPOPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  redirect(`/purchase-order/${id}`);
}
