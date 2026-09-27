// src/app/(With Sidebar)/petty-cash/PcDashboardClient.tsx
//
// Dashboard Petty Cash - lihat planning-pc.md Bagian 2 untuk rancangan
// lengkapnya. Menggantikan placeholder <ComingSoon /> yang sebelumnya ada
// di page.tsx ini. Sumber data sengaja dipakai ulang dari yang SUDAH ada
// (fetchMyPengajuanWithChain dkk., PC_APPROVAL_TYPE_COLORS) - tidak ada
// query/tabel baru di database, cuma dirakit ulang jadi tampilan yang lebih
// actionable & informatif.
//
// Satu insight yang baru ketemu SAAT develop (belum ada di planning-pc.md):
// approver di Petty Cash BUKAN role global ("role" profil bisa "user" biasa
// tapi tetap tercantum sbg approver di sebuah Template Approval departemen
// lain) - lihat fetchPengajuanApprovalQueue dkk. yang murni cek keberadaan
// userid di kolom `approvals`, tidak peduli `profiles.role`. Karena itu
// panel "Perlu Anda Proses" (approver) di bawah TIDAK digating oleh role,
// beda dari draft awal di planning-pc.md yang membagi dashboard jadi 2
// "varian" role - kenyataannya satu orang bisa sekaligus requester (selalu
// punya panel "Perlu Tindakan Anda") DAN approver dadakan (panel "Perlu
// Anda Proses" muncul kalau antriannya tidak kosong, siapa pun dia).

"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { toast } from "sonner";
import {
  AlertTriangle,
  ArrowRight,
  Banknote,
  Building2,
  Clock,
  FileText,
  Hourglass,
  Inbox,
  Loader2,
  PlusCircle,
  ReceiptText,
  RefreshCcw,
  ShieldAlert,
  Wallet,
} from "lucide-react";

import { createClient } from "@/lib/supabase/client";
import { cn, formatCurrency } from "@/lib/utils";
import { isGADepartment } from "@/lib/constants/departments";

import {
  fetchAllPengajuan,
  fetchMyPengajuanWithChain,
  fetchPengajuanApprovalQueue,
} from "@/services/pettyCashPengajuanService";
import {
  fetchAllVouchers,
  fetchVoucherApprovalQueue,
} from "@/services/pettyCashVoucherService";
import {
  fetchAllDeklarasi,
  fetchDeklarasiApprovalQueue,
} from "@/services/pettyCashDeklarasiService";
import {
  fetchAllSubVouchers,
  fetchSubVoucherPaymentQueue,
} from "@/services/pettyCashSubVoucherService";
import { fetchActiveBudgets } from "@/services/pettyCashBudgetService";

import {
  buildActionItems,
  buildActivityFeed,
  computeChainSteps,
  computePcOverallStatus,
  formatRelativeTime,
  summarizeOverallStatus,
} from "@/services/pettyCashDashboardService";

import {
  PettyCashDeklarasi,
  PettyCashPengajuan,
  PettyCashPengajuanWithChain,
  PettyCashSubVoucher,
  PettyCashVoucher,
} from "@/type";
import {
  PC_APPROVAL_TYPE_COLORS,
  PC_APPROVAL_TYPE_DEKLARASI,
  PC_APPROVAL_TYPE_PENGAJUAN,
  PC_APPROVAL_TYPE_VOUCHER,
} from "@/type/enum";

import { Content } from "@/components/content";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { PcStatCard } from "@/components/petty-cash/PcStatCard";
import { PcActionNeededList } from "@/components/petty-cash/PcActionNeededList";
import { PcActivityFeed } from "@/components/petty-cash/PcActivityFeed";
import { PcChainStepper } from "@/components/petty-cash/PcChainStepper";
import { PcBudgetChart, PcBudgetRow } from "@/components/petty-cash/PcBudgetChart";

type Profile = {
  nama: string | null;
  department: string | null;
  lokasi: string | null;
  company: string | null;
  role: string | null;
};

const NYANGKUT_THRESHOLD_DAYS = 5;
const LIMIT_BUDGET_WARNING_PCT = 85;

const daysSince = (date: string | Date) => {
  const ms = Date.now() - new Date(date).getTime();
  return Math.floor(ms / (1000 * 60 * 60 * 24));
};

const isSameMonth = (date: string | Date, ref: Date) => {
  const d = new Date(date);
  return (
    d.getFullYear() === ref.getFullYear() && d.getMonth() === ref.getMonth()
  );
};

