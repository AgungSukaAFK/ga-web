// src/hooks/use-waiting-approver-companies.ts
//
// Company (GMI / GIS / LOURDES) dari approver yang sedang ditunggu di tabel
// list MR/PO - teks "Menunggu: <nama>" di kolom status. Snapshot `approvals`
// yang tersimpan di MR/PO tidak menyimpan company, jadi diambil dari
// `profiles` sekali per halaman tabel (bukan per baris). Hasilnya dicache di
// state, jadi ganti halaman cuma mengambil approver yang belum pernah dilihat.

"use client";

import { useEffect, useMemo, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { getCurrentApprover } from "@/lib/utils";
import { Approval } from "@/type";

interface ApprovalRow {
  status: string;
  approvals?: Approval[] | null;
}

/** Map userid approver -> company (null kalau profilnya tidak punya company). */
export function useWaitingApproverCompanies(rows: ApprovalRow[]) {
  const [companies, setCompanies] = useState<Record<string, string | null>>(
    {},
  );

  const idsKey = useMemo(() => {
    const ids = new Set<string>();
    for (const row of rows) {
      if (row.status !== "Pending Approval") continue;
      const id = getCurrentApprover(row.approvals)?.userid;
      if (id) ids.add(id);
    }
    return [...ids].sort().join(",");
  }, [rows]);

  useEffect(() => {
    const missing = idsKey
      ? idsKey.split(",").filter((id) => !(id in companies))
      : [];
    if (missing.length === 0) return;
    let cancelled = false;

    (async () => {
      const { data, error } = await createClient()
        .from("profiles")
        .select("id, company")
        .in("id", missing);
      // Best-effort - label company cuma pelengkap, gagal ya tampil nama saja.
      if (cancelled || error) return;
      setCompanies((prev) => {
        const next = { ...prev };
        // Id yang tidak ketemu tetap dicatat (null) supaya tidak di-fetch ulang.
        for (const id of missing) next[id] = null;
        for (const p of data || []) next[p.id] = p.company ?? null;
        return next;
      });
    })();

    return () => {
      cancelled = true;
    };
    // `companies` sengaja tidak masuk dependency: hanya dipakai buat
    // menyaring id yang sudah ada, dan setiap update-nya berasal dari efek ini.
  }, [idsKey]);

  return companies;
}
