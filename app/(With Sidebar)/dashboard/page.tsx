"use client";

import { useEffect, useState } from "react";
import { Content } from "@/components/content";
import {
  FileClock,
  FileCheck,
  FileX,
  FileSpreadsheet,
  Package,
  CheckCheck,
  Calendar as CalendarIcon,
  TrendingUp,
} from "lucide-react";
import {
  Bar,
  BarChart,
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
} from "recharts";
import {
  fetchDashboardStats,
  fetchMonthlyMrTrend,
  fetchDepartmentMrDistribution,
  fetchLatestMRs,
  getActiveUserProfile,
  DashboardStats,
  ChartData, // Asumsi ChartData adalah { name: string, total: number } atau { name: string, mr: number, po: number }
  LatestMR,
} from "@/services/dashboardService";
import { Profile } from "@/type";
import { toast } from "sonner";
import { Skeleton } from "@/components/ui/skeleton";
import { cn, formatCurrency, formatDateFriendly } from "@/lib/utils";
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
import { Calendar } from "@/components/ui/calendar";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { DateRange } from "react-day-picker";
import { format } from "date-fns";

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

// Helper untuk label Pie Chart kustom
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

  // Hanya tampilkan label jika persentase cukup besar
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

// Helper untuk Tooltip Kustom
const CustomTooltip = ({
  active,
  payload,
  label,
}: TooltipProps<number, string>) => {
  if (active && payload && payload.length) {
    return (
      <div className="rounded-lg border bg-background p-2 shadow-sm">
        <div className="grid grid-cols-1 gap-2">
          <div className="flex flex-col">
            <span className="text-[0.7rem] uppercase text-muted-foreground">
              {label}
            </span>
            {payload.map((entry, index) => (
              <span
                key={index}
                className="font-bold"
                style={{ color: entry.color }}
              >
                {`${entry.name}: ${entry.value}`}
              </span>
            ))}
          </div>
        </div>
      </div>
    );
  }
  return null;
};

