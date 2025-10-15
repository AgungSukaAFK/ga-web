// src/app/(With Sidebar)/material-request/[id]/page.tsx

"use client";

import { use, useEffect, useState, Suspense } from "react";
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
import { Skeleton } from "@/components/ui/skeleton";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { User } from "@supabase/supabase-js";
import { MaterialRequest, Approval, Discussion } from "@/type"; // Menggunakan tipe dari file terpusat
import { formatCurrency, formatDateFriendly } from "@/lib/utils"; // Menggunakan formatDateFriendly
import { DiscussionSection } from "./discussion-component";

function DetailMRPageContent({ params }: { params: { id: string } }) {
  const mrId = parseInt(params.id);

  const [mr, setMr] = useState<MaterialRequest | null>(null);
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const supabase = createClient();

  useEffect(() => {
    const fetchData = async () => {
      setLoading(true);
      setError(null);

      const {
        data: { user },
      } = await supabase.auth.getUser();
      setCurrentUser(user);

      if (isNaN(mrId)) {
        setError("ID Material Request tidak valid.");
        setLoading(false);
        return;
      }

      const { data: mrData, error: mrError } = await supabase
        .from("material_requests")
        .select("*, users_with_profiles!userid(nama)")
        .eq("id", mrId)
        .single();

      if (mrError) {
        setError("Gagal memuat data MR.");
        toast.error("Gagal memuat data", { description: mrError.message });
      } else {
        setMr(mrData as any);
      }
      setLoading(false);
    };

    fetchData();
  }, [supabase, mrId]);

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
        (app: Approval) => app.status === "approved"
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

  const ApprovalActions = () => {
    if (!mr || !currentUser || mr.status !== "Pending Approval") return null;

    const myApprovalIndex = mr.approvals.findIndex(
      (app) => app.userid === currentUser.id
    );
    if (
      myApprovalIndex === -1 ||
      mr.approvals[myApprovalIndex].status !== "pending"
    ) {
      return null;
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
      case "pending approval":
        return <Badge variant="secondary">Pending Approval</Badge>;
      case "pending validation":
        return <Badge variant="secondary">Pending Validation</Badge>;
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

  if (loading) return <DetailMRSkeleton />;
  if (error || !mr)
    return (
      <Content className="col-span-12">
        <div className="flex flex-col items-center justify-center h-96 text-center">
          <AlertTriangle className="w-16 h-16 text-destructive mb-4" />
          <h1 className="text-2xl font-bold">Data Tidak Ditemukan</h1>
          <p className="text-muted-foreground">{error}</p>
          <Button asChild variant="outline" className="mt-6">
            <Link href="/material-request">Kembali ke Daftar MR</Link>
          </Button>
        </div>
      </Content>
    );

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
              value={(mr as any).users_with_profiles?.nama || "N/A"}
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
              value={formatDateFriendly(mr.created_at)}
            />
            <InfoItem
              icon={Calendar}
              label="Due Date"
              value={formatDateFriendly(mr.due_date)}
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
                  <TableHead>Nama Item</TableHead>
                  <TableHead>Qty</TableHead>
                  <TableHead>Vendor</TableHead>
                  <TableHead>Link</TableHead>
                  <TableHead>Catatan</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {mr.orders.map((item, index) => (
                  <TableRow key={index}>
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
                    <TableCell>
                      {item.qty} {item.uom}
                    </TableCell>
                    <TableCell>{item.vendor || "-"}</TableCell>
                    <TableCell>
                      <Button asChild variant={"outline"}>
                        <Link href={item.url}>View Link</Link>
                      </Button>
                    </TableCell>
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
          {mr.approvals.length > 0 ? (
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
                  {getApprovalStatusBadge(
                    approver.status as "approved" | "rejected" | "pending"
                  )}
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-sm text-muted-foreground text-center">
              Jalur approval belum ditentukan oleh GA.
            </p>
          )}
        </Content>
        <Content title="Lampiran">
          {mr.attachments.length > 0 ? (
            <ul className="space-y-2">
              {mr.attachments.map((file, index) => (
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
              ))}
            </ul>
          ) : (
            <p className="text-sm text-muted-foreground">Tidak ada lampiran.</p>
          )}
        </Content>
      </div>

      <div className="col-span-12">
        <DiscussionSection
          mrId={String(mr.id)}
          initialDiscussions={mr.discussions as Discussion[]}
        />
      </div>
    </>
  );
}

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

const DetailMRSkeleton = () => (
  <>
    <div className="col-span-12">
      <Skeleton className="h-12 w-1/2" />
    </div>
    <Content className="col-span-12 lg:col-span-8">
      <Skeleton className="h-64 w-full" />
    </Content>
    <Content className="col-span-12 lg:col-span-4">
      <Skeleton className="h-64 w-full" />
    </Content>
  </>
);

// Bungkus dengan Suspense
export default function DetailMRPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const resolvedParams = use(params);
  return (
    <Suspense fallback={<DetailMRSkeleton />}>
      <DetailMRPageContent params={resolvedParams} />
    </Suspense>
  );
}
