-- ============================================================
-- Fitur "balas pesan" di komentar Update Web
-- ============================================================
--
-- add_update_web_post_discussion dapat parameter baru p_reply_to (snapshot
-- pesan yang dibalas: user_id, user_name, timestamp, excerpt - lihat
-- DiscussionReplyRef di type/index.ts). Signature lama (5 argumen) di-drop
-- dulu supaya tidak ada 2 overload yang bikin panggilan RPC ambigu.
--
-- MR/PO tidak perlu migration - kolom `discussions`-nya ditulis langsung dari
-- client (lihat material-request/[id]/discussion-component.tsx).

drop function if exists public.add_update_web_post_discussion(bigint, text, jsonb, jsonb, jsonb);

create or replace function public.add_update_web_post_discussion(
  p_id bigint,
  p_message text,
  p_content jsonb default null,
  p_mentions jsonb default '[]'::jsonb,
  p_attachment jsonb default null,
  p_reply_to jsonb default null
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_name text;
  v_reply_to jsonb;
begin
  if trim(coalesce(p_message, '')) = '' and p_content is null and p_attachment is null then
    raise exception 'Pesan tidak boleh kosong.';
  end if;

  select coalesce(nama, email, 'Unknown User') into v_name
  from public.profiles where id = auth.uid();

  -- Whitelist key + batasi panjang excerpt, supaya payload mentah dari client
  -- tidak bisa menyisipkan field lain ke entri diskusi.
  if p_reply_to is not null and jsonb_typeof(p_reply_to) = 'object' then
    v_reply_to := jsonb_build_object(
      'user_id', p_reply_to->>'user_id',
      'user_name', left(coalesce(p_reply_to->>'user_name', ''), 200),
      'timestamp', p_reply_to->>'timestamp',
      'excerpt', left(coalesce(p_reply_to->>'excerpt', ''), 200)
    );
  end if;

  update public.update_web_posts
  set discussions = coalesce(discussions, '[]'::jsonb) || jsonb_build_array(
    jsonb_strip_nulls(jsonb_build_object('reply_to', v_reply_to)) ||
    jsonb_build_object(
      'user_id', auth.uid(),
      'user_name', v_name,
      'message', p_message,
      'content', p_content,
      'mentions', coalesce(p_mentions, '[]'::jsonb),
      'attachment', p_attachment,
      'timestamp', now()
    )
  )
  where id = p_id;

  if not found then
    raise exception 'Postingan Update Web tidak ditemukan.';
  end if;
end;
$$;

grant execute on function public.add_update_web_post_discussion(bigint, text, jsonb, jsonb, jsonb, jsonb) to authenticated;
