// src/app/(With Sidebar)/user-management/UserManagementClient.tsx

"use client";

import { Content } from "@/components/content";
import {
  ExcelDownloadMenu,
  type ExcelDownloadMode,
} from "@/components/excel-download-menu";
import { ListSearchInput } from "@/components/list-search-input";
import { RowActionsMenu } from "@/components/row-actions-menu";
import {
  SortableTableHead,
  resolveSort,
  type SortColumnConfig,
} from "@/components/sortable-table-head";
import { StickyHeaderTable } from "@/components/sticky-header-table";
import { TablePaginationFooter } from "@/components/table-pagination-footer";
import { DropdownMenuItem } from "@/components/ui/dropdown-menu";
import { orIlikePattern } from "@/lib/supabase/search-filter";
import {
  SearchableSelect,
  SearchableSelectTrigger,
  SearchableSelectValue,
  SearchableSelectContent,
  SearchableSelectItem,
} from "@/components/ui/searchable-select";
import {
  TableBody,
  TableCell,
  TableHead,
  TableRow,
} from "@/components/ui/table";
import { createClient } from "@/lib/supabase/client";
import { Badge } from "@/components/ui/badge";
import { Loader2, Edit } from "lucide-react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useEffect, useState, useCallback, useTransition } from "react";
import { toast } from "@/lib/toast";
import Link from "next/link";
import { exportStyledExcel, fetchAllRows } from "@/lib/excel-export";
import { User as Profile } from "@/type"; // Menggunakan tipe User dari @/type
import { formatDateFriendly } from "@/lib/utils";
import { UserAvatar } from "@/components/user-avatar";
import { LIMIT_OPTIONS } from "@/type/enum";
import { dataDepartment as sharedDepartmentData } from "@/type/comboboxData";
import { useUrlSearchInput } from "@/hooks/use-url-search-input";
import {
  ActiveFilter,
  FilterPanel,
} from "@/components/filter-panel";
import { CreateUserDialog } from "./CreateUserDialog";

// Tipe data spesifik untuk tabel ini
interface UserForTable extends Profile {
  email: string; // Pastikan email ada
}

const dataRole: string[] = [
  "admin",
  "approver",
  "requester",
  "user",
  "announcer",
];
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
  "GIS BPN",
  "Site Manado",
  "Site DIZA",
  "Site PIK",
  "Site BGE",
];
const dataDepartment: string[] = Array.from(
  new Set([
    ...sharedDepartmentData.map((item) => item.value),
    // Backward compatibility for legacy value stored in older profiles.
    "Human Resource",
  ]),
);

// Kolom yang bisa di-sort lewat klik header tabel (key = nilai di URL).
const DEFAULT_SORT = "nama.asc";
const SORTABLE_COLUMNS: Record<string, SortColumnConfig> = {
  nama: { column: "nama" },
  email: { column: "email" },
  nrp: { column: "nrp" },
  company: { column: "company" },
  role: { column: "role" },
  lokasi: { column: "lokasi" },
  department: { column: "department" },
};

const SEARCH_FIELDS = ["Nama", "Email", "NRP"];

