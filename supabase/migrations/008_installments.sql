-- ============================================================
-- MoneyReg — Migration 008: Taksitli harcama desteği
-- transactions tablosuna taksit kolonları + constraint + index ekler
-- ============================================================

-- 1) Taksit kolonları
alter table public.transactions
  add column if not exists installment_group_id uuid null,
  add column if not exists installment_number   int  null,
  add column if not exists total_installments   int  null;

-- 2) Grup sorguları için index
create index if not exists idx_transactions_installment_group_id
  on public.transactions (installment_group_id)
  where installment_group_id is not null;

-- 3) Bütünlük kontrolü: taksit alanları ya hep dolu ya hep boş olmalı
do $$
begin
  if not exists (
    select 1 from pg_constraint where conname = 'chk_installment_consistency'
  ) then
    alter table public.transactions
      add constraint chk_installment_consistency
      check (
        (installment_group_id is null and installment_number is null and total_installments is null)
        or
        (installment_group_id is not null and installment_number is not null and total_installments is not null
          and installment_number >= 1
          and total_installments >= 1
          and installment_number <= total_installments)
      );
  end if;
end $$;

-- 4) UNIQUE constraint (idempotent sync için)
do $$
begin
  if not exists (
    select 1 from pg_constraint where conname = 'uq_installment_group_number'
  ) then
    alter table public.transactions
      add constraint uq_installment_group_number
      unique (installment_group_id, installment_number);
  end if;
end $$;
