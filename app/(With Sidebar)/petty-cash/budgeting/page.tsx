// src/app/(With Sidebar)/petty-cash/budgeting/page.tsx
//
// Halaman Budgeting Petty Cash (GA/Admin only) - wrapper tipis yang resolve
// role/departemen user login lalu render PettyCashBudgetingClient. Proteksi
// akses yang SEBENARNYA ada di RLS (petty_cash_budget_insert/update, lihat
// supabase/petty-cash-budget-setup.sql) - guard `canManage` di sini cuma
// utk UX (sembunyikan menu dari yang bukan GA/Admin), bukan pengganti RLS.

"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { isGADepartment } from "@/lib/constants/departments";
import PettyCashBudgetingClient from "./PettyCashBudgetingClient";
import { Loader2 } from "lucide-react";

export default function PettyCashBudgetingPage() {
  const supabase = createClient();
  const [loading, setLoading] = useState(true);
  const [canManage, setCanManage] = useState(false);

  useEffect(() => {
    const load = async () => {
      try {
        const {
          data: { user },
        } = await supabase.auth.getUser();
        if (!user) return;

        const { data: profile } = await supabase
          .from("profiles")
          .select("role, department")
          .eq("id", user.id)
          .single();

        setCanManage(
          profile?.role === "admin" || isGADepartment(profile?.department),
        );
      } finally {
        setLoading(false);
      }
    };
    load();
  }, []);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="h-6 w-6 animate-spin text-primary" />
      </div>
    );
  }

  return <PettyCashBudgetingClient canManage={canManage} />;
}