interface NyangkutRow {
  id: number;
  kode: string;
  tipe: "Pengajuan" | "Voucher" | "Deklarasi" | "Tarikan Dana";
  department: string;
  status: string;
  hari: number;
  href: string;
}

export default function PcDashboardClient() {
  const supabase = createClient();

  const [loading, setLoading] = useState(true);
  const [profile, setProfile] = useState<Profile | null>(null);

  const [chain, setChain] = useState<PettyCashPengajuanWithChain[]>([]);
  const [pengajuanQueue, setPengajuanQueue] = useState<PettyCashPengajuan[]>([]);
  const [voucherQueue, setVoucherQueue] = useState<PettyCashVoucher[]>([]);
  const [deklarasiQueue, setDeklarasiQueue] = useState<PettyCashDeklarasi[]>([]);
  const [paymentQueue, setPaymentQueue] = useState<PettyCashSubVoucher[]>([]);
  const [activeBudgets, setActiveBudgets] = useState<
    Awaited<ReturnType<typeof fetchActiveBudgets>>
  >([]);

  const [allPengajuan, setAllPengajuan] = useState<PettyCashPengajuan[]>([]);
  const [allVouchers, setAllVouchers] = useState<PettyCashVoucher[]>([]);
  const [allDeklarasi, setAllDeklarasi] = useState<PettyCashDeklarasi[]>([]);
  const [allSubVouchers, setAllSubVouchers] = useState<PettyCashSubVoucher[]>(
    [],
  );

  const isFinanceApprover = (p: Profile | null) =>
    !!p && (p.role === "admin" || (p.department === "Finance" && p.role === "approver"));

  const isAdminGA = (p: Profile | null) =>
    !!p &&
    (p.role === "admin" ||
      isGADepartment(p.department) ||
      p.department === "General Manager");

  const loadData = async () => {
    setLoading(true);
    try {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) throw new Error("User tidak terautentikasi.");

      const { data: prof, error: profErr } = await supabase
        .from("profiles")
        .select("nama, department, lokasi, company, role")
        .eq("id", user.id)
        .single();
      if (profErr) throw profErr;

      const currentProfile: Profile = {
        nama: prof?.nama ?? null,
        department: prof?.department ?? null,
        lokasi: prof?.lokasi ?? null,
        company: prof?.company ?? null,
        role: prof?.role ?? null,
      };
      setProfile(currentProfile);

      const finance = isFinanceApprover(currentProfile);
      const adminGA = isAdminGA(currentProfile);
      const budgetCompanyFilter =
        adminGA && currentProfile.company === "LOURDES"
          ? undefined
          : currentProfile.company ?? undefined;

      const [
        chainData,
        pengajuanQ,
        voucherQ,
        deklarasiQ,
        paymentQ,
        budgets,
        allPengajuanData,
        allVouchersData,
        allDeklarasiData,
        allSubVouchersData,
      ] = await Promise.all([
        fetchMyPengajuanWithChain(user.id),
        fetchPengajuanApprovalQueue(user.id),
        fetchVoucherApprovalQueue(user.id),
        fetchDeklarasiApprovalQueue(user.id),
        finance
          ? fetchSubVoucherPaymentQueue(currentProfile.company)
          : Promise.resolve([]),
        fetchActiveBudgets(budgetCompanyFilter),
        adminGA ? fetchAllPengajuan() : Promise.resolve([]),
        adminGA ? fetchAllVouchers() : Promise.resolve([]),
        adminGA ? fetchAllDeklarasi() : Promise.resolve([]),
        adminGA ? fetchAllSubVouchers() : Promise.resolve([]),
      ]);

      setChain(chainData);
      setPengajuanQueue(pengajuanQ);
      setVoucherQueue(voucherQ);
      setDeklarasiQueue(deklarasiQ);
      setPaymentQueue(paymentQ);
      setActiveBudgets(budgets);
      setAllPengajuan(allPengajuanData);
      setAllVouchers(allVouchersData);
      setAllDeklarasi(allDeklarasiData);
      setAllSubVouchers(allSubVouchersData);
    } catch (error: any) {
      toast.error("Gagal memuat Dashboard Petty Cash", {
        description: error.message,
      });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  // --- Turunan data milik sendiri (requester) ---
  const summary = useMemo(() => summarizeOverallStatus(chain), [chain]);
  const actionItems = useMemo(() => buildActionItems(chain), [chain]);
  const activityEvents = useMemo(
    () => buildActivityFeed(chain, 10),
    [chain],
  );

  const tercairkanBulanIni = useMemo(() => {
    const now = new Date();
    let total = 0;
    for (const p of chain) {
      for (const sv of p.petty_cash_voucher?.[0]?.petty_cash_sub_voucher ?? []) {
        if (sv.status === "Selesai" && isSameMonth(sv.paid_at ?? sv.created_at, now)) {
          total += sv.amount;
        }
      }
    }
    return total;
  }, [chain]);

  const pengajuanAktif = useMemo(
    () =>
      chain.filter((p) => {
        const s = computePcOverallStatus(p);
        return s.tone !== "rejected" && s.key !== "tuntas";
      }),
    [chain],
  );

  const myBudgetRow: PcBudgetRow | null = useMemo(() => {
    if (!profile) return null;
    const match = activeBudgets.find(
      (b) =>
        b.department === profile.department &&
        (b.site ?? null) === (profile.lokasi ?? null),
    );
    if (!match) return null;
    return {
      label: match.name,
      used: match.initial_budget - match.current_budget,
      total: match.initial_budget,
    };
  }, [activeBudgets, profile]);

  // --- Turunan data approval/pembayaran (approver, siapa pun bisa) ---
  const approvalTotal =
    pengajuanQueue.length +
    voucherQueue.length +
    deklarasiQueue.length +
    paymentQueue.length;

  // --- Turunan data admin/GA (lintas perusahaan) ---
  const adminGA = isAdminGA(profile);

  const companySummaryRows = useMemo(() => {
    if (!adminGA) return [];
    const now = new Date();
    const byDept = new Map<
      string,
      { pengajuanBulanIni: number; tercairkanBulanIni: number }
    >();
    for (const p of allPengajuan) {
      const dept = p.department || "Tanpa Departemen";
      const row = byDept.get(dept) ?? {
        pengajuanBulanIni: 0,
        tercairkanBulanIni: 0,
      };
      if (isSameMonth(p.created_at, now)) row.pengajuanBulanIni += 1;
      byDept.set(dept, row);
    }
    for (const sv of allSubVouchers) {
      if (sv.status !== "Selesai") continue;
      const dept = sv.petty_cash_voucher?.department || "Tanpa Departemen";
      const row = byDept.get(dept) ?? {
        pengajuanBulanIni: 0,
        tercairkanBulanIni: 0,
      };
      if (isSameMonth(sv.paid_at ?? sv.created_at, now)) {
        row.tercairkanBulanIni += sv.amount;
      }
      byDept.set(dept, row);
    }
    return Array.from(byDept.entries())
      .map(([department, v]) => ({ department, ...v }))
      .sort((a, b) => b.tercairkanBulanIni - a.tercairkanBulanIni)
      .slice(0, 8);
  }, [adminGA, allPengajuan, allSubVouchers]);

  const nyangkutRows = useMemo<NyangkutRow[]>(() => {
    if (!adminGA) return [];
    const rows: NyangkutRow[] = [];
    for (const p of allPengajuan) {
      if (p.status !== "In Approval") continue;
      const hari = daysSince(p.created_at);
      if (hari >= NYANGKUT_THRESHOLD_DAYS) {
        rows.push({
          id: p.id,
          kode: p.kode_pengajuan,
          tipe: "Pengajuan",
          department: p.department,
          status: p.status,
          hari,
          href: `/petty-cash/pengajuan/${p.id}`,
        });
      }
    }
    for (const v of allVouchers) {
      if (v.status !== "In Approval") continue;
      const hari = daysSince(v.created_at);
      if (hari >= NYANGKUT_THRESHOLD_DAYS) {
        rows.push({
          id: v.id,
          kode: v.kode_voucher,
          tipe: "Voucher",
          department: v.department,
          status: v.status,
          hari,
          href: `/petty-cash/voucher/${v.id}`,
        });
      }
    }
    for (const d of allDeklarasi) {
      if (d.status !== "In Approval") continue;
      const hari = daysSince(d.created_at);
      if (hari >= NYANGKUT_THRESHOLD_DAYS) {
        rows.push({
          id: d.id,
          kode: d.kode_deklarasi,
          tipe: "Deklarasi",
          department: d.department,
          status: d.status,
          hari,
          href: `/petty-cash/deklarasi/${d.id}`,
        });
      }
    }
    for (const sv of allSubVouchers) {
      if (sv.status !== "Menunggu Pembayaran") continue;
      const hari = daysSince(sv.created_at);
      if (hari >= NYANGKUT_THRESHOLD_DAYS) {
        rows.push({
          id: sv.id,
          kode: sv.kode_sub_voucher,
          tipe: "Tarikan Dana",
          department: sv.petty_cash_voucher?.department || "-",
          status: sv.status,
          hari,
          href: `/petty-cash/sub-voucher/${sv.id}`,
        });
      }
    }
    return rows.sort((a, b) => b.hari - a.hari).slice(0, 10);
  }, [adminGA, allPengajuan, allVouchers, allDeklarasi, allSubVouchers]);

  const adminBudgetRows: PcBudgetRow[] = useMemo(
    () =>
      activeBudgets.map((b) => ({
        label: `${b.name} (${b.department})`,
        used: b.initial_budget - b.current_budget,
        total: b.initial_budget,
      })),
    [activeBudgets],
  );

  const budgetMendekatiLimit = useMemo(
    () =>
      activeBudgets
        .map((b) => ({
          ...b,
          pct:
            b.initial_budget > 0
              ? Math.round(
                  ((b.initial_budget - b.current_budget) / b.initial_budget) *
                    100,
                )
              : 0,
        }))
        .filter((b) => b.pct >= LIMIT_BUDGET_WARNING_PCT)
        .sort((a, b) => b.pct - a.pct),
    [activeBudgets],
  );

  if (loading) {
    return (
      <Content size="lg">
        <div className="flex flex-col items-center justify-center gap-3 py-20 text-muted-foreground">
          <Loader2 className="h-6 w-6 animate-spin" />
          <p className="text-sm">Memuat Dashboard Petty Cash...</p>
        </div>
      </Content>
    );
  }

  const today = new Date().toLocaleDateString("id-ID", {
    weekday: "long",
    day: "2-digit",
    month: "long",
    year: "numeric",
  });

  return (
    <>
      {/* Header sapaan + refresh */}
      <div className="col-span-12 flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-xl font-semibold tracking-tight">
            Halo{profile?.nama ? `, ${profile.nama}` : ""}
          </h1>
          <p className="text-sm text-muted-foreground">{today}</p>
        </div>
        <Button variant="outline" size="sm" onClick={loadData} className="w-fit">
          <RefreshCcw className="h-3.5 w-3.5" />
          Muat Ulang
        </Button>
      </div>

      {/* Kartu ringkasan */}
      <div className="col-span-12 grid grid-cols-2 gap-3 sm:grid-cols-4">
        <PcStatCard
          icon={FileText}
          label="Pengajuan Aktif"
          value={pengajuanAktif.length}
          hint="Belum tuntas / ditolak"
          href="/petty-cash/pengajuan-saya"
        />
        <PcStatCard
          icon={Hourglass}
          label="Perlu Tindakan Saya"
          value={summary.perluTindakanSaya}
          hint="Giliran Anda bertindak"
          accent={summary.perluTindakanSaya > 0 ? "action" : "default"}
          href="#perlu-tindakan-anda"
        />
        <PcStatCard
          icon={Clock}
          label="Menunggu Orang Lain"
          value={summary.menungguOrangLain}
          hint="Approver / Finance"
          href="/petty-cash/pengajuan-saya"
        />
        <PcStatCard
          icon={Banknote}
          label="Tercairkan Bulan Ini"
          value={formatCurrency(tercairkanBulanIni)}
          hint="Tarikan dana berstatus Selesai"
          href="/petty-cash/pengajuan-saya"
        />
      </div>

      {/* Perlu Tindakan Anda (requester) */}
      <Content
        id="perlu-tindakan-anda"
        size="lg"
        title="Perlu Tindakan Anda"
        description="Pengajuan Petty Cash milik Anda yang sedang menunggu langkah lanjutan dari Anda sendiri."
      >
        <PcActionNeededList items={actionItems} />
      </Content>

      {/* Perlu Anda Proses (approver / Finance, siapa pun - lihat catatan di atas file ini) */}
      {approvalTotal > 0 && (
        <Content
          size="lg"
          title="Perlu Anda Proses"
          description="Dokumen Petty Cash yang sedang giliran Anda approve atau bayarkan."
          cardAction={
            <Button asChild size="sm" variant="outline">
              <Link href="/petty-cash/approval">
                Buka Antrian Approval
                <ArrowRight className="h-3.5 w-3.5" />
              </Link>
            </Button>
          }
        >
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            {[
              {
                label: "Approval Pengajuan",
                count: pengajuanQueue.length,
                type: PC_APPROVAL_TYPE_PENGAJUAN,
              },
              {
                label: "Approval Voucher",
                count: voucherQueue.length,
                type: PC_APPROVAL_TYPE_VOUCHER,
              },
              {
                label: "Approval Deklarasi",
                count: deklarasiQueue.length,
                type: PC_APPROVAL_TYPE_DEKLARASI,
              },
              {
                label: "Tarikan Menunggu Dibayar",
                count: paymentQueue.length,
                type: null,
              },
            ]
              .filter((row) => row.count > 0)
              .map((row) => (
                <div
                  key={row.label}
                  className="flex flex-col gap-1 rounded-lg border p-3"
                >
                  <Badge
                    className={cn(
                      "w-fit whitespace-nowrap",
                      row.type
                        ? PC_APPROVAL_TYPE_COLORS[row.type]
                        : "bg-teal-50 text-teal-700 border-teal-200 dark:bg-teal-900/40 dark:text-teal-300 dark:border-teal-800",
                    )}
                  >
                    {row.label}
                  </Badge>
                  <span className="text-2xl font-bold">{row.count}</span>
                </div>
              ))}
          </div>
        </Content>
      )}

      {/* Pengajuan Berjalan + Budget */}
      <Content size="md" title="Pengajuan Berjalan">
        {pengajuanAktif.length === 0 ? (
          <p className="py-6 text-center text-sm text-muted-foreground">
            Tidak ada Pengajuan yang sedang berjalan.
          </p>
        ) : (
          <ul className="flex flex-col divide-y">
            {pengajuanAktif.slice(0, 6).map((p) => {
              const status = computePcOverallStatus(p);
              const steps = computeChainSteps(p);
              return (
                <li key={p.id} className="flex flex-col gap-2 py-3 first:pt-0 last:pb-0">
                  <Link
                    href={`/petty-cash/pengajuan-saya?open=${p.id}`}
                    className="flex items-center justify-between gap-2 hover:underline"
                  >
                    <span className="font-mono text-sm font-medium">
                      {p.kode_pengajuan}
                    </span>
                    <Badge className={cn(status.badgeClass, "whitespace-nowrap")}>
                      {status.label}
                    </Badge>
                  </Link>
                  <PcChainStepper steps={steps} />
                </li>
              );
            })}
          </ul>
        )}
        {pengajuanAktif.length > 6 && (
          <div className="mt-2 text-center">
            <Button asChild variant="link" size="sm">
              <Link href="/petty-cash/pengajuan-saya">
                Lihat semua ({pengajuanAktif.length})
              </Link>
            </Button>
          </div>
        )}
      </Content>

      <Content
        size="md"
        title="Budget Departemen Saya"
        description={
          profile?.department
            ? `${profile.department}${profile.lokasi ? ` · ${profile.lokasi}` : ""}`
            : undefined
        }
      >
        {myBudgetRow ? (
          <PcBudgetChart rows={[myBudgetRow]} />
        ) : (
          <p className="py-6 text-center text-sm text-muted-foreground">
            Belum ada Budget Petty Cash aktif untuk departemen Anda. Hubungi
            GA/Admin.
          </p>
        )}
      </Content>

      {/* Aktivitas + Aksi Cepat */}
      <Content size="md" title="Aktivitas Terbaru">
        <PcActivityFeed events={activityEvents} />
      </Content>

      <Content size="md" title="Aksi Cepat">
        <div className="flex flex-col gap-2">
          <Button asChild className="justify-start">
            <Link href="/petty-cash/input-pengajuan">
              <PlusCircle className="h-4 w-4" />
              Buat Pengajuan Baru
            </Link>
          </Button>
          <Button asChild variant="outline" className="justify-start">
            <Link href="/petty-cash/pengajuan-voucher">
              <ReceiptText className="h-4 w-4" />
              Ajukan Voucher / Tarik Dana
            </Link>
          </Button>
          <Button asChild variant="outline" className="justify-start">
            <Link href="/petty-cash/deklarasi">
              <Wallet className="h-4 w-4" />
              Ajukan Deklarasi
            </Link>
          </Button>
          <Button asChild variant="ghost" className="justify-start">
            <Link href="/petty-cash/pengajuan-saya">
              <Inbox className="h-4 w-4" />
              Lihat Semua Pengajuan Saya
            </Link>
          </Button>
        </div>
      </Content>

      {/* Bagian khusus Admin/GA */}
      {adminGA && (
        <>
          <div className="col-span-12 mt-2 flex items-center gap-2">
            <ShieldAlert className="h-4 w-4 text-muted-foreground" />
            <h2 className="text-sm font-semibold text-muted-foreground">
              Ringkasan Perusahaan (Admin/GA)
            </h2>
          </div>

          <Content size="md" title="Budget Lintas Departemen">
            <PcBudgetChart rows={adminBudgetRows} />
          </Content>

          <Content
            size="md"
            title="Departemen Mendekati Limit Budget"
            description={`Sisa budget di bawah ${100 - LIMIT_BUDGET_WARNING_PCT}%`}
          >
            {budgetMendekatiLimit.length === 0 ? (
              <p className="py-6 text-center text-sm text-muted-foreground">
                Tidak ada departemen yang mendekati limit budget.
              </p>
            ) : (
              <ul className="flex flex-col divide-y">
                {budgetMendekatiLimit.map((b) => (
                  <li
                    key={b.id}
                    className="flex items-center justify-between gap-2 py-2 first:pt-0 last:pb-0"
                  >
                    <div className="flex items-center gap-2">
                      <Building2 className="h-4 w-4 text-muted-foreground" />
                      <span className="text-sm">
                        {b.name}{" "}
                        <span className="text-xs text-muted-foreground">
                          ({b.department})
                        </span>
                      </span>
                    </div>
                    <Badge className="bg-red-50 text-red-700 border-red-200 dark:bg-red-900/40 dark:text-red-300 dark:border-red-800 whitespace-nowrap">
                      {b.pct}% terpakai
                    </Badge>
                  </li>
                ))}
              </ul>
            )}
          </Content>

          <Content
            size="lg"
            title="Dokumen Nyangkut Lama"
            description={`Sudah ${NYANGKUT_THRESHOLD_DAYS}+ hari diam di status "In Approval" / "Menunggu Pembayaran" sejak diajukan.`}
          >
            {nyangkutRows.length === 0 ? (
              <p className="py-6 text-center text-sm text-muted-foreground">
                Tidak ada dokumen yang nyangkut lama. Semua lancar.
              </p>
            ) : (
              <ul className="flex flex-col divide-y">
                {nyangkutRows.map((row) => (
                  <li key={`${row.tipe}-${row.id}`}>
                    <Link
                      href={row.href}
                      className="flex flex-wrap items-center justify-between gap-2 py-2.5 first:pt-0 last:pb-0 hover:bg-accent/30 rounded-md px-1 -mx-1 transition-colors"
                    >
                      <div className="flex items-center gap-2">
                        <AlertTriangle className="h-4 w-4 shrink-0 text-amber-600 dark:text-amber-400" />
                        <span className="font-mono text-sm">{row.kode}</span>
                        <Badge variant="outline" className="text-[10px]">
                          {row.tipe}
                        </Badge>
                        <span className="text-xs text-muted-foreground">
                          {row.department}
                        </span>
                      </div>
                      <span className="text-xs font-medium text-amber-700 dark:text-amber-400">
                        {row.hari} hari
                      </span>
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </Content>

          <Content
            size="lg"
            title="Aktivitas Departemen Bulan Ini"
            description="Jumlah Pengajuan baru & total dana tercairkan (Tarikan Selesai) per departemen."
          >
            {companySummaryRows.length === 0 ? (
              <p className="py-6 text-center text-sm text-muted-foreground">
                Belum ada aktivitas bulan ini.
              </p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b text-left text-xs text-muted-foreground">
                      <th className="py-2 pr-4 font-medium">Departemen</th>
                      <th className="py-2 pr-4 font-medium">
                        Pengajuan Bulan Ini
                      </th>
                      <th className="py-2 font-medium">
                        Tercairkan Bulan Ini
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {companySummaryRows.map((row) => (
                      <tr key={row.department} className="border-b last:border-0">
                        <td className="py-2 pr-4">{row.department}</td>
                        <td className="py-2 pr-4">{row.pengajuanBulanIni}</td>
                        <td className="py-2 font-medium">
                          {formatCurrency(row.tercairkanBulanIni)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </Content>
        </>
      )}
    </>
  );
}
