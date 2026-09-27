-- ============================================================
-- MoneyReg — Migration 010: Admin yetkisi + feedback yönetimi
-- ============================================================

-- 1) profiles.is_admin
alter table public.profiles
  add column if not exists is_admin boolean not null default false;

-- 2) Feedback: adminler tüm feedback'leri okuyabilir
drop policy if exists "Admins can read all feedback" on public.feedback;
create policy "Admins can read all feedback"
  on public.feedback for select
  using (
    exists (
      select 1 from public.profiles
      where id = auth.uid() and is_admin = true
    )
  );

-- 3) Feedback: adminler silebilir
drop policy if exists "Admins can delete feedback" on public.feedback;
create policy "Admins can delete feedback"
  on public.feedback for delete
  using (
    exists (
      select 1 from public.profiles
      where id = auth.uid() and is_admin = true
    )
  );
