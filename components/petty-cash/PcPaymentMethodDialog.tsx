// src/components/petty-cash/PcPaymentMethodDialog.tsx
//
// Dialog "Ubah Metode Pencairan" sebuah Voucher - utk GA/Finance/admin/
// approver Voucher di luar alur "Edit & Setujui" (mis. ternyata harus lewat
// Overbook setelah Voucher disetujui). Rekening pilihan = rekening tersimpan
// milik pemohon (lewat RPC, lihat fetchVoucherOwnerBankAccounts) atau isi
// manual. Hak akses dicek ulang di RPC update_petty_cash_voucher_payment_method.

"use client";

import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { toast } from "@/lib/toast";
import { pickPcPayment, validatePcPayment } from "@/lib/pcPayment";
import {
  fetchVoucherOwnerBankAccounts,
  updateVoucherPaymentMethod,
} from "@/services/pettyCashVoucherService";
import { BankAccount, PcPaymentInfo, PettyCashVoucher } from "@/type";
import { PcPaymentMethodField } from "./PcPaymentMethodField";
import { Loader2, Wallet } from "lucide-react";

export function PcPaymentMethodDialog({
  voucher,
  open,
  onOpenChange,
  onSaved,
}: {
  voucher: Pick<
    PettyCashVoucher,
    | "id"
    | "kode_voucher"
    | "payment_method"
    | "bank_name"
    | "bank_account_number"
    | "bank_account_holder_name"
  >;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSaved?: () => void | Promise<void>;
}) {
  const [value, setValue] = useState<PcPaymentInfo>(pickPcPayment(voucher));
  const [accounts, setAccounts] = useState<BankAccount[]>([]);
  const [loadingAccounts, setLoadingAccounts] = useState(false);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!open) return;
    setValue(pickPcPayment(voucher));
    setLoadingAccounts(true);
    fetchVoucherOwnerBankAccounts(voucher.id)
      .then(setAccounts)
      .catch((error: any) => {
        setAccounts([]);
        toast.error("Gagal memuat rekening pemohon", {
          description: error.message,
        });
      })
      .finally(() => setLoadingAccounts(false));
  }, [open, voucher.id]);

  const handleSave = async () => {
    const error = validatePcPayment(value);
    if (error) return toast.error(error);
    setSaving(true);
    try {
      await updateVoucherPaymentMethod(voucher.id, value);
      toast.success(`Metode pencairan ${voucher.kode_voucher} diperbarui.`);
      onOpenChange(false);
      await onSaved?.();
    } catch (err: any) {
      toast.error("Gagal mengubah metode pencairan", {
        description: err.message,
      });
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={(o) => !saving && onOpenChange(o)}>
      <DialogContent className="sm:max-w-xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Wallet className="h-5 w-5 text-primary" />
            Ubah Metode Pencairan
          </DialogTitle>
          <DialogDescription>
            {voucher.kode_voucher} - berlaku utk tarikan yang belum dibayar.
            Perubahan dicatat di riwayat diskusi Voucher.
          </DialogDescription>
        </DialogHeader>

        <PcPaymentMethodField
          value={value}
          onChange={setValue}
          accounts={accounts}
          loadingAccounts={loadingAccounts}
          allowManualAccount
          disabled={saving}
        />

        <DialogFooter>
          <Button
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={saving}
          >
            Batal
          </Button>
          <Button onClick={handleSave} disabled={saving}>
            {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Simpan
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
