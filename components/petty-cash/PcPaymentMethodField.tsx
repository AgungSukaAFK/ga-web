// src/components/petty-cash/PcPaymentMethodField.tsx
//
// Field "Metode Pencairan" Petty Cash (Transfer/Cash/Overbook, lihat
// PcPaymentMethod di type/index.ts & lib/pcPayment.ts) - dipakai bareng
// oleh dialog Buat Voucher (requester), Edit & Setujui Voucher (approver),
// dialog Ubah Metode Pencairan (GA/Finance/admin), dan form pembayaran
// Finance, supaya pilihan & aturan rekeningnya sama di semua tempat.
//
// Transfer wajib pilih rekening. Daftar rekening dimuat PEMANGGIL
// (`accounts`) karena sumbernya beda: requester = rekening miliknya sendiri
// (fetchMyBankAccounts), approver/GA/Finance = rekening pemilik Voucher
// lewat RPC (fetchVoucherOwnerBankAccounts). `quickAddUserId` (requester)
// menampilkan tombol tambah rekening baru ke Profile; `allowManualAccount`
// (approver/Finance) membolehkan isi rekening manual kalau pemohon belum
// menyimpan rekening yang dimaksud.

"use client";

import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { BankAccountDialog } from "@/components/bank-account-form-dialog";
import { cn } from "@/lib/utils";
import { formatPcBankAccount } from "@/lib/pcPayment";
import { PC_PAYMENT_METHOD_OPTIONS } from "@/type/enum";
import { BankAccount, PcPaymentInfo, PcPaymentMethod } from "@/type";
import { Banknote, Landmark, Loader2, Plus, Repeat } from "lucide-react";

const METHOD_ICON: Record<PcPaymentMethod, React.ElementType> = {
  Transfer: Landmark,
  Cash: Banknote,
  Overbook: Repeat,
};

const MANUAL_VALUE = "__manual__";
const CURRENT_VALUE = "__current__";

const accountKey = (a: {
  bank_name?: string | null;
  bank_account_number?: string | null;
  account_number?: string | null;
}) =>
  `${(a.bank_name ?? "").trim().toLowerCase()}|${(
    a.bank_account_number ??
    a.account_number ??
    ""
  ).trim()}`;

interface PcPaymentMethodFieldProps {
  value: PcPaymentInfo;
  onChange: (value: PcPaymentInfo) => void;
  accounts: BankAccount[];
  loadingAccounts?: boolean;
  // Requester: tombol "Tambah Rekening" (tersimpan ke Profile miliknya).
  quickAddUserId?: string | null;
  onAccountAdded?: (account: BankAccount) => void;
  // Approver/GA/Finance: boleh isi rekening manual.
  allowManualAccount?: boolean;
  disabled?: boolean;
  label?: string;
  // Teks bantuan di bawah pilihan metode.
  hint?: string;
}

