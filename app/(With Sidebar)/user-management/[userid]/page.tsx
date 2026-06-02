"use client";

import { Content } from "@/components/content";
import { Input } from "@/components/ui/input";
import { createClient } from "@/lib/supabase/client";
import React, { useEffect, useState, Suspense, use } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import {
  Loader2,
  Save,
  X,
  Edit as EditIcon,
  Terminal,
  Power,
  PowerOff,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { Combobox, ComboboxData } from "@/components/combobox";
import { dataDepartment as sharedDepartmentData } from "@/type/comboboxData";
import { Skeleton } from "@/components/ui/skeleton";
import { Label } from "@/components/ui/label"; // Impor Label
import { toast } from "sonner";

// REVISI: Tipe Profile diperbarui sesuai skema database
type Profile = {
  nama: string | null;
  role: string | null;
  lokasi: string | null;
  department: string | null;
  company: string | null;
  nrp: string | null;
};

// REVISI: Tipe UserWithProfile diperbarui
type UserWithProfile = {
  id: string;
  email: string;
  nama: string | null;
  role: string | null;
  lokasi: string | null;
  department: string | null;
  company: string | null;
  nrp: string | null;
  is_active: boolean;
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
  { label: "GIS BPN", value: "GIS BPN" },
  { label: "Site Manado", value: "Site Manado" },
  { label: "Site DIZA", value: "Site DIZA" },
];

const dataRole: ComboboxData = [
  { label: "Admin", value: "admin" },
  { label: "Approver", value: "approver" },
  { label: "Requester", value: "requester" },
  { label: "User", value: "user" },
];

const dataDepartment: ComboboxData = [
  ...sharedDepartmentData,
  // Backward compatibility for legacy value stored in older profiles.
  { label: "Human Resource", value: "Human Resource" },
].filter(
  (item, index, list) =>
    list.findIndex((x) => x.value === item.value) === index,
);

// REVISI: Data untuk Company
const dataCompany: ComboboxData = [
  { label: "GIS (Global Inti Sejati)", value: "GIS" },
  { label: "GMI (Garuda Mart Indonesia)", value: "GMI" },
  { label: "LOURDES (Korporat)", value: "LOURDES" },
];

function EditUserPageContent({ params }: { params: { userid: string } }) {
  const [editMode, setEditMode] = useState(false);
  const [loading, setLoading] = useState(true);
  const [user, setUser] = useState<UserWithProfile | null>(null);
  const [formData, setFormData] = useState<Profile>({
    nama: null,
    role: null,
    lokasi: null,
    department: null,
    company: null,
    nrp: null,
  });
  const [isUpdating, setIsUpdating] = useState(false);
  const [updateError, setUpdateError] = useState<string | null>(null);
  const [updateSuccess, setUpdateSuccess] = useState<boolean>(false);
  const [isTogglingActive, setIsTogglingActive] = useState(false);
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);
  const router = useRouter();
  const { userid } = params;

  useEffect(() => {
    async function fetchUserData() {
      const supabase = createClient();
      setLoading(true);

      try {
        // Identitas admin yang sedang login (untuk mencegah menonaktifkan diri sendiri).
        const {
          data: { user: authUser },
        } = await supabase.auth.getUser();
        setCurrentUserId(authUser?.id ?? null);

        // REVISI: Mengambil semua kolom dari view + status aktif dari tabel profiles.
        const [{ data, error }, { data: statusData }] = await Promise.all([
          supabase
            .from("users_with_profiles")
            .select("id, email, nama, role, lokasi, department, company, nrp")
            .eq("id", userid)
            .single(),
          supabase
            .from("profiles")
            .select("is_active")
            .eq("id", userid)
            .single(),
        ]);

        if (error || !data) {
          console.error("User with profile not found:", error);
          toast.error("User tidak ditemukan.");
          router.push("/user-management"); // Sesuaikan route jika perlu
          return;
        }

        // is_active default true bila kolom belum diisi (kompatibilitas).
        setUser({ ...data, is_active: statusData?.is_active ?? true });
        setFormData({
          // Set semua data ke form
          nama: data.nama,
          role: data.role,
          lokasi: data.lokasi,
          department: data.department,
          company: data.company,
          nrp: data.nrp,
        });
      } catch (err) {
        console.error("Unexpected error:", err);
        toast.error("Terjadi kesalahan tak terduga.");
      } finally {
        setLoading(false);
      }
    }

    fetchUserData();
  }, [userid, router]);

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    setFormData((prevData) => ({ ...prevData, [name]: value || null })); // Simpan null jika kosong
  };

  // Handler untuk Combobox (lebih generik)
  const handleComboboxChange = (field: keyof Profile, value: string) => {
    setFormData((prevData) => ({ ...prevData, [field]: value || null }));
  };

  const handleUpdateProfile = async () => {
    if (!user) return;
    setIsUpdating(true);
    setUpdateError(null);
    setUpdateSuccess(false);
    const supabase = createClient();

    try {
      const { error } = await supabase
        .from("profiles")
        .update({
          // Update semua field yang ada di formData
          nama: formData.nama,
          role: formData.role,
          lokasi: formData.lokasi,
          department: formData.department,
          company: formData.company,
          nrp: formData.nrp,
        })
        .eq("id", user.id);

      if (error) throw error;

      // Update state user lokal setelah sukses
      setUser((prev) => (prev ? { ...prev, ...formData } : null));
      setEditMode(false);
      setUpdateSuccess(true);
      toast.success("Profil berhasil diperbarui!");
    } catch (error: any) {
      console.error("Error updating profile:", error.message);
      setUpdateError("Gagal memperbarui profil: " + error.message);
      toast.error("Gagal memperbarui profil", { description: error.message });
    } finally {
      setIsUpdating(false);
    }
  };

  const handleCancelEdit = () => {
    setEditMode(false);
    if (user) {
      // Reset form ke data asli
      setFormData({
        nama: user.nama,
        role: user.role,
        lokasi: user.lokasi,
        department: user.department,
        company: user.company,
        nrp: user.nrp,
      });
    }
    setUpdateError(null);
    setUpdateSuccess(false);
  };

  const handleToggleActive = async () => {
    if (!user) return;
    const nextActive = !user.is_active;
    setIsTogglingActive(true);
    const supabase = createClient();

    try {
      const { error } = await supabase
        .from("profiles")
        .update({ is_active: nextActive })
        .eq("id", user.id);

      if (error) throw error;

      setUser((prev) => (prev ? { ...prev, is_active: nextActive } : prev));
      toast.success(
        nextActive
          ? "Akun berhasil diaktifkan kembali."
          : "Akun berhasil dinonaktifkan.",
      );
    } catch (error: any) {
      console.error("Error toggling active status:", error.message);
      toast.error("Gagal mengubah status akun", {
        description: error.message,
      });
    } finally {
      setIsTogglingActive(false);
    }
  };

  if (loading) {
    return (
      <Content size="md" title="Edit Profil">
        <Skeleton className="h-96 w-full" />
      </Content>
    );
  }

  if (!user) {
    return (
      <Content size="md" title="Edit Profil">
        <Alert variant="destructive">
          <Terminal className="h-4 w-4" />
          <AlertTitle>Error</AlertTitle>
          <AlertDescription>User tidak ditemukan.</AlertDescription>
        </Alert>
      </Content>
    );
  }

  return (
    <>
      <Content size="md" title={`Edit Profil - ${user.email}`}>
        {updateSuccess && (
          <Alert className="mb-4 bg-green-100 border-green-400 text-green-700">
            <Terminal className="h-4 w-4" />
            <AlertTitle>Berhasil!</AlertTitle>
            <AlertDescription>Profil berhasil diperbarui.</AlertDescription>
          </Alert>
        )}
        {updateError && (
          <Alert variant="destructive" className="mb-4">
            <Terminal className="h-4 w-4" />
            <AlertTitle>Gagal!</AlertTitle>
            <AlertDescription>{updateError}</AlertDescription>
          </Alert>
        )}

        <div className="space-y-4">
          <div>
            <Label className="mb-2 block font-medium">Nama</Label>
            {!editMode ? (
              <p className="p-2 border rounded-md bg-muted/50 min-h-10">
                {user.nama || "-"}
              </p>
            ) : (
              <Input
                name="nama"
                value={formData.nama || ""}
                onChange={handleInputChange}
                placeholder="Nama Lengkap"
              />
            )}
          </div>

          <div>
            <Label className="mb-2 block font-medium">Email</Label>
            <Input value={user.email || ""} disabled className="bg-muted/30" />
          </div>

          {/* REVISI: NRP */}
          <div>
            <Label className="mb-2 block font-medium">NRP</Label>
            {!editMode ? (
              <p className="p-2 border rounded-md bg-muted/50 min-h-10">
                {user.nrp || "-"}
              </p>
            ) : (
              <Input
                name="nrp"
                value={formData.nrp || ""}
                onChange={handleInputChange}
                placeholder="Nomor Registrasi Pokok"
              />
            )}
          </div>

          {/* REVISI: Company */}
          <div>
            <Label className="mb-2 block font-medium">Perusahaan</Label>
            {!editMode ? (
              <p className="p-2 border rounded-md bg-muted/50 min-h-10">
                {user.company || "-"}
              </p>
            ) : (
              <Combobox
                data={dataCompany}
                onChange={(value) => handleComboboxChange("company", value)}
                defaultValue={formData.company || ""}
              />
            )}
          </div>

          <div>
            <Label className="mb-2 block font-medium">Role</Label>
            {!editMode ? (
              <p className="p-2 border rounded-md bg-muted/50 min-h-10">
                {user.role || "-"}
              </p>
            ) : (
              <Combobox
                data={dataRole}
                onChange={(value) => handleComboboxChange("role", value)}
                defaultValue={formData.role || ""}
              />
            )}
          </div>

          <div>
            <Label className="mb-2 block font-medium">Lokasi</Label>
            {!editMode ? (
              <p className="p-2 border rounded-md bg-muted/50 min-h-10">
                {user.lokasi || "-"}
              </p>
            ) : (
              <Combobox
                data={dataLokasi}
                onChange={(value) => handleComboboxChange("lokasi", value)}
                defaultValue={formData.lokasi || ""}
              />
            )}
          </div>

          <div>
            <Label className="mb-2 block font-medium">Departemen</Label>
            {!editMode ? (
              <p className="p-2 border rounded-md bg-muted/50 min-h-10">
                {user.department || "-"}
              </p>
            ) : (
              <Combobox
                data={dataDepartment}
                onChange={(value) => handleComboboxChange("department", value)}
                defaultValue={formData.department || ""}
              />
            )}
          </div>
        </div>

        <div className="mt-6 flex justify-end gap-2">
          {!editMode ? (
            <Button onClick={() => setEditMode(true)}>
              <EditIcon className="mr-2 h-4 w-4" /> Edit Profil
            </Button>
          ) : (
            <>
              <Button variant="outline" onClick={handleCancelEdit}>
                <X className="mr-2 h-4 w-4" /> Batal
              </Button>
              <Button onClick={handleUpdateProfile} disabled={isUpdating}>
                {isUpdating ? (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                ) : (
                  <Save className="mr-2 h-4 w-4" />
                )}
                Simpan Perubahan
              </Button>
            </>
          )}
        </div>
      </Content>

      {/* --- Kartu terpisah: Status Akun (Aktif / Nonaktif) --- */}
      <Content
        size="md"
        title="Status Akun"
        description="Kelola akses login akun ini ke sistem."
      >
        <div>
          <div className="mb-4 flex items-center gap-2">
            <span className="text-sm font-medium">Status saat ini:</span>
            {user.is_active ? (
              <Badge className="bg-green-100 text-green-700 hover:bg-green-100">
                Aktif
              </Badge>
            ) : (
              <Badge variant="destructive">Nonaktif</Badge>
            )}
          </div>
          <h3 className="font-semibold">
            {user.is_active ? "Nonaktifkan Akun" : "Aktifkan Akun"}
          </h3>
          <p className="mt-1 text-sm text-muted-foreground">
            {user.is_active
              ? "User yang dinonaktifkan tidak dapat login dan tidak akan muncul di sistem (misalnya saat pembuatan template approval). Datanya tetap tersimpan dan bisa diaktifkan kembali kapan saja."
              : "Aktifkan kembali akun ini agar user dapat login dan kembali muncul di sistem."}
          </p>

          {user.id === currentUserId ? (
            <p className="mt-3 text-sm text-amber-600">
              Anda tidak dapat menonaktifkan akun Anda sendiri.
            </p>
          ) : (
            <AlertDialog>
              <AlertDialogTrigger asChild>
                <Button
                  variant={user.is_active ? "destructive" : "default"}
                  className="mt-3"
                  disabled={isTogglingActive}
                >
                  {isTogglingActive ? (
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  ) : user.is_active ? (
                    <PowerOff className="mr-2 h-4 w-4" />
                  ) : (
                    <Power className="mr-2 h-4 w-4" />
                  )}
                  {user.is_active ? "Nonaktifkan Akun" : "Aktifkan Akun"}
                </Button>
              </AlertDialogTrigger>
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle>
                    {user.is_active
                      ? "Nonaktifkan akun ini?"
                      : "Aktifkan kembali akun ini?"}
                  </AlertDialogTitle>
                  <AlertDialogDescription>
                    {user.is_active
                      ? `Akun "${user.nama || user.email}" tidak akan bisa login dan akan disembunyikan dari sistem. Anda dapat mengaktifkannya kembali kapan saja.`
                      : `Akun "${user.nama || user.email}" akan dapat login kembali dan muncul lagi di sistem.`}
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel>Batal</AlertDialogCancel>
                  <AlertDialogAction onClick={handleToggleActive}>
                    {user.is_active ? "Ya, Nonaktifkan" : "Ya, Aktifkan"}
                  </AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
          )}
        </div>
      </Content>
    </>
  );
}

// Bungkus dengan Suspense karena menggunakan use(params)
export default function EditUserPage({
  params,
}: {
  params: Promise<{ userid: string }>;
}) {
  const resolvedParams = use(params);
  return (
    <Suspense
      fallback={
        <Content size="md" title="Edit Profil">
          <Skeleton className="h-96 w-full" />
        </Content>
      }
    >
      <EditUserPageContent params={resolvedParams} />
    </Suspense>
  );
}
