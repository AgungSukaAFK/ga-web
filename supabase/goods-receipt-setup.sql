-- Fitur Cetak BAST + Scan QR Goods Receipt Confirmation.
--
-- 1. app_settings: tabel key/value generik, admin-editable, dipakai buat
--    nyimpen "kode global" penerimaan barang (passphrase bersama, plain
--    text sesuai keputusan user - bukan di-hash).
-- 2. purchase_orders.receipt_token: token acak unik per PO, dipakai sebagai
--    URL publik `/goods-receipt/<token>` yang di-encode ke QR code di BAST.
--    Di-generate sekali (lazy, saat pertama kali "Cetak BAST" diklik) dan
--    dipakai ulang di reprint - BUKAN dirotasi tiap cetak.
-- 3. purchase_orders.goods_receipt: snapshot hasil konfirmasi penerimaan
--    (nama penerima, waktu, qty & foto per item) - sekali diisi, PO ini
--    dianggap "sudah diterima" dan token-nya jadi single-use (re-scan cuma
--    nampilin info, gak bisa submit ulang).
-- 4. Service account "Publik (Scan QR)": dipakai sebagai actor/user_id di
--    activity_logs & updated_by saat konfirmasi datang dari scan QR publik
--    TANPA login (kode global doang) - supaya FK ke auth.users tetap valid
--    tanpa perlu bikin kolom nullable. Nama penerima yang sesungguhnya
--    selalu tersimpan terpisah di goods_receipt.receiver_name.

create table if not exists public.app_settings (
  key text primary key,
  value text,
  updated_at timestamptz not null default now(),
  updated_by uuid references auth.users(id)
);

insert into public.app_settings (key, value)
  values ('goods_receipt_global_code', 'GANTI-KODE-INI')
  on conflict (key) do nothing;

alter table public.app_settings enable row level security;

drop policy if exists "Admin can read app_settings" on public.app_settings;
create policy "Admin can read app_settings" on public.app_settings
  for select to authenticated
  using (
    exists (
      select 1 from public.profiles p
      where p.id = auth.uid() and p.role = 'admin'
    )
  );

drop policy if exists "Admin can update app_settings" on public.app_settings;
create policy "Admin can update app_settings" on public.app_settings
  for update to authenticated
  using (
    exists (
      select 1 from public.profiles p
      where p.id = auth.uid() and p.role = 'admin'
    )
  );

alter table public.purchase_orders
  add column if not exists receipt_token text unique,
  add column if not exists goods_receipt jsonb;

create index if not exists idx_purchase_orders_receipt_token
  on public.purchase_orders (receipt_token);

-- Service account buat konfirmasi via kode global (tanpa login). Password
-- di-random & tidak pernah dipakai untuk login normal - akun ini murni
-- sebagai "actor" placeholder di FK, bukan akun yang bisa dipakai orang.
do $$
declare
  v_user_id uuid;
begin
  select id into v_user_id from auth.users where email = 'public-scan@internal.garudamart.local';

  if v_user_id is null then
    v_user_id := gen_random_uuid();
    insert into auth.users (
      id, instance_id, aud, role, email, encrypted_password,
      email_confirmed_at, created_at, updated_at,
      raw_app_meta_data, raw_user_meta_data
    ) values (
      v_user_id, '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated',
      'public-scan@internal.garudamart.local', crypt(gen_random_uuid()::text, gen_salt('bf')),
      now(), now(), now(),
      '{"provider":"email","providers":["email"]}', '{}'
    );
  end if;

  -- Trigger `handle_new_user` di atas otomatis bikin row profiles kosong
  -- (role 'user') begitu insert auth.users di atas jalan - jadi di sini
  -- harus UPSERT (bukan ON CONFLICT DO NOTHING) supaya nama/role/is_active
  -- yang benar tetap ke-set walau row-nya sudah ada duluan dari trigger.
  insert into public.profiles (id, nama, role, department, company, email, is_active)
  values (
    v_user_id, 'Publik (Scan QR)', 'system', 'System', null,
    'public-scan@internal.garudamart.local', false
  )
  on conflict (id) do update set
    nama = excluded.nama,
    role = excluded.role,
    department = excluded.department,
    is_active = excluded.is_active;
end $$;
