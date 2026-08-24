"use client";

import { PicPopover } from "@/components/pic-popover";
import { GA_DEPARTMENTS } from "@/lib/constants/departments";

export function PicGaPopover() {
  return (
    <PicPopover
      label="PIC GA"
      title="PIC General Affair validator"
      emptyMessage="Belum ada approver GA terdaftar."
      departments={GA_DEPARTMENTS}
    />
  );
}
