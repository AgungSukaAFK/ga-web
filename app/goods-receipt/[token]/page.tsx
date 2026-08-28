"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import {
  fetchGoodsReceiptView,
  verifyGoodsReceiptCode,
  submitGoodsReceipt,
  GoodsReceiptView,
} from "@/services/goodsReceiptService";
import { getAttachmentSizeError } from "@/lib/attachments";
import { uploadAttachmentDirectPublic } from "@/lib/uploadDirect";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { toast } from "sonner";
import { CheckCircle2, Loader2, PackageCheck, ScanLine } from "lucide-react";

type Phase =
  | "loading"
  | "not_found"
  | "already_received"
  | "auth"
  | "form"
  | "success";

interface ItemInput {
  qty: string;
  photo: File | null;
}

export default function GoodsReceiptPage() {
  const params = useParams();
  const token = params.token as string;

  const [phase, setPhase] = useState<Phase>("loading");
  const [view, setView] = useState<GoodsReceiptView | null>(null);

  const [sessionNama, setSessionNama] = useState<string | null>(null);

  const [codeInput, setCodeInput] = useState("");
  const [nameInput, setNameInput] = useState("");
  const [authError, setAuthError] = useState<string | null>(null);
  const [verifyingCode, setVerifyingCode] = useState(false);

  const [itemInputs, setItemInputs] = useState<Record<string, ItemInput>>({});
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    const load = async () => {
      const result = await fetchGoodsReceiptView(token);
      if (!result) {
        setPhase("not_found");
        return;
      }
      setView(result);

      if (result.already_received) {
        setPhase("already_received");
        return;
      }

      setItemInputs(
        Object.fromEntries(
          result.items.map((item) => [
            item.part_number,
            { qty: String(item.qty_dikirim), photo: null },
          ]),
        ),
      );

      const supabase = createClient();
      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (user) {
        const { data: profile } = await supabase
          .from("profiles")
          .select("nama")
          .eq("id", user.id)
          .single();
        setSessionNama(profile?.nama || user.email || "Anda");
        setPhase("form");
      } else {
        setPhase("auth");
      }
    };
    load();
  }, [token]);

  const handleVerifyCode = async () => {
    setAuthError(null);
    if (!nameInput.trim()) {
      setAuthError("Nama lengkap wajib diisi.");
      return;
    }
    if (!codeInput.trim()) {
      setAuthError("Kode global wajib diisi.");
      return;
    }
    setVerifyingCode(true);
    try {
      const valid = await verifyGoodsReceiptCode(codeInput.trim());
      if (!valid) {
        setAuthError("Kode global salah. Coba lagi.");
        return;
      }
      setPhase("form");
    } finally {
      setVerifyingCode(false);
    }
  };

  const updateItemQty = (partNumber: string, qty: string) => {
    setItemInputs((prev) => ({ ...prev, [partNumber]: { ...prev[partNumber], qty } }));
  };

  const updateItemPhoto = (partNumber: string, file: File | null) => {
    if (file) {
      const sizeError = getAttachmentSizeError(file);
      if (sizeError) {
        toast.error("Ukuran foto terlalu besar", { description: sizeError });
        return;
      }
    }
    setItemInputs((prev) => ({
      ...prev,
      [partNumber]: { ...prev[partNumber], photo: file },
    }));
  };

  const isFormComplete =
    view?.items.every((item) => {
      const input = itemInputs[item.part_number];
      return (
        input &&
        input.qty.trim() !== "" &&
        Number(input.qty) >= 0 &&
        !!input.photo
      );
    }) ?? false;

  const handleSubmit = async () => {
    if (!view || !isFormComplete) return;
    setSubmitting(true);
    try {
      // Foto di-upload LANGSUNG dari browser ke storage VPS dulu (bukan
      // dikirim lewat body server action bareng data lain) - Vercel
      // Serverless Functions punya hard limit body request 4.5MB yang gampang
      // kelewat kalau beberapa foto item digabung jadi satu request.
      const safeKode = view.kode_po.replace(/\//g, "-");
      const photos: Record<string, { url: string; name: string }> = {};
      for (const item of view.items) {
        const photo = itemInputs[item.part_number].photo;
        if (!photo) continue;
        const path = `${safeKode}/goods-receipt/${item.part_number}/${Date.now()}_${photo.name}`;
        const uploadResult = await uploadAttachmentDirectPublic(photo, path);
        if (!uploadResult.success) {
          toast.error(`Gagal mengunggah foto item ${item.part_number}`, {
            description: uploadResult.message,
          });
          return;
        }
        photos[item.part_number] = { url: uploadResult.url, name: photo.name };
      }

      const formData = new FormData();
      formData.append(
        "items_json",
        JSON.stringify(
          view.items.map((item) => ({
            part_number: item.part_number,
            qty_received: Number(itemInputs[item.part_number].qty),
          })),
        ),
      );
      formData.append("photos_json", JSON.stringify(photos));
      if (!sessionNama) {
        formData.append("receiver_name", nameInput.trim());
        formData.append("code", codeInput.trim());
      }

      const result = await submitGoodsReceipt(token, formData);
      if (!result.success) {
        toast.error("Gagal menyimpan konfirmasi", {
          description: result.message,
        });
        return;
      }
      setPhase("success");
    } finally {
      setSubmitting(false);
    }
  };

  if (phase === "loading") {
    return (
      <div className="flex min-h-screen items-center justify-center p-4">
        <div className="w-full max-w-md space-y-4">
          <Skeleton className="h-8 w-2/3" />
          <Skeleton className="h-40 w-full" />
        </div>
      </div>
    );
  }

  if (phase === "not_found") {
    return (
      <div className="flex min-h-screen items-center justify-center p-4">
        <div className="w-full max-w-md rounded-lg border p-8 text-center shadow-md">
          <h1 className="text-xl font-bold text-destructive">
            QR Tidak Valid
          </h1>
          <p className="mt-2 text-sm text-muted-foreground">
            Kode QR ini tidak ditemukan atau sudah tidak berlaku.
          </p>
        </div>
      </div>
    );
  }

  if (phase === "already_received") {
    return (
      <div className="flex min-h-screen items-center justify-center p-4">
        <div className="w-full max-w-md rounded-lg border p-8 text-center shadow-md">
          <CheckCircle2 className="mx-auto h-12 w-12 text-green-600" />
          <h1 className="mt-4 text-xl font-bold">
            Barang Sudah Dikonfirmasi Diterima
          </h1>
          <p className="mt-2 text-sm text-muted-foreground">
            {view?.received_info
              ? `Sudah dikonfirmasi diterima oleh ${view.received_info.receiver_name} pada ${new Date(
                  view.received_info.confirmed_at,
                ).toLocaleString("id-ID")}.`
              : "Semua barang pada PO ini sudah dikonfirmasi diterima sebelumnya."}
          </p>
          <p className="mt-1 text-xs text-muted-foreground">
            PO {view?.kode_po} - MR {view?.kode_mr}
          </p>
        </div>
      </div>
    );
  }

  if (phase === "success") {
    return (
      <div className="flex min-h-screen items-center justify-center p-4">
        <div className="w-full max-w-md rounded-lg border p-8 text-center shadow-md">
          <CheckCircle2 className="mx-auto h-12 w-12 text-green-600" />
          <h1 className="mt-4 text-xl font-bold">Konfirmasi Berhasil</h1>
          <p className="mt-2 text-sm text-muted-foreground">
            Konfirmasi penerimaan barang PO {view?.kode_po} berhasil disimpan.
            Terima kasih.
          </p>
        </div>
      </div>
    );
  }

  if (phase === "auth") {
    return (
      <div className="flex min-h-screen items-center justify-center p-4">
        <div className="w-full max-w-md rounded-lg border p-8 shadow-md">
          <div className="text-center mb-6">
            <ScanLine className="mx-auto h-10 w-10 text-primary" />
            <h1 className="mt-3 text-lg font-bold">Konfirmasi Penerimaan Barang</h1>
            <p className="text-sm text-muted-foreground">
              PO {view?.kode_po} - MR {view?.kode_mr}
            </p>
          </div>
          <div className="space-y-4">
            <div className="space-y-1.5">
              <Label htmlFor="receiver-name">Nama Lengkap Anda</Label>
              <Input
                id="receiver-name"
                value={nameInput}
                onChange={(e) => setNameInput(e.target.value)}
                placeholder="Nama lengkap"
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="global-code">Kode Global</Label>
              <Input
                id="global-code"
                type="password"
                value={codeInput}
                onChange={(e) => setCodeInput(e.target.value)}
                placeholder="Kode global penerimaan barang"
              />
            </div>
            {authError && (
              <p className="text-sm text-destructive">{authError}</p>
            )}
            <Button
              className="w-full"
              onClick={handleVerifyCode}
              disabled={verifyingCode}
            >
              {verifyingCode && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Lanjutkan
            </Button>
            <p className="text-xs text-muted-foreground text-center">
              Sudah punya akun di sistem ini? Login dulu di tab lain lalu
              scan ulang QR - nama Anda akan otomatis terisi tanpa kode
              global.
            </p>
          </div>
        </div>
      </div>
    );
  }

  // phase === "form"
  return (
    <div className="min-h-screen p-4 md:p-8">
      <div className="mx-auto max-w-2xl">
        <div className="text-center mb-6">
          <PackageCheck className="mx-auto h-10 w-10 text-primary" />
          <h1 className="mt-3 text-lg font-bold">Konfirmasi Penerimaan Barang</h1>
          <p className="text-sm text-muted-foreground">
            PO {view?.kode_po} - MR {view?.kode_mr}
          </p>
          <p className="text-sm mt-1">
            Diterima oleh: <span className="font-semibold">{sessionNama || nameInput}</span>
          </p>
        </div>

        <div className="space-y-4">
          {view?.items.map((item) => {
            const input = itemInputs[item.part_number] || { qty: "", photo: null };
            return (
              <div key={item.part_number} className="rounded-lg border p-4 space-y-3">
                <div>
                  <p className="font-medium text-sm">{item.name}</p>
                  <p className="text-xs text-muted-foreground font-mono">
                    {item.part_number}
                  </p>
                  <p className="text-xs text-muted-foreground mt-1">
                    Dikirim: {item.qty_dikirim} {item.uom}
                  </p>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div className="space-y-1">
                    <Label className="text-xs">Qty Diterima</Label>
                    <Input
                      type="number"
                      min={0}
                      value={input.qty}
                      onChange={(e) => updateItemQty(item.part_number, e.target.value)}
                    />
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs">Foto Barang (wajib)</Label>
                    <Input
                      type="file"
                      accept="image/*"
                      capture="environment"
                      onChange={(e) =>
                        updateItemPhoto(item.part_number, e.target.files?.[0] || null)
                      }
                    />
                  </div>
                </div>
              </div>
            );
          })}
        </div>

        <Button
          className="w-full mt-6"
          onClick={handleSubmit}
          disabled={!isFormComplete || submitting}
        >
          {submitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
          Kirim Konfirmasi Penerimaan
        </Button>
      </div>
    </div>
  );
}
