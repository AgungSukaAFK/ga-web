// src/app/(With Sidebar)/petty-cash/budgeting/page.tsx

import { Suspense } from "react";
import {
  PettyCashBudgetingClientContent,
  PettyCashBudgetingSkeleton,
} from "./PettyCashBudgetingClient";

export default function PettyCashBudgetingPage() {
  return (
    <Suspense fallback={<PettyCashBudgetingSkeleton />}>
      <PettyCashBudgetingClientContent />
    </Suspense>
  );
}
