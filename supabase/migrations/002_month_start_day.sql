-- ============================================================
-- MoneyReg — Migration 002: month_start_day
-- Kullanıcı aylık raporun hangi günden başladığını seçebilir.
-- 1-28 arası sınır: şubat dahil tüm aylarda güvenli.
-- ============================================================

alter table public.profiles
  add column month_start_day integer not null default 1
  check (month_start_day between 1 and 28);
