"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { Content } from "@/components/content";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { toast } from "sonner";
import { Loader2, KeyRound } from "lucide-react";
import {
  getGoodsReceiptSetting,
  setGoodsReceiptSetting,
} from "@/services/goodsReceiptService";
import { logActivity } from "@/services/logService";
import { Profile } from "@/type";

export function GoodsReceiptSettingsClient() {
  const router = useRouter();
  const supabase = createClient();

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [currentUser, setCurrentUser] = useState<{ id: string; email?: string } | null>(
    null,
  );
  const [profile, setProfile] = useState<Profile | null>(null);
  const [currentCode, setCurrentCode] = useState("");
  const [newCode, setNewCode] = useState("");

  useEffect(() => {
    const load = async () => {
      setLoading(true);
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) {
        router.push("/auth/login");
        return;
      }
      setCurrentUser(user);

      const { data: profileData } = await supabase
        .from("profiles")
        .select("*")
        .eq("id", user.id)
        .single();

      if (!profileData || profileData.role !== "admin") {
        toast.error("Akses ditolak.");
        router.push("/dashboard");
        return;
      }
      setProfile(profileData as Profile);

      try {
        const code = await getGoodsReceiptSetting();
        setCurrentCode(code);
      } catch (err: any) {
        toast.error("Gagal mengambil kode global", {
          description: err.message,
        });
      }
      setLoading(false);
    };
    load();
  }, []);

  const handleSave = async () => {
    if (!currentUser) return;
    if (!newCode.trim()) {
      toast.error("Kode baru tidak boleh kosong.");
      return;
    }
    setSaving(true);
    try {
      await setGoodsReceiptSetting(newCode.trim(), currentUser.id);
      await logActivity(
        currentUser.id,
        "UPDATE_GOODS_RECEIPT_CODE",
        "system_settings",
        "goods_receipt_global_code",
        `${profile?.nama || currentUser.email || "Unknown"} mengganti kode global penerimaan barang`,
        null,
      );
      setCurrentCode(newCode.trim());
      setNewCode("");
      toast.success("Kode global berhasil diperbarui.");
    } catch (err: any) {
      toast.error("Gagal menyimpan kode global", { description: err.message });
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return <Skeleton className="col-span-12 h-64 w-full" />;
  }

  return (
    <Content
      size="sm"
      title="Kode Global Terima Barang"
      description="Kode ini dipakai penerima barang di halaman scan QR BAST saat mereka belum login. Bagikan hanya ke internal perusahaan."
    >
      <div className="space-y-6">
        <div className="space-y-1.5">
          <Label className="text-xs text-muted-foreground">
            Kode Aktif Saat Ini
          </Label>
          <div className="flex items-center gap-2 rounded-md border bg-muted/50 px-3 py-2 font-mono text-sm">
            <KeyRound className="h-4 w-4 text-muted-foreground" />
            {currentCode || "-"}
          </div>
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="new-goods-receipt-code">Ganti dengan Kode Baru</Label>
          <Input
            id="new-goods-receipt-code"
            value={newCode}
            onChange={(e) => setNewCode(e.target.value)}
            placeholder="Masukkan kode baru"
            className="mt-1"
          />
        </div>

        <Button onClick={handleSave} disabled={saving || !newCode.trim()}>
          {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
          Simpan Kode Baru
        </Button>
      </div>
    </Content>
  );
}
