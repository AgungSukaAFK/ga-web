"use client";

import { useState } from "react";
import { Loader2, UserPlus } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  SearchableSelect,
  SearchableSelectTrigger,
  SearchableSelectValue,
  SearchableSelectContent,
  SearchableSelectItem,
} from "@/components/ui/searchable-select";
import { createUserByAdmin } from "@/services/userAdminService";

const dataCompany = [
  { label: "GIS (Global Inti Sejati)", value: "GIS" },
  { label: "GMI (Garuda Mart Indonesia)", value: "GMI" },
  { label: "LOURDES (Korporat)", value: "LOURDES" },
];

const emptyForm = {
  email: "",
  password: "",
  nama: "",
  nrp: "",
  role: "user",
  lokasi: "",
  department: "",
  company: "",
};

export function CreateUserDialog({
  roles,
  lokasiOptions,
  departmentOptions,
  adminCompany,
  onCreated,
}: {
  roles: string[];
  lokasiOptions: string[];
  departmentOptions: string[];
  adminCompany: string | null | undefined;
  onCreated: () => void;
}) {
  const [open, setOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState(emptyForm);

  // Admin non-LOURDES terkunci ke company-nya sendiri (ditegakkan juga di server).
  const companyLocked = !!adminCompany && adminCompany !== "LOURDES";

  const set = (field: keyof typeof emptyForm, value: string) =>
    setForm((prev) => ({ ...prev, [field]: value }));

  const handleOpenChange = (next: boolean) => {
    setOpen(next);
    if (next) {
      setForm({ ...emptyForm, company: companyLocked ? adminCompany! : "" });
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    try {
      await createUserByAdmin({
        email: form.email,
        password: form.password,
        nama: form.nama,
        nrp: form.nrp || null,
        role: form.role,
        lokasi: form.lokasi || null,
        department: form.department || null,
        company: form.company || null,
      });
      toast.success("User berhasil dibuat", {
        description: `${form.nama} sudah bisa login dengan email/NRP & password tersebut.`,
      });
      setOpen(false);
      onCreated();
    } catch (error: any) {
      toast.error("Gagal membuat user", { description: error.message });
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogTrigger asChild>
        <Button variant="outline" className="w-full md:w-auto">
          <UserPlus className="mr-2 h-4 w-4" />
          Tambah User
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Tambah User Baru</DialogTitle>
          <DialogDescription>
            Akun langsung aktif tanpa konfirmasi email.
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="grid gap-4">
          <div className="grid gap-2">
            <Label htmlFor="cu-nama">Nama *</Label>
            <Input
              id="cu-nama"
              required
              value={form.nama}
              onChange={(e) => set("nama", e.target.value)}
              disabled={saving}
            />
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="grid gap-2">
              <Label htmlFor="cu-email">Email *</Label>
              <Input
                id="cu-email"
                type="email"
                required
                autoComplete="off"
                value={form.email}
                onChange={(e) => set("email", e.target.value)}
                disabled={saving}
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="cu-password">Password *</Label>
              <Input
                id="cu-password"
                type="text"
                required
                minLength={6}
                autoComplete="new-password"
                placeholder="Min. 6 karakter"
                value={form.password}
                onChange={(e) => set("password", e.target.value)}
                disabled={saving}
              />
            </div>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="grid gap-2">
              <Label htmlFor="cu-nrp">NRP</Label>
              <Input
                id="cu-nrp"
                value={form.nrp}
                onChange={(e) => set("nrp", e.target.value)}
                disabled={saving}
              />
            </div>
            <div className="grid gap-2">
              <Label>Role *</Label>
              <SearchableSelect
                value={form.role}
                onValueChange={(v) => set("role", v)}
                disabled={saving}
              >
                <SearchableSelectTrigger>
                  <SearchableSelectValue />
                </SearchableSelectTrigger>
                <SearchableSelectContent>
                  {roles.map((r) => (
                    <SearchableSelectItem key={r} value={r}>
                      {r}
                    </SearchableSelectItem>
                  ))}
                </SearchableSelectContent>
              </SearchableSelect>
            </div>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="grid gap-2">
              <Label>Lokasi</Label>
              <SearchableSelect
                value={form.lokasi}
                onValueChange={(v) => set("lokasi", v)}
                disabled={saving}
              >
                <SearchableSelectTrigger>
                  <SearchableSelectValue placeholder="Pilih lokasi" />
                </SearchableSelectTrigger>
                <SearchableSelectContent>
                  {lokasiOptions.map((l) => (
                    <SearchableSelectItem key={l} value={l}>
                      {l}
                    </SearchableSelectItem>
                  ))}
                </SearchableSelectContent>
              </SearchableSelect>
            </div>
            <div className="grid gap-2">
              <Label>Departemen</Label>
              <SearchableSelect
                value={form.department}
                onValueChange={(v) => set("department", v)}
                disabled={saving}
              >
                <SearchableSelectTrigger>
                  <SearchableSelectValue placeholder="Pilih departemen" />
                </SearchableSelectTrigger>
                <SearchableSelectContent>
                  {departmentOptions.map((d) => (
                    <SearchableSelectItem key={d} value={d}>
                      {d}
                    </SearchableSelectItem>
                  ))}
                </SearchableSelectContent>
              </SearchableSelect>
            </div>
          </div>
          <div className="grid gap-2">
            <Label>Perusahaan</Label>
            <SearchableSelect
              value={form.company}
              onValueChange={(v) => set("company", v)}
              disabled={saving || companyLocked}
            >
              <SearchableSelectTrigger>
                <SearchableSelectValue placeholder="Pilih perusahaan" />
              </SearchableSelectTrigger>
              <SearchableSelectContent>
                {dataCompany.map((c) => (
                  <SearchableSelectItem key={c.value} value={c.value}>
                    {c.label}
                  </SearchableSelectItem>
                ))}
              </SearchableSelectContent>
            </SearchableSelect>
          </div>
          <DialogFooter>
            <Button
              type="button"
              variant="ghost"
              onClick={() => setOpen(false)}
              disabled={saving}
            >
              Batal
            </Button>
            <Button type="submit" disabled={saving}>
              {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              {saving ? "Menyimpan..." : "Simpan"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
