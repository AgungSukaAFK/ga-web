// src/app/(With Sidebar)/petty-cash/management/page.tsx
//
// Halaman Management Petty Cash (admin only) - wrapper tipis yang resolve
// role user login lalu render PettyCashManagementClient. Proteksi akses yang
// SEBENARNYA ada di RLS (petty_cash_*_update_admin, lihat
// supabase/petty-cash-admin-management-setup.sql) - guard `isAdmin` di sini
// cuma untuk UX (sembunyikan menu dari yang bukan admin), bukan pengganti RLS.

"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import PettyCashManagementClient from "./PettyCashManagementClient";
import { Loader2 } from "lucide-react";

export default function PettyCashManagementPage() {
  const supabase = createClient();
  const [loading, setLoading] = useState(true);
  const [isAdmin, setIsAdmin] = useState(false);

  useEffect(() => {
    const load = async () => {
      try {
        const {
          data: { user },
        } = await supabase.auth.getUser();
        if (!user) return;

        const { data: profile } = await supabase
          .from("profiles")
          .select("role")
          .eq("id", user.id)
          .single();

        setIsAdmin(profile?.role === "admin");
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

  return <PettyCashManagementClient isAdmin={isAdmin} />;
}
