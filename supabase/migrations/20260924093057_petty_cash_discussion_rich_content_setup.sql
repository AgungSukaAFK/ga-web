-- Tambahan buat 3 RPC diskusi Petty Cash (petty-cash-discussion-rpc-setup.sql)
-- supaya bisa nyimpen rich content (Tiptap JSON) & mentions (tag user/barang/
-- vendor/dokumen) - sebelumnya cuma nyimpen `message` polos.
--
-- ADDITIVE & BACKWARD COMPATIBLE: parameter baru (`p_content`, `p_mentions`)
-- punya default, jadi caller lama yang cuma ngirim (p_id, p_message) tetap
-- jalan tanpa perubahan. Tetap SECURITY DEFINER yang cuma nyentuh kolom
-- `discussions` - lihat komentar lengkap di petty-cash-discussion-rpc-setup.sql.
--
-- Jalankan SEKALI lewat SQL Editor Supabase (project utama), SETELAH
-- petty-cash-discussion-rpc-setup.sql.

create or replace function public.add_petty_cash_pengajuan_discussion(
  p_id bigint,
  p_message text,
  p_content jsonb default null,
  p_mentions jsonb default '[]'::jsonb
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_name text;
begin
  if trim(coalesce(p_message, '')) = '' and p_content is null then
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
      'content', p_content,
      'mentions', coalesce(p_mentions, '[]'::jsonb),
      'timestamp', now()
    )
  )
  where id = p_id;
end;
$$;

grant execute on function public.add_petty_cash_pengajuan_discussion(bigint, text, jsonb, jsonb) to authenticated;

create or replace function public.add_petty_cash_voucher_discussion(
  p_id bigint,
  p_message text,
  p_content jsonb default null,
  p_mentions jsonb default '[]'::jsonb
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_name text;
begin
  if trim(coalesce(p_message, '')) = '' and p_content is null then
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
      'content', p_content,
      'mentions', coalesce(p_mentions, '[]'::jsonb),
      'timestamp', now()
    )
  )
  where id = p_id;
end;
$$;

grant execute on function public.add_petty_cash_voucher_discussion(bigint, text, jsonb, jsonb) to authenticated;

create or replace function public.add_petty_cash_deklarasi_discussion(
  p_id bigint,
  p_message text,
  p_content jsonb default null,
  p_mentions jsonb default '[]'::jsonb
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_name text;
begin
  if trim(coalesce(p_message, '')) = '' and p_content is null then
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
      'content', p_content,
      'mentions', coalesce(p_mentions, '[]'::jsonb),
      'timestamp', now()
    )
  )
  where id = p_id;
end;
$$;

grant execute on function public.add_petty_cash_deklarasi_discussion(bigint, text, jsonb, jsonb) to authenticated;
