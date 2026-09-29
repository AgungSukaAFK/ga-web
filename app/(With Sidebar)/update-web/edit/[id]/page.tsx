// src/app/(With Sidebar)/update-web/edit/[id]/page.tsx
//
// Halaman edit postingan Update Web (admin only) - perubahan otomatis
// tersimpan sbg draft per post, lihat components/update-web/UpdatePostForm.tsx.

"use client";

import { use, useEffect, useState } from "react";
import Link from "next/link";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import { Content } from "@/components/content";
import { UpdatePostForm } from "@/components/update-web/UpdatePostForm";
import { useUpdateWebAdmin } from "@/hooks/use-update-web-admin";
import { fetchUpdateWebPostById } from "@/services/updateWebService";
import { UpdateWebPost } from "@/type/update-web";

export default function EditUpdateWebPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = use(params);
  const postId = Number(id);
  const { userId, checking } = useUpdateWebAdmin();
  const [post, setPost] = useState<UpdateWebPost | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!Number.isInteger(postId)) {
      setError("ID postingan tidak valid.");
      return;
    }
    fetchUpdateWebPostById(postId)
      .then(setPost)
      .catch((e) => setError(e.message ?? "Postingan tidak ditemukan."));
  }, [postId]);

  if (error) {
    return (
      <Content title="Edit Update Web" description={error}>
        <Button variant="outline" asChild>
          <Link href="/update-web">Kembali ke Update Web</Link>
        </Button>
      </Content>
    );
  }

  if (checking || !userId || !post) {
    return <Skeleton className="col-span-12 h-[70vh] w-full rounded-xl" />;
  }

  return (
    <UpdatePostForm
      mode="edit"
      userId={userId}
      initialPost={post}
      latestVersion={null}
    />
  );
}
