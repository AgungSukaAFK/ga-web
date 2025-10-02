"use client";

import { use, useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { Content } from "@/components/content";
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
  CircleUser,
  Building,
  Tag,
  Calendar,
  DollarSign,
  Info,
  Download,
  Link as LinkIcon,
  AlertTriangle,
  Check,
  X,
  Loader2,
} from "lucide-react";
import Link from "next/link";
import { DiscussionSection } from "./discussion-component"; // Sesuaikan path jika perlu
import { Skeleton } from "@/components/ui/skeleton";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { User } from "@supabase/supabase-js";

// --- Tipe Data ---
interface Approval {
  userid: string;
  nama: string;
  status: "pending" | "approved" | "rejected";
  type: string;
}

interface MaterialRequest {
  id: string;
  kode_mr: string;
  status: string;
  remarks: string;
  cost_estimation: string;
  department: string;
  kategori: string;
  created_at: string;
  due_date: string;
  orders: {
    name: string;
    qty: string;
    uom: string;
    note?: string;
    url?: string;
  }[];
  approvals: Approval[];
  attachments: { name: string; url: string }[];
  discussions: any[];
  users_with_profiles: { nama: string } | null;
}

// --- Helper Functions ---
const formatDate = (dateString?: string) => {
  if (!dateString) return "N/A";
  return new Date(dateString).toLocaleDateString("id-ID", {
    weekday: "long",
    year: "numeric",
    month: "long",
    day: "numeric",
  });
};

const formatCurrency = (value: string) => {
  if (!value || isNaN(Number(value))) return "Rp 0";
  return new Intl.NumberFormat("id-ID", {
    style: "currency",
    currency: "IDR",
    minimumFractionDigits: 0,
  }).format(Number(value));
};

