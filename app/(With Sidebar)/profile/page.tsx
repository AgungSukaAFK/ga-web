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
import { Combobox, ComboboxData } from "@/components/combobox";
import { ThemeSwitcher } from "@/components/theme-switcher";
import { Label } from "@/components/ui/label";

type Profile = {
  nama: string | null;
  role: string | null;
  lokasi: string | null;
  department: string | null;
};

const dataLokasi: ComboboxData = [
  { label: "Head Office", value: "Head Office" },
  { label: "Tanjung Enim", value: "Tanjung Enim" },
  { label: "Balikpapan", value: "Balikpapan" },
  { label: "Site BA", value: "Site BA" },
  { label: "Site TAL", value: "Site TAL" },
  { label: "Site MIP", value: "Site MIP" },
  { label: "Site MIFA", value: "Site MIFA" },
  { label: "Site BIB", value: "Site BIB" },
  { label: "Site AMI", value: "Site AMI" },
  { label: "Site Tabang", value: "Site Tabang" },
];

export const dataDepartment: ComboboxData = [
  { label: "General Affair", value: "General Affair" },
  { label: "Marketing", value: "Marketing" },
  { label: "Manufacture", value: "Manufacture" },
  { label: "K3", value: "K3" },
  { label: "Finance", value: "Finance" },
  { label: "IT", value: "IT" },
  { label: "Logistik", value: "Logistik" },
  { label: "Purchasing", value: "Purchasing" },
  { label: "Warehouse", value: "Warehouse" },
  { label: "Service", value: "Service" },
  { label: "General Manager", value: "General Manager" },
  { label: "Executive Manager", value: "Executive Manager" },
  { label: "Boards of Director", value: "Boards of Director" },
];

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
        setFormData(fetchedProfile);
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

  // Handler perubahan dari Combobox
  const handleLokasiChange = (value: string) => {
    console.log(value);
    setFormData((prevData) => ({
      ...prevData,
      lokasi: value,
    }));
  };
  const handleDepartmentChange = (value: string) => {
    setFormData((prevData) => ({
      ...prevData,
      department: value,
    }));
  };

  // Fungsi untuk mengirim data yang diubah ke Supabase
  const handleUpdateProfile = async () => {
    setIsUpdating(true);
    setUpdateError(null);
    setUpdateSuccess(false);
    const supabase = createClient();

    try {
      console.log(formData);
      const { error } = await supabase
        .from("profiles")
        .update(formData)
        .eq("id", user?.id);

      if (error) {
        throw error;
      }

      setProfile(formData);
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
    <>
      <Content size="md" title="Data Profil">
        {/* Tampilkan pesan sukses atau error setelah pembaruan */}
        {updateSuccess && (
          <Alert className="mb-4 bg-green-500 text-white">
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
            <p className="p-2 border border-border rounded-md bg-muted/50">
              {profile?.role || "-"}
            </p>
          </div>
          <div>
            <label className="mb-2 block font-medium">Lokasi</label>
            {!editMode ? (
              <p className="p-2 border border-border rounded-md bg-muted/50">
                {profile?.lokasi || "-"}
              </p>
            ) : (
              <Combobox data={dataLokasi} onChange={handleLokasiChange} />
            )}
          </div>
          <div>
            <label className="mb-2 block font-medium">Departemen</label>
            {!editMode ? (
              <p className="p-2 border border-border rounded-md bg-muted/50">
                {profile?.department || "-"}
              </p>
            ) : (
              <Combobox
                data={dataDepartment}
                onChange={handleDepartmentChange}
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
      <Content size="xs">
        <div className="flex justify-between items-center">
          <Label className="text-base font-bold">Pengaturan Tema</Label>
          <ThemeSwitcher />
        </div>
      </Content>
    </>
  );
}
