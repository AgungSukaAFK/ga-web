"use client";

import { useEffect, useRef, useState } from "react";
import { useParams } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import {
  fetchGoodsReceiptView,
  verifyGoodsReceiptCode,
  submitGoodsReceipt,
  getServerTime,
  GoodsReceiptView,
} from "@/services/goodsReceiptService";
import { PhotoCaptureMeta } from "@/type";
import {
  formatStampTime,
  getDeviceLabel,
  reverseGeocode,
} from "@/lib/photoStamp";
import { CameraCaptureDialog } from "@/components/goods-receipt/CameraCaptureDialog";
import { getAttachmentSizeError } from "@/lib/attachments";
import { uploadAttachmentDirectPublic } from "@/lib/uploadDirect";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { toast } from "sonner";
import {
  Camera,
  CheckCircle2,
  Loader2,
  MapPin,
  PackageCheck,
  RefreshCw,
  ScanLine,
} from "lucide-react";

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
  photoMeta: PhotoCaptureMeta | null;
  previewUrl: string | null;
}

type LocationState =
  | { status: "pending" }
  | { status: "error"; message: string }
  | {
      status: "ok";
      latitude: number;
      longitude: number;
      accuracy_m: number | null;
      address: string | null;
    };

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

  // Data "timestamp" sistem utk watermark foto - lokasi WAJIB (tanpa
  // lokasi tombol kamera dikunci), jam pakai jam server + offset.
  const [location, setLocation] = useState<LocationState>({ status: "pending" });
  const [deviceLabel, setDeviceLabel] = useState("");
  const [serverTimeOffset, setServerTimeOffset] = useState(0);
  const [cameraFor, setCameraFor] = useState<string | null>(null);

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
            {
              qty: String(item.qty_dikirim),
              photo: null,
              photoMeta: null,
              previewUrl: null,
            },
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

  const requestLocation = () => {
    setLocation({ status: "pending" });
    if (!navigator.geolocation) {
      setLocation({
        status: "error",
        message: "Browser ini tidak mendukung lokasi.",
      });
      return;
    }
    navigator.geolocation.getCurrentPosition(
      async (pos) => {
        const { latitude, longitude, accuracy } = pos.coords;
        const address = await reverseGeocode(latitude, longitude);
        setLocation({
          status: "ok",
          latitude,
          longitude,
          accuracy_m: Number.isFinite(accuracy) ? Math.round(accuracy) : null,
          address,
        });
      },
      (err) => {
        setLocation({
          status: "error",
          message:
            err.code === err.PERMISSION_DENIED
              ? "Izin lokasi ditolak. Izinkan akses lokasi di pengaturan browser, lalu klik Coba Lagi."
              : "Lokasi tidak bisa didapat. Pastikan GPS aktif, lalu klik Coba Lagi.",
        });
      },
      { enableHighAccuracy: true, timeout: 20000, maximumAge: 0 },
    );
  };

  useEffect(() => {
    if (phase !== "form") return;
    requestLocation();
    getDeviceLabel().then(setDeviceLabel);
    const t0 = Date.now();
    getServerTime()
      .then((serverIso) => {
        const t1 = Date.now();
        setServerTimeOffset(Date.parse(serverIso) - (t0 + t1) / 2);
      })
      .catch(() => {});
  }, [phase]);

  // Object URL preview foto dilepas saat halaman ditinggal.
  const itemInputsRef = useRef(itemInputs);
  itemInputsRef.current = itemInputs;
  useEffect(
    () => () => {
      Object.values(itemInputsRef.current).forEach(
        (i) => i.previewUrl && URL.revokeObjectURL(i.previewUrl),
      );
    },
    [],
  );

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

  // Dipanggil dialog kamera TEPAT saat jepret - meta yang sama ini juga
  // yang disimpan ke server, jadi watermark & data selalu cocok.
  const pendingMetaRef = useRef<PhotoCaptureMeta | null>(null);
  const buildStampLines = (): string[] => {
    if (location.status !== "ok") return [];
    const meta: PhotoCaptureMeta = {
      captured_at: new Date(Date.now() + serverTimeOffset).toISOString(),
      latitude: location.latitude,
      longitude: location.longitude,
      accuracy_m: location.accuracy_m,
      address: location.address,
      device: deviceLabel || "Tidak diketahui",
    };
    pendingMetaRef.current = meta;
    return [
      formatStampTime(new Date(meta.captured_at)),
      meta.address || "Alamat tidak tersedia",
      `${meta.latitude.toFixed(6)}, ${meta.longitude.toFixed(6)}${
        meta.accuracy_m !== null ? ` (±${meta.accuracy_m} m)` : ""
      }`,
      `Device: ${meta.device}`,
      `PO ${view?.kode_po} · MR ${view?.kode_mr}`,
    ];
  };

  const handlePhotoCaptured = (partNumber: string, file: File) => {
    const sizeError = getAttachmentSizeError(file);
    if (sizeError) {
      toast.error("Ukuran foto terlalu besar", { description: sizeError });
      return;
    }
    const meta = pendingMetaRef.current;
    setItemInputs((prev) => {
      const old = prev[partNumber];
      if (old?.previewUrl) URL.revokeObjectURL(old.previewUrl);
      return {
        ...prev,
        [partNumber]: {
          ...old,
          photo: file,
          photoMeta: meta,
          previewUrl: URL.createObjectURL(file),
        },
      };
    });
  };

  const isFormComplete =
    view?.items.every((item) => {
      const input = itemInputs[item.part_number];
      return (
        input &&
        input.qty.trim() !== "" &&
        Number(input.qty) >= 0 &&
        !!input.photo &&
        !!input.photoMeta
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
      const photos: Record<
        string,
        { url: string; name: string; meta: PhotoCaptureMeta | null }
      > = {};
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
        photos[item.part_number] = {
          url: uploadResult.url,
          name: photo.name,
          meta: itemInputs[item.part_number].photoMeta,
        };
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

        <div
          className={`mb-4 flex items-start gap-3 rounded-lg border p-3 text-sm ${
            location.status === "error"
              ? "border-destructive/50 bg-destructive/5"
              : ""
          }`}
        >
          <MapPin
            className={`mt-0.5 h-4 w-4 shrink-0 ${
              location.status === "error" ? "text-destructive" : "text-primary"
            }`}
          />
          <div className="flex-1 min-w-0">
            {location.status === "pending" && (
              <p className="flex items-center gap-2 text-muted-foreground">
                <Loader2 className="h-3 w-3 animate-spin" /> Mengambil lokasi...
              </p>
            )}
            {location.status === "error" && (
              <p className="text-destructive">{location.message}</p>
            )}
            {location.status === "ok" && (
              <>
                <p className="break-words">
                  {location.address || "Alamat tidak tersedia"}
                </p>
                <p className="text-xs text-muted-foreground">
                  {location.latitude.toFixed(6)}, {location.longitude.toFixed(6)}
                  {location.accuracy_m !== null &&
                    ` (±${location.accuracy_m} m)`}
                  {deviceLabel && ` · ${deviceLabel}`}
                </p>
              </>
            )}
          </div>
          {location.status !== "pending" && (
            <Button
              variant="ghost"
              size="sm"
              className="h-7 shrink-0"
              onClick={requestLocation}
            >
              <RefreshCw className="mr-1 h-3 w-3" />
              {location.status === "error" ? "Coba Lagi" : "Perbarui"}
            </Button>
          )}
        </div>

        <div className="space-y-4">
          {view?.items.map((item) => {
            const input = itemInputs[item.part_number] || {
              qty: "",
              photo: null,
              photoMeta: null,
              previewUrl: null,
            };
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
                    <Label className="text-xs">Foto Barang (wajib, dari kamera)</Label>
                    <Button
                      type="button"
                      variant={input.photo ? "outline" : "default"}
                      className="w-full"
                      disabled={location.status !== "ok"}
                      onClick={() => setCameraFor(item.part_number)}
                    >
                      <Camera className="mr-2 h-4 w-4" />
                      {input.photo ? "Foto Ulang" : "Ambil Foto"}
                    </Button>
                  </div>
                </div>
                {input.previewUrl && (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={input.previewUrl}
                    alt={`Foto ${item.name}`}
                    className="w-full rounded-md border"
                  />
                )}
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

      <CameraCaptureDialog
        open={cameraFor !== null}
        onOpenChange={(open) => !open && setCameraFor(null)}
        title={
          view?.items.find((i) => i.part_number === cameraFor)?.name ||
          "Foto Barang"
        }
        getStampLines={buildStampLines}
        onCapture={(file) => cameraFor && handlePhotoCaptured(cameraFor, file)}
      />
    </div>
  );
}
