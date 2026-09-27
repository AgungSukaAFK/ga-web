// src/components/petty-cash/PcChainStepper.tsx
//
// Mini stepper horizontal 4 titik (Pengajuan - Voucher - Tarikan Dana -
// Deklarasi) - dipakai kartu "Pengajuan Berjalan" di Dashboard Petty Cash
// (lihat planning-pc.md Bagian 2.2). Datanya dari computeChainSteps,
// services/pettyCashDashboardService.ts - komponen ini murni presentasi.

import { CheckIcon, XIcon } from "lucide-react";
import { cn } from "@/lib/utils";
import { PcChainStep } from "@/services/pettyCashDashboardService";

const dotClassFor = (state: PcChainStep["state"]) => {
  switch (state) {
    case "done":
      return "bg-green-600 border-green-600 text-white dark:bg-green-500 dark:border-green-500";
    case "current":
      return "bg-orange-500 border-orange-500 text-white dark:bg-orange-500 dark:border-orange-500";
    case "rejected":
      return "bg-red-600 border-red-600 text-white dark:bg-red-500 dark:border-red-500";
    default:
      return "bg-muted border-muted-foreground/30 text-muted-foreground";
  }
};

const lineClassFor = (state: PcChainStep["state"]) =>
  state === "done" ? "bg-green-600 dark:bg-green-500" : "bg-muted-foreground/20";

export function PcChainStepper({ steps }: { steps: PcChainStep[] }) {
  return (
    <div className="flex items-start gap-0">
      {steps.map((step, idx) => (
        <div key={step.key} className="flex flex-1 items-start last:flex-none">
          <div className="flex flex-col items-center gap-1">
            <div
              className={cn(
                "flex h-6 w-6 shrink-0 items-center justify-center rounded-full border-2 text-[10px] font-bold",
                dotClassFor(step.state),
              )}
              title={step.label}
            >
              {step.state === "done" ? (
                <CheckIcon className="h-3.5 w-3.5" />
              ) : step.state === "rejected" ? (
                <XIcon className="h-3.5 w-3.5" />
              ) : (
                idx + 1
              )}
            </div>
            <span className="max-w-16 text-center text-[10px] leading-tight text-muted-foreground">
              {step.label}
              {step.detail && (
                <>
                  <br />
                  <span className="font-medium text-foreground">
                    {step.detail}
                  </span>
                </>
              )}
            </span>
          </div>
          {idx < steps.length - 1 && (
            <div
              className={cn(
                "mt-3 h-0.5 flex-1",
                lineClassFor(steps[idx].state),
              )}
            />
          )}
        </div>
      ))}
    </div>
  );
}
