// src/app/auth/login/page.tsx

"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import Link from "next/link";
import { toast } from "sonner";
import { Loader2, Building2, Headset } from "lucide-react";
import { signInWithEmailOrNrp } from "@/services/userService";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
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

      toast.success("Login berhasil! Mengarahkan ke dashboard...");
      // Refresh state server dan arahkan ke root (middleware akan handle sisanya)
      router.push("/dashboard");
      router.refresh();
    } catch (error: any) {
      setError(error.message);
      toast.error("Login Gagal", { description: error.message });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex items-center justify-center min-h-screen bg-gray-100 dark:bg-gray-900 px-4">
      <Card className="w-full max-w-md">
        <CardHeader>
          <CardTitle className="text-2xl text-center">Login</CardTitle>
          <CardDescription className="text-center">
            Masukkan Email atau NRP Anda untuk masuk.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="identifier">Email atau NRP</Label>
              <Input
                id="identifier"
                name="identifier"
                type="text"
                required
                placeholder="email@example.com atau 123456"
                disabled={loading}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="password">Password</Label>
              <Input
                id="password"
                name="password"
                type="password"
                required
                disabled={loading}
              />
            </div>
            <div className="w-full flex justify-end">
              <button
                type="button"
                onClick={() => setIsForgotPasswordOpen(true)}
                className="text-end text-sm underline-offset-4 hover:underline"
              >
                Lupa password?
              </button>
            </div>
            {error && (
              <Alert variant="destructive">
                <AlertTitle>Login Gagal</AlertTitle>
                <AlertDescription>{error}</AlertDescription>
              </Alert>
            )}
            <Button type="submit" disabled={loading} className="w-full">
              {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Login
            </Button>
          </form>
          <div className="mt-4 text-center text-sm">
            Belum punya akun?{" "}
            <Link href="/auth/sign-up" className="underline underline-offset-4">
              Daftar di sini
            </Link>
          </div>
        </CardContent>
      </Card>

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
    </div>
  );
}
