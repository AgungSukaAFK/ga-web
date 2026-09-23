// src/services/pcDiscussionService.ts
//
// "Kirim pesan diskusi" untuk 3 dokumen Petty Cash (Pengajuan/Voucher/
// Deklarasi) - lewat RPC (supabase/petty-cash-discussion-rpc-setup.sql),
// BUKAN .update() langsung ke kolom `discussions`, karena siapa pun yang
// login boleh ikut diskusi (bukan cuma pemilik/approver yang gilirannya
// pending) - lihat komentar SECURITY DEFINER di file SQL itu untuk kenapa
// harus lewat RPC yang dibatasi ketat, bukan policy RLS UPDATE yang longgar.

import { createClient } from "@/lib/supabase/client";

const supabase = createClient();

export const addPengajuanDiscussion = async (
  id: number,
  message: string,
): Promise<void> => {
  const { error } = await supabase.rpc(
    "add_petty_cash_pengajuan_discussion",
    { p_id: id, p_message: message },
  );
  if (error) throw error;
};

export const addVoucherDiscussion = async (
  id: number,
  message: string,
): Promise<void> => {
  const { error } = await supabase.rpc("add_petty_cash_voucher_discussion", {
    p_id: id,
    p_message: message,
  });
  if (error) throw error;
};

export const addDeklarasiDiscussion = async (
  id: number,
  message: string,
): Promise<void> => {
  const { error } = await supabase.rpc(
    "add_petty_cash_deklarasi_discussion",
    { p_id: id, p_message: message },
  );
  if (error) throw error;
};