const userSearchFilter = (term: string) => {
  const pattern = orIlikePattern(term);
  return `nama.ilike.${pattern},email.ilike.${pattern},nrp.ilike.${pattern}`;
};

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
  const [reloadKey, setReloadKey] = useState(0); // Dinaikkan untuk refetch setelah tambah user

  // State dari URL
  const currentPage = Number(searchParams.get("page") || "1");
  const searchTerm = searchParams.get("search") || "";
  const sortFilter = searchParams.get("sort") || DEFAULT_SORT;
  const roleFilter = searchParams.get("role") || "";
  const lokasiFilter = searchParams.get("lokasi") || "";
  const departmentFilter = searchParams.get("department") || "";
  const statusFilter = searchParams.get("status") || ""; // "active" | "inactive"
  const limit = Number(searchParams.get("limit") || 25);

  // State untuk input form
  // Push ke URL hanya dari ketikan user - lihat hooks/use-url-search-input.ts
  const [searchInput, setSearchInput, resetSearchInput] = useUrlSearchInput(
    searchTerm,
    (value) =>
      startTransition(() => {
        router.push(`${pathname}?${createQueryString({ search: value })}`);
      }),
  );

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
    [searchParams],
  );

  // Ambil daftar id user yang cocok dengan filter status dari tabel profiles
  // (sumber kebenaran is_active). Mengembalikan null jika filter status tidak aktif.
  const fetchIdsByStatus = useCallback(
    async (company: string | null | undefined): Promise<string[] | null> => {
      if (!statusFilter) return null;
      let q = s
        .from("profiles")
        .select("id")
        .eq("is_active", statusFilter === "active");
      if (company && company !== "LOURDES") q = q.eq("company", company);
      const { data } = await q;
      return (data || []).map((r: { id: string }) => r.id);
    },
    [s, statusFilter],
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
      if (searchTerm) query = query.or(userSearchFilter(searchTerm));
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

      // Filter Status (Aktif/Nonaktif) berbasis is_active di tabel profiles
      const statusIds = await fetchIdsByStatus(currentAdminProfile?.company);
      if (statusIds !== null) query = query.in("id", statusIds);

      const sort = resolveSort(sortFilter, SORTABLE_COLUMNS, DEFAULT_SORT);
      query = query
        .order(sort.column, { ascending: sort.ascending, nullsFirst: false })
        .order("id", { ascending: true }) // urutan stabil antar halaman
        .range(from, to);

      const { data, error, count } = await query;

      if (error) {
        toast.error("Gagal mengambil data user: " + error.message);
        setUserList([]);
      } else {
        // Gabungkan status aktif (sumber kebenaran di tabel profiles).
        const rows = (data as UserForTable[]) || [];
        const ids = rows.map((u) => u.id);
        const activeMap = new Map<string, boolean>();
        if (ids.length > 0) {
          const { data: statusRows } = await s
            .from("profiles")
            .select("id, is_active")
            .in("id", ids);
          (statusRows || []).forEach((row: any) =>
            activeMap.set(row.id, row.is_active),
          );
        }
        setUserList(
          rows.map((u) => ({
            ...u,
            // default aktif bila kolom belum diisi (kompatibilitas)
            is_active: activeMap.get(u.id) ?? true,
          })),
        );
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
    statusFilter,
    fetchIdsByStatus,
    limit,
    sortFilter,
    reloadKey,
  ]); // Tambahkan adminProfile sebagai dependency jika perlu


  // Handler untuk filter
  const handleFilterChange = (
    updates: Record<string, string | number | undefined>,
  ) => {
    startTransition(() => {
      router.push(`${pathname}?${createQueryString(updates)}`);
    });
  };

  const fetchAllUserCount = async () => {
    let query = s
      .from("users_with_profiles")
      .select("id", { count: "exact", head: true });
    if (adminProfile?.company && adminProfile.company !== "LOURDES") {
      query = query.eq("company", adminProfile.company);
    }
    const { count, error } = await query;
    if (error) throw error;
    return count ?? 0;
  };

  // mode "all"      : semua user yang boleh dilihat admin (batas company tetap berlaku)
  // mode "filtered" : sesuai filter, pencarian & urutan yang sedang diterapkan di tabel
  const handleDownloadExcel = async (mode: ExcelDownloadMode) => {
    const useFilters = mode === "filtered";
    setIsExporting(true);
    const toastId = toast.loading(
      useFilters
        ? "Menyiapkan data user sesuai filter..."
        : "Menyiapkan semua data user...",
    );
    const exportSort = useFilters
      ? resolveSort(sortFilter, SORTABLE_COLUMNS, DEFAULT_SORT)
      : { column: "nama", ascending: true };

    try {
      const statusIds = useFilters
        ? await fetchIdsByStatus(adminProfile?.company)
        : null;

      const buildQuery = () => {
        let query = s
          .from("users_with_profiles")
          .select(
            `id, nama, email, role, lokasi, department, nrp, company, profile_created_at`,
          );

        if (useFilters) {
          if (searchTerm) query = query.or(userSearchFilter(searchTerm));
          if (roleFilter) query = query.eq("role", roleFilter);
          if (lokasiFilter) query = query.eq("lokasi", lokasiFilter);
          if (departmentFilter) {
            query = query.eq("department", departmentFilter);
          }
          if (statusIds !== null) query = query.in("id", statusIds);
        }

        // REVISI: Terapkan filter company admin
        if (adminProfile?.company && adminProfile.company !== "LOURDES") {
          query = query.eq("company", adminProfile.company);
        }

        return query
          .order(exportSort.column, {
            ascending: exportSort.ascending,
            nullsFirst: false,
          })
          .order("id", { ascending: true }); // urutan stabil antar halaman
      };

      const data = await fetchAllRows(buildQuery);

      if (data.length === 0) {
        toast.warning(
          useFilters
            ? "Tidak ada data user untuk diekspor sesuai filter."
            : "Tidak ada data user untuk diekspor.",
          { id: toastId },
        );
        return;
      }

      // Ambil status aktif (sumber kebenaran di tabel profiles) untuk kolom Status.
      const exportIds = data.map((u: any) => u.id);
      const exportActiveMap = new Map<string, boolean>();
      if (exportIds.length > 0) {
        const { data: statusRows } = await s
          .from("profiles")
          .select("id, is_active")
          .in("id", exportIds);
        (statusRows || []).forEach((row: any) =>
          exportActiveMap.set(row.id, row.is_active),
        );
      }

      const formattedData = data.map((user: any) => ({
        Nama: user.nama,
        Email: user.email,
        Role: user.role,
        Lokasi: user.lokasi,
        Departemen: user.department,
        NRP: user.nrp,
        Perusahaan: user.company,
        Status:
          (exportActiveMap.get(user.id) ?? true) ? "Aktif" : "Nonaktif",
        "Tanggal Dibuat": formatDateFriendly(user.profile_created_at),
      }));

      await exportStyledExcel(
        formattedData,
        `Daftar_User_${useFilters ? "Filter" : "Semua"}_${new Date().toISOString().split("T")[0]}.xlsx`,
        "Daftar User",
      );

      toast.success("Data user berhasil diunduh!", { id: toastId });
    } catch (error: any) {
      toast.error("Gagal mengunduh data", {
        id: toastId,
        description: error.message,
      });
    } finally {
      setIsExporting(false);
    }
  };

  const clearFilters = () => {
    resetSearchInput();
    startTransition(() => {
      router.push(pathname);
    });
  };

  // --- Chip filter aktif ---
  const activeFilters: ActiveFilter[] = [];
  if (searchTerm)
    activeFilters.push({
      key: "search",
      label: "Cari",
      value: searchTerm,
      onRemove: () => {
        resetSearchInput();
        handleFilterChange({ search: undefined });
      },
    });
  if (roleFilter && roleFilter !== "all")
    activeFilters.push({
      key: "role",
      label: "Role",
      value: roleFilter,
      onRemove: () => handleFilterChange({ role: undefined }),
    });
  if (lokasiFilter && lokasiFilter !== "all")
    activeFilters.push({
      key: "lokasi",
      label: "Lokasi",
      value: lokasiFilter,
      onRemove: () => handleFilterChange({ lokasi: undefined }),
    });
  if (departmentFilter && departmentFilter !== "all")
    activeFilters.push({
      key: "department",
      label: "Departemen",
      value: departmentFilter,
      onRemove: () => handleFilterChange({ department: undefined }),
    });
  if (statusFilter && statusFilter !== "all")
    activeFilters.push({
      key: "status",
      label: "Status",
      value:
        statusFilter === "active"
          ? "Aktif"
          : statusFilter === "inactive"
            ? "Nonaktif"
            : statusFilter,
      onRemove: () => handleFilterChange({ status: undefined }),
    });

  return (
    <Content title="Manajemen User" size="lg" className="col-span-12">
      {/* --- Filter Section --- */}
      <div className="flex flex-col gap-4 mb-6">
        <div className="flex flex-col md:flex-row gap-4">
          <ListSearchInput
            placeholder="Cari nama, email, atau NRP..."
            value={searchInput}
            onChange={setSearchInput}
            searchableFields={SEARCH_FIELDS}
          />
          <CreateUserDialog
            roles={dataRole}
            lokasiOptions={dataLokasi}
            departmentOptions={dataDepartment}
            adminCompany={adminProfile?.company}
            onCreated={() => setReloadKey((k) => k + 1)}
          />
          <ExcelDownloadMenu
            itemLabel="user"
            filteredCount={totalItems}
            fetchAllCount={fetchAllUserCount}
            onDownload={handleDownloadExcel}
            isExporting={isExporting}
          />
        </div>

        <FilterPanel activeFilters={activeFilters} onReset={clearFilters}>
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
            <div className="flex flex-col gap-2">
              <label className="text-sm font-medium">Role</label>
              <SearchableSelect
                onValueChange={(value) =>
                  handleFilterChange({
                    role: value === "all" ? undefined : value,
                  })
                }
                value={roleFilter || "all"}
              >
                <SearchableSelectTrigger>
                  <SearchableSelectValue placeholder="Filter role" />
                </SearchableSelectTrigger>
                <SearchableSelectContent>
                  <SearchableSelectItem value="all">Semua Role</SearchableSelectItem>
                  {dataRole.map((role) => (
                    <SearchableSelectItem key={role} value={role}>
                      {role}
                    </SearchableSelectItem>
                  ))}
                </SearchableSelectContent>
              </SearchableSelect>
            </div>
            <div className="flex flex-col gap-2">
              <label className="text-sm font-medium">Lokasi</label>
              <SearchableSelect
                onValueChange={(value) =>
                  handleFilterChange({
                    lokasi: value === "all" ? undefined : value,
                  })
                }
                value={lokasiFilter || "all"}
              >
                <SearchableSelectTrigger>
                  <SearchableSelectValue placeholder="Filter lokasi" />
                </SearchableSelectTrigger>
                <SearchableSelectContent>
                  <SearchableSelectItem value="all">Semua Lokasi</SearchableSelectItem>
                  {dataLokasi.map((lok) => (
                    <SearchableSelectItem key={lok} value={lok}>
                      {lok}
                    </SearchableSelectItem>
                  ))}
                </SearchableSelectContent>
              </SearchableSelect>
            </div>
            <div className="flex flex-col gap-2">
              <label className="text-sm font-medium">Departemen</label>
              <SearchableSelect
                onValueChange={(value) =>
                  handleFilterChange({
                    department: value === "all" ? undefined : value,
                  })
                }
                value={departmentFilter || "all"}
              >
                <SearchableSelectTrigger>
                  <SearchableSelectValue placeholder="Filter departemen" />
                </SearchableSelectTrigger>
                <SearchableSelectContent>
                  <SearchableSelectItem value="all">Semua Departemen</SearchableSelectItem>
                  {dataDepartment.map((dept) => (
                    <SearchableSelectItem key={dept} value={dept}>
                      {dept}
                    </SearchableSelectItem>
                  ))}
                </SearchableSelectContent>
              </SearchableSelect>
            </div>
            <div className="flex flex-col gap-2">
              <label className="text-sm font-medium">Status</label>
              <SearchableSelect
                onValueChange={(value) =>
                  handleFilterChange({
                    status: value === "all" ? undefined : value,
                  })
                }
                value={statusFilter || "all"}
              >
                <SearchableSelectTrigger>
                  <SearchableSelectValue placeholder="Filter status" />
                </SearchableSelectTrigger>
                <SearchableSelectContent>
                  <SearchableSelectItem value="all">Semua Status</SearchableSelectItem>
                  <SearchableSelectItem value="active">Aktif</SearchableSelectItem>
                  <SearchableSelectItem value="inactive">Nonaktif</SearchableSelectItem>
                </SearchableSelectContent>
              </SearchableSelect>
            </div>
          </div>
        </FilterPanel>
      </div>

      {/* --- Table Section --- */}
      <StickyHeaderTable
        className="min-w-[1000px]"
        containerClassName="border rounded-md overflow-x-auto"
        header={
            <TableRow>
              <TableHead className="w-[50px]">No</TableHead>
              <SortableTableHead
                sortKey="nama"
                currentSort={sortFilter}
                onSortChange={(sort) => handleFilterChange({ sort })}
              >
                Nama
              </SortableTableHead>
              <SortableTableHead
                sortKey="email"
                currentSort={sortFilter}
                onSortChange={(sort) => handleFilterChange({ sort })}
              >
                Email
              </SortableTableHead>
              <SortableTableHead
                sortKey="nrp"
                currentSort={sortFilter}
                onSortChange={(sort) => handleFilterChange({ sort })}
              >
                NRP
              </SortableTableHead>
              <SortableTableHead
                sortKey="company"
                currentSort={sortFilter}
                onSortChange={(sort) => handleFilterChange({ sort })}
              >
                Perusahaan
              </SortableTableHead>
              <SortableTableHead
                sortKey="role"
                currentSort={sortFilter}
                onSortChange={(sort) => handleFilterChange({ sort })}
              >
                Role
              </SortableTableHead>
              <SortableTableHead
                sortKey="lokasi"
                currentSort={sortFilter}
                onSortChange={(sort) => handleFilterChange({ sort })}
              >
                Lokasi
              </SortableTableHead>
              <SortableTableHead
                sortKey="department"
                currentSort={sortFilter}
                onSortChange={(sort) => handleFilterChange({ sort })}
              >
                Departemen
              </SortableTableHead>
              <TableHead>Status</TableHead>
              <TableHead className="text-right">Aksi</TableHead>
            </TableRow>
        }
      >
        <TableBody>
          {loading || isPending ? (
            <TableRow>
              <TableCell colSpan={10} className="text-center h-24">
                <div className="flex justify-center items-center gap-2">
                  <Loader2 className="h-5 w-5 animate-spin" />
                  Memuat data...
                </div>
              </TableCell>
            </TableRow>
          ) : userList.length > 0 ? (
            userList.map((user, index) => (
              <TableRow
                key={user.id}
                onClick={() => router.push(`/user-management/${user.id}`)}
                className="cursor-pointer"
              >
                <TableCell className="font-medium">
                  {(currentPage - 1) * limit + index + 1}
                </TableCell>
                <TableCell className="font-semibold">
                  <div className="flex items-center gap-2">
                    <UserAvatar
                      userId={user.id}
                      name={user.nama || user.email}
                      className="h-8 w-8"
                      fallbackClassName="text-xs"
                    />
                    <span>{user.nama || "-"}</span>
                  </div>
                </TableCell>
                <TableCell>{user.email}</TableCell>
                <TableCell>{user.nrp || "-"}</TableCell>
                <TableCell>{user.company || "-"}</TableCell>
                <TableCell>{user.role || "-"}</TableCell>
                <TableCell>{user.lokasi || "-"}</TableCell>
                <TableCell>{user.department || "-"}</TableCell>
                <TableCell>
                  {user.is_active === false ? (
                    <Badge variant="destructive">Nonaktif</Badge>
                  ) : (
                    <Badge className="bg-green-100 text-green-700 hover:bg-green-100 dark:bg-green-900/40 dark:text-green-300 dark:hover:bg-green-900/40">
                      Aktif
                    </Badge>
                  )}
                </TableCell>
                <TableCell
                  className="text-right"
                  onClick={(e) => e.stopPropagation()}
                >
                  <RowActionsMenu>
                    <DropdownMenuItem asChild>
                      <Link
                        href={`/user-management/${user.id}`}
                        className="cursor-pointer"
                      >
                        <Edit className="mr-2 h-4 w-4" /> Edit
                      </Link>
                    </DropdownMenuItem>
                  </RowActionsMenu>
                </TableCell>
              </TableRow>
            ))
          ) : (
            <TableRow>
              <TableCell colSpan={10} className="text-center h-24">
                Tidak ada user yang ditemukan.
              </TableCell>
            </TableRow>
          )}
        </TableBody>
      </StickyHeaderTable>

      {/* --- Pagination & Limit Section --- */}
      <TablePaginationFooter
        currentPage={currentPage}
        totalItems={totalItems}
        limit={limit}
        limitOptions={LIMIT_OPTIONS}
        itemLabel="user"
        onPageChange={(page) => handleFilterChange({ page })}
        onLimitChange={(value) => handleFilterChange({ limit: value })}
        className="mt-6"
      />
    </Content>
  );
}
