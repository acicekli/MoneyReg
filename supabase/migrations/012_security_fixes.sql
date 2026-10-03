-- ============================================================
-- MoneyReg — Migration 012: Güvenlik düzeltmeleri
--   1) profiles: kullanıcı is_admin/email gibi alanları değiştiremesin
--   2) join_space_by_code: sadece 'shared' alanlara katılım
--   3) space_members: davet kodunu atlayan doğrudan insert kapatıldı
--   4) spaces: kolon yetkileri + kapalı alan tekrar açılamaz
--   5) transactions: update/delete sadece kendi kaydı + aktif alan
--   6) SECURITY DEFINER fonksiyonlara sabit search_path
--   7) receipts bucket: boyut + mime sınırı
--   8) feedback: uzunluk sınırı
--
-- NOT: Uygulamadan önce mevcut adminleri kontrol et:
--   select id, email from public.profiles where is_admin;
-- Yetkisiz kişi admin yapılmışsa: update public.profiles set is_admin = false where id = '...';
-- ============================================================

-- ---------- 1) profiles ----------
revoke update on public.profiles from authenticated;
grant update (display_name, default_currency, month_start_day)
  on public.profiles to authenticated;

drop policy if exists profiles_update_own on public.profiles;
create policy profiles_update_own on public.profiles
  for update to authenticated
  using (auth.uid() = id)
  with check (auth.uid() = id);

-- ---------- 2) Yardımcı fonksiyonlar (search_path sabit) ----------
create or replace function public.is_space_member(p_space_id uuid, p_user_id uuid)
returns boolean
language sql
security definer
stable
set search_path = ''
as $$
  -- Sadece çağıranın kendi üyeliği sorgulanabilir (başkasının üyeliği sızmasın)
  select p_user_id = auth.uid()
    and exists (
      select 1 from public.space_members
      where space_id = p_space_id and user_id = p_user_id
    );
$$;

alter function public.is_space_owner(uuid, uuid) set search_path = '';
alter function public.handle_new_user() set search_path = '';

-- ---------- 3) Davet koduyla katılım: sadece shared alanlar ----------
create or replace function public.join_space_by_code(code text)
returns json
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid        uuid := auth.uid();
  v_space_id   uuid;
  v_space_name text;
  v_status     public.space_status;
begin
  if v_uid is null then
    raise exception 'Oturum bulunamadı.';
  end if;

  code := upper(trim(code));
  if code = '' or length(code) < 6 then
    raise exception 'Geçersiz davet kodu.';
  end if;

  -- Kişisel alanlara davetle katılım yok
  select id, name, status
    into v_space_id, v_space_name, v_status
    from public.spaces
   where invite_code = code
     and type = 'shared';

  if v_space_id is null then
    raise exception 'Bu koda sahip bir alan bulunamadı.';
  end if;

  if v_status = 'closed' then
    raise exception 'Bu alan sonlandırılmış, katılınamaz.';
  end if;

  if exists (
    select 1 from public.space_members
     where space_id = v_space_id and user_id = v_uid
  ) then
    raise exception 'Bu alana zaten üyesiniz.';
  end if;

  insert into public.space_members (space_id, user_id)
  values (v_space_id, v_uid);

  return json_build_object('id', v_space_id, 'name', v_space_name);
end;
$$;

revoke execute on function public.join_space_by_code(text) from public, anon;
grant execute on function public.join_space_by_code(text) to authenticated;

-- ---------- 4) space_members: doğrudan insert sadece alan sahibi kendini ekler ----------
-- (Katılım RPC üzerinden; handle_new_user trigger'ı RLS'i zaten bypass eder.)
drop policy if exists space_members_insert on public.space_members;
create policy space_members_insert on public.space_members
  for insert to authenticated
  with check (
    user_id = auth.uid()
    and exists (
      select 1 from public.spaces s
      where s.id = space_id and s.created_by = auth.uid()
    )
  );

-- ---------- 5) spaces: kolon yetkileri + kapalı alan tekrar açılamaz ----------
revoke insert, update on public.spaces from authenticated;
grant insert (type, name, status, created_by) on public.spaces to authenticated;
grant update (name, status) on public.spaces to authenticated;

drop policy if exists spaces_update on public.spaces;
create policy spaces_update on public.spaces
  for update to authenticated
  using (created_by = auth.uid())
  with check (created_by = auth.uid());

create or replace function public.prevent_reopen_space()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if old.status = 'closed' and new.status <> 'closed' then
    raise exception 'Sonlandırılmış alan tekrar açılamaz.';
  end if;
  return new;
end;
$$;

drop trigger if exists trg_prevent_reopen_space on public.spaces;
create trigger trg_prevent_reopen_space
  before update on public.spaces
  for each row execute function public.prevent_reopen_space();

-- ---------- 6) transactions: sadece kendi kaydı + aktif alan ----------
drop policy if exists transactions_update on public.transactions;
create policy transactions_update on public.transactions
  for update to authenticated
  using (
    created_by = auth.uid()
    and (
      public.is_space_member(space_id, auth.uid())
      or public.is_space_owner(space_id, auth.uid())
    )
    and exists (
      select 1 from public.spaces s
      where s.id = space_id and s.status = 'active'
    )
  )
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

drop policy if exists transactions_delete on public.transactions;
create policy transactions_delete on public.transactions
  for delete to authenticated
  using (
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

-- ---------- 7) receipts bucket: 5 MB + sadece görsel ----------
update storage.buckets
   set file_size_limit = 5242880,
       allowed_mime_types = array['image/jpeg', 'image/png', 'image/webp', 'image/heic']
 where id = 'receipts';

-- ---------- 8) feedback: uzunluk sınırı (mevcut satırları etkilemez) ----------
alter table public.feedback
  drop constraint if exists chk_feedback_message_len;
alter table public.feedback
  add constraint chk_feedback_message_len
  check (char_length(message) between 1 and 2000) not valid;

alter table public.feedback
  drop constraint if exists chk_feedback_email_len;
alter table public.feedback
  add constraint chk_feedback_email_len
  check (email is null or char_length(email) <= 320) not valid;
