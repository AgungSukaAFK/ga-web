"use client";

import { useEffect, useMemo, useState } from "react";
import { Content } from "@/components/content";
import {
  FileClock,
  FileCheck,
  FileX,
  FileSpreadsheet,
  Package,
  CheckCheck,
  Files,
  ShoppingCart,
  Truck,
  PackageCheck,
  CheckCircle2,
  PackageOpen,
  ChevronLeft,
  ChevronRight,
  ChevronRight as ArrowRightIcon,
  Bell,
  BellRing,
  Clock,
} from "lucide-react";
import {
  Area,
  AreaChart,
  ResponsiveContainer,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
  PieChart,
  Pie,
  Cell,
  Legend,
  TooltipProps,
  BarChart,
  Bar,
} from "recharts";
import {
  fetchDashboardStats,
  fetchDailyMrPoTrend,
  fetchDepartmentMrDistribution,
  fetchLatestMRs,
  fetchItemStatusPipeline,
  fetchMyActionItems,
  fetchMrByStatus,
  fetchPoByStatus,
  getActiveUserProfile,
  DashboardStats,
  ChartData,
  DailyTrendPoint,
  LatestMR,
  ItemStatusPipeline,
  ActionItemGroup,
  ScoreResult,
  fetchMrScore,
  fetchPoScore,
} from "@/services/dashboardService";
import {
  fetchMyFollowupSummary,
  FollowupSummaryItem,
} from "@/services/approvalService";
import { MR_ITEM_STATUSES } from "@/type/enum";
import { Profile } from "@/type";
import { toast } from "sonner";
import { Skeleton } from "@/components/ui/skeleton";
import { cn, formatDateFriendly, formatRelativeTime } from "@/lib/utils";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { ClickableStatCard } from "@/components/dashboard/clickable-stat-card";
import { ScoreStatCard } from "@/components/dashboard/score-stat-card";
import { createClient } from "@/lib/supabase/client";

// Warna baru yang lebih cerah untuk Pie Chart
const PIE_COLORS = [
  "#3b82f6", // blue-500
  "#22c55e", // green-500
  "#eab308", // yellow-500
  "#f97316", // orange-500
  "#ec4899", // pink-500
  "#a855f7", // purple-500
  "#14b8a6", // teal-500
  "#64748b", // slate-500
];

const RADIAN = Math.PI / 180;
const CustomPieLabel = ({
  cx,
  cy,
  midAngle,
  innerRadius,
  outerRadius,
  percent,
}: any) => {
  const radius = innerRadius + (outerRadius - innerRadius) * 0.5;
  const x = cx + radius * Math.cos(-midAngle * RADIAN);
  const y = cy + radius * Math.sin(-midAngle * RADIAN);
  const percentValue = Math.round((percent || 0) * 100);

  if (percentValue < 5) return null;

  return (
    <text
      x={x}
      y={y}
      fill="white"
      textAnchor={x > cx ? "start" : "end"}
      dominantBaseline="central"
      className="font-bold text-xs"
    >
      {`${percentValue}%`}
    </text>
  );
};

const CustomTooltip = ({ active, payload, label }: TooltipProps<number, string>) => {
  if (active && payload && payload.length) {
    return (
      <div className="rounded-lg border bg-background p-2 shadow-md">
        <div className="grid grid-cols-1 gap-1">
          <span className="text-[0.7rem] uppercase text-muted-foreground">
            {label}
          </span>
          {payload.map((entry, index) => (
            <span key={index} className="font-bold text-sm" style={{ color: entry.color }}>
              {`${entry.name}: ${entry.value}`}
            </span>
          ))}
        </div>
      </div>
    );
  }
  return null;
};

// Pipeline barang MR - urutan siklus hidup 1 item dari diminta sampai
// selesai. "Cancelled"/"Replaced" sengaja tidak dimasukkan (bukan alur maju,
// exception path).
const PIPELINE_STAGES: { key: string; label: string }[] = [
  { key: MR_ITEM_STATUSES.PENDING, label: "Pending" },
  { key: MR_ITEM_STATUSES.PROCESSING, label: "Processing" },
  { key: MR_ITEM_STATUSES.SHIPPED_BY_VENDOR, label: "Dikirim Vendor" },
  { key: MR_ITEM_STATUSES.DITERIMA_GA, label: "Diterima GA" },
  { key: MR_ITEM_STATUSES.ON_DELIVERY, label: "Dikirim ke Requester" },
  { key: MR_ITEM_STATUSES.COMPLETED, label: "Selesai" },
];

