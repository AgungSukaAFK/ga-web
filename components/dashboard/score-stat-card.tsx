"use client";

import { useState } from "react";
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
import { Badge } from "@/components/ui/badge";
import { cn, formatDateFriendly } from "@/lib/utils";
import { GaugeCircle } from "lucide-react";
import { AgeGrade, GRADE_THRESHOLDS, ScoreResult } from "@/services/dashboardService";

const PAGE_SIZE = 10;

const GRADE_COLORS: Record<AgeGrade, string> = {
  A: "text-emerald-600 bg-emerald-50 border-emerald-200 dark:text-emerald-400 dark:bg-emerald-950/40 dark:border-emerald-800",
  B: "text-sky-600 bg-sky-50 border-sky-200 dark:text-sky-400 dark:bg-sky-950/40 dark:border-sky-800",
  C: "text-yellow-600 bg-yellow-50 border-yellow-200 dark:text-yellow-400 dark:bg-yellow-950/40 dark:border-yellow-800",
  D: "text-orange-600 bg-orange-50 border-orange-200 dark:text-orange-400 dark:bg-orange-950/40 dark:border-orange-800",
  E: "text-red-600 bg-red-50 border-red-200 dark:text-red-400 dark:bg-red-950/40 dark:border-red-800",
};

const GRADE_RING_COLORS: Record<AgeGrade, string> = {
  A: "border-emerald-500 text-emerald-600 dark:text-emerald-400",
  B: "border-sky-500 text-sky-600 dark:text-sky-400",
  C: "border-yellow-500 text-yellow-600 dark:text-yellow-400",
  D: "border-orange-500 text-orange-600 dark:text-orange-400",
  E: "border-red-500 text-red-600 dark:text-red-400",
};

interface ScoreStatCardProps {
  title: string;
  description: string;
  score: ScoreResult | null;
  loading?: boolean;
}

export function ScoreStatCard({ title, description, score, loading }: ScoreStatCardProps) {
  const [open, setOpen] = useState(false);
  const [page, setPage] = useState(1);

  const grade = score?.grade ?? null;
  const entries = score?.entries ?? [];
  const totalPages = Math.max(1, Math.ceil(entries.length / PAGE_SIZE));
  const pageRows = entries.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);
  const rangeStart = pageRows.length > 0 ? (page - 1) * PAGE_SIZE + 1 : 0;
  const rangeEnd = (page - 1) * PAGE_SIZE + pageRows.length;

  const handleOpenChange = (next: boolean) => {
    setOpen(next);
    if (!next) setPage(1);
  };

  return (
    <>
      <button type="button" onClick={() => setOpen(true)} className="text-left w-full h-full">
        <Card className="h-full flex flex-col gap-2 p-4 hover:border-primary/50 hover:shadow-sm transition-colors cursor-pointer">
          <div className="flex justify-between items-start gap-2">
            <h3 className="text-sm font-medium text-muted-foreground leading-tight">
              {title}
            </h3>
            <GaugeCircle className="h-5 w-5 flex-shrink-0 text-muted-foreground" />
          </div>
          {loading ? (
            <Skeleton className="h-9 w-16" />
          ) : grade ? (
            <div className="flex items-center gap-2">
              <span
                className={cn(
                  "flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-full border-2 text-lg font-black",
                  GRADE_RING_COLORS[grade],
                )}
              >
                {grade}
              </span>
              <span className="text-sm text-muted-foreground">
                {score!.avgDays.toFixed(1)} hari rata-rata
              </span>
            </div>
          ) : (
            <p className="text-2xl font-bold text-muted-foreground">-</p>
          )}
          <p className="text-xs text-muted-foreground mt-auto">
            {loading || !grade
              ? description
              : `${description} · ${score!.count} data`}
          </p>
        </Card>
      </button>

      <Dialog open={open} onOpenChange={handleOpenChange}>
        <DialogContent className="w-[80vw] max-w-[80vw] sm:max-w-[80vw] max-h-[80vh] flex flex-col">
          <DialogHeader>
            <DialogTitle>{title}</DialogTitle>
            <DialogDescription>{description}</DialogDescription>
          </DialogHeader>

          <div className="space-y-4 overflow-y-auto pr-1">
            {/* Ringkasan rata-rata */}
            <div className="rounded-md border p-3 flex items-center gap-4">
              {grade ? (
                <span
                  className={cn(
                    "flex h-14 w-14 flex-shrink-0 items-center justify-center rounded-full border-2 text-2xl font-black",
                    GRADE_RING_COLORS[grade],
                  )}
                >
                  {grade}
                </span>
              ) : (
                <span className="flex h-14 w-14 flex-shrink-0 items-center justify-center rounded-full border-2 border-muted text-2xl font-black text-muted-foreground">
                  -
                </span>
              )}
              <div>
                <p className="text-sm text-muted-foreground">Rata-rata umur periode ini</p>
                <p className="text-xl font-bold">
                  {grade ? `${score!.avgDays.toFixed(1)} Hari` : "Belum ada data selesai"}
                </p>
                <p className="text-xs text-muted-foreground">
                  Dihitung dari {score?.count ?? 0} data yang sudah Full Received
                </p>
              </div>
            </div>

            {/* Legenda grading */}
            <div>
              <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground mb-2">
                Keterangan Grading
              </p>
              <div className="grid grid-cols-5 gap-1.5">
                {GRADE_THRESHOLDS.map((g) => (
                  <div
                    key={g.grade}
                    className={cn(
                      "flex flex-col items-center justify-center gap-0.5 rounded-md border px-1 py-2 text-center",
                      g.grade === grade
                        ? GRADE_COLORS[g.grade]
                        : "border-input text-muted-foreground",
                    )}
                  >
                    <span className="text-sm font-bold">{g.grade}</span>
                    <span className="text-[9px] leading-tight">{g.label}</span>
                  </div>
                ))}
              </div>
            </div>

            {/* Tabel data aktual */}
            <div className="rounded-md border overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Kode</TableHead>
                    <TableHead>Dibuat</TableHead>
                    <TableHead>Selesai</TableHead>
                    <TableHead className="text-right">Umur</TableHead>
                    <TableHead className="text-center">Grade</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {pageRows.length > 0 ? (
                    pageRows.map((row) => (
                      <TableRow key={row.id}>
                        <TableCell className="font-medium">{row.kode}</TableCell>
                        <TableCell>{formatDateFriendly(row.created_at)}</TableCell>
                        <TableCell>{formatDateFriendly(row.full_received_at)}</TableCell>
                        <TableCell className="text-right">
                          {row.age_days.toFixed(1)} hari
                        </TableCell>
                        <TableCell className="text-center">
                          <Badge variant="outline" className={cn("font-bold", GRADE_COLORS[row.grade])}>
                            {row.grade}
                          </Badge>
                        </TableCell>
                      </TableRow>
                    ))
                  ) : (
                    <TableRow>
                      <TableCell colSpan={5} className="text-center h-24 text-muted-foreground">
                        Tidak ada data selesai pada periode ini.
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </div>
          </div>

          <div className="flex flex-col sm:flex-row items-center justify-between gap-2 pt-2">
            <p className="text-xs text-muted-foreground">
              Menampilkan {rangeStart}-{rangeEnd} dari {entries.length} data
            </p>
            <CustomPagination currentPage={page} totalPages={totalPages} onPageChange={setPage} />
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
