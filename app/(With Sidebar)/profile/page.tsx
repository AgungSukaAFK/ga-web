"use client";

import { Content } from "@/components/content";
import { Input } from "@/components/ui/input";
import { createClient } from "@/lib/supabase/client";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { User } from "@supabase/supabase-js";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import {
  Loader2,
  Terminal,
  Eye,
  EyeOff,
  KeyRound,
  Landmark,
  Plus,
  Edit,
  Trash2,
} from "lucide-react";
import { Combobox } from "@/components/combobox";
import { ThemeSwitcher } from "@/components/theme-switcher";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { Skeleton } from "@/components/ui/skeleton";
import { dataDepartment, dataLokasi } from "@/type/comboboxData";
import { AccentThemeSwitcher } from "@/components/accent-theme-switcher";
import { NotificationSettings } from "@/components/notification-settings";
import { BankAccount } from "@/type";
import { fetchMyBankAccounts, deleteBankAccount } from "@/services/bankAccountService";
import { BankAccountDialog } from "@/components/bank-account-form-dialog";
import { ConfirmDialog } from "@/components/confirm-dialog";

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

  // --- Ubah Password ---
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showCurrentPassword, setShowCurrentPassword] = useState(false);
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [isChangingPassword, setIsChangingPassword] = useState(false);

  // --- Rekening Bank ---
  const [bankAccounts, setBankAccounts] = useState<BankAccount[]>([]);
  const [isBankDialogOpen, setIsBankDialogOpen] = useState(false);
  const [selectedBankAccount, setSelectedBankAccount] =
    useState<BankAccount | null>(null);

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

        const accounts = await fetchMyBankAccounts(user.id);
        setBankAccounts(accounts);
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

  // Ubah password sendiri - verifikasi password saat ini dulu (sign-in
  // ulang) sebelum updateUser, supaya orang yang session-nya "nyangkut"
  // di device lain tidak bisa ganti password tanpa tahu password lama.
  const handleChangePassword = async () => {
    if (!user?.email) return;

    if (!currentPassword || !newPassword || !confirmPassword) {
      toast.error("Semua kolom password wajib diisi.");
      return;
    }
    if (newPassword.length < 6) {
      toast.error("Password baru minimal 6 karakter.");
      return;
    }
    if (newPassword !== confirmPassword) {
      toast.error("Konfirmasi password baru tidak cocok.");
      return;
    }

    setIsChangingPassword(true);
    const supabase = createClient();

    try {
      const { error: signInError } = await supabase.auth.signInWithPassword({
        email: user.email,
        password: currentPassword,
      });
      if (signInError) {
        toast.error("Password saat ini salah.");
        return;
      }

      const { error: updateError } = await supabase.auth.updateUser({
        password: newPassword,
      });
      if (updateError) throw updateError;

      toast.success("Password berhasil diubah.");
      setCurrentPassword("");
      setNewPassword("");
      setConfirmPassword("");
    } catch (error: any) {
      toast.error("Gagal mengubah password", { description: error.message });
    } finally {
      setIsChangingPassword(false);
    }
  };

  const handleOpenAddBank = () => {
    setSelectedBankAccount(null);
    setIsBankDialogOpen(true);
  };

  const handleOpenEditBank = (account: BankAccount) => {
    setSelectedBankAccount(account);
    setIsBankDialogOpen(true);
  };

  const handleBankSaved = (account: BankAccount) => {
    setBankAccounts((prev) =>
      prev.some((a) => a.id === account.id)
        ? prev.map((a) => (a.id === account.id ? account : a))
        : [...prev, account],
    );
  };

  const handleDeleteBank = async (id: number) => {
    try {
      await deleteBankAccount(id);
      setBankAccounts((prev) => prev.filter((a) => a.id !== id));
      toast.success("Rekening berhasil dihapus.");
    } catch (err: any) {
      toast.error("Gagal menghapus rekening", { description: err.message });
    }
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
      {/* Kolom kanan: Ubah Password + Pengaturan Tema + Notifikasi ditumpuk agar mengisi ruang kosong */}
      <div className="col-span-12 flex flex-col gap-4 md:gap-6 lg:col-span-6">
        <Content size="lg">
          <div className="flex items-center gap-2 mb-4">
            <KeyRound className="h-4 w-4" />
            <Label className="text-base font-bold">Ubah Password</Label>
          </div>
          <div className="space-y-4">
            <div>
              <Label className="mb-2 block font-medium">
                Password Saat Ini
              </Label>
              <div className="relative">
                <Input
                  type={showCurrentPassword ? "text" : "password"}
                  value={currentPassword}
                  onChange={(e) => setCurrentPassword(e.target.value)}
                  disabled={isChangingPassword}
                  className="pr-10"
                />
                <button
                  type="button"
                  onClick={() => setShowCurrentPassword((v) => !v)}
                  className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                  tabIndex={-1}
                >
                  {showCurrentPassword ? (
                    <EyeOff className="h-4 w-4" />
                  ) : (
                    <Eye className="h-4 w-4" />
                  )}
                </button>
              </div>
            </div>
            <div>
              <Label className="mb-2 block font-medium">Password Baru</Label>
              <div className="relative">
                <Input
                  type={showNewPassword ? "text" : "password"}
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  disabled={isChangingPassword}
                  className="pr-10"
                />
                <button
                  type="button"
                  onClick={() => setShowNewPassword((v) => !v)}
                  className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                  tabIndex={-1}
                >
                  {showNewPassword ? (
                    <EyeOff className="h-4 w-4" />
                  ) : (
                    <Eye className="h-4 w-4" />
                  )}
                </button>
              </div>
            </div>
            <div>
              <Label className="mb-2 block font-medium">
                Konfirmasi Password Baru
              </Label>
              <div className="relative">
                <Input
                  type={showNewPassword ? "text" : "password"}
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  disabled={isChangingPassword}
                  className="pr-10"
                />
              </div>
            </div>
            <div className="flex justify-end">
              <Button
                onClick={handleChangePassword}
                disabled={isChangingPassword}
              >
                {isChangingPassword ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Menyimpan...
                  </>
                ) : (
                  "Simpan Password"
                )}
              </Button>
            </div>
          </div>
        </Content>
        <Content size="lg">
          {/* --- REVISI: Tambahkan AccentThemeSwitcher --- */}
          <div className="flex flex-wrap items-center justify-between gap-3">
            <Label className="text-base font-bold">Pengaturan Tema</Label>
            <div className="flex items-center gap-1">
              <AccentThemeSwitcher />
              <ThemeSwitcher />
            </div>
          </div>
          {/* --- AKHIR REVISI --- */}
        </Content>
        <Content size="lg">
          <NotificationSettings />
        </Content>
        <Content size="lg">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              <Landmark className="h-4 w-4" />
              <Label className="text-base font-bold">Rekening Bank</Label>
            </div>
            <Button size="sm" onClick={handleOpenAddBank}>
              <Plus className="mr-2 h-4 w-4" /> Tambah Rekening
            </Button>
          </div>
          {bankAccounts.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              Belum ada rekening tersimpan. Rekening dibutuhkan saat membuat
              pengajuan Petty Cash tipe Reimbursement.
            </p>
          ) : (
            <div className="space-y-2">
              {bankAccounts.map((account) => (
                <div
                  key={account.id}
                  className="flex items-center justify-between gap-3 p-3 border border-border rounded-md"
                >
                  <div className="text-sm min-w-0">
                    <p className="font-semibold truncate">
                      {account.bank_name} - {account.account_number}
                    </p>
                    <p className="text-muted-foreground text-xs truncate">
                      a.n. {account.account_holder_name}
                    </p>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => handleOpenEditBank(account)}
                    >
                      <Edit className="h-3 w-3" />
                    </Button>
                    <ConfirmDialog
                      title={`Hapus Rekening: ${account.bank_name}`}
                      description="Apakah Anda yakin ingin menghapus rekening ini? Tindakan ini tidak dapat dibatalkan."
                      onConfirm={() => handleDeleteBank(account.id)}
                    >
                      <Button variant="destructive" size="sm">
                        <Trash2 className="h-3 w-3" />
                      </Button>
                    </ConfirmDialog>
                  </div>
                </div>
              ))}
            </div>
          )}
        </Content>
      </div>
      <BankAccountDialog
        open={isBankDialogOpen}
        onOpenChange={setIsBankDialogOpen}
        onSaved={handleBankSaved}
        initialData={selectedBankAccount}
        userId={user?.id || ""}
      />
    </>
  );
}
