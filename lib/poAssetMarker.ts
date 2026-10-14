// Sisipkan/lepas segmen "AST" tepat setelah segmen "PO" pada kode_po, sebagai
// penanda visual PO Asset. Nomor urutnya TETAP satu rangkaian dengan PO
// biasa (bukan counter terpisah) - segmen ini murni penanda, dilakukan
// client-side (string manipulation) supaya tidak perlu fetch ulang nomor
// urut ke server. Dipakai di halaman Buat PO & Edit PO.
export const withAssetMarker = (kodePo: string, isAsset: boolean): string => {
  const parts = kodePo.split("/");
  const poIdx = parts.indexOf("PO");
  if (poIdx === -1) return kodePo;
  const hasMarker = parts[poIdx + 1] === "AST";
  if (isAsset && !hasMarker) {
    parts.splice(poIdx + 1, 0, "AST");
  } else if (!isAsset && hasMarker) {
    parts.splice(poIdx + 1, 1);
  }
  return parts.join("/");
};
