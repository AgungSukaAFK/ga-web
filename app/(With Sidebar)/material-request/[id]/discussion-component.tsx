// src/app/material-request/[id]/discussion-section.tsx

"use client";

import { useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { useRouter } from "next/navigation";
import { Discussion, DiscussionSubmitPayload } from "@/type";
import { logActivity } from "@/services/logService";
import { sendNotification } from "@/lib/notifications/client";
import { DiscussionPanel } from "@/components/discussion-panel";

interface DiscussionSectionProps {
  mrId: string;
  initialDiscussions: Discussion[];
}

export function DiscussionSection({
  mrId,
  initialDiscussions,
}: DiscussionSectionProps) {
  const [discussions, setDiscussions] = useState(initialDiscussions);
  const supabase = createClient();
  const router = useRouter();

  const submit = async (payload: DiscussionSubmitPayload) => {
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) throw new Error("Anda harus login untuk mengirim pesan.");

    const { data: profile } = await supabase
      .from("profiles")
      .select("nama")
      .eq("id", user.id)
      .single();
    const userName = profile?.nama || user.email || "Unknown User";

    const newDiscussionEntry: Discussion = {
      user_id: user.id,
      user_name: userName,
      timestamp: new Date().toISOString(),
      ...payload,
    };

    const updatedDiscussions = [...discussions, newDiscussionEntry];

    const { error } = await supabase
      .from("material_requests")
      .update({ discussions: updatedDiscussions })
      .eq("id", mrId);

    if (error) throw error;

    await logActivity(
      user.id,
      "ADD_MR_DISCUSSION",
      "material_request",
      String(mrId),
      `${userName} menambahkan pesan diskusi pada MR ini.`,
      { message: payload.message },
    );

    const userMentions = (payload.mentions ?? []).filter((m) => m.type === "user");
    await Promise.all(
      userMentions
        .filter((m) => m.id !== user.id)
        .map((m) =>
          sendNotification({
            userId: m.id,
            actorId: user.id,
            type: "mention",
            title: "Anda di-tag dalam diskusi",
            message: `${userName} men-tag Anda dalam diskusi MR.`,
            link: `/material-request/${mrId}`,
            resourceId: String(mrId),
            resourceType: "material_request",
          }),
        ),
    );

    setDiscussions(updatedDiscussions);
    router.refresh();
  };

  return (
    <DiscussionPanel
      discussions={discussions}
      onSubmit={submit}
      storagePathPrefix={`discussions/material-request/${mrId}`}
    />
  );
}
