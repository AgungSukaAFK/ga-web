// src/app/auth/sign-up/page.tsx

"use client";

import { useState } from "react";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import Link from "next/link";
import { toast } from "sonner";
import {
  CheckCircle2,
  Loader2,
  LockKeyhole,
  Mail,
  UserPlus,
} from "lucide-react";
import { signUpUser } from "@/services/userService";
import { AuthShell } from "@/components/auth/auth-shell";
import { AuthInput } from "@/components/auth/auth-input";
import { cn } from "@/lib/utils";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";

export default function SignupPage() {
  const [loading, setLoading] = useState(false);
  const [signupSuccess, setSignupSuccess] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [password, setPassword] = useState("");
  const [repeatPassword, setRepeatPassword] = useState("");
  const mismatch = repeatPassword.length > 0 && password !== repeatPassword;

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setLoading(true);
    setError(null);

    const formData = new FormData(event.currentTarget);
    const email = formData.get("email") as string;

    if (password !== repeatPassword) {
      setError("Konfirmasi password tidak cocok.");
      setLoading(false);
      return;
    }

    try {
      await signUpUser({ email, password });
      setSignupSuccess(true);
    } catch (error: any) {
      setError(error.message);
      toast.error("Pendaftaran Gagal", { description: error.message });
    } finally {
      setLoading(false);
    }
  };

  if (signupSuccess) {
    return (
      <AuthShell title="Pendaftaran Berhasil">
        <div className="space-y-6 text-center">
          <div className="mx-auto flex size-14 items-center justify-center rounded-full bg-emerald-500/10 text-emerald-600 dark:text-emerald-400">
            <CheckCircle2 className="size-7" />
          </div>
          <p className="text-sm leading-relaxed text-muted-foreground">
            Akun Anda telah dibuat. Silakan hubungi admin untuk mendapatkan NRP
            dan aktivasi akun agar dapat mengakses sistem.
          </p>
          <Button asChild className="h-11 w-full">
            <Link href="/auth/login">Kembali ke Halaman Login</Link>
          </Button>
        </div>
      </AuthShell>
    );
  }

  return (
    <AuthShell
      title="Daftar Akun Baru"
      description="Buat akun untuk dapat mengakses sistem."
    >
      <form onSubmit={handleSubmit} className="space-y-4">
        <div className="space-y-2">
          <Label htmlFor="email">Email</Label>
          <AuthInput
            icon={Mail}
            id="email"
            name="email"
            type="email"
            required
            autoComplete="email"
            autoFocus
            placeholder="nama@perusahaan.com"
            disabled={loading}
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="password">Password</Label>
          <AuthInput
            icon={LockKeyhole}
            id="password"
            name="password"
            type="password"
            required
            autoComplete="new-password"
            placeholder="••••••••"
            disabled={loading}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="repeat-password">Ulangi Password</Label>
          <AuthInput
            icon={LockKeyhole}
            id="repeat-password"
            name="repeat-password"
            type="password"
            required
            autoComplete="new-password"
            placeholder="••••••••"
            disabled={loading}
            value={repeatPassword}
            onChange={(e) => setRepeatPassword(e.target.value)}
            aria-invalid={mismatch}
            className={cn(mismatch && "border-destructive focus-visible:ring-destructive")}
          />
          {mismatch && (
            <p className="text-xs text-destructive">
              Konfirmasi password belum cocok.
            </p>
          )}
        </div>
        {error && (
          <Alert variant="destructive">
            <AlertTitle>Pendaftaran Gagal</AlertTitle>
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}
        <Button type="submit" disabled={loading} className="h-11 w-full">
          {loading ? (
            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
          ) : (
            <UserPlus className="mr-2 h-4 w-4" />
          )}
          {loading ? "Memproses..." : "Daftar"}
        </Button>
      </form>
      <p className="mt-6 text-center text-sm text-muted-foreground">
        Sudah punya akun?{" "}
        <Link
          href="/auth/login"
          className="font-medium text-foreground underline underline-offset-4 hover:text-primary"
        >
          Login di sini
        </Link>
      </p>
    </AuthShell>
  );
}
