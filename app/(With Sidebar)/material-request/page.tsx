"use client";

export interface MaterialRequest {
  id: string;
  userid: string;
  kode_mr: string;
  kategori: string;
  status: string;
  remarks: string;
  cost_estimation: string;
  department: string;
  created_at: Date;
  due_date?: Date;
  orders: Order[];
  approvals: Approval[];
  attachments: Attachment[];
  discussions: {}[];
}

interface Approval {
  type: string;
  status: string;
  userid: string;
  nama: string;
  email: string;
  role: string;
  department: string;
}

export interface Order {
  name: string;
  qty: string;
  uom: string;
  vendor: string;
  vendor_contact: string;
  note: string;
  url: string;
}

export interface Attachment {
  url: string;
  name: string;
}

type User = {
  id: string;
  nama: string;
  email: string;
  role: string;
  department: string;
};

import { Content } from "@/components/content";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { createClient } from "@/lib/supabase/client";
import { FileText, Newspaper, Printer, Search } from "lucide-react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { Suspense, useEffect, useState } from "react";
import { toast } from "sonner";

import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import * as XLSX from "xlsx";
import { PaginationComponent } from "@/components/pagination-components";

// --- Helper & Constants ---
const LIMIT_OPTIONS = [10, 25, 50, 100];
const formatDate = (dateString?: Date | string) => {
  if (!dateString) return "-";
  return new Date(dateString).toLocaleDateString("id-ID", {
    weekday: "long",
    year: "numeric",
    month: "long",
    day: "numeric",
  });
};

