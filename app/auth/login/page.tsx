// src/app/auth/login/page.tsx

"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import Link from "next/link";
import { toast } from "sonner";
import {
  Loader2,
  Building2,
  Headset,
  LockKeyhole,
  LogIn,
  UserRound,
} from "lucide-react";
import { signInWithEmailOrNrp } from "@/services/userService";
import { AuthShell } from "@/components/auth/auth-shell";
import { AuthInput } from "@/components/auth/auth-input";
import { getSafeNextPath } from "@/lib/safe-next-path";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";

export default function LoginPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isForgotPasswordOpen, setIsForgotPasswordOpen] = useState(false);

  // Tampilkan pesan jika user diarahkan ke sini karena akunnya dinonaktifkan.
  useEffect(() => {
    const reason = new URLSearchParams(window.location.search).get("reason");
    if (reason === "deactivated") {
      const message =
        "Akun Anda telah dinonaktifkan. Silakan hubungi administrator.";
      setError(message);
      toast.error("Akses Ditolak", { description: message });
    }
  }, []);

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setLoading(true);
    setError(null);

    const formData = new FormData(event.currentTarget);
    const identifier = formData.get("identifier") as string;
    const password = formData.get("password") as string;

    try {
      await signInWithEmailOrNrp(identifier, password);

      // Kembali ke halaman yang tadi dicegat login (mis. hasil scan QR
      // dokumen cetak) - dibawa middleware lewat ?next=. Tanpa itu baru ke
      // dashboard.
      const next = getSafeNextPath(
        new URLSearchParams(window.location.search).get("next"),
      );
      toast.success(
        next
          ? "Login berhasil! Melanjutkan ke halaman tujuan..."
          : "Login berhasil! Mengarahkan ke dashboard...",
      );
      router.replace(next ?? "/dashboard");
      router.refresh();
    } catch (error: any) {
      setError(error.message);
      toast.error("Login Gagal", { description: error.message });
    } finally {
      setLoading(false);
    }
  };

  return (
    <AuthShell
      title="Selamat datang kembali"
      description="Masuk dengan Email atau NRP Anda untuk melanjutkan."
    >
      <form onSubmit={handleSubmit} className="space-y-4">
        <div className="space-y-2">
          <Label htmlFor="identifier">Email atau NRP</Label>
          <AuthInput
            icon={UserRound}
            id="identifier"
            name="identifier"
            type="text"
            required
            autoComplete="username"
            autoFocus
            placeholder="email@example.com atau 123456"
            disabled={loading}
          />
        </div>
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <Label htmlFor="password">Password</Label>
            <button
              type="button"
              onClick={() => setIsForgotPasswordOpen(true)}
              className="text-sm text-muted-foreground underline-offset-4 hover:text-foreground hover:underline"
            >
              Lupa password?
            </button>
          </div>
          <AuthInput
            icon={LockKeyhole}
            id="password"
            name="password"
            type="password"
            required
            autoComplete="current-password"
            placeholder="••••••••"
            disabled={loading}
          />
        </div>
        {error && (
          <Alert variant="destructive">
            <AlertTitle>Login Gagal</AlertTitle>
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}
        <Button type="submit" disabled={loading} className="h-11 w-full">
          {loading ? (
            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
          ) : (
            <LogIn className="mr-2 h-4 w-4" />
          )}
          {loading ? "Memproses..." : "Masuk"}
        </Button>
      </form>
      <p className="mt-6 text-center text-sm text-muted-foreground">
        Belum punya akun?{" "}
        <Link
          href="/auth/sign-up"
          className="font-medium text-foreground underline underline-offset-4 hover:text-primary"
        >
          Daftar di sini
        </Link>
      </p>

      <Dialog open={isForgotPasswordOpen} onOpenChange={setIsForgotPasswordOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Building2 className="h-5 w-5" /> Lupa Password?
            </DialogTitle>
            <DialogDescription>
              Reset password mandiri lewat email tidak tersedia untuk sistem
              ini.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3 text-sm">
            <div className="flex items-start gap-3 rounded-md border p-3">
              <Headset className="h-5 w-5 flex-shrink-0 text-primary mt-0.5" />
              <p>
                Silakan hubungi pihak <strong>IT</strong> atau{" "}
                <strong>Admin General Affair (GA)</strong> di{" "}
                <strong>Head Office PT. Garuda Mart Indonesia</strong> untuk
                dibantu proses reset password akun Anda.
              </p>
            </div>
            <p className="text-muted-foreground">
              Siapkan Nama, Email/NRP yang terdaftar, dan Departemen Anda saat
              menghubungi, agar proses verifikasi lebih cepat.
            </p>
          </div>
          <DialogFooter>
            <Button onClick={() => setIsForgotPasswordOpen(false)}>
              Mengerti
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </AuthShell>
  );
}
