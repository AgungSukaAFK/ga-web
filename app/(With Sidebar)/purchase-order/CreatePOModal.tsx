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
import { fetchApprovedMaterialRequests } from "@/services/purchaseOrderService";
import { Loader2, FilePlus2, Search } from "lucide-react";
import { toast } from "sonner";
import { ApprovedMaterialRequest } from "@/type";

interface CreatePOModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export function CreatePOModal({ isOpen, onClose }: CreatePOModalProps) {
  const [approvedMRs, setApprovedMRs] = useState<ApprovedMaterialRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const router = useRouter();

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
      }, 300);

      return () => {
        clearTimeout(handler);
      };
    }
  }, [isOpen, searchQuery]);

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
                    className="w-full text-left p-3 border rounded-lg hover:bg-accent transition-colors flex justify-between items-start group"
                  >
                    <div className="flex-1 min-w-0 pr-4">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-semibold text-base">
                          {mr.kode_mr}
                        </span>
                        <Badge variant="secondary" className="text-xs">
                          {mr.department}
                        </Badge>
                      </div>
                      {/* REVISI: Line clamp untuk remarks */}
                      <p className="text-sm text-muted-foreground mt-2 line-clamp-3 break-words">
                        {mr.remarks || "Tidak ada remarks."}
                      </p>
                    </div>
                    <FilePlus2 className="h-5 w-5 text-muted-foreground group-hover:text-primary flex-shrink-0 mt-1" />
                  </button>
                </li>
              ))}
            </ul>
          ) : (
            <div className="text-center h-full flex flex-col justify-center items-center py-8">
              <p className="font-semibold">Tidak Ada MR yang Ditemukan</p>
              <p className="text-sm text-muted-foreground">
                Pastikan status MR sudah &quot;Waiting PO&quot;.
              </p>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
