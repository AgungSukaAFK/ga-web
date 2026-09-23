// src/app/(With Sidebar)/petty-cash/budgeting/PettyCashBudgetingClient.tsx
//
// "Budgeting" Petty Cash (GA/Admin only) - kelola pool budget PER
// DEPARTEMEN + SITE yang AUTO-terisi ke Input Pengajuan baru (lihat
// komentar PettyCashBudget di type/index.ts - resolveAutoBudget cocokkan
// department & site SEKALIGUS, bukan departemen saja). Add/Edit-Top-up/
// Riwayat/Aktifkan-Nonaktifkan - pola & tampilannya SENGAJA dibuat identik
// dengan app/(With Sidebar)/cost-center-management/CostCenterClient.tsx
// (cost center milik MR/PO) supaya konsisten, meski datanya terpisah.

"use client";

import { useEffect, useState } from "react";
import { Content } from "@/components/content";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Combobox } from "@/components/combobox";
import { CurrencyInput } from "@/components/ui/currency-input";
import { Badge } from "@/components/ui/badge";
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
import { cn, formatCurrency, formatDateFriendly } from "@/lib/utils";
import { dataDepartment, dataLokasi } from "@/type/comboboxData";
import { toast } from "sonner";
import { PettyCashBudget, PettyCashBudgetHistory } from "@/type";
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
  ShieldAlert,
} from "lucide-react";
import { User } from "@supabase/supabase-js";

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
  const [initialBudget, setInitialBudget] = useState(0);
  const [newBudget, setNewBudget] = useState(0);
  const [reason, setReason] = useState("");
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (budget) {
      setName(budget.name);
      setDepartment(budget.department);
      setSite(budget.site || "");
      setInitialBudget(budget.initial_budget);
      setNewBudget(budget.current_budget);
    } else {
      setName("");
      setDepartment("");
      setSite("");
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
        if (!name.trim() || !department || !site) {
          toast.error("Nama, Departemen, dan Site/Lokasi wajib diisi.");
          setLoading(false);
          return;
        }
        await createBudget(
          { name: name.trim(), department, site, initial_budget: initialBudget },
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
      <DialogContent>
        <DialogHeader>
          <DialogTitle>
            {isCreateMode ? "Buat Budget Baru" : `Edit/Top-up: ${budget?.name}`}
          </DialogTitle>
        </DialogHeader>
        <div className="grid gap-4 py-4">
          <div className="grid grid-cols-4 items-center gap-4">
            <Label htmlFor="name" className="text-right">
              Nama
            </Label>
            <Input
              id="name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="col-span-3"
              disabled={!isCreateMode}
              placeholder="Ex: Budget GA Bulanan"
            />
          </div>
          <div className="grid grid-cols-4 items-center gap-4">
            <Label className="text-right">Departemen</Label>
            <div className="col-span-3">
              <Combobox
                data={dataDepartment}
                onChange={setDepartment}
                defaultValue={department}
                placeholder="Pilih departemen..."
                disabled={!isCreateMode}
              />
            </div>
          </div>
          <div className="grid grid-cols-4 items-center gap-4">
            <Label className="text-right">Site/Lokasi</Label>
            <div className="col-span-3">
              <Combobox
                data={dataLokasi}
                onChange={setSite}
                defaultValue={site}
                placeholder="Pilih site/lokasi..."
                disabled={!isCreateMode}
              />
            </div>
          </div>
          {isCreateMode && (
            <p className="text-xs text-muted-foreground -mt-2 col-span-4 text-right">
              Kombinasi Departemen + Site ini akan otomatis dipasangkan ke
              Pengajuan dari requester yang sama.
            </p>
          )}
          <div className="grid grid-cols-4 items-center gap-4">
            <Label htmlFor="budget" className="text-right">
              {isCreateMode ? "Initial Budget" : "Current Budget"}
            </Label>
            <CurrencyInput
              id="budget"
              value={isCreateMode ? initialBudget : newBudget}
              onValueChange={isCreateMode ? setInitialBudget : setNewBudget}
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
      <DialogContent className="max-w-3xl">
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

export default function PettyCashBudgetingClient({
  canManage,
}: {
  canManage: boolean;
}) {
  const supabase = createClient();

  const [budgets, setBudgets] = useState<PettyCashBudget[]>([]);
  const [loading, setLoading] = useState(true);
  const [authUser, setAuthUser] = useState<User | null>(null);

  const [isFormOpen, setIsFormOpen] = useState(false);
  const [isHistoryOpen, setIsHistoryOpen] = useState(false);
  const [selected, setSelected] = useState<PettyCashBudget | null>(null);
  const [togglingId, setTogglingId] = useState<number | null>(null);

  const loadData = async () => {
    setLoading(true);
    try {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      setAuthUser(user);

      const data = await fetchBudgets();
      setBudgets(data);
    } catch (err: any) {
      toast.error("Gagal memuat budget", { description: err.message });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (canManage) loadData();
    else setLoading(false);
  }, [canManage]);

  const handleOpenNew = () => {
    setSelected(null);
    setIsFormOpen(true);
  };

  const handleOpenEdit = (b: PettyCashBudget) => {
    setSelected(b);
    setIsFormOpen(true);
  };

  const handleOpenHistory = (b: PettyCashBudget) => {
    setSelected(b);
    setIsHistoryOpen(true);
  };

  const handleToggleActive = async (b: PettyCashBudget) => {
    if (!authUser) {
      toast.error("Sesi admin tidak ditemukan.");
      return;
    }
    const willDeactivate = b.is_active !== false;
    const confirmMsg = willDeactivate
      ? `Nonaktifkan Budget "${b.name}"? Departemen "${b.department}" tidak akan otomatis ke-assign budget ini lagi ke Pengajuan baru.`
      : `Aktifkan kembali Budget "${b.name}"?`;
    if (!confirm(confirmMsg)) return;

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

  if (!canManage) {
    return (
      <Content title="Budgeting Petty Cash" description="Khusus GA/Admin.">
        <div className="flex flex-col items-center justify-center h-64 text-muted-foreground gap-2">
          <ShieldAlert className="h-10 w-10" />
          <p className="text-sm">Anda tidak memiliki akses ke halaman ini.</p>
        </div>
      </Content>
    );
  }

  return (
    <>
      <Content
        title="Budgeting Petty Cash"
        description="Kelola budget per departemen - otomatis diterapkan ke Input Pengajuan baru sesuai departemen requester."
        cardAction={
          <Button onClick={handleOpenNew}>
            <Plus className="mr-2 h-4 w-4" /> Tambah Budget
          </Button>
        }
        className="col-span-12"
      >
        <div className="border rounded-md overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Nama</TableHead>
                <TableHead>Departemen</TableHead>
                <TableHead>Site/Lokasi</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="text-right">Initial Budget</TableHead>
                <TableHead className="text-right">Sisa Budget</TableHead>
                <TableHead className="text-right">Aksi</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {loading ? (
                <TableRow>
                  <TableCell colSpan={7} className="text-center h-24">
                    <Loader2 className="mx-auto h-6 w-6 animate-spin" />
                  </TableCell>
                </TableRow>
              ) : budgets.length > 0 ? (
                budgets.map((item) => {
                  const isInactive = item.is_active === false;
                  const dimClass = isInactive ? "opacity-50" : "";
                  return (
                    <TableRow key={item.id}>
                      <TableCell className={cn("font-medium", dimClass)}>
                        {item.name}
                      </TableCell>
                      <TableCell className={dimClass}>
                        <Badge variant="outline">{item.department}</Badge>
                      </TableCell>
                      <TableCell className={cn("text-sm", dimClass)}>
                        {item.site || "-"}
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
                    Belum ada budget - tambah budget pertama utk sebuah
                    departemen.
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </div>
      </Content>

      <BudgetDialog
        open={isFormOpen}
        onOpenChange={setIsFormOpen}
        onSave={loadData}
        adminUser={authUser}
        budget={selected}
      />

      <HistoryDialog
        open={isHistoryOpen}
        onOpenChange={setIsHistoryOpen}
        budget={selected}
      />
    </>
  );
}
