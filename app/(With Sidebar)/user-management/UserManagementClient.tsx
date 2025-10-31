// src/app/(With Sidebar)/user-management/UserManagementClient.tsx

"use client";

import { Content } from "@/components/content";
import { PaginationComponent } from "@/components/pagination"; // Pastikan path ini benar
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
import { createClient } from "@/lib/supabase/client";
import { Loader2, Newspaper, Search, Edit } from "lucide-react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useEffect, useState, useCallback, useTransition } from "react";
import { toast } from "sonner";
import Link from "next/link";
import * as XLSX from "xlsx";
import { User as Profile } from "@/type"; // Menggunakan tipe User dari @/type
import { formatDateFriendly } from "@/lib/utils";
import { LIMIT_OPTIONS } from "@/type/enum";

// Tipe data spesifik untuk tabel ini
interface UserForTable extends Profile {
  email: string; // Pastikan email ada
}

const dataRole: string[] = ["admin", "approver", "requester", "user"];
const dataLokasi: string[] = [
  "Head Office",
  "Tanjung Enim",
  "Balikpapan",
  "Site BA",
  "Site TAL",
  "Site MIP",
  "Site MIFA",
  "Site BIB",
  "Site AMI",
  "Site Tabang",
];
const dataDepartment: string[] = [
  "General Affair",
  "Marketing",
  "Produksi",
  "K3",
  "Finance",
  "IT",
  "Logistik",
  "Purchasing",
  "Warehouse",
  "Service",
  "General Manager",
  "Executive Manager",
  "Boards of Director",
];

