-- ============================================================
-- MoneyReg — Migration 009: Kullanıcı geri bildirimleri
-- ============================================================

create table if not exists public.feedback (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  email text,
  category text not null check (category in ('bug', 'feature', 'other')),
  message text not null,
  platform text,
  created_at timestamptz not null default now()
);

create index if not exists idx_feedback_user_id on public.feedback (user_id);
create index if not exists idx_feedback_created_at on public.feedback (created_at desc);

alter table public.feedback enable row level security;

drop policy if exists "Users can insert own feedback" on public.feedback;
create policy "Users can insert own feedback"
  on public.feedback for insert
  with check (auth.uid() = user_id);

drop policy if exists "Users can read own feedback" on public.feedback;
create policy "Users can read own feedback"
  on public.feedback for select
  using (auth.uid() = user_id);
