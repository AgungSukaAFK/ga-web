// src/app/(With Sidebar)/petty-cash/budgeting/PettyCashBudgetingClient.tsx
//
// "Budgeting" Petty Cash (GA/Admin only) - kelola pool budget PER
// DEPARTEMEN + SITE + PERUSAHAAN (GMI/GIS/LOURDES) yang AUTO-terisi ke
// Input Pengajuan baru (lihat komentar PettyCashBudget di type/index.ts -
// resolveAutoBudget cocokkan department & site & company SEKALIGUS).
// Pola & tampilannya SENGAJA dibuat identik dengan
// app/(With Sidebar)/cost-center-management/CostCenterClient.tsx (cost
// center milik MR/PO) supaya konsisten - search + pagination + filter
// "Perusahaan" khusus admin company LOURDES - bedanya di sini TIDAK ada
// kolom "Kode" seperti Cost Center, karena Budget Petty Cash tidak
// memakainya.

"use client";

import { useCallback, useEffect, useState, useTransition } from "react";
import { Content } from "@/components/content";
import { PaginationComponent } from "@/components/pagination-components";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Combobox } from "@/components/combobox";
import { CurrencyInput } from "@/components/ui/currency-input";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Select,
  SelectTrigger,
  SelectValue,
  SelectContent,
  SelectItem,
} from "@/components/ui/select";
import {
  SearchableSelect,
  SearchableSelectTrigger,
  SearchableSelectValue,
  SearchableSelectContent,
  SearchableSelectItem,
} from "@/components/ui/searchable-select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { createClient } from "@/lib/supabase/client";
import { ConfirmDialog } from "@/components/confirm-dialog";
import { isGADepartment } from "@/lib/constants/departments";
import { cn, formatCurrency, formatDateFriendly } from "@/lib/utils";
import { dataDepartment, dataLokasi } from "@/type/comboboxData";
import { toast } from "sonner";
import { PettyCashBudget, PettyCashBudgetHistory, Profile } from "@/type";
import {
  fetchBudgets,
  fetchBudgetHistory,
  createBudget,
  updateBudgetAmount,
  setBudgetActiveStatus,
} from "@/services/pettyCashBudgetService";
import {
  Loader2,
  Plus,
  Edit,
  History,
  Power,
  PowerOff,
  Search,
} from "lucide-react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { User } from "@supabase/supabase-js";
import { LIMIT_OPTIONS } from "@/type/enum";
import { useUrlSearchInput } from "@/hooks/use-url-search-input";
import { ActiveFilter, FilterPanel } from "@/components/filter-panel";

