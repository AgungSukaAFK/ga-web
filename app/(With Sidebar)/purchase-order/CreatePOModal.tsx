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
import { Badge } from "@/components/ui/badge";
import {
  ApprovedMaterialRequest,
  fetchApprovedMaterialRequests,
} from "@/services/purchaseOrderService";
import { Loader2, FilePlus2, Search } from "lucide-react";
import { toast } from "sonner";

interface CreatePOModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export function CreatePOModal({ isOpen, onClose }: CreatePOModalProps) {
  const [approvedMRs, setApprovedMRs] = useState<ApprovedMaterialRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const router = useRouter();

  // Debounce effect untuk pencarian
  useEffect(() => {
    if (isOpen) {
      const handler = setTimeout(() => {
        setLoading(true);
        fetchApprovedMaterialRequests(searchQuery)
          .then((data) => setApprovedMRs(data))
          .catch((err) =>
            toast.error("Gagal memuat daftar MR", { description: err.message })
          )
          .finally(() => setLoading(false));
      }, 300); // Jeda 300ms setelah user berhenti mengetik

      return () => {
        clearTimeout(handler);
      };
    }
  }, [isOpen, searchQuery]); // Efek ini berjalan saat modal terbuka atau query pencarian berubah

  const handleSelectMr = (mrId: number) => {
    router.push(`/purchase-order/create?mrId=${mrId}`);
    onClose();
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>Pilih Material Request</DialogTitle>
          <DialogDescription>
            Pilih MR yang sudah disetujui untuk diangkat menjadi Purchase Order
            baru.
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
          {loading ? (
            <div className="flex justify-center items-center h-full">
              <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
            </div>
          ) : approvedMRs.length > 0 ? (
            <ul className="space-y-2">
              {approvedMRs.map((mr) => (
                <li key={mr.id}>
                  <button
                    onClick={() => handleSelectMr(mr.id)}
                    className="w-full text-left p-3 border rounded-lg hover:bg-accent transition-colors flex justify-between items-center"
                  >
                    <div>
                      {/* FIX: Mengganti <p> menjadi <div> untuk menghindari error hidrasi */}
                      <div className="font-semibold items-center flex gap-2">
                        <span>{mr.kode_mr}</span>
                        <Badge variant="secondary">{mr.department}</Badge>
                      </div>
                      <p className="text-sm text-muted-foreground mt-1 truncate">
                        {mr.remarks}
                      </p>
                    </div>
                    <FilePlus2 className="h-5 w-5 text-primary flex-shrink-0 ml-4" />
                  </button>
                </li>
              ))}
            </ul>
          ) : (
            <div className="text-center h-full flex flex-col justify-center items-center">
              <p className="font-semibold">Tidak Ada MR yang Ditemukan</p>
              <p className="text-sm text-muted-foreground">
                Coba ubah kata kunci pencarian Anda, atau belum ada MR yang
                disetujui.
              </p>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
