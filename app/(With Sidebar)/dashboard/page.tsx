// src/app/(With Sidebar)/dashboard/page.tsx

"use client";

import { useEffect, useState } from "react";
import { Content } from "@/components/content";
import { TrendingUp } from "lucide-react";
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
} from "recharts";
import {
  fetchDashboardStats,
  fetchMonthlyMrTrend,
  fetchDepartmentMrDistribution,
  fetchLatestMRs,
  getActiveUserProfile,
  DashboardStats,
  ChartData,
  LatestMR,
} from "@/services/dashboardService";
import { Profile } from "@/type";
import { toast } from "sonner";
import { Skeleton } from "@/components/ui/skeleton";

// Warna untuk chart pai (sesuai variabel CSS shadcn)
const PIE_COLORS = [
  "hsl(var(--chart-1))",
  "hsl(var(--chart-2))",
  "hsl(var(--chart-3))",
  "hsl(var(--chart-4))",
  "hsl(var(--chart-5))",
];

export default function Dashboard() {
  const [profile, setProfile] = useState<Profile | null>(null);
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [monthlyTrend, setMonthlyTrend] = useState<ChartData[]>([]);
  const [departmentDist, setDepartmentDist] = useState<ChartData[]>([]);
  const [latestMRs, setLatestMRs] = useState<LatestMR[]>([]);
  const [loading, setLoading] = useState(true);

  // Tanggal default (1 tahun terakhir)
  const [dateRange, setDateRange] = useState({
    from: new Date(new Date().setFullYear(new Date().getFullYear() - 1)),
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
        const startDate = dateRange.from.toISOString();
        const endDate = dateRange.to.toISOString();

        const [statsData, trendData, deptData, latestData] = await Promise.all([
          fetchDashboardStats(companyCode, startDate, endDate),
          fetchMonthlyMrTrend(companyCode),
          fetchDepartmentMrDistribution(companyCode),
          fetchLatestMRs(companyCode),
        ]);

        setStats(statsData);
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
  }: {
    title: string;
    value: string | number | undefined;
    description: string;
  }) => (
    <Content size="xs" title={title} description={description}>
      {loading ? (
        <Skeleton className="h-8 w-16" />
      ) : (
        <p className="font-bold text-2xl">{value ?? 0}</p>
      )}
    </Content>
  );

  return (
    <>
      <Content
        size="md"
        title="Tren MR vs PO Tahun Ini"
        cardFooter={
          <div className="flex w-full items-start gap-2 text-sm">
            <div className="grid gap-2">
              <div className="flex items-center gap-2 leading-none font-medium">
                Statistik pembuatan MR tahun ini ({profile?.company})
                <TrendingUp className="h-4 w-4" />
              </div>
              <div className="text-muted-foreground flex items-center gap-2 leading-none">
                Periode {new Date().getFullYear()}
              </div>
            </div>
          </div>
        }
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
              <Tooltip
                cursor={{ fill: "hsl(var(--muted))" }}
                contentStyle={{
                  backgroundColor: "hsl(var(--background))",
                  border: "1px solid hsl(var(--border))",
                }}
              />
              <Bar
                dataKey="total"
                fill="hsl(var(--primary))"
                radius={[4, 4, 0, 0]}
              />
            </BarChart>
          </ResponsiveContainer>
        )}
      </Content>

      <Content
        size="md"
        title="Distribusi MR per Departemen"
        cardFooter={
          <div className="flex w-full items-start gap-2 text-sm">
            <div className="grid gap-2">
              <div className="flex items-center gap-2 leading-none font-medium">
                Statistik berdasarkan departemen tahun ini ({profile?.company})
                <TrendingUp className="h-4 w-4" />
              </div>
            </div>
          </div>
        }
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
                outerRadius={100}
                fill="#8884d8"
                dataKey="total"
                nameKey="name"
                label={({ name, percent }) =>
                  `${name} (${(percent * 100).toFixed(0)}%)`
                }
              >
                {departmentDist.map((_, index) => (
                  <Cell
                    key={`cell-${index}`}
                    fill={PIE_COLORS[index % PIE_COLORS.length]}
                  />
                ))}
              </Pie>
              <Tooltip
                contentStyle={{
                  backgroundColor: "hsl(var(--background))",
                  border: "1px solid hsl(var(--border))",
                }}
              />
              <Legend />
            </PieChart>
          </ResponsiveContainer>
        )}
      </Content>

      {/* --- Kartu Statistik --- */}
      <StatCard
        title="MR Open"
        value={stats?.mr_open}
        description="Status Pending"
      />
      <StatCard
        title="MR Closed"
        value={stats?.mr_closed}
        description="Status Completed"
      />
      <StatCard
        title="Total MR"
        value={stats?.mr_total}
        description="Tahun ini"
      />
      <StatCard
        title="PO Pending"
        value={stats?.po_pending}
        description="Status Pending"
      />
      <StatCard
        title="PO Completed"
        value={stats?.po_completed}
        description="Status Completed"
      />
      <StatCard
        title="Total PO"
        value={stats?.po_total}
        description="Tahun ini"
      />

      {/* Rata-rata waktu (Masih Dummy - perlu RPC khusus) */}
      {/* <Content
        size="md"
        title="Rata-rata Waktu Proses"
        className="col-span-12 md:col-span-6"
      >
        <div className="space-y-4">
          <div>
            <CardTitle>MR s/d PO Dibuat</CardTitle>
            <CardDescription>2 Hari, 6 Jam (dummy)</CardDescription>
          </div>
          <div>
            <CardTitle>MR Open s/d MR Close</CardTitle>
            <CardDescription>6 Hari, 12 Jam (dummy)</CardDescription>
          </div>
        </div>
      </Content> */}

      {/* <Content
        size="lg"
        title="Material Request Terbaru"
        description={`5 MR terakhir untuk ${profile?.company}`}
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
                    <TableCell>{mr.status}</TableCell>
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
      </Content> */}
    </>
  );
}
