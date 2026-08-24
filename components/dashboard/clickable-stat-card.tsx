"use client";

import { useEffect, useState } from "react";
import { Card } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { CustomPagination } from "@/components/custom-pagination";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";

const PAGE_SIZE = 10;

interface BaseProps {
  title: string;
  value: number | undefined;
  description: string;
  icon: React.ElementType;
  colorClass?: string;
  loading?: boolean;
  columns: string[];
}

// Server-paginated - dipakai kartu berbasis tabel yang bisa di-query
// langsung (MR/PO by status). `fetchPage` cuma dipanggil pas modal-nya
// dibuka/ganti halaman, bukan pas card-nya sekadar dirender.
interface ServerModeProps<T> extends BaseProps {
  mode: "server";
  fetchPage: (page: number, limit: number) => Promise<{ rows: T[]; count: number }>;
  renderRow: (row: T) => React.ReactNode;
}

// Client-paginated - dipakai kartu yang datanya udah kepaksa di-fetch
// sekaligus di parent (mis. status barang dari JSONB `orders`, gak bisa
// di-query/di-paginate langsung server-side). Tetap scrollable & paginated
// di UI, cuma paginasinya .slice() di memori, bukan round-trip server.
interface ClientModeProps<T> extends BaseProps {
  mode: "client";
  items: T[];
  renderRow: (row: T) => React.ReactNode;
}

type ClickableStatCardProps<T> = ServerModeProps<T> | ClientModeProps<T>;

export function ClickableStatCard<T>(props: ClickableStatCardProps<T>) {
  const { title, value, description, icon: Icon, colorClass, loading, columns } =
    props;
  const [open, setOpen] = useState(false);
  const [page, setPage] = useState(1);
  const [rows, setRows] = useState<T[]>([]);
  const [count, setCount] = useState(0);
  const [modalLoading, setModalLoading] = useState(false);

  useEffect(() => {
    if (!open) return;

    if (props.mode === "client") {
      setCount(props.items.length);
      setRows(props.items.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE));
      return;
    }

    let cancelled = false;
    setModalLoading(true);
    props
      .fetchPage(page, PAGE_SIZE)
      .then((result) => {
        if (cancelled) return;
        setRows(result.rows);
        setCount(result.count);
      })
      .finally(() => {
        if (!cancelled) setModalLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [open, page]);

  const handleOpenChange = (next: boolean) => {
    setOpen(next);
    if (!next) {
      setPage(1);
      setRows([]);
      setCount(0);
    }
  };

  const totalPages = Math.max(1, Math.ceil(count / PAGE_SIZE));
  const rangeStart = rows.length > 0 ? (page - 1) * PAGE_SIZE + 1 : 0;
  const rangeEnd = (page - 1) * PAGE_SIZE + rows.length;

  return (
    <>
      <button type="button" onClick={() => setOpen(true)} className="text-left w-full h-full">
        <Card className="h-full flex flex-col gap-2 p-4 hover:border-primary/50 hover:shadow-sm transition-colors cursor-pointer">
          <div className="flex justify-between items-start gap-2">
            <h3 className="text-sm font-medium text-muted-foreground leading-tight">
              {title}
            </h3>
            <Icon
              className={cn(
                "h-5 w-5 flex-shrink-0",
                colorClass || "text-muted-foreground",
              )}
            />
          </div>
          {loading ? (
            <Skeleton className="h-9 w-16" />
          ) : (
            <p className="font-bold text-3xl">{value ?? 0}</p>
          )}
          <p className="text-xs text-muted-foreground mt-auto">{description}</p>
        </Card>
      </button>

      <Dialog open={open} onOpenChange={handleOpenChange}>
        <DialogContent className="w-[80vw] max-w-[80vw] sm:max-w-[80vw] max-h-[80vh] flex flex-col">
          <DialogHeader>
            <DialogTitle>{title}</DialogTitle>
            <DialogDescription>{description}</DialogDescription>
          </DialogHeader>
          <div className="flex-1 overflow-auto rounded-md border">
            <Table>
              <TableHeader>
                <TableRow>
                  {columns.map((col) => (
                    <TableHead key={col}>{col}</TableHead>
                  ))}
                </TableRow>
              </TableHeader>
              <TableBody>
                {modalLoading ? (
                  Array.from({ length: 5 }).map((_, i) => (
                    <TableRow key={i}>
                      <TableCell colSpan={columns.length}>
                        <Skeleton className="h-8 w-full" />
                      </TableCell>
                    </TableRow>
                  ))
                ) : rows.length > 0 ? (
                  rows.map((row, i) => (
                    <TableRow key={i}>{props.renderRow(row)}</TableRow>
                  ))
                ) : (
                  <TableRow>
                    <TableCell
                      colSpan={columns.length}
                      className="text-center h-24 text-muted-foreground"
                    >
                      Tidak ada data.
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </div>
          <div className="flex flex-col sm:flex-row items-center justify-between gap-2 pt-2">
            <p className="text-xs text-muted-foreground">
              Menampilkan {rangeStart}-{rangeEnd} dari {count} data
            </p>
            <CustomPagination
              currentPage={page}
              totalPages={totalPages}
              onPageChange={setPage}
            />
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
