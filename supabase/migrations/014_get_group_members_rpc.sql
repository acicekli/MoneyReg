-- ============================================================
-- MoneyReg — Grup Üyelerini Güvenli Şekilde Getirme RPC
-- ============================================================
-- Profiller RLS ile korunduğu için, paylaşımlı bir alandaki
-- diğer üyelerin isimleri normal sorguyla çekilemiyordu.
-- Bu SECURITY DEFINER fonksiyon, sadece kullanıcının üye olduğu
-- alanların üyelerini ve isimlerini döndürür.
-- ============================================================

create or replace function public.get_group_members_info(target_space_id uuid)
returns table (
  user_id uuid,
  display_name text,
  joined_at timestamptz
)
language sql
security definer
set search_path = public
as $$
  select
    sm.user_id,
    coalesce(p.display_name, 'Bilinmeyen') as display_name,
    sm.joined_at
  from public.space_members sm
  join public.profiles p on p.id = sm.user_id
  where sm.space_id = target_space_id
    and exists (
      -- Sadece bu alana üye olanlar sorgulayabilir
      select 1 from public.space_members my
      where my.space_id = target_space_id and my.user_id = auth.uid()
    )
  order by sm.joined_at asc;
$$;

revoke all on function public.get_group_members_info(uuid) from public;
grant execute on function public.get_group_members_info(uuid) to authenticated;

comment on function public.get_group_members_info(uuid) is
  'Güvenli şekilde bir gruptaki üyelerin isimlerini listeler.';
