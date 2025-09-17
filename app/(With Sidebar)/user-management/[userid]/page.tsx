"use client";

import { Content } from "@/components/content";
import { Input } from "@/components/ui/input";
import { createClient } from "@/lib/supabase/client";
import React, { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Terminal } from "lucide-react";
import { Combobox, ComboboxData } from "@/components/combobox";

type Profile = {
  nama: string | null;
  role: string | null;
  lokasi: string | null;
  department: string | null;
};

type UserWithProfile = {
  id: string;
  email: string;
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

const dataRole: ComboboxData = [
  { label: "Admin", value: "admin" },
  { label: "Approver", value: "approver" },
  { label: "Requester", value: "requester" },
  { label: "User", value: "user" },
];

const dataDepartment: ComboboxData = [
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

export default function EditUserPage({
  params,
}: {
  params: Promise<{ userid: string }>;
}) {
  const [editMode, setEditMode] = useState(false);
  const [loading, setLoading] = useState(true);
  const [user, setUser] = useState<UserWithProfile | null>(null);
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

  const { userid } = React.use(params);

  useEffect(() => {
    async function fetchUserData() {
      const supabase = createClient();
      setLoading(true);

      try {
        const { data, error } = await supabase
          .from("users_with_profiles")
          .select("id, email, nama, role, lokasi, department")
          .eq("id", userid)
          .single();

        if (error || !data) {
          console.error("User with profile not found:", error);
          router.push("/users");
          return;
        }

        setUser(data);
        setFormData({
          nama: data.nama,
          role: data.role,
          lokasi: data.lokasi,
          department: data.department,
        });
      } catch (err) {
        console.error("Unexpected error:", err);
      } finally {
        setLoading(false);
      }
    }

    fetchUserData();
  }, [userid, router]);

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    setFormData((prevData) => ({ ...prevData, [name]: value }));
  };

  const handleLokasiChange = (value: string) => {
    setFormData((prevData) => ({ ...prevData, lokasi: value }));
  };

  const handleRoleChange = (value: string) => {
    setFormData((prevData) => ({ ...prevData, role: value }));
  };

  const handleDepartmentChange = (value: string) => {
    setFormData((prevData) => ({ ...prevData, department: value }));
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
        .update(formData)
        .eq("id", user.id);

      if (error) throw error;

      setUser((prev) => (prev ? { ...prev, ...formData } : null));
      setEditMode(false);
      setUpdateSuccess(true);
    } catch (error: any) {
      console.error("Error updating profile:", error.message);
      setUpdateError("Gagal memperbarui profil: " + error.message);
    } finally {
      setIsUpdating(false);
    }
  };

  const handleCancelEdit = () => {
    setEditMode(false);
    if (user) {
      setFormData({
        nama: user.nama,
        role: user.role,
        lokasi: user.lokasi,
        department: user.department,
      });
    }
    setUpdateError(null);
    setUpdateSuccess(false);
  };

  if (loading) {
    return (
      <Content size="md" title="Edit Profil">
        <p>Memuat data...</p>
      </Content>
    );
  }

  return (
    <Content size="md" title={`Edit Profil - ${user?.email}`}>
      {updateSuccess && (
        <Alert className="mb-4 bg-green-500 text-white">
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
          <label className="mb-2 block font-medium">Nama</label>
          {!editMode ? (
            <p className="p-2 border rounded-md bg-muted/50">
              {user?.nama || "-"}
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
          <Input value={user?.email || ""} disabled />
        </div>

        <div>
          <label className="mb-2 block font-medium">Role</label>
          {!editMode ? (
            <p className="p-2 border rounded-md bg-muted/50">
              {user?.role || "-"}
            </p>
          ) : (
            <Combobox
              data={dataRole}
              onChange={handleRoleChange}
              defaultValue={user?.role || ""}
            />
          )}
        </div>

        <div>
          <label className="mb-2 block font-medium">Lokasi</label>
          {!editMode ? (
            <p className="p-2 border rounded-md bg-muted/50">
              {user?.lokasi || "-"}
            </p>
          ) : (
            <Combobox
              data={dataLokasi}
              onChange={handleLokasiChange}
              defaultValue={user?.lokasi || ""}
            />
          )}
        </div>

        <div>
          <label className="mb-2 block font-medium">Departemen</label>
          {!editMode ? (
            <p className="p-2 border rounded-md bg-muted/50">
              {user?.department || "-"}
            </p>
          ) : (
            <Combobox
              data={dataDepartment}
              onChange={handleDepartmentChange}
              defaultValue={user?.department || ""}
            />
          )}
        </div>
      </div>

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
