-- ============================================================
-- MoneyReg — Migration 003: month_start_day 1-31 aralığına genişletme
-- 29/30/31 seçildiğinde kısa aylarda effective gün ay sonuna kırpılır.
-- ============================================================

alter table public.profiles
  drop constraint if exists profiles_month_start_day_check;

alter table public.profiles
  add constraint profiles_month_start_day_check
  check (month_start_day between 1 and 31);
