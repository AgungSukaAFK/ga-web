// src/app/(With Sidebar)/settings/approval-templates/TemplateForm.tsx

"use client";

import { useEffect, useState } from "react";
import { Approval, User } from "@/type"; // Pastikan path ini benar
import { APPROVAL_TYPE_OPTIONS } from "@/type/enum";
import { AutoRule, searchUsers } from "@/services/approvalTemplateService";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
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
import { Combobox } from "@/components/combobox";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { dataDepartment } from "@/type/comboboxData";

const AUTO_DOCUMENT_TYPE_OPTIONS = [
  { label: "Material Request (MR)", value: "material_request" },
  { label: "Purchase Order (PO)", value: "purchase_order" },
];

interface TemplateFormProps {
  initialData?: {
    id?: number;
    template_name: string;
    description: string;
    approval_path: Approval[];
    auto_rules?: AutoRule[];
  } | null;
  onSave: (data: {
    template_name: string;
    description: string;
    approval_path: Approval[];
    auto_rules: AutoRule[];
  }) => Promise<void>;
  onCancel: () => void;
}

// Baris approval di form ini butuh identitas yang stabil & unik per baris
// (dipakai buat React key + target update/remove/move), terlepas dari
// userid - karena sekarang user yang sama boleh muncul lebih dari sekali
// di satu template (mis. "Menyetujui" lalu "Receiver" oleh orang yang sama).
// _rowKey murni lokal ke form ini, di-strip lagi sebelum disimpan (lihat
// handleSave) supaya tidak ikut tersimpan ke approval_path di DB.
type ApprovalRow = Approval & { _rowKey: string };
type AutoRuleRow = Partial<AutoRule> & { _rowKey: string };

const makeRowKey = () =>
  typeof crypto !== "undefined" && "randomUUID" in crypto
    ? crypto.randomUUID()
    : `${Date.now()}-${Math.random()}`;