// --- Komponen Utama Halaman ---
export default function DetailMRPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const [mr, setMr] = useState<MaterialRequest | null>(null);
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const supabase = createClient();

  const { id: paramsId } = use(params);

  useEffect(() => {
    const fetchData = async () => {
      setLoading(true);
      setError(null);

      // Ambil data user dan MR secara bersamaan
      const {
        data: { user },
      } = await supabase.auth.getUser();
      setCurrentUser(user);

      const { data: mrData, error: mrError } = await supabase
        .from("material_requests")
        .select("*, users_with_profiles (nama)")
        .eq("id", paramsId)
        .single<MaterialRequest>();

      if (mrError) {
        setError(
          "Gagal memuat data Material Request. Mungkin data tidak ditemukan."
        );
        toast.error("Gagal memuat data", { description: mrError.message });
      } else {
        setMr(mrData);
      }
      setLoading(false);
    };

    if (paramsId) {
      fetchData();
    }
  }, [supabase, paramsId]);

  // --- Logika untuk Aksi Approval ---
  const handleApprovalAction = async (decision: "approved" | "rejected") => {
    if (!mr || !currentUser) return;
    setActionLoading(true);

    const approverIndex = mr.approvals.findIndex(
      (app) => app.userid === currentUser.id
    );
    const updatedApprovals = JSON.parse(JSON.stringify(mr.approvals));
    updatedApprovals[approverIndex].status = decision;

    let newMrStatus = mr.status;
    if (decision === "rejected") {
      newMrStatus = "Rejected";
    } else if (decision === "approved") {
      const isLastApproval = updatedApprovals.every(
        (app: { status: string }) => app.status === "approved"
      );
      if (isLastApproval) {
        newMrStatus = "Approved";
      }
    }

    const { error } = await supabase
      .from("material_requests")
      .update({ approvals: updatedApprovals, status: newMrStatus })
      .eq("id", mr.id);

    if (error) {
      toast.error("Aksi gagal", { description: error.message });
    } else {
      toast.success(
        `MR berhasil di-${decision === "approved" ? "setujui" : "tolak"}`
      );
      setMr((prevMr) =>
        prevMr
          ? { ...prevMr, approvals: updatedApprovals, status: newMrStatus }
          : null
      );
    }
    setActionLoading(false);
  };

  // Komponen untuk menampilkan tombol aksi
  const ApprovalActions = () => {
    if (!mr || !currentUser || mr.status !== "Pending") return null;

    const myApprovalIndex = mr.approvals.findIndex(
      (app) => app.userid === currentUser.id
    );
    if (
      myApprovalIndex === -1 ||
      mr.approvals[myApprovalIndex].status !== "pending"
    ) {
      return null; // Bukan approver atau sudah bertindak
    }

    const isMyTurn = mr.approvals
      .slice(0, myApprovalIndex)
      .every((app) => app.status === "approved");
    if (!isMyTurn) {
      return (
        <p className="text-sm text-muted-foreground text-center">
          Menunggu persetujuan dari approver sebelumnya.
        </p>
      );
    }

    return (
      <div className="flex gap-2">
        <Button
          className="w-full"
          onClick={() => handleApprovalAction("approved")}
          disabled={actionLoading}
        >
          {actionLoading ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <Check className="mr-2 h-4 w-4" />
          )}{" "}
          Setujui
        </Button>
        <Button
          variant="destructive"
          className="w-full"
          onClick={() => handleApprovalAction("rejected")}
          disabled={actionLoading}
        >
          {actionLoading ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <X className="mr-2 h-4 w-4" />
          )}{" "}
          Tolak
        </Button>
      </div>
    );
  };

  const getStatusBadge = (status: string) => {
    switch (status.toLowerCase()) {
      case "approved":
        return <Badge variant="outline">Approved</Badge>;
      case "rejected":
        return <Badge variant="destructive">Rejected</Badge>;
      case "pending":
        return <Badge variant="secondary">Pending</Badge>;
      default:
        return <Badge>{status}</Badge>;
    }
  };

  const getApprovalStatusBadge = (
    status: "pending" | "approved" | "rejected"
  ) => {
    switch (status) {
      case "approved":
        return (
          <Badge variant="outline" className="capitalize">
            {status}
          </Badge>
        );
      case "rejected":
        return (
          <Badge variant="destructive" className="capitalize">
            {status}
          </Badge>
        );
      default:
        return (
          <Badge variant="secondary" className="capitalize">
            {status}
          </Badge>
        );
    }
  };

  if (loading) {
    return (
      <div className="col-span-12">
        <DetailMRSkeleton />
      </div>
    );
  }

  if (error || !mr) {
    return (
      <div className="col-span-12 flex flex-col items-center justify-center h-96 text-center">
        <AlertTriangle className="w-16 h-16 text-destructive mb-4" />
        <h1 className="text-2xl font-bold">Data Tidak Ditemukan</h1>
        <p className="text-muted-foreground">{error}</p>
        <Button asChild variant="outline" className="mt-6">
          <Link href="/material-request">Kembali ke Daftar MR</Link>
        </Button>
      </div>
    );
  }

  return (
    <>
      <div className="col-span-12">
        <div className="flex flex-wrap justify-between items-center gap-4 mb-6">
          <div>
            <h1 className="text-3xl font-bold">{mr.kode_mr}</h1>
            <p className="text-muted-foreground">Detail Material Request</p>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-lg">Status:</span>
            {getStatusBadge(mr.status)}
          </div>
        </div>
      </div>

      <div className="col-span-12 lg:col-span-8 space-y-6">
        <Content title="Informasi Utama">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-x-6 gap-y-4">
            <InfoItem
              icon={CircleUser}
              label="Pembuat"
              value={mr.users_with_profiles?.nama || "N/A"}
            />
            <InfoItem
              icon={Building}
              label="Departemen"
              value={mr.department}
            />
            <InfoItem icon={Tag} label="Kategori" value={mr.kategori} />
            <InfoItem
              icon={Calendar}
              label="Tanggal Dibuat"
              value={formatDate(mr.created_at)}
            />
            <InfoItem
              icon={Calendar}
              label="Due Date"
              value={formatDate(mr.due_date)}
            />
            <InfoItem
              icon={DollarSign}
              label="Estimasi Biaya"
              value={formatCurrency(mr.cost_estimation)}
            />
            <div className="md:col-span-2">
              <InfoItem icon={Info} label="Remarks" value={mr.remarks} />
            </div>
          </div>
        </Content>
        <Content title="Order Items">
          <div className="rounded-md border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>No</TableHead>
                  <TableHead>Nama Item</TableHead>
                  <TableHead>Qty</TableHead>
                  <TableHead>UoM</TableHead>
                  <TableHead>Catatan</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {mr.orders.map((item, index) => (
                  <TableRow key={index}>
                    <TableCell>{index + 1}</TableCell>
                    <TableCell className="font-medium">
                      {item.name}
                      {item.url && (
                        <Link
                          href={item.url}
                          target="_blank"
                          className="ml-2 text-primary hover:underline"
                        >
                          <LinkIcon className="inline h-3 w-3" />
                        </Link>
                      )}
                    </TableCell>
                    <TableCell>{item.qty}</TableCell>
                    <TableCell>{item.uom}</TableCell>
                    <TableCell>{item.note || "-"}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </Content>
      </div>

      <div className="col-span-12 lg:col-span-4 space-y-6">
        <Content title="Tindakan Persetujuan">
          <ApprovalActions />
        </Content>
        <Content title="Jalur Approval">
          <ul className="space-y-4">
            {mr.approvals.map((approver, index) => (
              <li
                key={index}
                className="flex items-center justify-between gap-4"
              >
                <div>
                  <p className="font-semibold">{approver.nama}</p>
                  <p className="text-sm text-muted-foreground">
                    {approver.type}
                  </p>
                </div>
                {getApprovalStatusBadge(approver.status)}
              </li>
            ))}
          </ul>
        </Content>
        <Content title="Lampiran">
          <ul className="space-y-2">
            {mr.attachments.length > 0 ? (
              mr.attachments.map((file, index) => (
                <li key={index}>
                  <Link
                    href={`https://xdkjqwpvmyqcggpwghyi.supabase.co/storage/v1/object/public/mr/${file.url}`}
                    target="_blank"
                    className="flex items-center gap-2 text-sm text-primary hover:underline"
                  >
                    <Download className="h-4 w-4" />
                    <span>{file.name}</span>
                  </Link>
                </li>
              ))
            ) : (
              <p className="text-sm text-muted-foreground">
                Tidak ada lampiran.
              </p>
            )}
          </ul>
        </Content>
      </div>

      <div className="col-span-12">
        <DiscussionSection mrId={mr.id} initialDiscussions={mr.discussions} />
      </div>
    </>
  );
}

// Komponen Helper
const InfoItem = ({
  icon: Icon,
  label,
  value,
}: {
  icon: React.ElementType;
  label: string;
  value: string;
}) => (
  <div className="flex items-start gap-3">
    <Icon className="h-5 w-5 text-muted-foreground mt-1 flex-shrink-0" />
    <div>
      <p className="text-sm text-muted-foreground">{label}</p>
      <p className="font-medium">{value}</p>
    </div>
  </div>
);

// Komponen Skeleton
const DetailMRSkeleton = () => (
  <div className="col-span-12 animate-pulse">
    <div className="flex justify-between items-center mb-6">
      <div>
        <Skeleton className="h-8 w-48 mb-2" />
        <Skeleton className="h-4 w-64" />
      </div>
      <Skeleton className="h-8 w-24 rounded-full" />
    </div>
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
      <div className="lg:col-span-2 space-y-6">
        <Content>
          <div className="space-y-4">
            <Skeleton className="h-6 w-1/3 mb-4" />
            <div className="grid grid-cols-2 gap-4">
              <Skeleton className="h-12 w-full" />
              <Skeleton className="h-12 w-full" />
              <Skeleton className="h-12 w-full" />
              <Skeleton className="h-12 w-full" />
            </div>
          </div>
        </Content>
        <Content>
          <div className="space-y-4">
            <Skeleton className="h-6 w-1/3 mb-4" />
            <Skeleton className="h-32 w-full" />
          </div>
        </Content>
      </div>
      <div className="lg:col-span-1 space-y-6">
        <Content>
          <div className="space-y-4">
            <Skeleton className="h-6 w-1/2 mb-4" />
            <Skeleton className="h-10 w-full" />
            <Skeleton className="h-10 w-full" />
          </div>
        </Content>
        <Content>
          <div className="space-y-4">
            <Skeleton className="h-6 w-1/2 mb-4" />
            <Skeleton className="h-8 w-full" />
          </div>
        </Content>
      </div>
    </div>
  </div>
);
