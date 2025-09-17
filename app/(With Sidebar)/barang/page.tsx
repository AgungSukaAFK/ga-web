"use client";

import { ConfirmDialog } from "@/components/confirm-dialog";
import { Content } from "@/components/content";
import { PaginationComponent } from "@/components/pagination";
import { Button } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { createClient } from "@/lib/supabase/client";
import { useEffect, useState } from "react";
import { toast } from "sonner";

export default function BarangPage({
  searchParams,
}: {
  searchParams?: Promise<{ page?: string }>;
}) {
  const [page, setPage] = useState(1);
  const [totalItems, setTotalItems] = useState(0);
  const itemsPerPage = 25;
  const basePath = "/barang";

  const s = createClient();
  const [data, setData] = useState<any[]>([]);

  useEffect(() => {
    async function unwrapSearchParams() {
      if (searchParams) {
        const unwrapped = await searchParams;
        setPage(unwrapped.page ? parseInt(unwrapped.page) : 1);
      }
    }
    unwrapSearchParams();
  }, [searchParams]);

  useEffect(() => {
    async function fetchTotalItems() {
      const { count, error } = await s
        .from("barang")
        .select("*", { count: "exact", head: true });
      if (error) {
        toast.error("Gagal mengambil total data barang");
        return;
      }
      setTotalItems(count || 0);
    }
    fetchTotalItems();
  }, [s]);

  useEffect(() => {
    async function fetchData() {
      const { data, error } = await s
        .from("barang")
        .select("*")
        .range((page - 1) * itemsPerPage, page * itemsPerPage - 1);
      if (error) {
        toast.error("Gagal mengambil data barang");
        return;
      }
      setData(data || []);
    }
    fetchData();
  }, [s, page]);

  const handleDeleteBarang = async (id: string) => {
    const { error } = await s.from("barang").delete().eq("id", id);
    if (error) {
      toast.error("Gagal menghapus data barang");
      return;
    }
    setData((prevData) => prevData.filter((item) => item.id !== id));
    toast.success("Data barang berhasil dihapus");
  };

  // Cek role
  const [role, setRole] = useState<string>("");

  useEffect(() => {
    const fetchProfile = async () => {
      const { data: userData, error: userError } = await s.auth.getUser();
      if (userError || !userData.user) {
        setRole("");
        return;
      }
      const { data: profileData, error: profileError } = await s
        .from("profiles")
        .select("role")
        .eq("id", userData.user.id)
        .single();
      if (profileError || !profileData) {
        setRole("");
        return;
      }
      setRole(profileData.role);
    };
    fetchProfile();
  }, [s]);

  return (
    <>
      <Content
        title="Data Barang"
        description="Daftar barang yang tersedia."
        cardAction={
          role === "approver" && (
            <Button variant={"outline"}>
              <a href="/barang/tambah">Tambah barang</a>
            </Button>
          )
        }
        cardFooter={
          <div className="mt-8">
            <PaginationComponent
              currentPage={page}
              totalItems={totalItems}
              itemsPerPage={itemsPerPage}
              basePath={basePath}
            />
          </div>
        }
      >
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>No</TableHead>
              <TableHead>Part Number</TableHead>
              <TableHead>Part Name</TableHead>
              <TableHead>Kategori</TableHead>
              <TableHead>UoM</TableHead>
              <TableHead>Vendor</TableHead>
              {role === "approver" && <TableHead>Aksi</TableHead>}
            </TableRow>
          </TableHeader>
          <TableBody>
            {data?.map((item, index) => (
              <TableRow key={item.id}>
                <TableCell className="font-medium">{index + 1}</TableCell>
                <TableCell>{item.part_number}</TableCell>
                <TableCell>{item.part_name}</TableCell>
                <TableCell>{item.category}</TableCell>
                <TableCell>{item.uom}</TableCell>
                <TableCell>{item.vendor}</TableCell>
                {role === "approver" && (
                  <TableCell className="space-x-2">
                    <Button variant={"outline"} size={"sm"}>
                      <a href={`/barang/edit/${item.id}`}>Edit</a>
                    </Button>
                    <ConfirmDialog
                      title="Hapus data barang"
                      description="Apakah Anda yakin ingin menghapus data barang ini? Tindakan ini tidak dapat dibatalkan."
                      onConfirm={() => handleDeleteBarang(item.id)}
                    >
                      <Button variant={"destructive"} size={"sm"}>
                        Hapus
                      </Button>
                    </ConfirmDialog>
                  </TableCell>
                )}
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </Content>
    </>
  );
}