export function TemplateForm({
  initialData,
  onSave,
  onCancel,
}: TemplateFormProps) {
  const [templateName, setTemplateName] = useState("");
  const [description, setDescription] = useState("");
  const [approvalPath, setApprovalPath] = useState<ApprovalRow[]>([]);
  // Diinisialisasi langsung dari initialData (bukan lewat useEffect seperti
  // field lain) karena tiap baris dipakai sebagai defaultValue Combobox -
  // Combobox cuma baca defaultValue sekali pas mount pertama, jadi kalau
  // diisi belakangan lewat effect, tampilannya akan telat/nyangkut kosong
  // pas mode Edit.
  const [autoRules, setAutoRules] = useState<AutoRuleRow[]>(
    (initialData?.auto_rules || []).map((rule) => ({
      ...rule,
      _rowKey: makeRowKey(),
    })),
  );

  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState<User[]>([]);
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    if (initialData) {
      setTemplateName(initialData.template_name);
      setDescription(initialData.description || "");
      setApprovalPath(
        initialData.approval_path.map((a) => ({ ...a, _rowKey: makeRowKey() })),
      );
    }
  }, [initialData]);

  // userid yang muncul lebih dari sekali di jalur approval ini - dipakai
  // buat kasih penanda visual (bukan buat memblokir, user memang boleh
  // duplikat sekarang).
  const duplicateUserIds = new Set(
    approvalPath
      .map((a) => a.userid)
      .filter((id, idx, arr) => arr.indexOf(id) !== idx),
  );

  const handleSearch = async () => {
    try {
      const results = await searchUsers(searchQuery);
      setSearchResults(results);
    } catch (error: any) {
      toast.error("Gagal mencari user", { description: error.message });
    }
  };

  const addApprover = (user: User) => {
    if (approvalPath.some((a) => a.userid === user.id)) {
      toast.warning(`${user.nama} sudah ada di daftar approval ini.`, {
        description: "Tetap ditambahkan - cek urutan & jenis approval-nya.",
      });
    }
    setApprovalPath((prev) => [
      ...prev,
      {
        ...user,
        userid: user.id,
        status: "pending",
        type: "",
        nama: user.nama || "",
        department: user.department || "",
        role: user.role || "",
        email: user.email || "",
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

  const updateApproverType = (rowKey: string, type: string) => {
    setApprovalPath((prev) =>
      prev.map((app) => (app._rowKey === rowKey ? { ...app, type } : app)),
    );
  };

  const addAutoRule = () =>
    setAutoRules((prev) => [...prev, { _rowKey: makeRowKey() }]);

  const removeAutoRule = (rowKey: string) =>
    setAutoRules((prev) => prev.filter((r) => r._rowKey !== rowKey));

  const updateAutoRule = (
    rowKey: string,
    field: "document_type" | "department",
    value: string,
  ) =>
    setAutoRules((prev) =>
      prev.map((r) => (r._rowKey === rowKey ? { ...r, [field]: value } : r)),
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
    if (approvalPath.some((a) => !a.type)) {
      toast.error("Semua approver harus memiliki jenis approval.");
      return;
    }
    if (autoRules.some((r) => !r.document_type || !r.department)) {
      toast.error(
        "Tiap baris auto-terapkan wajib diisi Dokumen dan Departemen-nya (atau hapus barisnya).",
      );
      return;
    }
    const autoRuleKeys = autoRules.map(
      (r) => `${r.document_type}::${r.department}`,
    );
    if (new Set(autoRuleKeys).size !== autoRuleKeys.length) {
      toast.error(
        "Ada kombinasi Dokumen + Departemen yang sama diulang di daftar auto-terapkan.",
      );
      return;
    }

    setIsSaving(true);
    await onSave({
      template_name: templateName,
      description,
      approval_path: approvalPath.map(({ _rowKey, ...rest }) => rest),
      auto_rules: autoRules.map(({ _rowKey, ...rest }) => rest as AutoRule),
    });
    setIsSaving(false);
  };

  return (
    <div className="w-full space-y-6">
      <div className="space-y-2">
        <Label htmlFor="template-name">Nama Template</Label>
        <Input
          id="template-name"
          value={templateName}
          onChange={(e) => setTemplateName(e.target.value)}
          placeholder="Contoh: Pengadaan Aset IT"
        />
      </div>
      <div className="space-y-2">
        <Label htmlFor="template-desc">Deskripsi (Opsional)</Label>
        <Textarea
          id="template-desc"
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          placeholder="Digunakan untuk pengadaan laptop, printer, dll."
        />
      </div>

      <div className="space-y-2 rounded-md border p-3">
        <div className="flex items-center justify-between">
          <Label>Auto-Terapkan Template (Opsional)</Label>
          <Button
            type="button"
            size="sm"
            variant="outline"
            onClick={addAutoRule}
          >
            <Plus className="mr-1 h-3.5 w-3.5" /> Tambah Kombinasi
          </Button>
        </div>
        <p className="text-xs text-muted-foreground">
          Kalau diisi, template ini otomatis jadi default saat GA membuka
          validasi awal MR/PO dari kombinasi dokumen+departemen berikut - GA
          tetap bisa mengganti/edit manual saat itu juga. Satu template boleh
          punya lebih dari satu kombinasi.
        </p>
        {autoRules.length === 0 ? (
          <p className="text-xs text-muted-foreground italic pt-1">
            Belum ada kombinasi auto-terapkan.
          </p>
        ) : (
          <div className="space-y-2 pt-1">
            <div className="hidden sm:flex gap-2 px-1">
              <Label className="flex-1 text-xs font-normal text-muted-foreground">
                Dokumen
              </Label>
              <Label className="flex-1 text-xs font-normal text-muted-foreground">
                Departemen
              </Label>
              <span className="w-9 shrink-0" />
            </div>
            {autoRules.map((rule) => (
              <div
                key={rule._rowKey}
                className="flex flex-col sm:flex-row sm:items-center gap-2"
              >
                <div className="flex-1 space-y-1">
                  <Combobox
                    data={AUTO_DOCUMENT_TYPE_OPTIONS}
                    onChange={(value) =>
                      updateAutoRule(rule._rowKey, "document_type", value)
                    }
                    defaultValue={rule.document_type}
                    placeholder="Pilih dokumen..."
                  />
                </div>
                <div className="flex-1 space-y-1">
                  <Combobox
                    data={dataDepartment}
                    onChange={(value) =>
                      updateAutoRule(rule._rowKey, "department", value)
                    }
                    defaultValue={rule.department}
                    placeholder="Pilih departemen..."
                  />
                </div>

                <Button
                  type="button"
                  size="icon"
                  variant="outline"
                  className="mt-auto w-9 h-9 self-end sm:self-auto shrink-0"
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
            placeholder="Cari nama user..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && handleSearch()}
          />
          <Button variant="outline" onClick={handleSearch}>
            <Search />
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
                    <Badge variant={"outline"}>{user.department}</Badge>
                  </div>
                  <p className="text-xs text-muted-foreground truncate">
                    {user.email}
                  </p>
                </div>
                <Button
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
        <Table className="min-w-[600px]">
          <TableHeader>
            <TableRow>
              <TableHead className="w-[50px]">Urutan</TableHead>
              <TableHead>User</TableHead>
              <TableHead className="w-[180px]">Jenis</TableHead>
              <TableHead className="w-[140px]">Aksi</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {approvalPath.length === 0 && (
              <TableRow>
                <TableCell colSpan={4} className="text-center h-24">
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
                    className="font-medium max-w-[200px] truncate"
                    title={app.nama}
                  >
                    <div className="flex items-center gap-2">
                      <span className="truncate">{app.nama}</span>
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
                    <Combobox
                      data={APPROVAL_TYPE_OPTIONS}
                      onChange={(value) =>
                        updateApproverType(app._rowKey, value)
                      }
                      defaultValue={app.type}
                    />
                  </TableCell>
                  <TableCell>
                    <div className="flex gap-1">
                      <Button
                        size="icon"
                        variant="ghost"
                        onClick={() => moveApprover(i, "up")}
                        disabled={i === 0}
                      >
                        <ArrowUp className="h-4 w-4" />
                      </Button>
                      <Button
                        size="icon"
                        variant="ghost"
                        onClick={() => moveApprover(i, "down")}
                        disabled={i === approvalPath.length - 1}
                      >
                        <ArrowDown className="h-4 w-4" />
                      </Button>
                      <Button
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
        <Button variant="ghost" onClick={onCancel}>
          Batal
        </Button>
        <Button onClick={handleSave} disabled={isSaving}>
          {isSaving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
          Simpan Template
        </Button>
      </div>
    </div>
  );
}
