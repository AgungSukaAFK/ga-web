// src/app/(With Sidebar)/cost-center-management/CostCenterClient.tsx

"use client";

import { Content } from "@/components/content";
import { PaginationComponent } from "@/components/pagination-components";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
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
import { Skeleton } from "@/components/ui/skeleton";
import { createClient } from "@/lib/supabase/client";
import { isGADepartment } from "@/lib/constants/departments";
import {
  Loader2,
  Search,
  Edit,
  Plus,
  History,
  Eye,
  Power,
  PowerOff,
} from "lucide-react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useEffect, useState, useCallback, useTransition } from "react";
import { toast } from "sonner";
import { CostCenter, CostCenterHistory, Profile } from "@/type";
import { cn, formatCurrency, formatDateFriendly } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  createCostCenter,
  fetchCostCenterHistory,
  fetchCostCenters,
  updateCostCenterBudget,
  setCostCenterActiveStatus,
} from "@/services/costCenterService";
import { User } from "@supabase/supabase-js";
import { CurrencyInput } from "@/components/ui/currency-input"; // <-- IMPORT KOMPONEN BARU
import { LIMIT_OPTIONS } from "@/type/enum";
import { useUrlSearchInput } from "@/hooks/use-url-search-input";
import { ActiveFilter, FilterPanel } from "@/components/filter-panel";

