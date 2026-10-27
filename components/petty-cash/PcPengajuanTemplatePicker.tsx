// src/components/petty-cash/PcPengajuanTemplatePicker.tsx
//
// Tombol "Pakai Template" di Input Pengajuan (InputPengajuanClient.tsx) -
// daftar Template Pengajuan milik user login (lihat
// services/pettyCashPengajuanTemplateService.ts), dimuat saat dialog dibuka.
// Memilih template cuma memanggil `onSelect(id)`; pemanggil yang menerapkan
// (lewat ?template=<id>, jalur yang sama dgn tombol "Gunakan" di halaman
// Template Pengajuan).

"use client";

import { useState } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { createClient } from "@/lib/supabase/client";
import { fetchMyPengajuanTemplates } from "@/services/pettyCashPengajuanTemplateService";
import { PettyCashPengajuanTemplate } from "@/type";
import { toast } from "sonner";
import { FileStack, Loader2, PlayCircle, Settings2 } from "lucide-react";

interface PcPengajuanTemplatePickerProps {
  /** Ada barang di form - tampilkan peringatan bahwa isinya akan diganti. */
  hasItems: boolean;
  onSelect: (templateId: number) => void;
}

export function PcPengajuanTemplatePicker({
  hasItems,
  onSelect,
}: PcPengajuanTemplatePickerProps) {
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [templates, setTemplates] = useState<PettyCashPengajuanTemplate[]>([]);

  const handleOpenChange = async (next: boolean) => {
    setOpen(next);
    if (!next) return;
    setLoading(true);
    try {
      const {
        data: { user },
      } = await createClient().auth.getUser();
      if (!user) throw new Error("Sesi login berakhir.");
      setTemplates(await fetchMyPengajuanTemplates(user.id));
    } catch (error: any) {
      toast.error("Gagal memuat template", { description: error.message });
    } finally {
      setLoading(false);
    }
  };

  const choose = (id: number) => {
    setOpen(false);
    onSelect(id);
  };

  return (
    <>
      <Button
        type="button"
        variant="outline"
        size="sm"
        onClick={() => handleOpenChange(true)}
      >
        <FileStack className="h-4 w-4 mr-1" />
        Pakai Template
      </Button>

      <Dialog open={open} onOpenChange={handleOpenChange}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>Pakai Template Pengajuan</DialogTitle>
            <DialogDescription>
              {hasItems
                ? "Daftar barang di form akan diganti dengan isi template yang dipilih."
                : "Isi daftar barang dari template milik Anda."}
            </DialogDescription>
          </DialogHeader>

          {loading ? (
            <div className="flex justify-center py-8">
              <Loader2 className="h-6 w-6 animate-spin text-primary" />
            </div>
          ) : templates.length === 0 ? (
            <p className="py-6 text-center text-sm text-muted-foreground">
              Belum ada template. Buat dulu di halaman Template Pengajuan untuk
              barang yang rutin diajukan.
            </p>
          ) : (
            <ul className="flex max-h-[50vh] flex-col divide-y overflow-y-auto rounded-md border">
              {templates.map((t) => (
                <li
                  key={t.id}
                  className="flex items-center justify-between gap-3 px-3 py-2"
                >
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium">
                      {t.nama_template}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {t.items?.length ?? 0} barang
                    </p>
                  </div>
                  <Button size="sm" onClick={() => choose(t.id)}>
                    <PlayCircle className="h-4 w-4 mr-1" /> Gunakan
                  </Button>
                </li>
              ))}
            </ul>
          )}

          <div className="flex justify-end">
            <Button asChild variant="ghost" size="sm">
              <Link href="/petty-cash/template-pengajuan">
                <Settings2 className="h-4 w-4 mr-1" /> Kelola Template
              </Link>
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
