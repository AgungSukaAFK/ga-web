// src/app/(With Sidebar)/petty-cash/template-approval/PcApprovalTemplateForm.tsx
//
// Mirip TemplateForm.tsx (MR/PO, lihat approval-validation/templates/) tapi
// disederhanakan: tidak ada "jenis approval" per baris approver (alur Petty
// Cash cuma approve/reject sekuensial, tidak ada percabangan logic per jenis
// seperti Payment Validator/Receiver di PO). Auto-terapkan (auto_rules) ADA
// tapi lebih simpel dari punya MR/PO - cukup per-departemen, tanpa
// document_type.
//
// "Tipe Approval" di sini beda dari "jenis approval per baris" di atas - ini
// klasifikasi TEMPLATE-nya sendiri (satu dari 3 tahap alur Petty Cash, lihat
// PcApprovalType di type/index.ts), bukan per approver.

"use client";

import { useEffect, useState } from "react";
import { User } from "@/type";
import { searchUsers } from "@/services/approvalTemplateService";
import {
  PcApprover,
  PcAutoRule,
  PcApprovalTemplate,
  PcTemplateFormInput,
} from "@/services/pcApprovalTemplateService";
import { PcApprovalType } from "@/type";
import { PC_APPROVAL_TYPE_OPTIONS } from "@/type/enum";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { toast } from "sonner";
import {
  ArrowDown,
  ArrowUp,
  Loader2,
  Plus,
  Search,
  XCircle,
} from "lucide-react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { Combobox } from "@/components/combobox";
import { dataDepartment } from "@/type/comboboxData";

interface PcApprovalTemplateFormProps {
  initialData?: PcApprovalTemplate | null;
  onSave: (data: PcTemplateFormInput) => Promise<void>;
  onCancel: () => void;
}

// Sama seperti TemplateForm.tsx: butuh identitas baris yang stabil (React key
// + target move/remove) terlepas dari userid, karena user yang sama boleh
// muncul lebih dari sekali di jalur yang sama.
type ApprovalRow = PcApprover & { _rowKey: string };
type AutoRuleRow = Partial<PcAutoRule> & { _rowKey: string };

const makeRowKey = () =>
  typeof crypto !== "undefined" && "randomUUID" in crypto
    ? crypto.randomUUID()
    : `${Date.now()}-${Math.random()}`;

