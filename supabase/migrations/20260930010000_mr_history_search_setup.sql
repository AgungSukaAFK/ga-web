-- "History MR" di halaman Buat MR - RPC `search_mr_history` untuk mencari MR
-- lama (departemen sama) yang mau dipakai ulang sebagai template. Dipakai
-- searchMrHistory di services/mrTemplateService.ts.
--
-- Dibuat sebagai RPC (bukan filter PostgREST biasa) karena perlu mencari di
-- dalam kolom `orders` (json array) berdasarkan nama barang & part number,
-- dan mencari remarks berdasarkan TEKS-nya saja - remarks disimpan sebagai
-- string JSON Tiptap, jadi ilike langsung ke kolomnya ikut cocok ke key JSON
-- ("type", "paragraph", dst).
--
-- security invoker: tetap tunduk ke RLS material_requests milik pemanggil.
--
-- Jalankan SEKALI lewat SQL Editor Supabase (project utama).

-- Ambil teks polos dari remarks: kalau isinya JSON Tiptap, gabungkan semua
-- node "text"/label mention; kalau plain text lama (bukan JSON), kembalikan
-- apa adanya.
create or replace function public.mr_remarks_plain_text(p_remarks text)
returns text
language plpgsql
immutable
as $$
declare
  v_doc jsonb;
begin
  if p_remarks is null or p_remarks = '' then
    return '';
  end if;
  if left(ltrim(p_remarks), 1) <> '{' then
    return p_remarks;
  end if;
  begin
    v_doc := p_remarks::jsonb;
  exception when others then
    return p_remarks;
  end;
  if v_doc->>'type' is distinct from 'doc' then
    return p_remarks;
  end if;
  return coalesce(
    (
      select string_agg(v #>> '{}', ' ')
      from jsonb_path_query(v_doc, 'lax $.**.text') as v
    ),
    ''
  ) || ' ' || coalesce(
    (
      select string_agg(v #>> '{}', ' ')
      from jsonb_path_query(v_doc, 'lax $.**.attrs.label') as v
    ),
    ''
  );
end;
$$;

create or replace function public.search_mr_history(
  p_query text,
  p_department text,
  p_company_code text default null,
  p_limit int default 5
)
returns table (
  id bigint,
  kode_mr text,
  kategori text,
  remarks text,
  status text,
  department text,
  company_code text,
  created_at timestamptz,
  orders json,
  requester_nama text
)
language sql
stable
security invoker
set search_path = public
as $$
  with q as (
    -- Escape wildcard ilike (\, %, _) dari input user.
    select '%' || replace(replace(replace(trim(p_query), '\', '\\'), '%', '\%'), '_', '\_') || '%' as pattern
  )
  select
    mr.id,
    mr.kode_mr,
    mr.kategori,
    mr.remarks,
    mr.status,
    mr.department,
    mr.company_code,
    mr.created_at,
    mr.orders,
    p.nama as requester_nama
  from public.material_requests mr
  cross join q
  left join public.profiles p on p.id = mr.userid
  where length(trim(coalesce(p_query, ''))) >= 3
    and mr.department = p_department
    and (p_company_code is null or mr.company_code = p_company_code)
    and (
      mr.kode_mr ilike q.pattern
      or public.mr_remarks_plain_text(mr.remarks) ilike q.pattern
      or (
        json_typeof(mr.orders) = 'array'
        and exists (
          select 1
          from json_array_elements(mr.orders) as o
          where o->>'name' ilike q.pattern
             or o->>'part_number' ilike q.pattern
        )
      )
    )
  order by mr.created_at desc
  limit least(greatest(coalesce(p_limit, 5), 1), 5);
$$;

grant execute on function public.search_mr_history(text, text, text, int) to authenticated;
grant execute on function public.mr_remarks_plain_text(text) to authenticated;
