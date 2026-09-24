// src/services/pcDiscussionService.ts
//
// "Kirim pesan diskusi" untuk 3 dokumen Petty Cash (Pengajuan/Voucher/
// Deklarasi) - lewat RPC (supabase/petty-cash-discussion-rpc-setup.sql +
// petty-cash-discussion-rich-content-setup.sql), BUKAN .update() langsung ke
// kolom `discussions`, karena siapa pun yang login boleh ikut diskusi (bukan
// cuma pemilik/approver yang gilirannya pending) - lihat komentar SECURITY
// DEFINER di file SQL itu untuk kenapa harus lewat RPC yang dibatasi ketat,
// bukan policy RLS UPDATE yang longgar.

import { createClient } from "@/lib/supabase/client";
import { JSONContent } from "@tiptap/react";
import { DiscussionMention } from "@/type";

const supabase = createClient();

export interface PcDiscussionPayload {
  message: string;
  content?: JSONContent;
  mentions?: DiscussionMention[];
}

export const addPengajuanDiscussion = async (
  id: number,
  payload: PcDiscussionPayload,
): Promise<void> => {
  const { error } = await supabase.rpc(
    "add_petty_cash_pengajuan_discussion",
    {
      p_id: id,
      p_message: payload.message,
      p_content: payload.content ?? null,
      p_mentions: payload.mentions ?? [],
    },
  );
  if (error) throw error;
};

export const addVoucherDiscussion = async (
  id: number,
  payload: PcDiscussionPayload,
): Promise<void> => {
  const { error } = await supabase.rpc("add_petty_cash_voucher_discussion", {
    p_id: id,
    p_message: payload.message,
    p_content: payload.content ?? null,
    p_mentions: payload.mentions ?? [],
  });
  if (error) throw error;
};

export const addDeklarasiDiscussion = async (
  id: number,
  payload: PcDiscussionPayload,
): Promise<void> => {
  const { error } = await supabase.rpc(
    "add_petty_cash_deklarasi_discussion",
    {
      p_id: id,
      p_message: payload.message,
      p_content: payload.content ?? null,
      p_mentions: payload.mentions ?? [],
    },
  );
  if (error) throw error;
};
