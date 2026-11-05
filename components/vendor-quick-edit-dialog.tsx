// src/components/vendor-quick-edit-dialog.tsx
//
// Lengkapi data vendor langsung dari form Create/Edit PO, tanpa pindah ke
// Manajemen Vendor. Yang disimpan adalah master vendor, lalu parent menyalin
// hasilnya ke snapshot vendor_details lewat toStoredVendorDetails.

"use client";

import { useEffect, useState } from "react";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { fetchVendorById, updateVendor } from "@/services/vendorService";
import { StoredVendorDetails, Vendor } from "@/type";
import { VENDOR_TIPE_LABELS, VENDOR_TIPE_OPTIONS } from "@/type/enum";

export const toStoredVendorDetails = (vendor: Vendor): StoredVendorDetails => ({
  vendor_id: vendor.id,
  kode_vendor: vendor.kode_vendor,
  nama_vendor: vendor.nama_vendor,
  alamat: vendor.alamat || "",
  contact_person: vendor.pic_contact_person || "",
  email: vendor.email || "",
  tipe_vendor: vendor.tipe_vendor,
});

export function VendorQuickEditDialog({
  open,
  onOpenChange,
  vendorId,
  onSaved,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  vendorId: number | null;
  onSaved: (vendor: Vendor) => void;
}) {
  const [vendor, setVendor] = useState<Vendor | null>(null);
  const [loadError, setLoadError] = useState(false);
  const [saving, setSaving] = useState(false);

  // Selalu ambil data terbaru: snapshot di PO bisa lebih lama dari master
  // vendor, misalnya tipenya sudah diisi orang lain.
  useEffect(() => {
    if (!open || !vendorId) return;
    let cancelled = false;
    setVendor(null);
    setLoadError(false);
    fetchVendorById(vendorId)
      .then((data) => {
        if (!cancelled) setVendor(data);
      })
      .catch(() => {
        if (!cancelled) setLoadError(true);
      });
    return () => {
      cancelled = true;
    };
  }, [open, vendorId]);

  const setField = <K extends keyof Vendor>(key: K, value: Vendor[K]) =>
    setVendor((prev) => (prev ? { ...prev, [key]: value } : prev));

  const handleSave = async () => {
    if (!vendor?.tipe_vendor) return;
    setSaving(true);
    try {
      const saved = await updateVendor(vendor.id, {
        tipe_vendor: vendor.tipe_vendor,
        pic_contact_person: vendor.pic_contact_person?.trim() || null,
        alamat: vendor.alamat?.trim() || null,
        email: vendor.email?.trim() || null,
      });
      onSaved(saved);
      toast.success(`Vendor ${saved.nama_vendor} berhasil diperbarui.`);
      onOpenChange(false);
    } catch (err: any) {
      toast.error("Gagal menyimpan vendor", { description: err.message });
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Lengkapi Data Vendor</DialogTitle>
          <DialogDescription>
            Tipe Vendor (HO/Branch/Site) wajib diisi sebelum PO bisa disimpan.
            Perubahan ini tersimpan ke master vendor.
          </DialogDescription>
        </DialogHeader>

        {loadError ? (
          <p className="py-4 text-sm text-red-600 dark:text-red-400">
            Gagal memuat data vendor. Tutup dialog ini lalu coba lagi.
          </p>
        ) : !vendor ? (
          <div className="flex justify-center py-8">
            <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
          </div>
        ) : (
          <div className="grid gap-4 py-2">
            <div className="rounded-md bg-muted/50 p-3 text-sm">
              <p className="font-semibold [overflow-wrap:anywhere]">
                {vendor.nama_vendor}
              </p>
              <p className="text-xs text-muted-foreground">
                {vendor.kode_vendor}
              </p>
            </div>
            <div className="grid gap-1.5">
              <Label htmlFor="quick-vendor-tipe">Tipe Vendor</Label>
              <Select
                value={vendor.tipe_vendor || undefined}
                onValueChange={(value) =>
                  setField("tipe_vendor", value as Vendor["tipe_vendor"])
                }
              >
                <SelectTrigger id="quick-vendor-tipe" className="w-full">
                  <SelectValue placeholder="Pilih Tipe Vendor" />
                </SelectTrigger>
                <SelectContent>
                  {VENDOR_TIPE_OPTIONS.map((opt) => (
                    <SelectItem key={opt} value={opt}>
                      {VENDOR_TIPE_LABELS[opt]}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="grid gap-1.5">
              <Label htmlFor="quick-vendor-pic">PIC / Contact Person</Label>
              <Input
                id="quick-vendor-pic"
                value={vendor.pic_contact_person || ""}
                onChange={(e) => setField("pic_contact_person", e.target.value)}
              />
            </div>
            <div className="grid gap-1.5">
              <Label htmlFor="quick-vendor-email">Email</Label>
              <Input
                id="quick-vendor-email"
                type="email"
                value={vendor.email || ""}
                onChange={(e) => setField("email", e.target.value)}
              />
            </div>
            <div className="grid gap-1.5">
              <Label htmlFor="quick-vendor-alamat">Alamat</Label>
              <Textarea
                id="quick-vendor-alamat"
                value={vendor.alamat || ""}
                onChange={(e) => setField("alamat", e.target.value)}
              />
            </div>
          </div>
        )}

        <DialogFooter>
          <Button
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={saving}
          >
            Batal
          </Button>
          <Button
            onClick={handleSave}
            disabled={saving || !vendor?.tipe_vendor}
          >
            {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Simpan
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
