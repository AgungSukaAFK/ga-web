// navigator.clipboard cuma ada di secure context (https/localhost) - kalau
// app dibuka lewat IP LAN (http), jatuh ke execCommand("copy").
export async function writeClipboard(text: string) {
  if (navigator.clipboard?.writeText) {
    try {
      await navigator.clipboard.writeText(text);
      return;
    } catch {
      // Ditolak browser (mis. izin / dokumen tidak fokus) - coba cara lama.
    }
  }
  copyWithExecCommand(text);
}

function copyWithExecCommand(text: string) {
  // Teks ditulis lewat event `copy`, bukan dari seleksi textarea: focus trap
  // Dialog bisa menarik fokus balik, seleksinya hilang, tapi execCommand tetap
  // mengembalikan true sehingga tombol terlihat sukses padahal tidak tersalin.
  let written = false;
  const onCopy = (e: ClipboardEvent) => {
    e.clipboardData?.setData("text/plain", text);
    e.preventDefault();
    written = true;
  };

  const previousFocus = document.activeElement;
  const textarea = document.createElement("textarea");
  textarea.value = text;
  textarea.setAttribute("readonly", "");
  textarea.style.position = "fixed";
  textarea.style.opacity = "0";
  document.body.appendChild(textarea);
  document.addEventListener("copy", onCopy, true);
  textarea.focus({ preventScroll: true });
  textarea.select();
  const ok = document.execCommand("copy");
  document.removeEventListener("copy", onCopy, true);
  textarea.remove();
  if (previousFocus instanceof HTMLElement) {
    previousFocus.focus({ preventScroll: true });
  }
  if (!ok || !written) throw new Error("copy failed");
}
