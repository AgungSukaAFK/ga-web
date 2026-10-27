// src/app/(With Sidebar)/purchase-order/CreatePOModal.tsx

"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import {
  fetchMrsForPoPicker,
  PoPickerMaterialRequest,
} from "@/services/purchaseOrderService";
import { Search } from "lucide-react";
import { toast } from "sonner";
import { MrPickerList } from "./MrPickerList";

interface CreatePOModalProps {
  isOpen: boolean;
  onClose: () => void;
  companyCode?: string | null;
}

export function CreatePOModal({
  isOpen,
  onClose,
  companyCode,
}: CreatePOModalProps) {
  const [mrs, setMrs] = useState<PoPickerMaterialRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const router = useRouter();

  useEffect(() => {
    if (isOpen) {
      const handler = setTimeout(() => {
        setLoading(true);
        fetchMrsForPoPicker(companyCode, searchQuery)
          .then((data) => setMrs(data))
          .catch((err) =>
            toast.error("Gagal memuat daftar MR", { description: err.message })
          )
          .finally(() => setLoading(false));
      }, 300);

      return () => {
        clearTimeout(handler);
      };
    }
  }, [isOpen, searchQuery, companyCode]);

  const handleSelectMr = (mr: PoPickerMaterialRequest) => {
    router.push(`/purchase-order/create?mrId=${mr.id}`);
    onClose();
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>Pilih Material Request</DialogTitle>
          <DialogDescription>
            Pilih MR yang sudah disetujui untuk diangkat menjadi Purchase Order.
          </DialogDescription>
        </DialogHeader>

        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Cari Kode MR, remarks, atau departemen..."
            className="pl-9"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
        </div>

        <div className="mt-2 max-h-[50vh] min-h-[10rem] overflow-y-auto pr-2">
          <MrPickerList mrs={mrs} loading={loading} onSelect={handleSelectMr} />
        </div>
      </DialogContent>
    </Dialog>
  );
}
