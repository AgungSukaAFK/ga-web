// src/components/petty-cash/usePcVerifyAccess.tsx
//
// Penentu "mau dibawa ke mana" orang yang memindai QR di dokumen cetak Petty
// Cash (halaman /approval-pc-*/[id]) - dipakai bareng keempat halaman
// verifikasi:
// - approver dokumen ini yang step-nya masih pending (dan dokumen belum
//   ditolak) -> langsung diarahkan ke halaman detail, tempat tombol
//   approve/reject berada (PcApprovalActions).
// - pihak yang memang terlibat (pembuat, approver yang sudah memproses,
//   pihak tambahan mis. Finance pembayar Sub-Voucher) & admin -> halaman
//   verifikasi + tombol "Lihat Detail".
// - akun ber-role approver lain -> boleh melihat halaman verifikasi saja.
// - selain itu -> diblokir (tidak berhak melihat informasi dokumen).
//
// Ini lapisan UX, bukan pengganti RLS - data dokumen tetap dijaga policy
// tabel masing-masing.

"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { ExternalLink, Loader2, ShieldX } from "lucide-react";

export interface PcVerifySubject {
  user_id: string;
  approvals?: { userid: string; status: string }[] | null;
  // User lain yang ikut terlibat di dokumen ini (mis. paid_by Sub-Voucher).
  relatedUserIds?: (string | null | undefined)[];
}

export type PcVerifyAccess =
  | { state: "loading" }
  | { state: "redirecting" }
  | { state: "denied" }
  | { state: "allowed"; canOpenDetail: boolean };

interface Options {
  doc: PcVerifySubject | null;
  detailHref: string;
  // Aksi tambahan di halaman detail yang menunggu viewer ini (mis. Finance
  // perlu menyelesaikan pembayaran Sub-Voucher) - kalau true, viewer
  // langsung diarahkan ke detail seperti approver yang belum approve.
  needsActionFrom?: (viewer: {
    id: string;
    role: string | null;
    department: string | null;
  }) => boolean;
}

export function usePcVerifyAccess({
  doc,
  detailHref,
  needsActionFrom,
}: Options): PcVerifyAccess {
  const router = useRouter();
  const [access, setAccess] = useState<PcVerifyAccess>({ state: "loading" });
  // Pemanggil boleh mengoper objek `doc`/callback baru tiap render (mis.
  // dirakit inline) - effect cuma jalan ulang kalau ISI-nya berubah.
  const latest = useRef({ doc, needsActionFrom });
  latest.current = { doc, needsActionFrom };
  const docKey = doc ? JSON.stringify(doc) : null;

  useEffect(() => {
    const { doc, needsActionFrom } = latest.current;
    if (!doc) return;
    let cancelled = false;

    const resolve = async () => {
      const supabase = createClient();
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) {
        // Sesi habis di tengah jalan - middleware biasanya sudah
        // mencegat lebih dulu, ini cuma jaring pengaman.
        const next = window.location.pathname + window.location.search;
        router.replace(`/auth/login?next=${encodeURIComponent(next)}`);
        return;
      }
      const { data: profile } = await supabase
        .from("profiles")
        .select("role, department")
        .eq("id", user.id)
        .maybeSingle();
      if (cancelled) return;

      const role: string | null = profile?.role ?? null;
      const approvals = doc.approvals ?? [];
      const myStep = approvals.find((a) => a.userid === user.id);
      const isRejected = approvals.some((a) => a.status === "rejected");
      const isCreator = doc.user_id === user.id;
      const isRelated = (doc.relatedUserIds ?? []).includes(user.id);
      const isAdmin = role === "admin";

      const mustAct =
        (myStep?.status === "pending" && !isRejected) ||
        !!needsActionFrom?.({
          id: user.id,
          role,
          department: profile?.department ?? null,
        });
      if (mustAct) {
        setAccess({ state: "redirecting" });
        router.replace(detailHref);
        return;
      }

      const isInvolved = isCreator || !!myStep || isRelated || isAdmin;
      if (isInvolved || role === "approver") {
        setAccess({ state: "allowed", canOpenDetail: isInvolved });
      } else {
        setAccess({ state: "denied" });
      }
    };

    resolve();
    return () => {
      cancelled = true;
    };
  }, [docKey, detailHref]);

  return access;
}

/** `?step=N` dari QR slot tanda tangan - 0 = pembuat, 1..n = approver ke-n. */
export function useHighlightedStep(): number | null {
  const [step, setStep] = useState<number | null>(null);
  useEffect(() => {
    const raw = new URLSearchParams(window.location.search).get("step");
    const n = raw === null ? NaN : Number(raw);
    setStep(Number.isInteger(n) && n >= 0 ? n : null);
  }, []);
  return step;
}

export function PcVerifyLoading({ message }: { message?: string }) {
  return (
    <div className="flex min-h-screen items-center justify-center p-4">
      {message ? (
        <div className="flex items-center gap-2 text-muted-foreground">
          <Loader2 className="h-5 w-5 animate-spin" />
          <span>{message}</span>
        </div>
      ) : (
        <div className="w-full max-w-2xl space-y-4">
          <Skeleton className="h-10 w-1/2" />
          <Skeleton className="h-40 w-full" />
          <Skeleton className="h-64 w-full" />
        </div>
      )}
    </div>
  );
}

export function PcVerifyDenied({ docLabel }: { docLabel: string }) {
  return (
    <div className="flex min-h-screen items-center justify-center p-4">
      <div className="max-w-md rounded-lg border p-8 text-center shadow-md">
        <ShieldX className="mx-auto h-12 w-12 text-destructive" />
        <h1 className="mt-4 text-2xl font-bold">Akses Ditolak</h1>
        <p className="mt-2 text-muted-foreground">
          Anda tidak memiliki izin untuk melihat informasi {docLabel} ini.
          Hanya pembuat, approver terkait, dan akun ber-role approver yang
          dapat mengakses halaman ini.
        </p>
        <Button asChild variant="outline" className="mt-6">
          <Link href="/dashboard">Kembali ke Dashboard</Link>
        </Button>
      </div>
    </div>
  );
}

export function PcVerifyDetailButton({
  href,
  label,
}: {
  href: string;
  label: string;
}) {
  return (
    <Button asChild className="mt-4 w-full sm:w-auto">
      <Link href={href}>
        <ExternalLink className="mr-2 h-4 w-4" />
        {label}
      </Link>
    </Button>
  );
}
