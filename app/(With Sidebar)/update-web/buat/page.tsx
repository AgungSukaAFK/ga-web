// src/app/(With Sidebar)/update-web/buat/page.tsx
//
// Halaman buat postingan Update Web (admin only) - isian otomatis tersimpan
// sbg draft, lihat components/update-web/UpdatePostForm.tsx.

"use client";

import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Skeleton } from "@/components/ui/skeleton";
import { UpdatePostForm } from "@/components/update-web/UpdatePostForm";
import { useUpdateWebAdmin } from "@/hooks/use-update-web-admin";
import { fetchLatestUpdateWebPost } from "@/services/updateWebService";

type Version = { major: number; minor: number; patch: number };

export default function BuatUpdateWebPage() {
  const { userId, checking } = useUpdateWebAdmin();
  const [latestVersion, setLatestVersion] = useState<Version | null>(null);
  const [loadingLatest, setLoadingLatest] = useState(true);

  useEffect(() => {
    fetchLatestUpdateWebPost()
      .then((post) =>
        setLatestVersion(
          post
            ? {
                major: post.version_major,
                minor: post.version_minor,
                patch: post.version_patch,
              }
            : null,
        ),
      )
      .catch((error) =>
        toast.error("Gagal memuat versi terakhir", {
          description: error.message,
        }),
      )
      .finally(() => setLoadingLatest(false));
  }, []);

  if (checking || loadingLatest || !userId) {
    return <Skeleton className="col-span-12 h-[70vh] w-full rounded-xl" />;
  }

  return (
    <UpdatePostForm
      mode="create"
      userId={userId}
      latestVersion={latestVersion}
    />
  );
}
