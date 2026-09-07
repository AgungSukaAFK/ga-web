// src/components/bank-account-form-dialog.tsx

"use client";

import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";
import { BankAccount } from "@/type";
import { createBankAccount, updateBankAccount } from "@/services/bankAccountService";

// Dialog CRUD tambah/edit rekening bank - dipakai dari halaman Profile (kelola
// daftar rekening) dan dari form Buat Petty Cash Reimbursement (quick-add).
// `onSaved` menerima rekening yang baru dibuat/diperbarui supaya pemanggil
// bisa langsung memilihnya (lihat buat/page.tsx) atau cukup append ke list
// lokal (lihat profile/page.tsx) tanpa perlu refetch.
export function BankAccountDialog({
  open,
  onOpenChange,
  onSaved,
  initialData,
  userId,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSaved: (account: BankAccount) => void;
  initialData: BankAccount | null; // null = Create Mode
  userId: string;
}) {
  const [formData, setFormData] = useState({
    bank_name: "",
    account_number: "",
    account_holder_name: "",
  });
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (initialData) {
      setFormData({
        bank_name: initialData.bank_name,
        account_number: initialData.account_number,
        account_holder_name: initialData.account_holder_name,
      });
    } else {
      setFormData({ bank_name: "", account_number: "", account_holder_name: "" });
    }
  }, [initialData, open]);

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
  };

  const isCreateMode = !initialData;

  const handleSubmit = async () => {
    if (
      !formData.bank_name.trim() ||
      !formData.account_number.trim() ||
      !formData.account_holder_name.trim()
    ) {
      toast.error("Nama Bank, Nomor Rekening, dan Atas Nama wajib diisi.");
      return;
    }

    setLoading(true);
    try {
      const saved = isCreateMode
        ? await createBankAccount(formData, userId)
        : await updateBankAccount(initialData!.id, formData);

      toast.success(
        isCreateMode ? "Rekening berhasil ditambahkan." : "Rekening berhasil diperbarui.",
      );
      onSaved(saved);
      onOpenChange(false);
    } catch (err: any) {
      toast.error("Gagal menyimpan rekening", { description: err.message });
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>
            {isCreateMode ? "Tambah Rekening Bank" : "Edit Rekening Bank"}
          </DialogTitle>
        </DialogHeader>
        <div className="grid gap-4 py-4">
          <div className="grid grid-cols-4 items-center gap-4">
            <Label htmlFor="bank_name" className="text-right">
              Nama Bank
            </Label>
            <Input
              id="bank_name"
              name="bank_name"
              value={formData.bank_name}
              onChange={handleInputChange}
              className="col-span-3"
              disabled={loading}
              placeholder="Ex: BCA"
            />
          </div>
          <div className="grid grid-cols-4 items-center gap-4">
            <Label htmlFor="account_number" className="text-right">
              Nomor Rekening
            </Label>
            <Input
              id="account_number"
              name="account_number"
              value={formData.account_number}
              onChange={handleInputChange}
              className="col-span-3"
              disabled={loading}
              placeholder="Ex: 1234567890"
            />
          </div>
          <div className="grid grid-cols-4 items-center gap-4">
            <Label htmlFor="account_holder_name" className="text-right">
              Atas Nama
            </Label>
            <Input
              id="account_holder_name"
              name="account_holder_name"
              value={formData.account_holder_name}
              onChange={handleInputChange}
              className="col-span-3"
              disabled={loading}
              placeholder="Sesuai buku tabungan"
            />
          </div>
        </div>
        <DialogFooter>
          <Button
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={loading}
          >
            Batal
          </Button>
          <Button onClick={handleSubmit} disabled={loading}>
            {loading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : "Simpan"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
