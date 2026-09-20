-- ============================================================
-- MoneyReg — Migration 005: Fiş fotoğrafları için Storage bucket
-- - receipts (private)
-- - Path formatı: {user_id}/{timestamp}_{random}.jpg
-- - RLS: kullanıcı sadece kendi klasörüne erişebilir
-- ============================================================

-- ---------- 1) Bucket oluştur ----------

insert into storage.buckets (id, name, public)
values ('receipts', 'receipts', false)
on conflict (id) do nothing;

-- ---------- 2) RLS politikaları ----------
-- Path'in ilk klasörü = user_id
-- storage.foldername(name) → path'i klasörlere ayırır, [1] = ilk klasör

drop policy if exists "receipts_select_own" on storage.objects;
drop policy if exists "receipts_insert_own" on storage.objects;
drop policy if exists "receipts_update_own" on storage.objects;
drop policy if exists "receipts_delete_own" on storage.objects;

create policy "receipts_select_own"
  on storage.objects for select to authenticated
  using (
    bucket_id = 'receipts'
    and auth.uid()::text = (storage.foldername(name))[1]
  );

create policy "receipts_insert_own"
  on storage.objects for insert to authenticated
  with check (
    bucket_id = 'receipts'
    and auth.uid()::text = (storage.foldername(name))[1]
  );

create policy "receipts_update_own"
  on storage.objects for update to authenticated
  using (
    bucket_id = 'receipts'
    and auth.uid()::text = (storage.foldername(name))[1]
  );

create policy "receipts_delete_own"
  on storage.objects for delete to authenticated
  using (
    bucket_id = 'receipts'
    and auth.uid()::text = (storage.foldername(name))[1]
  );