export function PcPaymentMethodField({
  value,
  onChange,
  accounts,
  loadingAccounts = false,
  quickAddUserId,
  onAccountAdded,
  allowManualAccount = false,
  disabled = false,
  label = "Metode Pencairan",
  hint,
}: PcPaymentMethodFieldProps) {
  const [isAddOpen, setIsAddOpen] = useState(false);

  // Rekening yang sedang terisi (mis. snapshot di Voucher) tapi tidak ada di
  // daftar rekening tersimpan - tetap ditampilkan sbg pilihan tersendiri
  // supaya tidak "hilang" begitu dialog dibuka.
  const currentKey = accountKey(value);
  const matched = accounts.find((a) => accountKey(a) === currentKey);
  const hasCurrentOutsideList =
    value.payment_method === "Transfer" &&
    !!value.bank_account_number &&
    !matched;

  const [manual, setManual] = useState(false);
  useEffect(() => {
    if (value.payment_method !== "Transfer") setManual(false);
  }, [value.payment_method]);

  const selectValue = manual
    ? MANUAL_VALUE
    : matched
      ? String(matched.id)
      : hasCurrentOutsideList
        ? CURRENT_VALUE
        : "";

  const setMethod = (method: PcPaymentMethod) => {
    if (method === value.payment_method) return;
    if (method !== "Transfer") {
      onChange({
        payment_method: method,
        bank_name: null,
        bank_account_number: null,
        bank_account_holder_name: null,
      });
      return;
    }
    // Pindah ke Transfer - langsung pilih rekening pertama kalau cuma ada 1.
    const only = accounts.length === 1 ? accounts[0] : null;
    onChange({
      payment_method: "Transfer",
      bank_name: only?.bank_name ?? null,
      bank_account_number: only?.account_number ?? null,
      bank_account_holder_name: only?.account_holder_name ?? null,
    });
  };

  const selectAccount = (key: string) => {
    if (key === MANUAL_VALUE) {
      setManual(true);
      return;
    }
    setManual(false);
    if (key === CURRENT_VALUE) return;
    const account = accounts.find((a) => String(a.id) === key);
    if (!account) return;
    onChange({
      payment_method: "Transfer",
      bank_name: account.bank_name,
      bank_account_number: account.account_number,
      bank_account_holder_name: account.account_holder_name,
    });
  };

  const setManualField = (
    field: "bank_name" | "bank_account_number" | "bank_account_holder_name",
    fieldValue: string,
  ) => onChange({ ...value, payment_method: "Transfer", [field]: fieldValue });

  return (
    <div className="space-y-3">
      <div className="space-y-2">
        <Label>
          {label} <span className="text-red-500">*</span>
        </Label>
        <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
          {PC_PAYMENT_METHOD_OPTIONS.map((opt) => {
            const Icon = METHOD_ICON[opt.value];
            const active = value.payment_method === opt.value;
            return (
              <button
                key={opt.value}
                type="button"
                disabled={disabled}
                onClick={() => setMethod(opt.value)}
                aria-pressed={active}
                className={cn(
                  "flex items-start gap-2 rounded-lg border-2 p-3 text-left transition-colors disabled:opacity-60",
                  active
                    ? "border-primary bg-primary/10"
                    : "border-border hover:border-primary/40",
                )}
              >
                <Icon
                  className={cn(
                    "mt-0.5 h-4 w-4 shrink-0",
                    active ? "text-primary" : "text-muted-foreground",
                  )}
                />
                <span className="min-w-0">
                  <span
                    className={cn(
                      "block text-sm font-semibold",
                      active && "text-primary",
                    )}
                  >
                    {opt.label}
                  </span>
                  <span className="block text-xs text-muted-foreground">
                    {opt.description}
                  </span>
                </span>
              </button>
            );
          })}
        </div>
        {hint && <p className="text-xs text-muted-foreground">{hint}</p>}
      </div>

      {value.payment_method === "Transfer" && (
        <div className="space-y-2 rounded-md border bg-muted/20 p-3">
          <div className="flex items-center justify-between gap-2">
            <Label>
              Rekening Tujuan <span className="text-red-500">*</span>
            </Label>
            {quickAddUserId && (
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className="h-7 px-2"
                onClick={() => setIsAddOpen(true)}
                disabled={disabled}
              >
                <Plus className="mr-1 h-3.5 w-3.5" /> Tambah Rekening
              </Button>
            )}
          </div>

          {loadingAccounts ? (
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <Loader2 className="h-4 w-4 animate-spin" /> Memuat rekening...
            </div>
          ) : accounts.length === 0 &&
            !hasCurrentOutsideList &&
            !allowManualAccount ? (
            <p className="text-sm text-muted-foreground">
              Belum ada rekening tersimpan.{" "}
              {quickAddUserId
                ? "Tambahkan rekening dulu lewat tombol di atas (tersimpan juga di halaman Profile)."
                : "Minta pemohon menambahkan rekening di halaman Profile."}
            </p>
          ) : (
            <Select
              value={selectValue}
              onValueChange={selectAccount}
              disabled={disabled}
            >
              <SelectTrigger className="w-full">
                <SelectValue placeholder="Pilih rekening..." />
              </SelectTrigger>
              <SelectContent>
                {hasCurrentOutsideList && (
                  <SelectItem value={CURRENT_VALUE}>
                    {formatPcBankAccount(value)} (saat ini)
                  </SelectItem>
                )}
                {accounts.map((a) => (
                  <SelectItem key={a.id} value={String(a.id)}>
                    {a.bank_name} {a.account_number} a.n.{" "}
                    {a.account_holder_name}
                  </SelectItem>
                ))}
                {allowManualAccount && (
                  <SelectItem value={MANUAL_VALUE}>
                    Isi rekening lain secara manual...
                  </SelectItem>
                )}
              </SelectContent>
            </Select>
          )}

          {manual && (
            <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
              <Input
                placeholder="Nama bank"
                value={value.bank_name ?? ""}
                onChange={(e) => setManualField("bank_name", e.target.value)}
                disabled={disabled}
              />
              <Input
                placeholder="Nomor rekening"
                inputMode="numeric"
                value={value.bank_account_number ?? ""}
                onChange={(e) =>
                  setManualField("bank_account_number", e.target.value)
                }
                disabled={disabled}
              />
              <Input
                placeholder="Atas nama"
                value={value.bank_account_holder_name ?? ""}
                onChange={(e) =>
                  setManualField("bank_account_holder_name", e.target.value)
                }
                disabled={disabled}
              />
            </div>
          )}
        </div>
      )}

      {quickAddUserId && (
        <BankAccountDialog
          open={isAddOpen}
          onOpenChange={setIsAddOpen}
          initialData={null}
          userId={quickAddUserId}
          onSaved={(account) => {
            onAccountAdded?.(account);
            setManual(false);
            onChange({
              payment_method: "Transfer",
              bank_name: account.bank_name,
              bank_account_number: account.account_number,
              bank_account_holder_name: account.account_holder_name,
            });
          }}
        />
      )}
    </div>
  );
}
