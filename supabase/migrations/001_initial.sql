-- ============================================================
-- MoneyReg — Initial Schema
-- Sadece HARCAMA takibi. Gelir kavramı yoktur.
-- ============================================================

-- ---------- ENUM'lar ----------
create type space_type   as enum ('personal', 'shared');
create type space_status as enum ('active', 'closed');
create type currency     as enum ('TRY', 'USD', 'EUR');

-- ============================================================
-- 1. PROFILES
-- ============================================================
create table public.profiles (
  id               uuid primary key references auth.users(id) on delete cascade,
  display_name     text,
  default_currency text not null default 'TRY',
  created_at       timestamptz not null default now()
);

-- Yeni kullanıcı kaydolunca otomatik profil oluştur
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
as $$
declare
  v_display_name text;
  v_personal_id  uuid;
begin
  -- display_name öncelikli, yoksa full_name
  v_display_name := coalesce(
    new.raw_user_meta_data->>'display_name',
    new.raw_user_meta_data->>'full_name'
  );

  -- Profil oluştur
  insert into public.profiles (id, display_name)
  values (new.id, v_display_name)
  on conflict (id) do nothing;

  -- Kişisel space oluştur
  insert into public.spaces (type, name, created_by)
  values ('personal', coalesce(v_display_name, 'Benim Alanım'), new.id)
  returning id into v_personal_id;

  -- Kullanıcıyı üye yap
  insert into public.space_members (space_id, user_id)
  values (v_personal_id, new.id)
  on conflict do nothing;

  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- ============================================================
-- 2. SPACES
-- ============================================================
create table public.spaces (
  id          uuid primary key default gen_random_uuid(),
  type        space_type   not null,
  name        text         not null,
  status      space_status not null default 'active',
  created_by  uuid         not null references public.profiles(id) on delete cascade,
  created_at  timestamptz  not null default now()
);

create index idx_spaces_created_by on public.spaces(created_by);
create index idx_spaces_status     on public.spaces(status);

-- ============================================================
-- 3. SPACE MEMBERS
-- ============================================================
create table public.space_members (
  space_id   uuid not null references public.spaces(id) on delete cascade,
  user_id    uuid not null references public.profiles(id) on delete cascade,
  joined_at  timestamptz not null default now(),
  primary key (space_id, user_id)
);

create index idx_space_members_user on public.space_members(user_id);

-- ============================================================
-- 4. CATEGORIES
-- ============================================================
create table public.categories (
  id          uuid primary key default gen_random_uuid(),
  name        text    not null,
  icon        text,
  is_default  boolean not null default false,
  created_by  uuid references public.profiles(id) on delete cascade
);

create index idx_categories_created_by on public.categories(created_by);

-- ============================================================
-- 5. TRANSACTIONS
-- ============================================================
create table public.transactions (
  id                     uuid primary key default gen_random_uuid(),
  space_id               uuid        not null references public.spaces(id) on delete cascade,
  created_by             uuid        not null references public.profiles(id) on delete cascade,
  amount                 numeric(14,2) not null check (amount >= 0),
  currency               currency    not null default 'TRY',
  exchange_rate_snapshot numeric(14,6),
  category_id            uuid        references public.categories(id) on delete set null,
  note                   text,
  expense_date           date        not null default current_date,
  receipt_photo_url      text,
  created_at             timestamptz not null default now(),

  -- TRY dışındaki para birimlerinde kur ZORUNLU
  constraint chk_exchange_rate_required
    check (
      (currency = 'TRY' and exchange_rate_snapshot is null)
      or
      (currency <> 'TRY' and exchange_rate_snapshot is not null and exchange_rate_snapshot > 0)
    )
);

create index idx_transactions_space        on public.transactions(space_id);
create index idx_transactions_created_by   on public.transactions(created_by);
create index idx_transactions_expense_date on public.transactions(expense_date desc);
create index idx_transactions_category     on public.transactions(category_id);

-- ============================================================
-- 6. Yardımcı fonksiyonlar (RLS için)
-- ============================================================
create or replace function public.is_space_member(p_space_id uuid, p_user_id uuid)
returns boolean
language sql
security definer
stable
as $$
  select exists (
    select 1 from public.space_members
    where space_id = p_space_id and user_id = p_user_id
  );
