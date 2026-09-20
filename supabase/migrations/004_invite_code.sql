-- ============================================================
-- MoneyReg — Migration 004: Davet kodu sistemi
-- - spaces.invite_code (unique, otomatik üretilir)
-- - join_space_by_code(code text) RPC (SECURITY DEFINER)
-- ============================================================

-- ---------- 1) Davet kodu üretici ----------

create or replace function public.generate_invite_code()
returns text
language plpgsql
as $$
declare
  chars text := 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  result text := '';
  i int;
begin
  for i in 1..6 loop
    result := result || substr(chars, floor(random() * length(chars) + 1)::int, 1);
  end loop;
  return result;
end;
$$;

-- ---------- 2) invite_code kolonu ----------

alter table public.spaces
  add column invite_code text unique;

alter table public.spaces
  alter column invite_code set default public.generate_invite_code();

-- Mevcut space'lere kod üret
update public.spaces
set invite_code = public.generate_invite_code()
where invite_code is null;

alter table public.spaces
  alter column invite_code set not null;

-- ---------- 3) join_space_by_code RPC ----------

create or replace function public.join_space_by_code(code text)
returns json
language plpgsql
security definer
as $$
declare
  v_uid        uuid := auth.uid();
  v_space_id   uuid;
  v_space_name text;
  v_status     space_status;
begin
  -- Auth kontrolü
  if v_uid is null then
    raise exception 'Oturum bulunamadı.';
  end if;

  -- Kod normalize (büyük harf, boşlukları temizle)
  code := upper(trim(code));
  if code = '' or length(code) < 6 then
    raise exception 'Geçersiz davet kodu.';
  end if;

  -- Space'i bul
  select id, name, status
    into v_space_id, v_space_name, v_status
    from public.spaces
   where invite_code = code;

  if v_space_id is null then
    raise exception 'Bu koda sahip bir alan bulunamadı.';
  end if;

  if v_status = 'closed' then
    raise exception 'Bu alan sonlandırılmış, katılınamaz.';
  end if;

  -- Zaten üye mi?
  if exists (
    select 1 from public.space_members
     where space_id = v_space_id and user_id = v_uid
  ) then
    raise exception 'Bu alana zaten üyesiniz.';
  end if;

  -- Üye ekle
  insert into public.space_members (space_id, user_id)
  values (v_space_id, v_uid);

  return json_build_object(
    'id', v_space_id,
    'name', v_space_name
  );
end;
$$;

-- Grant (authenticated kullanıcılar çağırabilsin)
grant execute on function public.join_space_by_code(text) to authenticated;
