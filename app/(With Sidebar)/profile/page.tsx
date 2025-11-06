"use client";

import { Content } from "@/components/content";
import { Input } from "@/components/ui/input";
import { createClient } from "@/lib/supabase/client";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { User } from "@supabase/supabase-js";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Loader2, Terminal } from "lucide-react";
import { Combobox } from "@/components/combobox";
import { ThemeSwitcher } from "@/components/theme-switcher";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { Skeleton } from "@/components/ui/skeleton";
import { dataDepartment, dataLokasi } from "@/type/comboboxData";
import { AccentThemeSwitcher } from "@/components/accent-theme-switcher";

// REVISI: Tambahkan nrp dan company ke tipe Profile
type Profile = {
  nama: string | null;
  role: string | null;
  lokasi: string | null;
  department: string | null;
  nrp: string | null; // Tambahkan NRP
  company: string | null; // Tambahkan Company
};

export default function Dashboard() {
  const [editMode, setEditMode] = useState(false);
  const [loading, setLoading] = useState(true);
  const [user, setUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  // REVISI: Tambahkan nrp dan company ke formData
  const [formData, setFormData] = useState<Profile>({
    nama: null,
    role: null,
    lokasi: null,
    department: null,
    nrp: null,
    company: null,
  });
  const [isUpdating, setIsUpdating] = useState(false);
  const [updateError, setUpdateError] = useState<string | null>(null);
  const [updateSuccess, setUpdateSuccess] = useState<boolean>(false);
  const router = useRouter();

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

        // REVISI: Ambil nrp dan company
        const { data: profileRes, error: profileError } = await supabase
          .from("profiles")
          .select("nama, role, lokasi, department, nrp, company") // Ambil field baru
          .eq("id", user.id)
          .single();

        if (profileError || !profileRes) {
          console.error("Profile not found or error:", profileError);
          // Jika profil tidak ada sama sekali, mungkin perlu dibuat?
          // Untuk saat ini, anggap profil dasar selalu ada setelah sign up.
          // Jika ini halaman create profile, logikanya akan berbeda.
          // Di sini kita asumsikan profil sudah ada tapi mungkin belum lengkap.
          if (profileError?.code === "PGRST116") {
            // Kode error jika row tidak ditemukan
            console.log("Profile row not found for user:", user.id);
            // Anda bisa set state default atau menampilkan pesan error spesifik
            setProfile({
              nama: null,
              role: null,
              lokasi: null,
              department: null,
              nrp: null,
              company: null,
            });
            setFormData({
              nama: null,
              role: null,
              lokasi: null,
              department: null,
              nrp: null,
              company: null,
            });
          } else {
            throw profileError || new Error("Profile not found");
          }
          return;
        }

        const fetchedProfile = profileRes as Profile;
        setProfile(fetchedProfile);
        setFormData(fetchedProfile); // Inisialisasi form dengan semua data
      } catch (err: any) {
        console.error("An unexpected error occurred:", err);
        toast.error("Gagal memuat data profil", { description: err.message });
      } finally {
        setLoading(false);
      }
    }

    fetchUserData();
  }, [router]);

  // Handler untuk setiap perubahan input
  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    // REVISI: Pastikan hanya field yang editable yang diupdate
    if (name === "nama" || name === "nrp") {
      setFormData((prevData) => ({
        ...prevData,
        [name]: value || null, // Simpan null jika kosong
      }));
    }
  };

  // Handler perubahan dari Combobox (lebih generik)
  const handleComboboxChange = (field: keyof Profile, value: string) => {
    // REVISI: Pastikan hanya field yang editable yang diupdate
    if (field === "lokasi" || field === "department") {
      setFormData((prevData) => ({ ...prevData, [field]: value || null }));
    }
  };

  // Fungsi untuk mengirim data yang diubah ke Supabase
  const handleUpdateProfile = async () => {
    setIsUpdating(true);
    setUpdateError(null);
    setUpdateSuccess(false);
    const supabase = createClient();

    try {
      // REVISI: Hanya update field yang bisa diedit
      const dataToUpdate: Partial<Profile> = {
        nama: formData.nama,
        nrp: formData.nrp,
        lokasi: formData.lokasi,
        department: formData.department,
      };

      console.log("Updating profile with:", dataToUpdate); // Log data yang akan diupdate

      const { error } = await supabase
        .from("profiles")
        .update(dataToUpdate)
        .eq("id", user?.id);

      if (error) {
        throw error;
      }

      // Update state profile lokal dengan data yang baru disimpan
      setProfile((prevProfile) =>
        prevProfile ? { ...prevProfile, ...dataToUpdate } : null
      );
      setEditMode(false);
      setUpdateSuccess(true);
      toast.success("Profil berhasil diperbarui!"); // Tambahkan notifikasi sukses
    } catch (error: any) {
      console.error("Error updating profile:", error.message);
      setUpdateError("Gagal memperbarui profil: " + error.message);
      toast.error("Gagal memperbarui profil", { description: error.message }); // Tambahkan notifikasi error
    } finally {
      setIsUpdating(false);
    }
  };

  // Atur ulang form ke data asli saat mode edit dibatalkan
  const handleCancelEdit = () => {
    setEditMode(false);
    if (profile) {
      setFormData(profile); // Reset ke data profile yang terakhir diambil
    }
    setUpdateError(null);
    setUpdateSuccess(false);
  };

  if (loading) {
    return (
      <Content size="md" title="Data Profil">
        <Skeleton className="h-96 w-full" />
      </Content>
    );
  }

  return (
    <>
      <Content size="md" title="Data Profil">
        {/* Tampilkan pesan sukses atau error setelah pembaruan */}
        {updateSuccess && (
          <Alert className="mb-4 bg-green-100 border-green-400 text-green-700 dark:bg-green-900/30 dark:border-green-700 dark:text-green-300">
            <Terminal className="h-4 w-4" />
            <AlertTitle>Berhasil!</AlertTitle>
            <AlertDescription>
              Profil Anda berhasil diperbarui.
            </AlertDescription>
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
            <Label className="mb-2 block font-medium">Nama</Label>
            {!editMode ? (
              <p className="p-2 border border-border rounded-md bg-muted/50 min-h-[36px] flex items-center">
                {profile?.nama || "-"}
              </p>
            ) : (
              <Input
                placeholder="Nama lengkap"
                name="nama"
                value={formData.nama || ""}
                onChange={handleInputChange}
                disabled={isUpdating} // Disable saat proses update
              />
            )}
          </div>

          {/* REVISI: NRP (Editable) */}
          <div>
            <Label className="mb-2 block font-medium">NRP</Label>
            {!editMode ? (
              <p className="p-2 border border-border rounded-md bg-muted/50 min-h-[36px] flex items-center">
                {profile?.nrp || "-"}
              </p>
            ) : (
              <Input
                placeholder="Nomor Registrasi Pokok"
                name="nrp"
                value={formData.nrp || ""}
                onChange={handleInputChange}
                disabled={isUpdating}
              />
            )}
          </div>

          <div>
            <Label className="mb-2 block font-medium">Email</Label>
            {/* REVISI: Selalu read-only */}
            <p className="p-2 border border-border rounded-md bg-muted/30 text-muted-foreground min-h-[36px] flex items-center">
              {user?.email || "-"}
            </p>
          </div>

          <div>
            <Label className="mb-2 block font-medium">Role</Label>
            {/* REVISI: Selalu read-only */}
            <p className="p-2 border border-border rounded-md bg-muted/30 text-muted-foreground min-h-[36px] flex items-center">
              {profile?.role || "-"}
            </p>
          </div>

          {/* REVISI: Company (Read-Only) */}
          <div>
            <Label className="mb-2 block font-medium">Perusahaan</Label>
            <p className="p-2 border border-border rounded-md bg-muted/30 text-muted-foreground min-h-[36px] flex items-center">
              {profile?.company || "-"}
            </p>
          </div>

          <div>
            <Label className="mb-2 block font-medium">Lokasi</Label>
            {!editMode ? (
              <p className="p-2 border border-border rounded-md bg-muted/50 min-h-[36px] flex items-center">
                {profile?.lokasi || "-"}
              </p>
            ) : (
              <Combobox
                data={dataLokasi}
                onChange={(value) => handleComboboxChange("lokasi", value)}
                defaultValue={formData.lokasi || ""}
                disabled={isUpdating} // Disable saat proses update
              />
            )}
          </div>
          <div>
            <Label className="mb-2 block font-medium">Departemen</Label>
            {!editMode ? (
              <p className="p-2 border border-border rounded-md bg-muted/50 min-h-[36px] flex items-center">
                {profile?.department || "-"}
              </p>
            ) : (
              <Combobox
                data={dataDepartment}
                onChange={(value) => handleComboboxChange("department", value)}
                defaultValue={formData.department || ""}
                disabled={isUpdating} // Disable saat proses update
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
              <Button
                variant="outline"
                onClick={handleCancelEdit}
                disabled={isUpdating}
              >
                Batal
              </Button>
              <Button onClick={handleUpdateProfile} disabled={isUpdating}>
                {isUpdating ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Menyimpan...
                  </>
                ) : (
                  "Simpan"
                )}
              </Button>
            </>
          )}
        </div>
      </Content>
      <Content size="xs">
        {/* --- REVISI: Tambahkan AccentThemeSwitcher --- */}
        <div className="flex justify-between items-center">
          <Label className="text-base font-bold">Pengaturan Tema</Label>
          <div className="flex items-center gap-1">
            <AccentThemeSwitcher />
            <ThemeSwitcher />
          </div>
        </div>
        {/* --- AKHIR REVISI --- */}
      </Content>
    </>
  );
}
