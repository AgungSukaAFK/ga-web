// src/app/(With Sidebar)/petty-cash/management/page.tsx

"use client";

import { Content } from "@/components/content";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { useState, useEffect } from "react";
import { createClient } from "@/lib/supabase/client";
import { fetchManagementPettyCash } from "@/services/pettyCashService";
import { PettyCashRequest } from "@/type";
import {
  PETTY_CASH_STATUS_COLORS,
  PETTY_CASH_STATUS_OPTIONS,
} from "@/type/enum";
import {
  Loader2,
  RefreshCcw,
  Search,
  ArrowRight,
  FileSignature,
} from "lucide-react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";

const formatRupiah = (angka: number) => {
  return new Intl.NumberFormat("id-ID", {
    style: "currency",
    currency: "IDR",
    minimumFractionDigits: 0,
  }).format(angka);
};

const formatDate = (dateStr: string | Date) => {
  return new Date(dateStr).toLocaleDateString("id-ID", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
};

export default function PettyCashManagementPage() {
  const router = useRouter();
  const supabase = createClient();

  const [requests, setRequests] = useState<PettyCashRequest[]>([]);
  const [loading, setLoading] = useState(true);

  // State untuk Filter & Pencarian
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState("All");

  const loadData = async () => {
    setLoading(true);
    try {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) throw new Error("Tidak terautentikasi.");

      // Ambil profil untuk cek Role & Company
      const { data: profile, error } = await supabase
        .from("profiles")
        .select("company, department, role")
        .eq("id", user.id)
        .single();

      if (error) throw error;

      // 1. Proteksi Halaman (Hanya role tertentu yang boleh masuk)
      const isAuthorized =
        ["Finance", "General Affair", "General Manager"].includes(
          profile.department,
        ) || ["admin", "approver"].includes(profile.role);

      if (!isAuthorized) {
        toast.error("Akses Ditolak", {
          description:
            "Anda tidak memiliki hak akses ke halaman manajemen ini.",
        });
        router.push("/dashboard");
        return;
      }

      // 2. Tarik data (Logic backend sudah difilter per-Company)
      const data = await fetchManagementPettyCash(profile.company);
      setRequests(data);
    } catch (error: any) {
      toast.error("Gagal memuat data", { description: error.message });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  // Logic Pencarian & Filter Lokal
  const filteredRequests = requests.filter((pc) => {
    const searchLower = searchQuery.toLowerCase();
    const matchesSearch =
      pc.kode_pc.toLowerCase().includes(searchLower) ||
      (pc.users_with_profiles?.nama || "").toLowerCase().includes(searchLower);

    const matchesStatus = statusFilter === "All" || pc.status === statusFilter;

    return matchesSearch && matchesStatus;
  });

  const getStatusBadge = (status: string) => {
    const colorClass =
      PETTY_CASH_STATUS_COLORS[status] || "bg-gray-100 text-gray-800";
    return (
      <Badge className={`${colorClass} whitespace-nowrap`}>{status}</Badge>
    );
  };

  return (
    <Content
      title="Manajemen Petty Cash"
      description="Pantau dan proses semua pengajuan kas kecil operasional dari karyawan."
      cardAction={
        <Button
          variant="outline"
          size="sm"
          onClick={loadData}
          disabled={loading}
        >
          <RefreshCcw
            className={`h-4 w-4 mr-1 ${loading ? "animate-spin" : ""}`}
          />
          Refresh
        </Button>
      }
    >
      <div className="space-y-4">
        {/* PANEL PENCARIAN & FILTER */}
        <div className="flex flex-col sm:flex-row gap-4 justify-between bg-muted/30 p-4 rounded-lg border">
          <div className="relative w-full sm:w-[350px]">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Cari No. Dokumen atau Nama Pemohon..."
              className="pl-9"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
          </div>
          <div className="w-full sm:w-[220px]">
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger>
                <SelectValue placeholder="Filter Status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="All">Semua Status</SelectItem>
                {PETTY_CASH_STATUS_OPTIONS.map((status) => (
                  <SelectItem key={status} value={status}>
                    {status}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>

        {/* TABEL DATA (Anti-Melar) */}
        <div className="rounded-md border overflow-hidden">
          <Table className="table-fixed">
            <TableHeader>
              <TableRow>
                <TableHead className="w-[110px]">Tanggal</TableHead>
                <TableHead className="w-[180px]">No. Dokumen</TableHead>
                <TableHead className="w-[150px]">Pemohon</TableHead>
                <TableHead className="w-[160px]">Tipe</TableHead>
                <TableHead className="w-[150px] text-right">Nominal</TableHead>
                <TableHead className="w-[160px]">Status</TableHead>
                <TableHead className="w-[120px] text-center">Aksi</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {loading ? (
                <TableRow>
                  <TableCell colSpan={7} className="text-center h-32">
                    <Loader2 className="animate-spin h-6 w-6 mx-auto text-primary" />
                    <span className="text-sm text-muted-foreground mt-2 block">
                      Memuat data...
                    </span>
                  </TableCell>
                </TableRow>
              ) : filteredRequests.length === 0 ? (
                <TableRow>
                  <TableCell
                    colSpan={7}
                    className="text-center h-32 text-muted-foreground flex-col items-center justify-center"
                  >
                    <FileSignature className="h-8 w-8 mx-auto mb-2 text-muted-foreground/50" />
                    Tidak ada pengajuan ditemukan.
                  </TableCell>
                </TableRow>
              ) : (
                filteredRequests.map((pc) => (
                  <TableRow
                    key={pc.id}
                    className="hover:bg-muted/50 transition-colors"
                  >
                    <TableCell
                      className="whitespace-nowrap text-sm truncate"
                      title={formatDate(pc.created_at)}
                    >
                      {formatDate(pc.created_at)}
                    </TableCell>
                    <TableCell
                      className="font-semibold text-sm text-primary truncate"
                      title={pc.kode_pc}
                    >
                      {pc.kode_pc}
                    </TableCell>
                    <TableCell
                      className="truncate text-sm font-medium"
                      title={pc.users_with_profiles?.nama || "-"}
                    >
                      {pc.users_with_profiles?.nama || "-"}
                    </TableCell>
                    <TableCell className="text-sm truncate" title={pc.type}>
                      {pc.type}
                    </TableCell>
                    <TableCell className="text-right font-medium text-sm">
                      {formatRupiah(pc.amount)}
                    </TableCell>
                    <TableCell>{getStatusBadge(pc.status)}</TableCell>
                    <TableCell className="text-center">
                      <Button
                        variant="secondary"
                        size="sm"
                        className="h-8 px-3 text-xs w-full justify-between"
                        onClick={() => router.push(`/petty-cash/${pc.id}`)}
                      >
                        Proses <ArrowRight className="h-3 w-3 shrink-0" />
                      </Button>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </div>
      </div>
    </Content>
  );
}