export default function Dashboard() {
  const [profile, setProfile] = useState<Profile | null>(null);
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [monthlyTrend, setMonthlyTrend] = useState<ChartData[]>([]);
  const [departmentDist, setDepartmentDist] = useState<ChartData[]>([]);
  const [latestMRs, setLatestMRs] = useState<LatestMR[]>([]);
  const [loading, setLoading] = useState(true);

  // Default ke 30 hari terakhir
  const [dateRange, setDateRange] = useState<DateRange | undefined>({
    from: new Date(new Date().setDate(new Date().getDate() - 30)),
    to: new Date(),
  });

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

        // Pastikan dateRange tidak undefined
        const startDate = (dateRange?.from || new Date(0)).toISOString();
        const endDate = (dateRange?.to || new Date()).toISOString();

        // PENTING: Pastikan fungsi service di dashboardService.ts sudah diupdate
        // untuk menerima startDate dan endDate pada fetchMonthlyMrTrend dan fetchDepartmentMrDistribution

        const [statsData, trendData, deptData, latestData] = await Promise.all([
          fetchDashboardStats(companyCode, startDate, endDate),
          fetchMonthlyMrTrend(companyCode, startDate, endDate), // Asumsi service sudah diupdate
          fetchDepartmentMrDistribution(companyCode, startDate, endDate), // Asumsi service sudah diupdate
          fetchLatestMRs(companyCode), // latestMRs tidak perlu filter tanggal
        ]);

        setStats(statsData);
        console.log(statsData);
        setMonthlyTrend(trendData);
        setDepartmentDist(deptData);
        setLatestMRs(latestData);
      } catch (error: any) {
        toast.error("Gagal memuat data dashboard", {
          description: error.message,
        });
      } finally {
        setLoading(false);
      }
    };
    loadDashboard();
  }, [dateRange]); // Muat ulang jika date range berubah

  const StatCard = ({
    title,
    value,
    description,
    icon: Icon,
    colorClass,
  }: {
    title: string;
    value: string | number | undefined;
    description: string;
    icon: React.ElementType;
    colorClass?: string;
  }) => (
    <Content size="xs" className="flex flex-col">
      <div className="flex justify-between items-center mb-2">
        <h3 className="text-sm font-medium text-muted-foreground">{title}</h3>
        <Icon
          className={cn("h-5 w-5", colorClass || "text-muted-foreground")}
        />
      </div>
      {loading ? (
        <Skeleton className="h-9 w-16" />
      ) : (
        <p className="font-bold text-3xl">{value ?? 0}</p>
      )}
      <p className="text-xs text-muted-foreground mt-auto pt-2">
        {description}
      </p>
    </Content>
  );

  return (
    <>
      {/* Definisi warna chart untuk light/dark mode */}
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

      {/* Filter Tanggal */}
      <div className="col-span-12 flex flex-col sm:flex-row justify-between items-center gap-4">
        <h1 className="text-2xl font-bold">Dashboard {profile?.company}</h1>
        <Popover>
          <PopoverTrigger asChild>
            <Button
              variant="outline"
              className={cn(
                "w-full sm:w-[300px] justify-start text-left font-normal",
                !dateRange && "text-muted-foreground"
              )}
            >
              <CalendarIcon className="mr-2 h-4 w-4" />
              {dateRange?.from ? (
                dateRange.to ? (
                  <>
                    {format(dateRange.from, "LLL dd, y")} -{" "}
                    {format(dateRange.to, "LLL dd, y")}
                  </>
                ) : (
                  format(dateRange.from, "LLL dd, y")
                )
              ) : (
                <span>Pilih rentang tanggal</span>
              )}
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-auto p-0" align="end">
            <Calendar
              initialFocus
              mode="range"
              defaultMonth={dateRange?.from}
              selected={dateRange}
              onSelect={setDateRange} // Auto-update saat memilih
              numberOfMonths={2}
            />
          </PopoverContent>
        </Popover>
      </div>

      {/* --- Kartu Statistik --- */}
      <div className="col-span-12 grid gap-4 md:grid-cols-3 lg:grid-cols-6">
        <StatCard
          title="MR Open"
          value={stats?.mr_open}
          icon={FileClock}
          description="Pending Validation/Approval"
          colorClass="text-yellow-500"
        />
        <StatCard
          title="MR Menunggu PO"
          value={stats?.mr_waiting_po}
          icon={FileSpreadsheet}
          description="Status Waiting PO"
          colorClass="text-blue-500"
        />
        <StatCard
          title="MR Selesai"
          value={stats?.mr_closed}
          icon={FileCheck}
          description="Status Completed"
          colorClass="text-green-500"
        />
        <StatCard
          title="PO Open"
          value={stats?.po_pending}
          icon={Package}
          description="Pending Validation/Approval/BAST"
          colorClass="text-cyan-500"
        />
        <StatCard
          title="PO Selesai"
          value={stats?.po_completed}
          icon={CheckCheck}
          description="Status Completed"
          colorClass="text-green-500"
        />
        <StatCard
          title="MR Ditolak"
          value={stats?.mr_rejected}
          icon={FileX}
          description="Status Rejected"
          colorClass="text-destructive"
        />
      </div>

      <Content
        size="md"
        title="Tren MR vs PO"
        className="col-span-12 lg:col-span-7"
        description={`Total MR vs PO dibuat dalam rentang tanggal terpilih.`}
      >
        {loading ? (
          <Skeleton className="h-[350px] w-full" />
        ) : (
          <ResponsiveContainer width="100%" height={350}>
            <BarChart data={monthlyTrend}>
              <CartesianGrid
                strokeDasharray="3 3"
                vertical={false}
                stroke="hsl(var(--border))"
              />
              <XAxis
                dataKey="name"
                fontSize={12}
                tickLine={false}
                axisLine={false}
              />
              <YAxis
                fontSize={12}
                tickLine={false}
                axisLine={false}
                allowDecimals={false}
              />
              <Tooltip content={<CustomTooltip />} />
              <Legend />
              <Bar
                dataKey="mr"
                fill="var(--color-mr)"
                radius={[4, 4, 0, 0]}
                name="MR Dibuat"
              />
              <Bar
                dataKey="po"
                fill="var(--color-po)"
                radius={[4, 4, 0, 0]}
                name="PO Dibuat"
              />
            </BarChart>
          </ResponsiveContainer>
        )}
      </Content>

      <Content
        size="md"
        title="Distribusi MR per Departemen"
        className="col-span-12 lg:col-span-5"
        description="Persentase total MR berdasarkan departemen."
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
                outerRadius={120} // Buat pie lebih besar
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
              <Tooltip content={<CustomTooltip />} />
              <Legend />
            </PieChart>
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
                    <TableCell>
                      {mr.users_with_profiles?.nama || "N/A"}
                    </TableCell>
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
