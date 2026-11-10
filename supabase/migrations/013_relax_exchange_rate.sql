-- ============================================================
-- MoneyReg — Migration 013
-- TRY dışı harcamalarda kur henüz çekilememişse NULL'a izin ver.
-- syncQueue kur çekince günceller (update_exchange_rate).
-- ============================================================

alter table public.transactions
  drop constraint if exists chk_exchange_rate_required;

alter table public.transactions
  add constraint chk_exchange_rate_required
  check (
    (currency = 'TRY' and exchange_rate_snapshot is null)
    or
    (currency <> 'TRY' and (
      exchange_rate_snapshot is null
      or exchange_rate_snapshot > 0
    ))
  );