function MaterialRequestContent() {
  const s = createClient();
  const router = useRouter();
  const searchParams = useSearchParams();

  // --- State Management ---
  const [dataMR, setDataMR] = useState<MaterialRequest[]>([]);
  const [totalItems, setTotalItems] = useState(0);
  const [loading, setLoading] = useState(true);

  // --- Ambil state dari URL, berikan nilai default jika tidak ada ---
  const page = parseInt(searchParams.get("page") || "1", 10);
  const limit = parseInt(searchParams.get("limit") || "25", 10);
  const currentPage = isNaN(page) || page < 1 ? 1 : page;
  const itemsPerPage = LIMIT_OPTIONS.includes(limit) ? limit : 25;
  const totalPages = Math.ceil(totalItems / itemsPerPage);

  useEffect(() => {
    const fetchDataMR = async () => {
      setLoading(true);
      const from = (currentPage - 1) * itemsPerPage;
      const to = from + itemsPerPage - 1;

      try {
        const { data, error, count } = await s
          .from("material_requests")
          .select("*", { count: "exact" })
          .order("created_at", { ascending: false })
          .range(from, to);

        if (error) throw error;
        setDataMR(data || []);
        setTotalItems(count || 0);
      } catch (error: any) {
        toast.error("Gagal memuat data:", { description: error.message });
      } finally {
        setLoading(false);
      }
    };

    fetchDataMR();
  }, [s, currentPage, itemsPerPage]);

  const handleLimitChange = (newLimit: string) => {
    // Saat limit diubah, kembali ke halaman 1
    router.push(`/material-request?page=1&limit=${newLimit}`);
  };

  // --- Handler untuk Ekspor & Print ---
  const handlePrint = () => window.print();

  const handleDownloadExcel = () => {
    const worksheet = XLSX.utils.json_to_sheet(
      dataMR.map((mr) => ({
        "Kode MR": mr.kode_mr,
        Kategori: mr.kategori,
        Department: mr.department,
        Status: mr.status,
        Remarks: mr.remarks,
        "Estimasi Biaya": mr.cost_estimation,
        "Tanggal Dibuat": formatDate(mr.created_at),
        "Due Date": formatDate(mr.due_date),
      }))
    );
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, "Material Requests");
    XLSX.writeFile(workbook, "material_requests.xlsx");
    toast.success("File Excel berhasil diunduh!");
  };

  const handleDownloadPdf = () => {
    const doc = new jsPDF();
    autoTable(doc, {
      head: [
        [
          "Kode MR",
          "Kategori",
          "Department",
          "Status",
          "Tanggal Dibuat",
          "Due Date",
        ],
      ],
      body: dataMR.map((mr) => [
        mr.kode_mr,
        mr.kategori,
        mr.department,
        mr.status,
        formatDate(mr.created_at),
        formatDate(mr.due_date),
      ]),
    });
    doc.save("material_requests.pdf");
    toast.success("File PDF berhasil diunduh!");
  };

  // --- Mendapatkan informasi user ---
  const [currentUser, setCurrentUser] = useState<User | null>(null);

  // Ambil data user saat ini
  useEffect(() => {
    const fetchCurrentUser = async () => {
      const {
        data: { user },
        error,
      } = await s.auth.getUser();
      if (error || !user) {
        console.error("Error fetching current user:", error);
        toast.error("User tidak ditemukan. Silakan login kembali.");
        return;
      }
      const { data: profileData, error: profileError } = await s
        .from("users_with_profiles")
        .select("*")
        .eq("id", user.id)
        .single();
      if (profileError || !profileData) {
        console.error("Error fetching user profile:", profileError);
        toast.error("Gagal memuat data user. Silakan coba lagi.");
        return;
      }
      setCurrentUser(profileData);
    };
    fetchCurrentUser();
  }, []);

  return (
    <>
      <Content
        title="Daftar Material Request"
        description="Kelola seluruh data Material Request"
        cardAction={
          currentUser &&
          currentUser.role === "requester" && (
            <Button asChild>
              <Link href="/material-request/buat">Buat Material Request</Link>
            </Button>
          )
        }
      >
        <div className="flex flex-wrap items-center justify-between gap-4 mb-4">
          <div className="flex items-center gap-2">
            <Input placeholder="Cari Kode MR..." className="w-auto" />
            <Button variant="outline">
              <Search className="h-4 w-4" />
            </Button>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <Button onClick={handlePrint} variant="outline">
              <Printer className="mr-2 h-4 w-4" /> Cetak
            </Button>
            <Button onClick={handleDownloadExcel} variant="outline">
              <Newspaper className="mr-2 h-4 w-4" /> Excel
            </Button>
            <Button onClick={handleDownloadPdf} variant="outline">
              <FileText className="mr-2 h-4 w-4" /> PDF
            </Button>
          </div>
        </div>

        <div className="rounded-md border" id="printable-area">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>No</TableHead>
                <TableHead>Kode MR</TableHead>
                <TableHead>Kategori</TableHead>
                <TableHead>Department</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Tanggal Dibuat</TableHead>
                <TableHead>Due Date</TableHead>
                <TableHead>Aksi</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {loading ? (
                Array.from({ length: 5 }).map((_, i) => (
                  <TableRow key={i}>
                    <TableCell colSpan={8}>
                      <Skeleton className="h-8 w-full" />
                    </TableCell>
                  </TableRow>
                ))
              ) : dataMR.length > 0 ? (
                dataMR.map((mr, index) => (
                  <TableRow key={mr.id}>
                    <TableCell>
                      {(currentPage - 1) * itemsPerPage + index + 1}
                    </TableCell>
                    <TableCell className="font-medium">{mr.kode_mr}</TableCell>
                    <TableCell>{mr.kategori}</TableCell>
                    <TableCell>{mr.department}</TableCell>
                    <TableCell>{mr.status}</TableCell>
                    <TableCell>{formatDate(mr.created_at)}</TableCell>
                    <TableCell>{formatDate(mr.due_date)}</TableCell>
                    <TableCell>
                      <Button asChild variant="outline" size="sm">
                        <Link href={`/material-request/${mr.id}`}>View</Link>
                      </Button>
                    </TableCell>
                  </TableRow>
                ))
              ) : (
                <TableRow>
                  <TableCell colSpan={8} className="text-center h-24">
                    Tidak ada data ditemukan.
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </div>

        <div className="flex flex-wrap items-center justify-between gap-4 mt-4">
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <span>Tampilkan</span>
            <Select
              value={String(itemsPerPage)}
              onValueChange={handleLimitChange}
            >
              <SelectTrigger className="w-[70px]">
                <SelectValue placeholder={itemsPerPage} />
              </SelectTrigger>
              <SelectContent>
                {LIMIT_OPTIONS.map((opt) => (
                  <SelectItem key={opt} value={String(opt)}>
                    {opt}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <span>dari {totalItems} data</span>
          </div>
          <PaginationComponent
            currentPage={currentPage}
            totalPages={totalPages}
            basePath="/material-request"
            limit={itemsPerPage}
          />
        </div>
      </Content>
    </>
  );
}

// Bungkus komponen utama dengan Suspense
export default function MaterialRequestPage() {
  return (
    <Suspense fallback={<div>Memuat Halaman...</div>}>
      <MaterialRequestContent />
    </Suspense>
  );
}
