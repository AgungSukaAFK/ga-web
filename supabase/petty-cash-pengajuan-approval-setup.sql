-- Melengkapi RLS `petty_cash_pengajuan` dengan policy UPDATE untuk approver -
-- supabase/petty-cash-pengajuan-setup.sql SENGAJA belum punya ini ("Tambahkan
-- policy-nya di setup script terpisah begitu fitur itu dibuat"). Fitur itu
-- sekarang dibuat: halaman /petty-cash/approval-pengajuan.
--
-- Approver boleh update SEBUAH baris kalau dia ADA di array `approvals`
-- dengan status "pending" - dicek pakai containment jsonb (`@>`), idiom
-- paling murah utk "array ini punya elemen yang match subset field berikut".
--
-- PENTING: semua approver di sebuah dokumen mulai berstatus "pending" saat
-- dibuat (approval_path template di-copy apa adanya - lihat
-- createPettyCashPengajuan, services/pettyCashPengajuanService.ts), BUKAN
-- cuma approver pertama. Jadi policy ini SAJA tidak menjamin urutan approval
-- (approver ke-3 secara teknis lolos containment check ini walau approver
-- ke-1/ke-2 belum approve) - itu levelnya sama seperti tabel approval lain
-- di aplikasi ini (material_requests/purchase_orders/petty_cash_requests
-- semua pakai blanket USING (true) utk UPDATE, urutan approval 100% dijaga
-- di app code). Urutan yang benar SELALU divalidasi di app lewat
-- isMyApprovalTurn (lib/pcApprovalFlow.ts) sebelum kirim update - policy ini
-- cuma menyempitkan siapa yang BISA sama sekali menyentuh baris ini,
-- levelnya sudah lebih ketat dari tabel-tabel approval lain di atas.
--
-- Jalankan SEKALI lewat SQL Editor Supabase (project utama), SETELAH
-- petty-cash-pengajuan-setup.sql.

drop policy if exists "petty_cash_pengajuan_update_approver" on public.petty_cash_pengajuan;
create policy "petty_cash_pengajuan_update_approver"
  on public.petty_cash_pengajuan
  for update
  to authenticated
  using (
    approvals @> jsonb_build_array(
      jsonb_build_object('userid', auth.uid()::text, 'status', 'pending')
    )
  )
  with check (true);