export function UserManagementClientContent() {
  const s = createClient();
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  // State
  const [userList, setUserList] = useState<UserForTable[]>([]);
  const [loading, setLoading] = useState(true);
  const [isExporting, setIsExporting] = useState(false);
  const [totalItems, setTotalItems] = useState<number>(0);
  const [isPending, startTransition] = useTransition();
  const [adminProfile, setAdminProfile] = useState<Profile | null>(null); // State untuk profil admin

  // State dari URL
  const currentPage = Number(searchParams.get("page") || "1");
  const searchTerm = searchParams.get("search") || "";
  const roleFilter = searchParams.get("role") || "";
  const lokasiFilter = searchParams.get("lokasi") || "";
  const departmentFilter = searchParams.get("department") || "";
  const limit = Number(searchParams.get("limit") || 25);

  // State untuk input form
  const [searchInput, setSearchInput] = useState(searchTerm);

  const createQueryString = useCallback(
    (paramsToUpdate: Record<string, string | number | undefined>) => {
      const params = new URLSearchParams(searchParams.toString());
      Object.entries(paramsToUpdate).forEach(([name, value]) => {
        if (
          value !== undefined &&
          value !== null &&
          String(value).trim() !== ""
        ) {
          params.set(name, String(value));
        } else {
          params.delete(name);
        }
      });
      // Reset ke halaman 1 jika filter atau limit berubah
      if (Object.keys(paramsToUpdate).some((k) => k !== "page")) {
        params.set("page", "1");
      }
      return params.toString();
    },
    [searchParams]
  );

  // Efek untuk fetch data user dan profil admin
  useEffect(() => {
    async function fetchUsersAndAdminProfile() {
      setLoading(true);

      // Ambil profil admin yang sedang login
      const {
        data: { user },
      } = await s.auth.getUser();
      let currentAdminProfile: Profile | null = null;
      if (user) {
        const { data: profileData } = await s
          .from("profiles")
          .select("*")
          .eq("id", user.id)
          .single();
        currentAdminProfile = profileData;
        setAdminProfile(profileData); // Simpan profil admin
      } else {
        // Handle jika user tidak login (seharusnya sudah ditangani middleware)
        setLoading(false);
        return;
      }

      // Fetch data user berdasarkan filter dan profil admin
      const from = (currentPage - 1) * limit;
      const to = from + limit - 1;

      let query = s.from("users_with_profiles").select(`*`, { count: "exact" });

      // Filter Pencarian
      if (searchTerm)
        query = query.or(
          `nama.ilike.%${searchTerm}%,email.ilike.%${searchTerm}%,nrp.ilike.%${searchTerm}%`
        );
      if (roleFilter) query = query.eq("role", roleFilter);
      if (lokasiFilter) query = query.eq("lokasi", lokasiFilter);
      if (departmentFilter) query = query.eq("department", departmentFilter);

      // REVISI: Filter berdasarkan company admin
      if (
        currentAdminProfile?.company &&
        currentAdminProfile.company !== "LOURDES"
      ) {
        query = query.eq("company", currentAdminProfile.company);
      }
      // Jika LOURDES, tidak perlu filter company

      query = query.range(from, to).order("nama", { ascending: true });

      const { data, error, count } = await query;

      if (error) {
        toast.error("Gagal mengambil data user: " + error.message);
        setUserList([]);
      } else {
        setUserList((data as UserForTable[]) || []);
        setTotalItems(count || 0);
      }
      setLoading(false);
    }
    fetchUsersAndAdminProfile();
  }, [
    s,
    currentPage,
    searchTerm,
    roleFilter,
    lokasiFilter,
    departmentFilter,
    limit,
  ]); // Tambahkan adminProfile sebagai dependency jika perlu

  // Efek untuk debounce pencarian judul
  useEffect(() => {
    const handler = setTimeout(() => {
      if (searchInput !== searchTerm) {
        startTransition(() => {
          router.push(
            `${pathname}?${createQueryString({ search: searchInput })}`
          );
        });
      }
    }, 500);
    return () => clearTimeout(handler);
  }, [searchInput, searchTerm, pathname, router, createQueryString]);

  // Handler untuk filter
  const handleFilterChange = (
    updates: Record<string, string | number | undefined>
  ) => {
    startTransition(() => {
      router.push(`${pathname}?${createQueryString(updates)}`);
    });
  };

  const handleDownloadExcel = async () => {
    setIsExporting(true);
    toast.info("Mempersiapkan data lengkap untuk diunduh...");

    try {
      let query = s
        .from("users_with_profiles")
        .select(
          `nama, email, role, lokasi, department, nrp, company, profile_created_at`
        );

      // Terapkan semua filter aktif
      if (searchTerm)
        query = query.or(
          `nama.ilike.%${searchTerm}%,email.ilike.%${searchTerm}%,nrp.ilike.%${searchTerm}%`
        );
      if (roleFilter) query = query.eq("role", roleFilter);
      if (lokasiFilter) query = query.eq("lokasi", lokasiFilter);
      if (departmentFilter) query = query.eq("department", departmentFilter);

      // REVISI: Terapkan filter company admin
      if (adminProfile?.company && adminProfile.company !== "LOURDES") {
        query = query.eq("company", adminProfile.company);
      }

      const { data, error } = await query.order("nama", { ascending: true });

      if (error) throw error;
      if (!data || data.length === 0) {
        toast.warning("Tidak ada data user untuk diekspor sesuai filter.");
        return;
      }

      const formattedData = data.map((user) => ({
        Nama: user.nama,
        Email: user.email,
        Role: user.role,
        Lokasi: user.lokasi,
        Departemen: user.department,
        NRP: user.nrp,
        Perusahaan: user.company,
        "Tanggal Dibuat": formatDateFriendly(user.profile_created_at),
      }));

      const worksheet = XLSX.utils.json_to_sheet(formattedData);
      const workbook = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(workbook, worksheet, "Daftar User");
      XLSX.writeFile(
        workbook,
        `Daftar_User_${new Date().toISOString().split("T")[0]}.xlsx`
      );

      toast.success("Data user berhasil diunduh!");
    } catch (error: any) {
      toast.error("Gagal mengunduh data", { description: error.message });
    } finally {
      setIsExporting(false);
    }
  };

  return (
    <Content title="Manajemen User" size="lg" className="col-span-12">
      {/* --- Filter Section --- */}
      <div className="flex flex-col gap-4 mb-6">
        <div className="flex flex-col md:flex-row gap-4">
          <div className="relative flex-grow">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-muted-foreground" />
            <Input
              placeholder="Cari nama, email, atau NRP..."
              className="pl-10"
              value={searchInput}
              onChange={(e) => setSearchInput(e.target.value)}
            />
          </div>
          <Button
            onClick={handleDownloadExcel}
            disabled={isExporting}
            className="w-full md:w-auto"
          >
            {isExporting ? (
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            ) : (
              <Newspaper className="mr-2 h-4 w-4" />
            )}
            Download Excel
          </Button>
        </div>

        <div className="p-4 border rounded-lg bg-muted/50">
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
            <div className="flex flex-col gap-2">
              <label className="text-sm font-medium">Role</label>
              <Select
                onValueChange={(value) =>
                  handleFilterChange({
                    role: value === "all" ? undefined : value,
                  })
                }
                defaultValue={roleFilter || "all"}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Filter role" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Semua Role</SelectItem>
                  {dataRole.map((role) => (
                    <SelectItem key={role} value={role}>
                      {role}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="flex flex-col gap-2">
              <label className="text-sm font-medium">Lokasi</label>
              <Select
                onValueChange={(value) =>
                  handleFilterChange({
                    lokasi: value === "all" ? undefined : value,
                  })
                }
                defaultValue={lokasiFilter || "all"}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Filter lokasi" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Semua Lokasi</SelectItem>
                  {dataLokasi.map((lok) => (
                    <SelectItem key={lok} value={lok}>
                      {lok}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="flex flex-col gap-2">
              <label className="text-sm font-medium">Departemen</label>
              <Select
                onValueChange={(value) =>
                  handleFilterChange({
                    department: value === "all" ? undefined : value,
                  })
                }
                defaultValue={departmentFilter || "all"}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Filter departemen" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Semua Departemen</SelectItem>
                  {dataDepartment.map((dept) => (
                    <SelectItem key={dept} value={dept}>
                      {dept}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
        </div>
      </div>

      {/* --- Table Section --- */}
      <div className="border rounded-md overflow-x-auto">
        <Table className="min-w-[1000px]">
          <TableHeader>
            <TableRow>
              <TableHead className="w-[50px]">No</TableHead>
              <TableHead>Nama</TableHead>
              <TableHead>Email</TableHead>
              <TableHead>NRP</TableHead>
              <TableHead>Perusahaan</TableHead>
              <TableHead>Role</TableHead>
              <TableHead>Lokasi</TableHead>
              <TableHead>Departemen</TableHead>
              <TableHead className="text-right">Aksi</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {loading || isPending ? (
              <TableRow>
                <TableCell colSpan={9} className="text-center h-24">
                  <div className="flex justify-center items-center gap-2">
                    <Loader2 className="h-5 w-5 animate-spin" />
                    Memuat data...
                  </div>
                </TableCell>
              </TableRow>
            ) : userList.length > 0 ? (
              userList.map((user, index) => (
                <TableRow key={user.id}>
                  <TableCell className="font-medium">
                    {(currentPage - 1) * limit + index + 1}
                  </TableCell>
                  <TableCell className="font-semibold">
                    {user.nama || "-"}
                  </TableCell>
                  <TableCell>{user.email}</TableCell>
                  <TableCell>{user.nrp || "-"}</TableCell>
                  <TableCell>{user.company || "-"}</TableCell>
                  <TableCell>{user.role || "-"}</TableCell>
                  <TableCell>{user.lokasi || "-"}</TableCell>
                  <TableCell>{user.department || "-"}</TableCell>
                  <TableCell className="text-right">
                    <Button variant="outline" size="sm" asChild>
                      <Link href={`/user-management/${user.id}`}>
                        <Edit className="mr-2 h-3 w-3" />
                        Edit
                      </Link>
                    </Button>
                  </TableCell>
                </TableRow>
              ))
            ) : (
              <TableRow>
                <TableCell colSpan={9} className="text-center h-24">
                  Tidak ada user yang ditemukan.
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </div>

      {/* --- Pagination & Limit Section --- */}
      <div className="mt-6 flex flex-col md:flex-row justify-between items-center gap-4">
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <span>Tampilkan</span>
          <Select
            value={String(limit)}
            onValueChange={(value) => handleFilterChange({ limit: value })}
          >
            <SelectTrigger className="w-[70px]">
              <SelectValue placeholder={limit} />
            </SelectTrigger>
            <SelectContent>
              {LIMIT_OPTIONS.map((opt) => (
                <SelectItem key={opt} value={String(opt)}>
                  {opt}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <span>dari {totalItems} user.</span>
        </div>
        <PaginationComponent
          currentPage={currentPage}
          totalItems={totalItems}
          itemsPerPage={limit}
          basePath={pathname}
        />
      </div>
    </Content>
  );
}
