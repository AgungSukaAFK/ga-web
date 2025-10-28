"use client";

import { Content } from "@/components/content";
import { Input } from "@/components/ui/input";
import { createClient } from "@/lib/supabase/client";
import React, { useEffect, useState, Suspense, use } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Loader2, Save, X, Edit as EditIcon, Terminal } from "lucide-react";
import { Combobox, ComboboxData } from "@/components/combobox";
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

const dataRole: ComboboxData = [
  { label: "Admin", value: "admin" },
  { label: "Approver", value: "approver" },
  { label: "Requester", value: "requester" },
  { label: "User", value: "user" },
];

const dataDepartment: ComboboxData = [
  { label: "General Affair", value: "General Affair" },
  { label: "Marketing", value: "Marketing" },
  { label: "Produksi", value: "Produksi" },
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
  const router = useRouter();
  const { userid } = params;

  useEffect(() => {
    async function fetchUserData() {
      const supabase = createClient();
      setLoading(true);

      try {
        // REVISI: Mengambil semua kolom dari view
        const { data, error } = await supabase
          .from("users_with_profiles")
          .select("id, email, nama, role, lokasi, department, company, nrp")
          .eq("id", userid)
          .single();

        if (error || !data) {
          console.error("User with profile not found:", error);
          toast.error("User tidak ditemukan.");
          router.push("/user-management"); // Sesuaikan route jika perlu
          return;
        }

        setUser(data);
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
