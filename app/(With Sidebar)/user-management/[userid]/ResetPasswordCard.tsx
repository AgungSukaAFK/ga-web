"use client";

// Kartu reset password di halaman detail user - khusus admin departemen IT
// (isITAdmin), dicek ulang di server (resetUserPasswordByITAdmin).

import { useState } from "react";
import { KeyRound, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { Content } from "@/components/content";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { resetUserPasswordByITAdmin } from "@/services/userAdminService";

export function ResetPasswordCard({
  userId,
  userName,
}: {
  userId: string;
  userName: string;
}) {
  const [password, setPassword] = useState("");
  const [saving, setSaving] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    try {
      await resetUserPasswordByITAdmin(userId, password);
      toast.success("Password berhasil direset", {
        description: `Beritahu ${userName} password barunya, lalu minta ganti sendiri lewat halaman Profil.`,
      });
      setPassword("");
    } catch (error: any) {
      toast.error("Gagal mereset password", { description: error.message });
    } finally {
      setSaving(false);
    }
  };

  return (
    <Content
      size="lg"
      title="Reset Password"
      description="Untuk user yang lupa password. Password lama langsung tidak berlaku."
    >
      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <Label htmlFor="reset-password" className="mb-2 block font-medium">
            Password Baru
          </Label>
          {/* type="text" (seperti di Tambah User) - admin perlu melihat
              password yang diketik untuk diteruskan ke user. */}
          <Input
            id="reset-password"
            type="text"
            required
            minLength={6}
            autoComplete="new-password"
            placeholder="Min. 6 karakter"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            disabled={saving}
          />
        </div>
        <div className="flex justify-end">
          <Button type="submit" disabled={saving}>
            {saving ? (
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            ) : (
              <KeyRound className="mr-2 h-4 w-4" />
            )}
            {saving ? "Menyimpan..." : "Reset Password"}
          </Button>
        </div>
      </form>
    </Content>
  );
}
