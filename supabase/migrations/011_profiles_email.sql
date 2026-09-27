-- ============================================================
-- MoneyReg — Migration 011: profiles.email
-- profiles tablosuna email kolonu + trigger güncelleme
-- ============================================================

-- 1) email kolonu
alter table public.profiles
  add column if not exists email text;

-- 2) Mevcut kullanıcıları backfill et
update public.profiles p
set email = u.email
from auth.users u
where p.id = u.id and p.email is null;

-- 3) handle_new_user fonksiyonu — email de insert etsin
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
as $function$
declare
  v_display_name text;
  v_personal_id uuid;
begin
  v_display_name := coalesce(
    new.raw_user_meta_data->>'display_name',
    new.raw_user_meta_data->>'full_name'
  );

  insert into public.profiles (id, display_name, email)
  values (new.id, v_display_name, new.email)
  on conflict (id) do update set email = excluded.email;

  insert into public.spaces (type, name, created_by)
  values ('personal', coalesce(v_display_name, 'Benim Alanım'), new.id)
  returning id into v_personal_id;

  insert into public.space_members (space_id, user_id)
  values (v_personal_id, new.id)
  on conflict do nothing;

  return new;
end;
$function$;