// --- Komponen Dialog untuk Create/Edit ---
function CostCenterDialog({
  open,
  onOpenChange,
  onSave,
  adminUser,
  costCenter,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSave: () => void;
  adminUser: User | null;
  costCenter: CostCenter | null; // null = Mode Create, not null = Mode Edit
}) {
  const [formData, setFormData] = useState<Partial<CostCenter>>({});
  const [newBudget, setNewBudget] = useState<number>(0);
  const [reason, setReason] = useState("");
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (costCenter) {
      // Mode Edit
      setFormData(costCenter);
      setNewBudget(costCenter.current_budget);
      setReason("");
    } else {
      // Mode Create
      setFormData({
        name: "",
        code: "",
        company_code: "",
        initial_budget: 0,
      });
      setNewBudget(0); // Reset newBudget juga
      setReason("");
    }
  }, [costCenter, open]);

  const handleInputChange = (
    e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>
  ) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
  };

  // --- REVISI: Handler untuk CurrencyInput ---
  const handleBudgetChange = (value: number) => {
    if (!costCenter) {
      // Mode Create
      setFormData((prev) => ({ ...prev, initial_budget: value }));
    } else {
      // Mode Edit
      setNewBudget(value);
    }
  };

  const handleCompanyChange = (value: string) => {
    setFormData((prev) => ({ ...prev, company_code: value }));
  };

  const handleSubmit = async () => {
    if (!adminUser) {
      toast.error("Sesi admin tidak ditemukan.");
      return;
    }

    setLoading(true);
    try {
      if (costCenter) {
        // Mode Edit (Update Budget)
        if (!reason.trim()) {
          toast.error("Alasan penyesuaian budget wajib diisi.");
          setLoading(false);
          return;
        }
        await updateCostCenterBudget(
          costCenter.id,
          // Jika Anda ingin initial_budget juga bisa di-edit, tambahkan inputnya
          formData.initial_budget || costCenter.initial_budget,
          newBudget,
          adminUser.id,
          reason
        );
        toast.success(`Budget untuk ${costCenter.name} berhasil diperbarui.`);
      } else {
        // Mode Create
        if (!formData.name || !formData.company_code) {
          toast.error("Nama dan Perusahaan wajib diisi.");
          setLoading(false);
          return;
        }
        await createCostCenter(formData as any, adminUser.id);
        toast.success(`Cost Center ${formData.name} berhasil dibuat.`);
      }
      onSave();
      onOpenChange(false);
    } catch (err: any) {
      toast.error("Gagal menyimpan data", { description: err.message });
    } finally {
      setLoading(false);
    }
  };

  const isCreateMode = !costCenter;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>
            {isCreateMode
              ? "Buat Cost Center Baru"
              : `Edit Budget: ${costCenter.name}`}
          </DialogTitle>
        </DialogHeader>
        <div className="grid gap-4 py-4">
          <div className="grid grid-cols-4 items-center gap-4">
            <Label htmlFor="name" className="text-right">
              Nama
            </Label>
            <Input
              id="name"
              name="name"
              value={formData.name || ""}
              onChange={handleInputChange}
              className="col-span-3"
              disabled={!isCreateMode}
            />
          </div>
          <div className="grid grid-cols-4 items-center gap-4">
            <Label htmlFor="code" className="text-right">
              Kode
            </Label>
            <Input
              id="code"
              name="code"
              value={formData.code || ""}
              onChange={handleInputChange}
              className="col-span-3"
              disabled={!isCreateMode}
            />
          </div>
          <div className="grid grid-cols-4 items-center gap-4">
            <Label className="text-right">Perusahaan</Label>
            <SearchableSelect
              name="company_code"
              onValueChange={handleCompanyChange}
              value={formData.company_code}
              disabled={!isCreateMode}
            >
              <SearchableSelectTrigger className="col-span-3">
                <SearchableSelectValue placeholder="Pilih Perusahaan..." />
              </SearchableSelectTrigger>
              <SearchableSelectContent>
                <SearchableSelectItem value="GMI">GMI</SearchableSelectItem>
                <SearchableSelectItem value="GIS">GIS</SearchableSelectItem>
                <SearchableSelectItem value="LOURDES">LOURDES</SearchableSelectItem>
              </SearchableSelectContent>
            </SearchableSelect>
          </div>
          {/* --- REVISI: Ganti Input dengan CurrencyInput --- */}
          <div className="grid grid-cols-4 items-center gap-4">
            <Label htmlFor="budget" className="text-right">
              {isCreateMode ? "Initial Budget" : "Current Budget"}
            </Label>
            <CurrencyInput
              id="budget"
              name="budget"
              value={isCreateMode ? formData.initial_budget : newBudget}
              onValueChange={handleBudgetChange}
              className="col-span-3"
              placeholder="Rp 0"
            />
          </div>
          {!isCreateMode && (
            <div className="grid grid-cols-4 items-center gap-4">
              <Label htmlFor="reason" className="text-right">
                Alasan Update
              </Label>
              <Textarea
                id="reason"
                name="reason"
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                className="col-span-3"
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

// --- Komponen Dialog untuk History ---
function HistoryDialog({
  open,
  onOpenChange,
  costCenter,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  costCenter: CostCenter | null;
}) {
  const [history, setHistory] = useState<CostCenterHistory[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (open && costCenter) {
      setLoading(true);
      fetchCostCenterHistory(costCenter.id)
        .then(setHistory)
        .catch((err) =>
          toast.error("Gagal memuat riwayat", { description: err.message })
        )
        .finally(() => setLoading(false));
    }
  }, [open, costCenter]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl">
        <DialogHeader>
          <DialogTitle>Riwayat Budget: {costCenter?.name}</DialogTitle>
        </DialogHeader>
        <div className="max-h-[60vh] overflow-y-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Tanggal</TableHead>
                <TableHead>Deskripsi</TableHead>
                <TableHead>Oleh</TableHead>
                <TableHead>Ref. MR</TableHead>
                <TableHead className="text-right">Perubahan</TableHead>
                <TableHead className="text-right">Sisa Budget</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {loading && (
                <TableRow>
                  <TableCell colSpan={7} className="text-center">
                    <Loader2 className="mx-auto h-6 w-6 animate-spin" />
                  </TableCell>
                </TableRow>
              )}
              {!loading && history.length === 0 && (
                <TableRow>
                  <TableCell colSpan={7} className="text-center h-24">
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
                    <TableCell>
                      {item.material_requests?.kode_mr || "-"}
                    </TableCell>
                    <TableCell
                      className={cn(
                        "text-right font-medium",
                        item.change_amount < 0
                          ? "text-destructive"
                          : "text-green-600"
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

// --- Komponen Klien Utama ---
export function CostCenterClientContent() {
  const s = createClient();
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const [data, setData] = useState<CostCenter[]>([]);
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
  const [selectedCostCenter, setSelectedCostCenter] =
    useState<CostCenter | null>(null);

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
    [searchParams]
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
      const allowedRoles = ["admin"];
      const isAllowedDepartment =
        isGADepartment(profileData?.department) ||
        profileData?.department === "General Manager";
      if (!profileData || !isAllowedDepartment) {
        if (!allowedRoles.includes(profileData.role)) {
          toast.error("Akses ditolak.");
          router.push("/dashboard");
          return;
        }
      }
      setAdminProfile(profileData);

      try {
        const { data: ccData, count } = await fetchCostCenters(
          currentPage,
          limit,
          searchTerm,
          companyFilter,
          profileData
        );
        setData(ccData);
        setTotalItems(count);
      } catch (err: any) {
        toast.error("Gagal memuat cost center", { description: err.message });
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
    updates: Record<string, string | number | undefined>
  ) => {
    startTransition(() => {
      router.push(`${pathname}?${createQueryString(updates)}`);
    });
  };

  const handleOpenNew = () => {
    setSelectedCostCenter(null);
    setIsFormOpen(true);
  };

  const handleOpenEdit = (cc: CostCenter) => {
    setSelectedCostCenter(cc);
    setIsFormOpen(true);
  };

  const handleOpenHistory = (cc: CostCenter) => {
    setSelectedCostCenter(cc);
    setIsHistoryOpen(true);
  };

  const [togglingId, setTogglingId] = useState<number | null>(null);

  const handleToggleActive = async (cc: CostCenter) => {
    if (!authUser) {
      toast.error("Sesi admin tidak ditemukan.");
      return;
    }
    const willDeactivate = cc.is_active !== false;
    const confirmMsg = willDeactivate
      ? `Nonaktifkan Cost Center "${cc.name}"? CC ini tidak akan muncul lagi di pilihan/filter cost center pada halaman lain. Data & MR yang sudah memakainya tetap utuh.`
      : `Aktifkan kembali Cost Center "${cc.name}"? CC ini akan muncul kembali di pilihan cost center.`;
    if (!confirm(confirmMsg)) return;

    setTogglingId(cc.id);
    try {
      await setCostCenterActiveStatus(cc.id, !willDeactivate, authUser.id);
      toast.success(
        willDeactivate
          ? `Cost Center "${cc.name}" dinonaktifkan.`
          : `Cost Center "${cc.name}" diaktifkan.`
      );
      loadData();
    } catch (err: any) {
      toast.error("Gagal mengubah status cost center", {
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
        title="Manajemen Cost Center"
        description="Kelola daftar cost center dan budget."
        cardAction={
          <Button onClick={handleOpenNew}>
            <Plus className="mr-2 h-4 w-4" /> Tambah Cost Center
          </Button>
        }
        className="col-span-12"
      >
        <div className="flex flex-col gap-4 mb-6">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-muted-foreground" />
            <Input
              placeholder="Cari berdasarkan Nama atau Kode..."
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
                <TableHead>Kode</TableHead>
                <TableHead>Perusahaan</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="text-right">Initial Budget</TableHead>
                <TableHead className="text-right">Current Budget</TableHead>
                <TableHead className="text-right">Aksi</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {loading || isPending ? (
                <TableRow>
                  <TableCell colSpan={7} className="text-center h-24">
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
                      <TableCell className={cn("font-mono text-xs", dimClass)}>
                        {item.code || "-"}
                      </TableCell>
                      <TableCell className={dimClass}>
                        <Badge variant="outline">{item.company_code}</Badge>
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
                      <TableCell className={cn("text-right font-bold", dimClass)}>
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
                        <Button
                          variant={isInactive ? "outline" : "destructive"}
                          size="sm"
                          onClick={() => handleToggleActive(item)}
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
                      </TableCell>
                    </TableRow>
                  );
                })
              ) : (
                <TableRow>
                  <TableCell colSpan={7} className="text-center h-24">
                    Tidak ada data cost center ditemukan.
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
            <span>dari {totalItems} cost center.</span>
          </div>
          <PaginationComponent
            currentPage={currentPage}
            totalPages={Math.ceil(totalItems / limit)}
            limit={limit}
            basePath={pathname}
          />
        </div>
      </Content>

      <CostCenterDialog
        open={isFormOpen}
        onOpenChange={setIsFormOpen}
        onSave={() => loadData()}
        adminUser={authUser}
        costCenter={selectedCostCenter}
      />

      <HistoryDialog
        open={isHistoryOpen}
        onOpenChange={setIsHistoryOpen}
        costCenter={selectedCostCenter}
      />
    </>
  );
}
