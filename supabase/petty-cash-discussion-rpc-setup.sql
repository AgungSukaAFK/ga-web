-- RPC "kirim pesan diskusi" untuk 3 dokumen Petty Cash (Pengajuan/Voucher/
-- Deklarasi) - dipakai PcDiscussionPanel (components/petty-cash/) supaya
-- SEMUA user login bisa ikut diskusi di dokumen siapa pun (bukan dibatasi ke
-- pemilik/approver yang gilirannya pending saja), TANPA perlu membuka akses
-- UPDATE penuh ke seluruh baris lewat policy RLS yang longgar (yang bisa
-- disalahgunakan buat ubah status/approvals/items lewat request mentah).
--
-- SECURITY DEFINER: fungsi INI CUMA PERNAH menyentuh kolom `discussions` -
-- parameternya cuma id dokumen & isi pesan, jadi walau dieksekusi dengan
-- privilese pemilik tabel (bypass RLS), tidak ada jalan buat ubah kolom lain
-- lewat fungsi ini. updated_at/updated_by tetap ke-set otomatis oleh trigger
-- audit yang sudah ada (handle_petty_cash_*_audit) - tidak perlu diulang di
-- sini.
--
-- Jalankan SEKALI lewat SQL Editor Supabase (project utama), SETELAH
-- petty-cash-pengajuan-setup.sql, petty-cash-voucher-setup.sql, &
-- petty-cash-deklarasi-setup.sql.

create or replace function public.add_petty_cash_pengajuan_discussion(
  p_id bigint,
  p_message text
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_name text;
begin
  if trim(coalesce(p_message, '')) = '' then
    raise exception 'Pesan tidak boleh kosong.';
  end if;

  select coalesce(nama, email, 'Unknown User') into v_name
  from public.profiles where id = auth.uid();

  update public.petty_cash_pengajuan
  set discussions = coalesce(discussions, '[]'::jsonb) || jsonb_build_array(
    jsonb_build_object(
      'user_id', auth.uid(),
      'user_name', v_name,
      'message', p_message,
      'timestamp', now()
    )
  )
  where id = p_id;
end;
$$;

grant execute on function public.add_petty_cash_pengajuan_discussion(bigint, text) to authenticated;

create or replace function public.add_petty_cash_voucher_discussion(
  p_id bigint,
  p_message text
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_name text;
begin
  if trim(coalesce(p_message, '')) = '' then
    raise exception 'Pesan tidak boleh kosong.';
  end if;

  select coalesce(nama, email, 'Unknown User') into v_name
  from public.profiles where id = auth.uid();

  update public.petty_cash_voucher
  set discussions = coalesce(discussions, '[]'::jsonb) || jsonb_build_array(
    jsonb_build_object(
      'user_id', auth.uid(),
      'user_name', v_name,
      'message', p_message,
      'timestamp', now()
    )
  )
  where id = p_id;
end;
$$;

grant execute on function public.add_petty_cash_voucher_discussion(bigint, text) to authenticated;

create or replace function public.add_petty_cash_deklarasi_discussion(
  p_id bigint,
  p_message text
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_name text;
begin
  if trim(coalesce(p_message, '')) = '' then
    raise exception 'Pesan tidak boleh kosong.';
  end if;

  select coalesce(nama, email, 'Unknown User') into v_name
  from public.profiles where id = auth.uid();

  update public.petty_cash_deklarasi
  set discussions = coalesce(discussions, '[]'::jsonb) || jsonb_build_array(
    jsonb_build_object(
      'user_id', auth.uid(),
      'user_name', v_name,
      'message', p_message,
      'timestamp', now()
    )
  )
  where id = p_id;
end;
$$;

grant execute on function public.add_petty_cash_deklarasi_discussion(bigint, text) to authenticated;
