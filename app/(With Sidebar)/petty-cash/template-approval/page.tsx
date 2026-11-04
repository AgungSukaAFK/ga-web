// src/app/(With Sidebar)/petty-cash/template-approval/page.tsx

import { Suspense } from "react";
import PcApprovalTemplateClient from "./PcApprovalTemplateClient";

export default function TemplateApprovalPage() {
  return (
    <Suspense>
      <PcApprovalTemplateClient />
    </Suspense>
  );
}
