"use client";

import { ReactNode, Suspense, useCallback, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";

// Sengaja tidak meng-import tracking-card: file ini ikut bundle awal halaman
// list, sedangkan kartunya baru dimuat saat modal dibuka.

export type QuickTrackingState<Data> =
  | { status: "loading" }
  | { status: "ready"; data: Data }
  | { status: "error" };

export const useQuickTracking = <Row extends object, Data>(
  fetchData: (row: Row) => Promise<Data>,
) => {
  const [state, setState] = useState<QuickTrackingState<Data>>({
    status: "loading",
  });
  const latestRow = useRef<Row | null>(null);

  const load = useCallback(
    (row: Row) => {
      latestRow.current = row;
      setState({ status: "loading" });
      fetchData(row).then(
        (data) => {
          // Respons baris lama tidak boleh menimpa modal baris yang baru.
          if (latestRow.current === row) setState({ status: "ready", data });
        },
        (error) => {
          console.error("Gagal memuat data lacak:", error);
          if (latestRow.current === row) setState({ status: "error" });
        },
      );
    },
    [fetchData],
  );

  const retry = useCallback(() => {
    if (latestRow.current) load(latestRow.current);
  }, [load]);

  return { state, load, retry };
};

const TrackingSkeleton = ({ title }: { title: string }) => (
  <Card className="gap-0 py-0" aria-busy="true">
    <div className="flex items-center gap-3 p-4">
      <Skeleton className="h-10 w-10 shrink-0 rounded-full" />
      <div className="min-w-0 flex-1 space-y-1.5">
        <p className="text-xs font-medium text-muted-foreground">{title}</p>
        <Skeleton className="h-5 w-2/3 max-w-sm" />
      </div>
    </div>
  </Card>
);

export const QuickTrackingSlot = <Data,>({
  title,
  state,
  onRetry,
  children,
}: {
  title: string;
  state: QuickTrackingState<Data>;
  onRetry: () => void;
  children: (data: Data) => ReactNode;
}) => {
  if (state.status === "loading") return <TrackingSkeleton title={title} />;

  if (state.status === "error") {
    return (
      <Card className="flex-row items-center justify-between gap-3 p-4">
        <p className="text-sm text-muted-foreground">{title} gagal dimuat.</p>
        <Button variant="outline" size="sm" onClick={onRetry}>
          Coba lagi
        </Button>
      </Card>
    );
  }

  return (
    <Suspense fallback={<TrackingSkeleton title={title} />}>
      {children(state.data)}
    </Suspense>
  );
};