export function PcApprovalTemplateForm({
  initialData,
  onSave,
  onCancel,
}: PcApprovalTemplateFormProps) {
  const [templateName, setTemplateName] = useState(
    initialData?.template_name || "",
  );
  const [description, setDescription] = useState(
    initialData?.description || "",
  );
  const [approvalType, setApprovalType] = useState<PcApprovalType>(
    initialData?.approval_type || PC_APPROVAL_TYPE_OPTIONS[0],
  );
  const [approvalPath, setApprovalPath] = useState<ApprovalRow[]>(
    (initialData?.approval_path || []).map((a) => ({
      ...a,
      _rowKey: makeRowKey(),
    })),
  );
  // Diinisialisasi langsung dari initialData (bukan lewat useEffect) karena
  // tiap baris dipakai sebagai defaultValue Combobox - Combobox cuma baca
  // defaultValue sekali pas mount pertama (lihat TemplateForm.tsx MR/PO).
  const [autoRules, setAutoRules] = useState<AutoRuleRow[]>(
    (initialData?.auto_rules || []).map((rule) => ({
      ...rule,
      _rowKey: makeRowKey(),
    })),
  );

  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState<User[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    if (initialData) {
      setTemplateName(initialData.template_name);
      setDescription(initialData.description || "");
      setApprovalType(initialData.approval_type);
      setApprovalPath(
        (initialData.approval_path || []).map((a) => ({
          ...a,
          _rowKey: makeRowKey(),
        })),
      );
    }
  }, [initialData]);

  const duplicateUserIds = new Set(
    approvalPath
      .map((a) => a.userid)
      .filter((id, idx, arr) => arr.indexOf(id) !== idx),
  );

  const handleSearch = async () => {
    setIsSearching(true);
    try {
      const results = await searchUsers(searchQuery);
      setSearchResults(results);
    } catch (error: any) {
      toast.error("Gagal mencari user", { description: error.message });
    } finally {
      setIsSearching(false);
    }
  };

  const addApprover = (user: User) => {
    if (approvalPath.some((a) => a.userid === user.id)) {
      toast.warning(`${user.nama} sudah ada di daftar approval ini.`, {
        description: "Tetap ditambahkan - cek urutannya.",
      });
    }
    setApprovalPath((prev) => [
      ...prev,
      {
        userid: user.id,
        nama: user.nama || "",
        department: user.department || "",
        role: user.role || "",
        status: "pending",
        _rowKey: makeRowKey(),
      },
    ]);
    setSearchResults([]);
    setSearchQuery("");
  };

  const removeApprover = (rowKey: string) =>
    setApprovalPath((prev) => prev.filter((a) => a._rowKey !== rowKey));

  const moveApprover = (index: number, direction: "up" | "down") => {
    const newArr = [...approvalPath];
    const newIndex = direction === "up" ? index - 1 : index + 1;
    if (newIndex < 0 || newIndex >= newArr.length) return;
    [newArr[index], newArr[newIndex]] = [newArr[newIndex], newArr[index]];
    setApprovalPath(newArr);
  };

  const addAutoRule = () =>
    setAutoRules((prev) => [...prev, { _rowKey: makeRowKey() }]);

  const removeAutoRule = (rowKey: string) =>
    setAutoRules((prev) => prev.filter((r) => r._rowKey !== rowKey));

  const updateAutoRule = (rowKey: string, department: string) =>
    setAutoRules((prev) =>
      prev.map((r) => (r._rowKey === rowKey ? { ...r, department } : r)),
    );

  const handleSave = async () => {
    if (!templateName.trim()) {
      toast.error("Nama template wajib diisi.");
      return;
    }
    if (approvalPath.length === 0) {
      toast.error("Jalur approval harus memiliki minimal satu orang.");
      return;
    }
    if (autoRules.some((r) => !r.department)) {
      toast.error(
        "Tiap baris auto-terapkan wajib pilih departemennya (atau hapus barisnya).",
      );
      return;
    }
    const autoRuleDepts = autoRules.map((r) => r.department);
    if (new Set(autoRuleDepts).size !== autoRuleDepts.length) {
      toast.error("Ada departemen yang diulang di daftar auto-terapkan.");
      return;
    }

    setIsSaving(true);
    await onSave({
      template_name: templateName,
      description,
      approval_type: approvalType,
      approval_path: approvalPath.map(({ _rowKey, ...rest }) => rest),
      auto_rules: autoRules.map(({ _rowKey, ...rest }) => rest as PcAutoRule),
    });
    setIsSaving(false);
  };

  return (
    <div className="w-full space-y-6">
      <div className="space-y-2">
        <Label htmlFor="pc-template-name">Nama Template</Label>
        <Input
          id="pc-template-name"
          value={templateName}
          onChange={(e) => setTemplateName(e.target.value)}
          placeholder="Contoh: Approval Kasbon Transport"
        />
      </div>
      <div className="space-y-2">
        <Label htmlFor="pc-template-desc">Deskripsi (Opsional)</Label>
        <Textarea
          id="pc-template-desc"
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          placeholder="Dipakai untuk pengajuan reimbursement transport, dll."
        />
      </div>
      <div className="space-y-2">
        <Label htmlFor="pc-template-approval-type">Tipe Approval</Label>
        <Select
          value={approvalType}
          onValueChange={(value) => setApprovalType(value as PcApprovalType)}
        >
          <SelectTrigger id="pc-template-approval-type">
            <SelectValue placeholder="Pilih tipe approval..." />
          </SelectTrigger>
          <SelectContent>
            {PC_APPROVAL_TYPE_OPTIONS.map((type) => (
              <SelectItem key={type} value={type}>
                {type}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <p className="text-xs text-muted-foreground">
          Menandakan template ini dipakai untuk tahap apa: Approval Pengajuan,
          Approval Voucher, atau Approval Deklarasi.
        </p>
      </div>

      <div className="space-y-2 rounded-md border p-3">
        <div className="flex items-center justify-between">
          <Label>Auto-Terapkan Template (Opsional)</Label>
          <Button type="button" size="sm" variant="outline" onClick={addAutoRule}>
            <Plus className="mr-1 h-3.5 w-3.5" /> Tambah Departemen
          </Button>
        </div>
        <p className="text-xs text-muted-foreground">
          Kalau diisi, template ini otomatis diterapkan begitu user dari
          departemen berikut submit Input Pengajuan - tanpa validasi manual
          GA. Satu departemen cuma boleh terhubung ke satu template.
        </p>
        {autoRules.length === 0 ? (
          <p className="text-xs text-muted-foreground italic pt-1">
            Belum ada departemen yang auto-terapkan ke template ini.
          </p>
        ) : (
          <div className="space-y-2 pt-1">
            {autoRules.map((rule) => (
              <div key={rule._rowKey} className="flex items-center gap-2">
                <div className="flex-1">
                  <Combobox
                    data={dataDepartment}
                    onChange={(value) => updateAutoRule(rule._rowKey, value)}
                    defaultValue={rule.department}
                    placeholder="Pilih departemen..."
                  />
                </div>
                <Button
                  type="button"
                  size="icon"
                  variant="outline"
                  className="w-9 h-9 shrink-0"
                  onClick={() => removeAutoRule(rule._rowKey)}
                >
                  <XCircle className="h-4 w-4 text-destructive" />
                </Button>
              </div>
            ))}
          </div>
        )}
      </div>

      <div className="space-y-2">
        <Label>Bangun Jalur Approval</Label>
        <div className="flex gap-2">
          <Input
            placeholder="Cari nama approver..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && handleSearch()}
          />
          <Button
            type="button"
            variant="outline"
            onClick={handleSearch}
            disabled={isSearching}
          >
            {isSearching ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Search />
            )}
          </Button>
        </div>
        {searchResults.length > 0 && (
          <div className="space-y-2 border p-2 rounded-md max-h-48 overflow-y-auto">
            {searchResults.map((user) => (
              <div
                key={user.id}
                className="flex items-center gap-2 p-1 rounded hover:bg-accent"
              >
                <Avatar className="h-8 w-8">
                  <AvatarImage
                    src={`https://ui-avatars.com/api/?name=${user.nama}`}
                  />
                  <AvatarFallback>{user.nama?.charAt(0)}</AvatarFallback>
                </Avatar>
                <div className="flex-grow min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <p className="text-sm font-medium truncate">{user.nama}</p>
                    <Badge variant="outline">{user.department}</Badge>
                  </div>
                  <p className="text-xs text-muted-foreground truncate">
                    {user.email}
                  </p>
                </div>
                <Button
                  type="button"
                  size="icon"
                  variant="outline"
                  className="h-8 w-8 flex-shrink-0"
                  onClick={() => addApprover(user)}
                >
                  <Plus className="h-4 w-4" />
                </Button>
              </div>
            ))}
          </div>
        )}
      </div>

      <div className="overflow-x-auto rounded-md border">
        <Table className="min-w-[500px]">
          <TableHeader>
            <TableRow>
              <TableHead className="w-[50px]">Urutan</TableHead>
              <TableHead>User</TableHead>
              <TableHead className="w-[140px]">Aksi</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {approvalPath.length === 0 && (
              <TableRow>
                <TableCell colSpan={3} className="text-center h-24">
                  Belum ada approver ditambahkan.
                </TableCell>
              </TableRow>
            )}
            {approvalPath.map((app, i) => {
              const isDuplicate = duplicateUserIds.has(app.userid);
              return (
                <TableRow
                  key={app._rowKey}
                  className={cn(
                    isDuplicate &&
                      "bg-amber-50 hover:bg-amber-100 dark:bg-amber-950/30 dark:hover:bg-amber-950/50",
                  )}
                >
                  <TableCell>{i + 1}</TableCell>
                  <TableCell
                    className="font-medium max-w-[220px] truncate"
                    title={app.nama}
                  >
                    <div className="flex items-center gap-2">
                      <span className="truncate">{app.nama}</span>
                      <span className="text-xs text-muted-foreground truncate shrink-0">
                        ({app.department})
                      </span>
                      {isDuplicate && (
                        <Badge
                          variant="outline"
                          className="border-amber-500 text-amber-600 dark:text-amber-400 shrink-0"
                        >
                          Duplikat
                        </Badge>
                      )}
                    </div>
                  </TableCell>
                  <TableCell>
                    <div className="flex gap-1">
                      <Button
                        type="button"
                        size="icon"
                        variant="ghost"
                        onClick={() => moveApprover(i, "up")}
                        disabled={i === 0}
                      >
                        <ArrowUp className="h-4 w-4" />
                      </Button>
                      <Button
                        type="button"
                        size="icon"
                        variant="ghost"
                        onClick={() => moveApprover(i, "down")}
                        disabled={i === approvalPath.length - 1}
                      >
                        <ArrowDown className="h-4 w-4" />
                      </Button>
                      <Button
                        type="button"
                        size="icon"
                        variant="ghost"
                        onClick={() => removeApprover(app._rowKey)}
                      >
                        <XCircle className="h-4 w-4 text-destructive" />
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </div>
      <div className="flex justify-end gap-2 pt-4">
        <Button type="button" variant="ghost" onClick={onCancel}>
          Batal
        </Button>
        <Button type="button" onClick={handleSave} disabled={isSaving}>
          {isSaving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
          Simpan Template
        </Button>
      </div>
    </div>
  );
}
