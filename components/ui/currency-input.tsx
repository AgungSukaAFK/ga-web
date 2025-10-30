// src/components/ui/currency-input.tsx

"use client";

import * as React from "react";
import { Input } from "@/components/ui/input"; // Hanya 'Input' yang diimpor
import { cn } from "@/lib/utils";

// Fungsi helper untuk format
const formatRupiah = (value: number | string): string => {
  const numericValue = Number(String(value).replace(/[^0-9]/g, ""));
  if (isNaN(numericValue) || numericValue === 0) {
    return ""; // Kembalikan string kosong jika 0 atau NaN
  }
  return new Intl.NumberFormat("id-ID", {
    style: "currency",
    currency: "IDR",
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  })
    .format(numericValue)
    .replace("Rp", "Rp "); // Tambah spasi
};

// Fungsi helper untuk parsing
const parseRupiah = (formattedValue: string): number => {
  return Number(formattedValue.replace(/[^0-9]/g, ""));
};

// REVISI: Ganti 'InputProps' dengan 'React.ComponentProps<"input">'
export interface CurrencyInputProps
  extends Omit<React.ComponentProps<"input">, "onChange" | "value"> {
  value: number | null | undefined;
  onValueChange: (value: number) => void;
}

const CurrencyInput = React.forwardRef<HTMLInputElement, CurrencyInputProps>(
  ({ className, value, onValueChange, onBlur, ...props }, ref) => {
    const [displayValue, setDisplayValue] = React.useState<string>(() => {
      return value ? formatRupiah(value) : "";
    });

    React.useEffect(() => {
      const numericValue = value || 0;
      const formatted = formatRupiah(numericValue);

      // Cek apakah nilai angka dari displayValue sama dengan value prop
      const displayNumericValue = parseRupiah(displayValue);

      if (numericValue !== displayNumericValue) {
        setDisplayValue(formatted);
      }

      if (numericValue === 0 && displayValue !== "") {
        setDisplayValue("");
      }
    }, [value]); // Hanya bergantung pada 'value' prop

    const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
      const inputVal = e.target.value;
      const numericValue = parseRupiah(inputVal);

      if (numericValue > 9999999999999) {
        // Batas aman
        return;
      }

      setDisplayValue(formatRupiah(numericValue));
      onValueChange(numericValue);
    };

    const handleBlur = (e: React.FocusEvent<HTMLInputElement>) => {
      const numericValue = parseRupiah(e.target.value);
      setDisplayValue(formatRupiah(numericValue));

      if (onBlur) {
        onBlur(e);
      }
    };

    return (
      <Input
        type="text"
        className={cn("text-right", className)}
        ref={ref}
        value={displayValue}
        onChange={handleChange}
        onBlur={handleBlur}
        placeholder="Rp 0"
        {...props}
      />
    );
  }
);
CurrencyInput.displayName = "CurrencyInput";

export { CurrencyInput };