function BudgetDialog({
  open,
  onOpenChange,
  onSave,
  adminUser,
  budget,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSave: () => void;
  adminUser: User | null;
  budget: PettyCashBudget | null; // null = Create, not null = Edit/Top-up
}) {
  const isCreateMode = !budget;
  const [name, setName] = useState("");
  const [department, setDepartment] = useState("");
  const [site, setSite] = useState("");
  const [companyCode, setCompanyCode] = useState("");
  const [initialBudget, setInitialBudget] = useState(0);
  const [newBudget, setNewBudget] = useState(0);
  const [reason, setReason] = useState("");
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (budget) {
      setName(budget.name);
      setDepartment(budget.department);
      setSite(budget.site || "");
      setCompanyCode(budget.company_code || "");
      setInitialBudget(budget.initial_budget);
      setNewBudget(budget.current_budget);
    } else {
      setName("");
      setDepartment("");
      setSite("");
      setCompanyCode("");
      setInitialBudget(0);
      setNewBudget(0);
    }
    setReason("");
  }, [budget, open]);

  const handleSubmit = async () => {
    if (!adminUser) {
      toast.error("Sesi admin tidak ditemukan.");
      return;
    }
    setLoading(true);
    try {
      if (budget) {
        if (!reason.trim()) {
          toast.error("Alasan penyesuaian budget wajib diisi.");
          setLoading(false);
          return;
        }
        await updateBudgetAmount(
          budget.id,
          initialBudget,
          newBudget,
          adminUser.id,
          reason,
        );
        toast.success(`Budget "${budget.name}" berhasil diperbarui.`);
      } else {
        if (!name.trim() || !department || !site || !companyCode) {
          toast.error(
            "Nama, Departemen, Site/Lokasi, dan Perusahaan wajib diisi.",
          );
          setLoading(false);
          return;
        }
        await createBudget(
          {
            name: name.trim(),
            department,
            site,
            company_code: companyCode,
            initial_budget: initialBudget,
          },
          adminUser.id,
        );
        toast.success(`Budget "${name}" berhasil dibuat.`);
      }
      onSave();
      onOpenChange(false);
    } catch (err: any) {
      toast.error("Gagal menyimpan data", { description: err.message });
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-xl">
        <DialogHeader>
          <DialogTitle>
            {isCreateMode ? "Buat Budget Baru" : `Edit/Top-up: ${budget?.name}`}
          </DialogTitle>
        </DialogHeader>
        <div className="space-y-4 py-2">
          <div className="space-y-2">
            <Label htmlFor="name">Nama</Label>
            <Input
              id="name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              disabled={!isCreateMode}
              placeholder="Ex: Budget GA Bulanan"
            />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Departemen</Label>
              <Combobox
                data={dataDepartment}
                onChange={setDepartment}
                defaultValue={department}
                placeholder="Cari departemen..."
                disabled={!isCreateMode}
              />
            </div>
            <div className="space-y-2">
              <Label>Site/Lokasi</Label>
              <Combobox
                data={dataLokasi}
                onChange={setSite}
                defaultValue={site}
                placeholder="Cari site/lokasi..."
                disabled={!isCreateMode}
              />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Perusahaan</Label>
              <SearchableSelect
                onValueChange={setCompanyCode}
                value={companyCode}
                disabled={!isCreateMode}
              >
                <SearchableSelectTrigger className="w-full">
                  <SearchableSelectValue placeholder="Pilih Perusahaan..." />
                </SearchableSelectTrigger>
                <SearchableSelectContent>
                  <SearchableSelectItem value="GMI">GMI</SearchableSelectItem>
                  <SearchableSelectItem value="GIS">GIS</SearchableSelectItem>
                  <SearchableSelectItem value="LOURDES">LOURDES</SearchableSelectItem>
                </SearchableSelectContent>
              </SearchableSelect>
            </div>
            <div className="space-y-2">
              <Label htmlFor="budget">
                {isCreateMode ? "Initial Budget" : "Current Budget"}
              </Label>
              <CurrencyInput
                id="budget"
                value={isCreateMode ? initialBudget : newBudget}
                onValueChange={isCreateMode ? setInitialBudget : setNewBudget}
                placeholder="Rp 0"
              />
            </div>
          </div>
          {isCreateMode && (
            <p className="text-xs text-muted-foreground">
              Kombinasi Departemen + Site + Perusahaan ini akan otomatis
              dipasangkan ke Pengajuan dari requester yang sama.
            </p>
          )}
          {!isCreateMode && (
            <div className="space-y-2">
              <Label htmlFor="reason">Alasan Update</Label>
              <Textarea
                id="reason"
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                placeholder="Mis: Top-up budget Q4..."
              />
            </div>
          )}
        </div>
        <DialogFooter>
          <Button
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={loading}
          >
            Batal
          </Button>
          <Button onClick={handleSubmit} disabled={loading}>
            {loading ? (
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            ) : (
              "Simpan"
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function HistoryDialog({
  open,
  onOpenChange,
  budget,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  budget: PettyCashBudget | null;
}) {
  const [history, setHistory] = useState<PettyCashBudgetHistory[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (open && budget) {
      setLoading(true);
      fetchBudgetHistory(budget.id)
        .then(setHistory)
        .catch((err) =>
          toast.error("Gagal memuat riwayat", { description: err.message }),
        )
        .finally(() => setLoading(false));
    }
  }, [open, budget]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl lg:max-w-5xl xl:max-w-6xl">
        <DialogHeader>
          <DialogTitle>Riwayat Budget: {budget?.name}</DialogTitle>
        </DialogHeader>
        <div className="max-h-[60vh] overflow-y-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Tanggal</TableHead>
                <TableHead>Deskripsi</TableHead>
                <TableHead>Oleh</TableHead>
                <TableHead className="text-right">Perubahan</TableHead>
                <TableHead className="text-right">Sisa Budget</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {loading && (
                <TableRow>
                  <TableCell colSpan={5} className="text-center">
                    <Loader2 className="mx-auto h-6 w-6 animate-spin" />
                  </TableCell>
                </TableRow>
              )}
              {!loading && history.length === 0 && (
                <TableRow>
                  <TableCell colSpan={5} className="text-center h-24">
                    Tidak ada riwayat.
                  </TableCell>
                </TableRow>
              )}
              {!loading &&
                history.map((item) => (
                  <TableRow key={item.id}>
                    <TableCell>{formatDateFriendly(item.created_at)}</TableCell>
                    <TableCell>{item.description}</TableCell>
                    <TableCell>{item.profiles?.nama || "Sistem"}</TableCell>
                    <TableCell
                      className={cn(
                        "text-right font-medium",
                        item.change_amount < 0
                          ? "text-destructive"
                          : "text-green-600",
                      )}
                    >
                      {formatCurrency(item.change_amount)}
                    </TableCell>
                    <TableCell className="text-right font-bold">
                      {formatCurrency(item.new_budget)}
                    </TableCell>
                  </TableRow>
                ))}
            </TableBody>
          </Table>
        </div>
      </DialogContent>
    </Dialog>
  );
}

export function PettyCashBudgetingClientContent() {
  const s = createClient();
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const [data, setData] = useState<PettyCashBudget[]>([]);
  const [totalItems, setTotalItems] = useState(0);
  const [loading, setLoading] = useState(true);
  const [isPending, startTransition] = useTransition();
  const [adminProfile, setAdminProfile] = useState<Profile | null>(null);
  const [authUser, setAuthUser] = useState<User | null>(null);

  const currentPage = Number(searchParams.get("page") || "1");
  const limit = Number(searchParams.get("limit") || 25);
  const searchTerm = searchParams.get("search") || "";
  const companyFilter = searchParams.get("company") || "";

  // Push ke URL hanya dari ketikan user - lihat hooks/use-url-search-input.ts
  const [searchInput, setSearchInput, resetSearchInput] = useUrlSearchInput(
    searchTerm,
    (value) =>
      startTransition(() => {
        router.push(`${pathname}?${createQueryString({ search: value })}`);
      }),
  );

  const [isFormOpen, setIsFormOpen] = useState(false);
  const [isHistoryOpen, setIsHistoryOpen] = useState(false);
  const [selectedBudget, setSelectedBudget] = useState<PettyCashBudget | null>(
    null,
  );
  const [togglingId, setTogglingId] = useState<number | null>(null);

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
      if (Object.keys(paramsToUpdate).some((k) => k !== "page")) {
        params.set("page", "1");
      }
      return params.toString();
    },
    [searchParams],
  );

  const loadData = useCallback(() => {
    async function fetchData() {
      setLoading(true);
      const {
        data: { user },
      } = await s.auth.getUser();
      if (!user) {
        router.push("/auth/login");
        return;
      }
      setAuthUser(user);

      const { data: profileData } = await s
        .from("users_with_profiles")
        .select("*")
        .eq("id", user.id)
        .single();

      const isAllowed =
        profileData?.role === "admin" ||
        isGADepartment(profileData?.department) ||
        profileData?.department === "General Manager";
      if (!profileData || !isAllowed) {
        toast.error("Akses ditolak.");
        router.push("/dashboard");
        return;
      }
      setAdminProfile(profileData);

      try {
        const { data: budgetData, count } = await fetchBudgets(
          currentPage,
          limit,
          searchTerm,
          companyFilter,
          profileData,
        );
        setData(budgetData);
        setTotalItems(count);
      } catch (err: any) {
        toast.error("Gagal memuat budget", { description: err.message });
      } finally {
        setLoading(false);
      }
    }
    fetchData();
  }, [s, currentPage, limit, searchTerm, companyFilter, router]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const handleFilterChange = (
    updates: Record<string, string | number | undefined>,
  ) => {
    startTransition(() => {
      router.push(`${pathname}?${createQueryString(updates)}`);
    });
  };

  const handleOpenNew = () => {
    setSelectedBudget(null);
    setIsFormOpen(true);
  };

  const handleOpenEdit = (b: PettyCashBudget) => {
    setSelectedBudget(b);
    setIsFormOpen(true);
  };

  const handleOpenHistory = (b: PettyCashBudget) => {
    setSelectedBudget(b);
    setIsHistoryOpen(true);
  };

  const handleToggleActive = async (b: PettyCashBudget) => {
    if (!authUser) {
      toast.error("Sesi admin tidak ditemukan.");
      return;
    }
    const willDeactivate = b.is_active !== false;

    setTogglingId(b.id);
    try {
      await setBudgetActiveStatus(b.id, !willDeactivate, authUser.id);
      toast.success(
        willDeactivate
          ? `Budget "${b.name}" dinonaktifkan.`
          : `Budget "${b.name}" diaktifkan.`,
      );
      loadData();
    } catch (err: any) {
      toast.error("Gagal mengubah status budget", {
        description: err.message,
      });
    } finally {
      setTogglingId(null);
    }
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
  if (companyFilter && companyFilter !== "all")
    activeFilters.push({
      key: "company",
      label: "Perusahaan",
      value: companyFilter,
      onRemove: () => handleFilterChange({ company: undefined }),
    });

  const clearFilters = () => {
    resetSearchInput();
    handleFilterChange({ search: undefined, company: undefined });
  };

  return (
    <>
      <Content
        title="Budgeting Petty Cash"
        description="Kelola budget per departemen, site, dan perusahaan - otomatis diterapkan ke Input Pengajuan baru sesuai requester."
        cardAction={
          <Button onClick={handleOpenNew}>
            <Plus className="mr-2 h-4 w-4" /> Tambah Budget
          </Button>
        }
        className="col-span-12"
      >
        <div className="flex flex-col gap-4 mb-6">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-muted-foreground" />
            <Input
              placeholder="Cari berdasarkan Nama, Departemen, atau Site..."
              className="pl-10"
              value={searchInput}
              onChange={(e) => setSearchInput(e.target.value)}
            />
          </div>
          {adminProfile?.company === "LOURDES" && (
            <FilterPanel activeFilters={activeFilters} onReset={clearFilters}>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="flex flex-col gap-2">
                  <label className="text-sm font-medium">Perusahaan</label>
                  <SearchableSelect
                    onValueChange={(value) =>
                      handleFilterChange({
                        company: value === "all" ? undefined : value,
                      })
                    }
                    value={companyFilter || "all"}
                  >
                    <SearchableSelectTrigger>
                      <SearchableSelectValue placeholder="Filter perusahaan" />
                    </SearchableSelectTrigger>
                    <SearchableSelectContent>
                      <SearchableSelectItem value="all">Semua Perusahaan</SearchableSelectItem>
                      <SearchableSelectItem value="GMI">GMI</SearchableSelectItem>
                      <SearchableSelectItem value="GIS">GIS</SearchableSelectItem>
                      <SearchableSelectItem value="LOURDES">LOURDES</SearchableSelectItem>
                    </SearchableSelectContent>
                  </SearchableSelect>
                </div>
              </div>
            </FilterPanel>
          )}
        </div>

        <div className="border rounded-md overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Nama</TableHead>
                <TableHead>Departemen</TableHead>
                <TableHead>Site/Lokasi</TableHead>
                <TableHead>Perusahaan</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="text-right">Initial Budget</TableHead>
                <TableHead className="text-right">Sisa Budget</TableHead>
                <TableHead className="text-right">Aksi</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {loading || isPending ? (
                <TableRow>
                  <TableCell colSpan={8} className="text-center h-24">
                    <Loader2 className="mx-auto h-6 w-6 animate-spin" />
                  </TableCell>
                </TableRow>
              ) : data.length > 0 ? (
                data.map((item) => {
                  const isInactive = item.is_active === false;
                  const dimClass = isInactive ? "opacity-50" : "";
                  return (
                    <TableRow key={item.id}>
                      <TableCell className={cn("font-medium", dimClass)}>
                        {item.name}
                      </TableCell>
                      <TableCell className={dimClass}>
                        {item.department}
                      </TableCell>
                      <TableCell className={cn("text-sm", dimClass)}>
                        {item.site || "-"}
                      </TableCell>
                      <TableCell className={dimClass}>
                        <Badge variant="outline">
                          {item.company_code || "-"}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        {isInactive ? (
                          <Badge variant="secondary">Nonaktif</Badge>
                        ) : (
                          <Badge className="bg-green-500 text-white">
                            Aktif
                          </Badge>
                        )}
                      </TableCell>
                      <TableCell className={cn("text-right", dimClass)}>
                        {formatCurrency(item.initial_budget)}
                      </TableCell>
                      <TableCell
                        className={cn("text-right font-bold", dimClass)}
                      >
                        {formatCurrency(item.current_budget)}
                      </TableCell>
                      <TableCell className="text-right space-x-2">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => handleOpenHistory(item)}
                        >
                          <History className="mr-2 h-3 w-3" /> Riwayat
                        </Button>
                        <Button
                          variant="default"
                          size="sm"
                          onClick={() => handleOpenEdit(item)}
                        >
                          <Edit className="mr-2 h-3 w-3" /> Edit/Top-up
                        </Button>
                        <ConfirmDialog
                          title={
                            isInactive
                              ? `Aktifkan Budget: ${item.name}`
                              : `Nonaktifkan Budget: ${item.name}`
                          }
                          description={
                            isInactive
                              ? `Aktifkan kembali Budget "${item.name}"?`
                              : `Nonaktifkan Budget "${item.name}"? Kombinasi departemen+site+perusahaan ini tidak akan otomatis ke-assign budget ini lagi ke Pengajuan baru.`
                          }
                          confirmText={isInactive ? "Aktifkan" : "Nonaktifkan"}
                          cancelText="Batal"
                          onConfirm={() => handleToggleActive(item)}
                        >
                          <Button
                            variant={isInactive ? "outline" : "destructive"}
                            size="sm"
                            disabled={togglingId === item.id}
                          >
                            {togglingId === item.id ? (
                              <Loader2 className="h-3 w-3 animate-spin" />
                            ) : isInactive ? (
                              <>
                                <Power className="mr-2 h-3 w-3" /> Aktifkan
                              </>
                            ) : (
                              <>
                                <PowerOff className="mr-2 h-3 w-3" /> Nonaktifkan
                              </>
                            )}
                          </Button>
                        </ConfirmDialog>
                      </TableCell>
                    </TableRow>
                  );
                })
              ) : (
                <TableRow>
                  <TableCell colSpan={8} className="text-center h-24">
                    Belum ada budget - tambah budget pertama utk sebuah
                    departemen.
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </div>

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
            <span>dari {totalItems} budget.</span>
          </div>
          <PaginationComponent
            currentPage={currentPage}
            totalPages={Math.ceil(totalItems / limit)}
            limit={limit}
            basePath={pathname}
          />
        </div>
      </Content>

      <BudgetDialog
        open={isFormOpen}
        onOpenChange={setIsFormOpen}
        onSave={() => loadData()}
        adminUser={authUser}
        budget={selectedBudget}
      />

      <HistoryDialog
        open={isHistoryOpen}
        onOpenChange={setIsHistoryOpen}
        budget={selectedBudget}
      />
    </>
  );
}

export const PettyCashBudgetingSkeleton = () => (
  <Content title="Budgeting Petty Cash" size="lg" className="col-span-12">
    <div className="flex flex-col gap-4 mb-6">
      <div className="flex flex-col md:flex-row gap-4">
        <Skeleton className="h-10 w-full md:w-1/2" />
        <Skeleton className="h-10 w-full md:w-auto px-6" />
      </div>
    </div>
    <Skeleton className="h-96 w-full rounded-lg" />
    <div className="mt-6 flex justify-between items-center">
      <Skeleton className="h-8 w-32" />
      <Skeleton className="h-9 w-64" />
    </div>
  </Content>
);
