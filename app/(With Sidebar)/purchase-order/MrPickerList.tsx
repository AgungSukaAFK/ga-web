// src/app/(With Sidebar)/purchase-order/MrPickerList.tsx
//
// Daftar MR yang bisa dipilih jadi dasar PO - dipakai dialog "Cari MR untuk
// PO" (CreatePOModal) & "Kaitkan Material Request" (create/page.tsx). MR yang
// belum memenuhi syarat (lihat fetchMrsForPoPicker) tetap ditampilkan tapi
// muted & tidak bisa dipilih, lengkap dengan syarat yang belum terpenuhi.

"use client";

import { Badge } from "@/components/ui/badge";
import { Ban, FilePlus2, Loader2 } from "lucide-react";
import { PoPickerMaterialRequest } from "@/services/purchaseOrderService";
import { extractPlainText } from "@/lib/rich-content";
import { cn, formatCurrency } from "@/lib/utils";

interface MrPickerListProps {
  mrs: PoPickerMaterialRequest[];
  loading: boolean;
  onSelect: (mr: PoPickerMaterialRequest) => void;
}

function MrPickerItem({
  mr,
  onSelect,
}: {
  mr: PoPickerMaterialRequest;
  onSelect: (mr: PoPickerMaterialRequest) => void;
}) {
  const disabled = !!mr.ineligible_reason;

  return (
    <button
      type="button"
      disabled={disabled}
      onClick={() => onSelect(mr)}
      className={cn(
        "w-full text-left p-3 border rounded-lg flex justify-between items-start gap-4 group transition-colors",
        disabled ? "cursor-not-allowed bg-muted/40" : "hover:bg-accent",
      )}
    >
      <div className="flex-1 min-w-0">
        <div className={cn("space-y-2", disabled && "opacity-60")}>
          <div className="flex items-center gap-2 flex-wrap">
            <span className="font-semibold text-base [overflow-wrap:anywhere]">
              {mr.kode_mr}
            </span>
            <Badge variant="outline" className="text-xs">
              {mr.status}
            </Badge>
            {mr.department && (
              <Badge variant="secondary" className="text-xs">
                {mr.department}
              </Badge>
            )}
          </div>
          <p className="text-sm text-muted-foreground line-clamp-2 break-words">
            {extractPlainText(mr.remarks) || "Tidak ada remarks."}
          </p>
          <p className="text-xs text-muted-foreground">
            Estimasi: {formatCurrency(mr.cost_estimation ?? undefined)}
          </p>
        </div>
        {disabled && (
          <p className="mt-2 flex items-start gap-1.5 text-xs font-medium text-amber-700 dark:text-amber-300">
            <Ban className="h-3.5 w-3.5 flex-shrink-0 mt-px" />
            {mr.ineligible_reason}
          </p>
        )}
      </div>
      {!disabled && (
        <FilePlus2 className="h-5 w-5 text-muted-foreground group-hover:text-primary flex-shrink-0 mt-1" />
      )}
    </button>
  );
}

export function MrPickerList({ mrs, loading, onSelect }: MrPickerListProps) {
  if (loading) {
    return (
      <div className="flex justify-center items-center py-10">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (mrs.length === 0) {
    return (
      <div className="text-center py-8">
        <p className="font-semibold">Tidak Ada MR yang Ditemukan</p>
        <p className="text-sm text-muted-foreground">
          Coba kata kunci lain (Kode MR, remarks, atau departemen).
        </p>
      </div>
    );
  }

  const eligible = mrs.filter((mr) => !mr.ineligible_reason);
  const ineligible = mrs.filter((mr) => mr.ineligible_reason);

  return (
    <div className="space-y-4">
      {eligible.length > 0 ? (
        <ul className="space-y-2">
          {eligible.map((mr) => (
            <li key={mr.id}>
              <MrPickerItem mr={mr} onSelect={onSelect} />
            </li>
          ))}
        </ul>
      ) : (
        <p className="text-sm text-muted-foreground text-center py-4">
          Tidak ada MR yang siap dibuatkan PO.
        </p>
      )}

      {ineligible.length > 0 && (
        <div className="space-y-2">
          <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
            Belum memenuhi syarat PO ({ineligible.length})
          </p>
          <ul className="space-y-2">
            {ineligible.map((mr) => (
              <li key={mr.id}>
                <MrPickerItem mr={mr} onSelect={onSelect} />
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