// Batas hari MR/PO dianggap "Minggu N" di dalam bulan terpilih - potongan
// per 7 hari dari tanggal 1 (bukan minggu kalender ISO), supaya "Minggu 1
// bulan ini" gak ambigu/gak nyambung ke bulan sebelumnya.
const getMonthWeekRanges = (monthAnchor: Date) => {
  const year = monthAnchor.getFullYear();
  const month = monthAnchor.getMonth();
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const weeks: { week: number; start: Date; end: Date }[] = [];
  let day = 1;
  let week = 1;
  while (day <= daysInMonth) {
    const endDay = Math.min(day + 6, daysInMonth);
    weeks.push({
      week,
      start: new Date(year, month, day),
      end: new Date(year, month, endDay, 23, 59, 59, 999),
    });
    day += 7;
    week += 1;
  }
  return weeks;
};

export default function Dashboard() {
  const [profile, setProfile] = useState<Profile | null>(null);
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [dailyTrend, setDailyTrend] = useState<DailyTrendPoint[]>([]);
  const [departmentDist, setDepartmentDist] = useState<ChartData[]>([]);
  const [pipeline, setPipeline] = useState<ItemStatusPipeline | null>(null);
  const [latestMRs, setLatestMRs] = useState<LatestMR[]>([]);
  const [actionItems, setActionItems] = useState<ActionItemGroup[]>([]);
  const [followupSummary, setFollowupSummary] = useState<
    FollowupSummaryItem[]
  >([]);
  const [mrScore, setMrScore] = useState<ScoreResult | null>(null);
  const [poScore, setPoScore] = useState<ScoreResult | null>(null);
  const [loading, setLoading] = useState(true);

  // Jam berjalan (buat sapaan & jam realtime di header) - update tiap detik.
  const [now, setNow] = useState(new Date());
  useEffect(() => {
    const interval = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(interval);
  }, []);

  const greeting = useMemo(() => {
    const hour = now.getHours();
    if (hour < 11) return "Pagi";
    if (hour < 15) return "Siang";
    if (hour < 19) return "Sore";
    return "Malam";
  }, [now]);

  // Filter Bulan + Minggu (ganti date-range picker lama).
  const [selectedMonth, setSelectedMonth] = useState(() => {
    const d = new Date();
    d.setDate(1);
    d.setHours(0, 0, 0, 0);
    return d;
  });
  const [selectedWeek, setSelectedWeek] = useState<number | null>(null);

  const weekRanges = useMemo(() => getMonthWeekRanges(selectedMonth), [selectedMonth]);

  const effectiveRange = useMemo(() => {
    if (selectedWeek) {
      const w = weekRanges.find((r) => r.week === selectedWeek);
      if (w) return { start: w.start, end: w.end };
    }
    const year = selectedMonth.getFullYear();
    const month = selectedMonth.getMonth();
    return {
      start: new Date(year, month, 1),
      end: new Date(year, month + 1, 0, 23, 59, 59, 999),
    };
  }, [selectedMonth, selectedWeek, weekRanges]);

  const handlePrevMonth = () => {
    setSelectedWeek(null);
    setSelectedMonth((prev) => {
      const d = new Date(prev);
      d.setMonth(d.getMonth() - 1);
      return d;
    });
  };
  const handleNextMonth = () => {
    setSelectedWeek(null);
    setSelectedMonth((prev) => {
      const d = new Date(prev);
      d.setMonth(d.getMonth() + 1);
      return d;
    });
  };

  useEffect(() => {
    const loadDashboard = async () => {
      setLoading(true);
      try {
        const userProfile = await getActiveUserProfile();
        if (!userProfile || !userProfile.company) {
          throw new Error("Profil user atau company tidak ditemukan.");
        }
        setProfile(userProfile);

        const companyCode = userProfile.company;
        const startDate = effectiveRange.start.toISOString();
        const endDate = effectiveRange.end.toISOString();

        const {
          data: { user },
        } = await createClient().auth.getUser();

        const dateRange = { start: startDate, end: endDate };

        const [
          statsData,
          trendData,
          deptData,
          latestData,
          pipelineData,
          actionData,
          mrScoreData,
          poScoreData,
          followupData,
        ] = await Promise.all([
          fetchDashboardStats(companyCode, startDate, endDate),
          fetchDailyMrPoTrend(companyCode, startDate, endDate),
          fetchDepartmentMrDistribution(companyCode, startDate, endDate),
          fetchLatestMRs(companyCode),
          fetchItemStatusPipeline(companyCode),
          user ? fetchMyActionItems(user.id, userProfile) : Promise.resolve([]),
          fetchMrScore(companyCode, dateRange),
          fetchPoScore(companyCode, dateRange),
          user ? fetchMyFollowupSummary(user.id) : Promise.resolve([]),
        ]);

        setStats(statsData);
        setDailyTrend(trendData);
        setDepartmentDist(deptData);
        setLatestMRs(latestData);
        setPipeline(pipelineData);
        setMrScore(mrScoreData);
        setPoScore(poScoreData);
        setActionItems(actionData);
        setFollowupSummary(followupData);
      } catch (error: any) {
        toast.error("Gagal memuat data dashboard", {
          description: error.message,
        });
      } finally {
        setLoading(false);
      }
    };
    loadDashboard();
  }, [effectiveRange.start.getTime(), effectiveRange.end.getTime()]);

  const pipelineChartData = PIPELINE_STAGES.map((stage) => ({
    name: stage.label,
    total: pipeline?.counts[stage.key] || 0,
  }));

  const totalDept = departmentDist.reduce((acc, d) => acc + (d.total || 0), 0);

  return (
    <>
      <style>{`
        :root {
          --color-mr: hsl(221 83% 53%);
          --color-po: hsl(142 71% 45%);
        }
        .dark {
          --color-mr: hsl(221 83% 63%);
          --color-po: hsl(142 71% 55%);
        }
      `}</style>

      {/* --- Header: Sapaan + Profil Singkat + Jam --- */}
      <div className="col-span-12">
        <Content>
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
            <div>
              <h1 className="text-2xl font-bold">
                Selamat {greeting}, {profile?.nama || "..."}!
              </h1>
              <p className="text-sm text-muted-foreground mt-1">
                {profile?.department || "-"}
                {profile?.role ? ` · ${profile.role}` : ""}
                {profile?.company ? ` · ${profile.company}` : ""}
              </p>
            </div>
            <div className="text-left sm:text-right">
              <div className="flex items-center gap-2 text-2xl font-bold tabular-nums">
                <Clock className="h-5 w-5 text-muted-foreground" />
                {now.toLocaleTimeString("en-US", {
                  hour: "2-digit",
                  minute: "2-digit",
                  hour12: true,
                })}
              </div>
              <p className="text-sm text-muted-foreground mt-1">
                {now.toLocaleDateString("id-ID", {
                  weekday: "long",
                  day: "numeric",
                  month: "long",
                  year: "numeric",
                })}
              </p>
            </div>
          </div>
        </Content>
      </div>

      {/* --- Panel Follow-up Approval (urgent) --- */}
      {!loading && followupSummary.length > 0 && (
        <div className="col-span-12">
          <Content
            title="Permintaan Follow-up Approval"
            description="Dokumen ini sedang ditunggu - mohon segera diproses."
            className="border-red-300 dark:border-red-900/60"
          >
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
              {followupSummary.map((item) => (
                <Link
                  key={`${item.type}-${item.id}`}
                  href={item.href}
                  className="flex items-center justify-between gap-2 rounded-md border border-red-200 dark:border-red-900/60 bg-red-50 dark:bg-red-950/30 p-3 hover:bg-red-100 dark:hover:bg-red-950/50 transition-colors"
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <div className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-full bg-red-100 text-red-700 dark:bg-red-900/50 dark:text-red-300 animate-pulse">
                      <BellRing className="h-4 w-4" />
                    </div>
                    <div className="min-w-0">
                      <p className="text-sm font-medium truncate">
                        {item.type === "mr" ? "MR" : "PO"} {item.kode}
                      </p>
                      <p className="text-xs text-red-700 dark:text-red-400 truncate">
                        {item.count}x diminta follow-up - terakhir{" "}
                        {formatRelativeTime(item.lastRequestedAt)}
                      </p>
                    </div>
                  </div>
                  <ArrowRightIcon className="h-4 w-4 text-red-700 dark:text-red-400 flex-shrink-0" />
                </Link>
              ))}
            </div>
          </Content>
        </div>
      )}

      {/* --- Panel Aksi Diperlukan --- */}
      {!loading && actionItems.length > 0 && (
        <div className="col-span-12">
          <Content
            title="Perlu Aksi Anda"
            description="Daftar tugas yang sedang menunggu tindakan Anda."
          >
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
              {actionItems.map((item) => (
                <Link
                  key={item.key}
                  href={item.href}
                  className="flex items-center justify-between gap-2 rounded-md border p-3 hover:bg-muted/50 transition-colors"
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <div className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-full bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300">
                      <Bell className="h-4 w-4" />
                    </div>
                    <p className="text-sm font-medium truncate">{item.title}</p>
                  </div>
                  <ArrowRightIcon className="h-4 w-4 text-muted-foreground flex-shrink-0" />
                </Link>
              ))}
            </div>
          </Content>
        </div>
      )}

      {/* --- Filter Bulan + Minggu --- */}
      <div className="col-span-12 flex flex-col sm:flex-row justify-between items-center gap-4">
        <h2 className="text-lg font-semibold">Ringkasan {profile?.company}</h2>
        <div className="flex flex-col items-end gap-2">
          <div className="flex items-center gap-2">
            <Button variant="outline" size="icon" className="h-8 w-8" onClick={handlePrevMonth}>
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <span className="text-sm font-medium w-36 text-center">
              {selectedMonth.toLocaleDateString("id-ID", {
                month: "long",
                year: "numeric",
              })}
            </span>
            <Button variant="outline" size="icon" className="h-8 w-8" onClick={handleNextMonth}>
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>
          <div className="flex flex-wrap gap-1.5 justify-end">
            <Button
              variant={selectedWeek === null ? "default" : "outline"}
              size="sm"
              className="h-7 text-xs px-2"
              onClick={() => setSelectedWeek(null)}
            >
              Semua
            </Button>
            {weekRanges.map((w) => (
              <Button
                key={w.week}
                variant={selectedWeek === w.week ? "default" : "outline"}
                size="sm"
                className="h-7 text-xs px-2"
                onClick={() => setSelectedWeek(w.week)}
              >
                Minggu {w.week}
              </Button>
            ))}
          </div>
        </div>
      </div>

      {/* --- Skor Kinerja: grading umur MR/PO yang selesai pada periode ini --- */}
      <div className="col-span-12 space-y-2">
        <h3 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
          Skor Kinerja Periode Terpilih
        </h3>
        <div className="grid gap-4 grid-cols-1 sm:grid-cols-2">
          <ScoreStatCard
            title="Skor MR"
            description="Grading kecepatan penyelesaian MR (created s/d Full Received)"
            score={mrScore}
            loading={loading}
          />
          <ScoreStatCard
            title="Skor PO"
            description="Grading kecepatan penyelesaian PO (created s/d Full Received)"
            score={poScore}
            loading={loading}
          />
        </div>
      </div>

      {/* --- Kartu Statistik: Ringkasan Periode --- */}
      <div className="col-span-12 space-y-2">
        <h3 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
          Ringkasan Periode Terpilih
        </h3>
        <div className="grid gap-4 grid-cols-1 sm:grid-cols-2 md:grid-cols-3 xl:grid-cols-6">
          <ClickableStatCard
            mode="server"
            title="Total MR"
            value={stats?.mr_total}
            icon={Files}
            description="Semua MR dibuat periode ini"
            colorClass="text-indigo-500"
            loading={loading}
            columns={["Kode MR", "PIC", "Status", "Tanggal"]}
            fetchPage={(page, limit) =>
              fetchMrByStatus(
                profile?.company || "",
                null,
                { start: effectiveRange.start.toISOString(), end: effectiveRange.end.toISOString() },
                page,
                limit,
              )
            }
            renderRow={(row) => (
              <>
                <TableCell className="font-medium">{row.kode_mr}</TableCell>
                <TableCell>{row.users_with_profiles?.nama || "N/A"}</TableCell>
                <TableCell><Badge variant="secondary">{row.status}</Badge></TableCell>
                <TableCell>{formatDateFriendly(row.created_at)}</TableCell>
              </>
            )}
          />
          <ClickableStatCard
            mode="server"
            title="Total PO"
            value={stats?.po_total}
            icon={ShoppingCart}
            description="Semua PO dibuat periode ini"
            colorClass="text-purple-500"
            loading={loading}
            columns={["Kode PO", "PIC", "Status", "Tanggal"]}
            fetchPage={(page, limit) =>
              fetchPoByStatus(
                profile?.company || "",
                null,
                { start: effectiveRange.start.toISOString(), end: effectiveRange.end.toISOString() },
                page,
                limit,
              )
            }
            renderRow={(row) => (
              <>
                <TableCell className="font-medium">{row.kode_po}</TableCell>
                <TableCell>{row.users_with_profiles?.nama || "N/A"}</TableCell>
                <TableCell><Badge variant="secondary">{row.status}</Badge></TableCell>
                <TableCell>{formatDateFriendly(row.created_at)}</TableCell>
              </>
            )}
          />
          <ClickableStatCard
            mode="server"
            title="MR Open"
            value={stats?.mr_open}
            icon={FileClock}
            description="Pending Validation/Approval"
            colorClass="text-yellow-500"
            loading={loading}
            columns={["Kode MR", "PIC", "Status", "Tanggal"]}
            fetchPage={(page, limit) =>
              fetchMrByStatus(
                profile?.company || "",
                ["Pending Validation", "Pending Approval"],
                { start: effectiveRange.start.toISOString(), end: effectiveRange.end.toISOString() },
                page,
                limit,
              )
            }
            renderRow={(row) => (
              <>
                <TableCell className="font-medium">{row.kode_mr}</TableCell>
                <TableCell>{row.users_with_profiles?.nama || "N/A"}</TableCell>
                <TableCell><Badge variant="secondary">{row.status}</Badge></TableCell>
                <TableCell>{formatDateFriendly(row.created_at)}</TableCell>
              </>
            )}
          />
          <ClickableStatCard
            mode="server"
            title="MR Menunggu PO"
            value={stats?.mr_waiting_po}
            icon={FileSpreadsheet}
            description="Status Waiting PO"
            colorClass="text-blue-500"
            loading={loading}
            columns={["Kode MR", "PIC", "Status", "Tanggal"]}
            fetchPage={(page, limit) =>
              fetchMrByStatus(
                profile?.company || "",
                "Waiting PO",
                { start: effectiveRange.start.toISOString(), end: effectiveRange.end.toISOString() },
                page,
                limit,
              )
            }
            renderRow={(row) => (
              <>
                <TableCell className="font-medium">{row.kode_mr}</TableCell>
                <TableCell>{row.users_with_profiles?.nama || "N/A"}</TableCell>
                <TableCell><Badge variant="secondary">{row.status}</Badge></TableCell>
                <TableCell>{formatDateFriendly(row.created_at)}</TableCell>
              </>
            )}
          />
          <ClickableStatCard
            mode="server"
            title="MR Selesai"
            value={stats?.mr_closed}
            icon={FileCheck}
            description="Status Full Received"
            colorClass="text-green-500"
            loading={loading}
            columns={["Kode MR", "PIC", "Status", "Tanggal"]}
            fetchPage={(page, limit) =>
              fetchMrByStatus(
                profile?.company || "",
                "Full Received",
                { start: effectiveRange.start.toISOString(), end: effectiveRange.end.toISOString() },
                page,
                limit,
              )
            }
            renderRow={(row) => (
              <>
                <TableCell className="font-medium">{row.kode_mr}</TableCell>
                <TableCell>{row.users_with_profiles?.nama || "N/A"}</TableCell>
                <TableCell><Badge variant="secondary">{row.status}</Badge></TableCell>
                <TableCell>{formatDateFriendly(row.created_at)}</TableCell>
              </>
            )}
          />
          <ClickableStatCard
            mode="server"
            title="MR Ditolak"
            value={stats?.mr_rejected}
            icon={FileX}
            description="Status Rejected"
            colorClass="text-destructive"
            loading={loading}
            columns={["Kode MR", "PIC", "Status", "Tanggal"]}
            fetchPage={(page, limit) =>
              fetchMrByStatus(
                profile?.company || "",
                "Rejected",
                { start: effectiveRange.start.toISOString(), end: effectiveRange.end.toISOString() },
                page,
                limit,
              )
            }
            renderRow={(row) => (
              <>
                <TableCell className="font-medium">{row.kode_mr}</TableCell>
                <TableCell>{row.users_with_profiles?.nama || "N/A"}</TableCell>
                <TableCell><Badge variant="secondary">{row.status}</Badge></TableCell>
                <TableCell>{formatDateFriendly(row.created_at)}</TableCell>
              </>
            )}
          />
        </div>
      </div>

      {/* --- Kartu Statistik: Status Operasional Saat Ini (snapshot, TIDAK ikut filter bulan/minggu) --- */}
      <div className="col-span-12 space-y-2">
        <h3 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
          Status Operasional Saat Ini
        </h3>
        <div className="grid gap-4 grid-cols-1 sm:grid-cols-2 md:grid-cols-3 xl:grid-cols-6">
          <ClickableStatCard
            mode="client"
            title="Dikirim dari Vendor"
            value={pipeline?.counts[MR_ITEM_STATUSES.SHIPPED_BY_VENDOR] || 0}
            icon={Truck}
            description="Barang saat ini dalam pengiriman dari vendor"
            colorClass="text-indigo-500"
            loading={loading}
            columns={["Kode MR", "Barang", "Qty", "Status"]}
            items={pipeline?.itemsByStatus[MR_ITEM_STATUSES.SHIPPED_BY_VENDOR] || []}
            renderRow={(row) => (
              <>
                <TableCell className="font-medium">{row.kode_mr}</TableCell>
                <TableCell>{row.name}</TableCell>
                <TableCell>{row.qty} {row.uom}</TableCell>
                <TableCell><Badge variant="secondary">{row.status}</Badge></TableCell>
              </>
            )}
          />
          <ClickableStatCard
            mode="client"
            title="Dikirim dari GA"
            value={pipeline?.counts[MR_ITEM_STATUSES.ON_DELIVERY] || 0}
            icon={PackageCheck}
            description="Barang saat ini dalam pengiriman dari GA ke requester"
            colorClass="text-amber-500"
            loading={loading}
            columns={["Kode MR", "Barang", "Qty", "Status"]}
            items={pipeline?.itemsByStatus[MR_ITEM_STATUSES.ON_DELIVERY] || []}
            renderRow={(row) => (
              <>
                <TableCell className="font-medium">{row.kode_mr}</TableCell>
                <TableCell>{row.name}</TableCell>
                <TableCell>{row.qty} {row.uom}</TableCell>
                <TableCell><Badge variant="secondary">{row.status}</Badge></TableCell>
              </>
            )}
          />
          <ClickableStatCard
            mode="server"
            title="PO Open"
            value={stats?.po_pending}
            icon={Package}
            description="Pending Validation/Approval/Receive (saat ini)"
            colorClass="text-cyan-500"
            loading={loading}
            columns={["Kode PO", "PIC", "Status", "Tanggal"]}
            fetchPage={(page, limit) =>
              fetchPoByStatus(
                profile?.company || "",
                ["Pending Validation", "Pending Approval", "Pending Receive", "Partial Receive"],
                null,
                page,
                limit,
              )
            }
            renderRow={(row) => (
              <>
                <TableCell className="font-medium">{row.kode_po}</TableCell>
                <TableCell>{row.users_with_profiles?.nama || "N/A"}</TableCell>
                <TableCell><Badge variant="secondary">{row.status}</Badge></TableCell>
                <TableCell>{formatDateFriendly(row.created_at)}</TableCell>
              </>
            )}
          />
          <ClickableStatCard
            mode="server"
            title="PO Full Received"
            value={stats?.po_full_received}
            icon={CheckCircle2}
            description="Barang PO diterima penuh (saat ini)"
            colorClass="text-green-500"
            loading={loading}
            columns={["Kode PO", "PIC", "Status", "Tanggal"]}
            fetchPage={(page, limit) =>
              fetchPoByStatus(profile?.company || "", "Full Received", null, page, limit)
            }
            renderRow={(row) => (
              <>
                <TableCell className="font-medium">{row.kode_po}</TableCell>
                <TableCell>{row.users_with_profiles?.nama || "N/A"}</TableCell>
                <TableCell><Badge variant="secondary">{row.status}</Badge></TableCell>
                <TableCell>{formatDateFriendly(row.created_at)}</TableCell>
              </>
            )}
          />
          <ClickableStatCard
            mode="server"
            title="PO Partial Received"
            value={stats?.po_partial_received}
            icon={PackageOpen}
            description="Barang PO diterima sebagian (saat ini)"
            colorClass="text-orange-500"
            loading={loading}
            columns={["Kode PO", "PIC", "Status", "Tanggal"]}
            fetchPage={(page, limit) =>
              fetchPoByStatus(profile?.company || "", "Partial Receive", null, page, limit)
            }
            renderRow={(row) => (
              <>
                <TableCell className="font-medium">{row.kode_po}</TableCell>
                <TableCell>{row.users_with_profiles?.nama || "N/A"}</TableCell>
                <TableCell><Badge variant="secondary">{row.status}</Badge></TableCell>
                <TableCell>{formatDateFriendly(row.created_at)}</TableCell>
              </>
            )}
          />
          <ClickableStatCard
            mode="server"
            title="PO Selesai"
            value={stats?.po_completed}
            icon={CheckCheck}
            description="Status Full Received"
            colorClass="text-green-500"
            loading={loading}
            columns={["Kode PO", "PIC", "Status", "Tanggal"]}
            fetchPage={(page, limit) =>
              fetchPoByStatus(
                profile?.company || "",
                "Full Received",
                { start: effectiveRange.start.toISOString(), end: effectiveRange.end.toISOString() },
                page,
                limit,
              )
            }
            renderRow={(row) => (
              <>
                <TableCell className="font-medium">{row.kode_po}</TableCell>
                <TableCell>{row.users_with_profiles?.nama || "N/A"}</TableCell>
                <TableCell><Badge variant="secondary">{row.status}</Badge></TableCell>
                <TableCell>{formatDateFriendly(row.created_at)}</TableCell>
              </>
            )}
          />
        </div>
      </div>

      <Content
        size="md"
        title="Tren Harian MR vs PO"
        className="col-span-12 lg:col-span-7"
        description="Jumlah MR & PO dibuat per hari pada periode terpilih."
      >
        {loading ? (
          <Skeleton className="h-[350px] w-full" />
        ) : (
          <ResponsiveContainer width="100%" height={350}>
            <AreaChart data={dailyTrend}>
              <defs>
                <linearGradient id="colorMr" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="var(--color-mr)" stopOpacity={0.4} />
                  <stop offset="95%" stopColor="var(--color-mr)" stopOpacity={0} />
                </linearGradient>
                <linearGradient id="colorPo" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="var(--color-po)" stopOpacity={0.4} />
                  <stop offset="95%" stopColor="var(--color-po)" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="hsl(var(--border))" />
              <XAxis dataKey="label" fontSize={12} tickLine={false} axisLine={false} />
              <YAxis fontSize={12} tickLine={false} axisLine={false} allowDecimals={false} />
              <Tooltip content={<CustomTooltip />} />
              <Legend />
              <Area
                type="monotone"
                dataKey="mr"
                name="MR Dibuat"
                stroke="var(--color-mr)"
                strokeWidth={2}
                fill="url(#colorMr)"
                activeDot={{ r: 5 }}
              />
              <Area
                type="monotone"
                dataKey="po"
                name="PO Dibuat"
                stroke="var(--color-po)"
                strokeWidth={2}
                fill="url(#colorPo)"
                activeDot={{ r: 5 }}
              />
            </AreaChart>
          </ResponsiveContainer>
        )}
      </Content>

      <Content
        size="md"
        title="Distribusi MR per Departemen"
        className="col-span-12 lg:col-span-5"
        description="Persentase total MR berdasarkan departemen (periode terpilih)."
      >
        {loading ? (
          <Skeleton className="h-[350px] w-full" />
        ) : (
          <ResponsiveContainer width="100%" height={350}>
            <PieChart>
              <Pie
                data={departmentDist}
                cx="50%"
                cy="50%"
                labelLine={false}
                label={<CustomPieLabel />}
                innerRadius={70}
                outerRadius={120}
                paddingAngle={2}
                fill="#8884d8"
                dataKey="total"
                nameKey="name"
              >
                {departmentDist.map((_, index) => (
                  <Cell
                    key={`cell-${index}`}
                    fill={PIE_COLORS[index % PIE_COLORS.length]}
                    stroke={PIE_COLORS[index % PIE_COLORS.length]}
                    className="focus:outline-none"
                  />
                ))}
              </Pie>
              <text
                x="50%"
                y="47%"
                textAnchor="middle"
                dominantBaseline="middle"
                className="fill-foreground text-2xl font-bold"
              >
                {totalDept}
              </text>
              <text
                x="50%"
                y="55%"
                textAnchor="middle"
                dominantBaseline="middle"
                className="fill-muted-foreground text-xs"
              >
                Total MR
              </text>
              <Tooltip content={<CustomTooltip />} />
              <Legend />
            </PieChart>
          </ResponsiveContainer>
        )}
      </Content>

      <Content
        size="lg"
        title="Pipeline Barang MR"
        description="Jumlah barang per tahap alur (dari semua MR aktif, tidak terpengaruh filter periode)."
        className="col-span-12"
      >
        {loading ? (
          <Skeleton className="h-[280px] w-full" />
        ) : (
          <ResponsiveContainer width="100%" height={280}>
            <BarChart data={pipelineChartData} layout="vertical" margin={{ left: 24 }}>
              <defs>
                <linearGradient id="colorPipeline" x1="0" y1="0" x2="1" y2="0">
                  <stop offset="0%" stopColor="var(--color-mr)" stopOpacity={0.9} />
                  <stop offset="100%" stopColor="var(--color-mr)" stopOpacity={0.5} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="hsl(var(--border))" />
              <XAxis type="number" fontSize={12} tickLine={false} axisLine={false} allowDecimals={false} />
              <YAxis type="category" dataKey="name" fontSize={12} tickLine={false} axisLine={false} width={130} />
              <Tooltip content={<CustomTooltip />} />
              <Bar dataKey="total" name="Jumlah Barang" fill="url(#colorPipeline)" radius={[0, 4, 4, 0]} />
            </BarChart>
          </ResponsiveContainer>
        )}
      </Content>

      <Content
        size="lg"
        title="Material Request Terbaru"
        description={`5 MR terakhir (semua periode) untuk ${profile?.company}`}
        className="col-span-12"
      >
        <div className="rounded-md border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Kode MR</TableHead>
                <TableHead>PIC</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Tanggal dibuat</TableHead>
                <TableHead className="text-right">Aksi</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {loading ? (
                Array.from({ length: 5 }).map((_, i) => (
                  <TableRow key={i}>
                    <TableCell colSpan={5}>
                      <Skeleton className="h-8 w-full" />
                    </TableCell>
                  </TableRow>
                ))
              ) : latestMRs.length > 0 ? (
                latestMRs.map((mr) => (
                  <TableRow key={mr.id}>
                    <TableCell className="font-medium">{mr.kode_mr}</TableCell>
                    <TableCell>{mr.users_with_profiles?.nama || "N/A"}</TableCell>
                    <TableCell>
                      <Badge variant="secondary">{mr.status}</Badge>
                    </TableCell>
                    <TableCell>{formatDateFriendly(mr.created_at)}</TableCell>
                    <TableCell className="text-right">
                      <Button asChild variant="outline" size="sm">
                        <Link href={`/material-request/${mr.id}`}>View</Link>
                      </Button>
                    </TableCell>
                  </TableRow>
                ))
              ) : (
                <TableRow>
                  <TableCell colSpan={5} className="text-center h-24">
                    Tidak ada data MR terbaru.
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </div>
      </Content>
    </>
  );
}
