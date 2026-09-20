-- ============================================================
-- MoneyReg — Migration 006: Kategori silme kısıtı
-- Bir kategori kullanımda ise silinemez (transactions.category_id FK restrict).
-- ============================================================

-- Eski FK'yı kaldır (on delete set null)
alter table public.transactions
  drop constraint if exists transactions_category_id_fkey;

-- Yeni FK: silmeye çalışılırsa hata ver
alter table public.transactions
  add constraint transactions_category_id_fkey
  foreign key (category_id)
  references public.categories(id)
  on delete restrict;
