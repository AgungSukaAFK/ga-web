"use client";

import { PicPopover } from "@/components/pic-popover";

interface PicPoPopoverProps {
  companyCode: string | null;
}

export function PicPoPopover({ companyCode }: PicPoPopoverProps) {
  const scope =
    !companyCode || companyCode === "LOURDES"
      ? ["GMI", "GIS", "LOURDES"]
      : [companyCode, "LOURDES"];

  return (
    <PicPopover
      label="PIC PO"
      title="PIC Purchasing pembuat PO"
      emptyMessage="Belum ada PIC Purchasing terdaftar untuk company ini."
      departments={["Purchasing", "Procurement"]}
      companyScope={scope}
    />
  );
}
