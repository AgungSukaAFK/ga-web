// src/services/pcDiscussionService.ts
//
// "Kirim pesan diskusi" untuk 3 dokumen Petty Cash (Pengajuan/Voucher/
// Deklarasi) - lewat RPC (supabase/migrations/0004_petty_cash.sql (asal: petty_cash_discussion_rpc_setup.sql) +
// supabase/migrations/0004_petty_cash.sql (asal: petty_cash_discussion_rich_content_setup.sql) +
// supabase/migrations/0004_petty_cash.sql (asal: petty_cash_discussion_attachment_setup.sql)), BUKAN .update() langsung ke
// kolom `discussions`, karena siapa pun yang login boleh ikut diskusi (bukan
// cuma pemilik/approver yang gilirannya pending) - lihat komentar SECURITY
// DEFINER di file SQL itu untuk kenapa harus lewat RPC yang dibatasi ketat,
// bukan policy RLS UPDATE yang longgar.

import { createClient } from "@/lib/supabase/client";
import { DiscussionSubmitPayload } from "@/type";

const supabase = createClient();

// Alias - dipakai components/discussion-panel.tsx lewat halaman-halaman
// petty cash. Sama persis dengan payload yang dikirim buat MR/PO.
export type PcDiscussionPayload = DiscussionSubmitPayload;

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
      p_attachment: payload.attachment ?? null,
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
    p_attachment: payload.attachment ?? null,
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
      p_attachment: payload.attachment ?? null,
    },
  );
  if (error) throw error;
};

export const addSubVoucherDiscussion = async (
  id: number,
  payload: PcDiscussionPayload,
): Promise<void> => {
  const { error } = await supabase.rpc(
    "add_petty_cash_sub_voucher_discussion",
    {
      p_id: id,
      p_message: payload.message,
      p_content: payload.content ?? null,
      p_mentions: payload.mentions ?? [],
      p_attachment: payload.attachment ?? null,
    },
  );
  if (error) throw error;
};
