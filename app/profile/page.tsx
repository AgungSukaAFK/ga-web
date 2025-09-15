"use client";

import { Content } from "@/components/content";
import { Input } from "@/components/ui/input";
import { createClient } from "@/lib/supabase/client";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { User } from "@supabase/supabase-js";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Terminal } from "lucide-react";

// Tentukan tipe data untuk profil agar lebih aman
type Profile = {
  nama: string | null;
  role: string | null;
  lokasi: string | null;
  department: string | null;
};

export default function Dashboard() {
  const [editMode, setEditMode] = useState(false);
  const [loading, setLoading] = useState(true);
  const [user, setUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [formData, setFormData] = useState<Profile>({
    nama: null,
    role: null,
    lokasi: null,
    department: null,
  });
  const [isUpdating, setIsUpdating] = useState(false);
  const [updateError, setUpdateError] = useState<string | null>(null);
  const [updateSuccess, setUpdateSuccess] = useState<boolean>(false);
  const router = useRouter();

  // Efek untuk mengambil data awal saat komponen dimuat
  useEffect(() => {
    async function fetchUserData() {
      const supabase = createClient();
      setLoading(true);

      try {
        const {
          data: { user },
        } = await supabase.auth.getUser();

        if (!user) {
          router.push("/auth/login");
          return;
        }
        setUser(user);

        const { data: profileRes, error: profileError } = await supabase
          .from("profiles")
          .select("nama, role, lokasi, department")
          .eq("id", user.id)
          .single();

        if (profileError || !profileRes) {
          console.error("Profile not found or error:", profileError);
          router.push("/profile/create");
          return;
        }

        const fetchedProfile = profileRes as Profile;
        setProfile(fetchedProfile);
        setFormData(fetchedProfile); // Atur state form dengan data yang diambil
      } catch (err) {
        console.error("An unexpected error occurred:", err);
      } finally {
        setLoading(false);
      }
    }

    fetchUserData();
  }, [router]);

  // Handler untuk setiap perubahan input
  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    setFormData((prevData) => ({
      ...prevData,
      [name]: value,
    }));
  };

  // Fungsi untuk mengirim data yang diubah ke Supabase
  const handleUpdateProfile = async () => {
    setIsUpdating(true);
    setUpdateError(null);
    setUpdateSuccess(false);
    const supabase = createClient();

    try {
      const { data, error } = await supabase
        .from("profiles")
        .update(formData)
        .eq("id", user?.id);

      if (error) {
        throw error;
      }

      setProfile(formData); // Perbarui state profil dengan data baru
      setEditMode(false);
      setUpdateSuccess(true);
    } catch (error: any) {
      console.error("Error updating profile:", error.message);
      setUpdateError("Gagal memperbarui profil: " + error.message);
    } finally {
      setIsUpdating(false);
    }
  };

  // Atur ulang form ke data asli saat mode edit dibatalkan
  const handleCancelEdit = () => {
    setEditMode(false);
    if (profile) {
      setFormData(profile);
    }
    setUpdateError(null);
    setUpdateSuccess(false);
  };

  if (loading) {
    return (
      <Content size="md" title="Data Profil">
        <p>Memuat data...</p>
      </Content>
    );
  }

  return (
    <Content size="md" title="Data Profil">
      {/* Tampilkan pesan sukses atau error setelah pembaruan */}
      {updateSuccess && (
        <Alert className="mb-4 bg-green-500 text-white">
          <Terminal className="h-4 w-4" />
          <AlertTitle>Berhasil!</AlertTitle>
          <AlertDescription>Profil Anda berhasil diperbarui.</AlertDescription>
        </Alert>
      )}
      {updateError && (
        <Alert variant="destructive" className="mb-4">
          <Terminal className="h-4 w-4" />
          <AlertTitle>Gagal!</AlertTitle>
          <AlertDescription>{updateError}</AlertDescription>
        </Alert>
      )}

      {/* Bagian Form */}
      <div className="space-y-4">
        <div>
          <label className="mb-2 block font-medium">Nama</label>
          {!editMode ? (
            <p className="p-2 border border-border rounded-md bg-muted/50">
              {profile?.nama || "-"}
            </p>
          ) : (
            <Input
              className="mb-4"
              placeholder="Nama lengkap"
              name="nama"
              value={formData.nama || ""}
              onChange={handleInputChange}
            />
          )}
        </div>
        <div>
          <label className="mb-2 block font-medium">Email</label>
          <Input
            className="mb-4"
            placeholder="Email"
            value={user?.email || ""}
            disabled
          />
        </div>
        <div>
          <label className="mb-2 block font-medium">Role</label>
          {!editMode ? (
            <p className="p-2 border border-border rounded-md bg-muted/50">
              {profile?.role || "-"}
            </p>
          ) : (
            <Input
              className="mb-4"
              placeholder="Role"
              name="role"
              value={formData.role || ""}
              onChange={handleInputChange}
            />
          )}
        </div>
        <div>
          <label className="mb-2 block font-medium">Lokasi</label>
          {!editMode ? (
            <p className="p-2 border border-border rounded-md bg-muted/50">
              {profile?.lokasi || "-"}
            </p>
          ) : (
            <Input
              className="mb-4"
              placeholder="Lokasi"
              name="lokasi"
              value={formData.lokasi || ""}
              onChange={handleInputChange}
            />
          )}
        </div>
        <div>
          <label className="mb-2 block font-medium">Departemen</label>
          {!editMode ? (
            <p className="p-2 border border-border rounded-md bg-muted/50">
              {profile?.department || "-"}
            </p>
          ) : (
            <Input
              className="mb-4"
              placeholder="Departemen"
              name="department"
              value={formData.department || ""}
              onChange={handleInputChange}
            />
          )}
        </div>
      </div>

      {/* Bagian Tombol */}
      <div className="mt-6 flex justify-end gap-2">
        {!editMode ? (
          <Button onClick={() => setEditMode(true)}>Edit Profil</Button>
        ) : (
          <>
            <Button variant="outline" onClick={handleCancelEdit}>
              Batal
            </Button>
            <Button onClick={handleUpdateProfile} disabled={isUpdating}>
              {isUpdating ? "Menyimpan..." : "Simpan"}
            </Button>
          </>
        )}
      </div>
    </Content>
  );
}