$$;

create or replace function public.is_space_owner(p_space_id uuid, p_user_id uuid)
returns boolean
language sql
security definer
stable
as $$
  select exists (
    select 1 from public.spaces
    where id = p_space_id
      and type = 'personal'
      and created_by = p_user_id
  );
$$;

-- ============================================================
-- 7. ROW LEVEL SECURITY
-- ============================================================
alter table public.profiles      enable row level security;
alter table public.spaces        enable row level security;
alter table public.space_members enable row level security;
alter table public.categories    enable row level security;
alter table public.transactions  enable row level security;

-- ---------- profiles ----------
create policy profiles_select_own on public.profiles
  for select to authenticated using (auth.uid() = id);

create policy profiles_update_own on public.profiles
  for update to authenticated using (auth.uid() = id);

-- ---------- spaces ----------
create policy spaces_select on public.spaces
  for select to authenticated
  using (
    created_by = auth.uid()
    or
    (type = 'shared' and public.is_space_member(id, auth.uid()))
  );

create policy spaces_insert on public.spaces
  for insert to authenticated
  with check (created_by = auth.uid());

create policy spaces_update on public.spaces
  for update to authenticated
  using (created_by = auth.uid());

create policy spaces_delete on public.spaces
  for delete to authenticated
  using (created_by = auth.uid());

-- ---------- space_members ----------
create policy space_members_select on public.space_members
  for select to authenticated
  using (
    user_id = auth.uid()
    or exists (
      select 1 from public.spaces s
      where s.id = space_id and s.created_by = auth.uid()
    )
  );

create policy space_members_insert on public.space_members
  for insert to authenticated
  with check (
    user_id = auth.uid()
    or exists (
      select 1 from public.spaces s
      where s.id = space_id and s.created_by = auth.uid()
    )
  );

create policy space_members_delete on public.space_members
  for delete to authenticated
  using (
    user_id = auth.uid()
    or exists (
      select 1 from public.spaces s
      where s.id = space_id and s.created_by = auth.uid()
    )
  );

-- ---------- categories ----------
create policy categories_select on public.categories
  for select to authenticated
  using (is_default = true or created_by = auth.uid());

create policy categories_insert_own on public.categories
  for insert to authenticated
  with check (created_by = auth.uid());

create policy categories_update_own on public.categories
  for update to authenticated
  using (created_by = auth.uid() and is_default = false);

create policy categories_delete_own on public.categories
  for delete to authenticated
  using (created_by = auth.uid() and is_default = false);

-- ---------- transactions ----------
create policy transactions_select on public.transactions
  for select to authenticated
  using (
    public.is_space_member(space_id, auth.uid())
    or public.is_space_owner(space_id, auth.uid())
  );

create policy transactions_insert on public.transactions
  for insert to authenticated
  with check (
    created_by = auth.uid()
    and (
      public.is_space_member(space_id, auth.uid())
      or public.is_space_owner(space_id, auth.uid())
    )
    and exists (
      select 1 from public.spaces s
      where s.id = space_id and s.status = 'active'
    )
  );

create policy transactions_update on public.transactions
  for update to authenticated
  using (
    public.is_space_member(space_id, auth.uid())
    or public.is_space_owner(space_id, auth.uid())
  );

create policy transactions_delete on public.transactions
  for delete to authenticated
  using (
    public.is_space_member(space_id, auth.uid())
    or public.is_space_owner(space_id, auth.uid())
  );

-- ============================================================
-- 8. Varsayılan kategoriler (sadece harcama)
-- ============================================================
insert into public.categories (name, icon, is_default, created_by) values
  ('Market',    '🛒', true, null),
  ('Yemek',     '🍔', true, null),
  ('Ulaşım',    '🚌', true, null),
  ('Kira',      '🏠', true, null),
  ('Faturalar', '💡', true, null),
  ('Sağlık',    '💊', true, null),
  ('Eğlence',   '🎬', true, null),
  ('Giyim',     '👕', true, null),
  ('Diğer',     '📦', true, null);
