-- 任何员工都能在“新房源上线”里填 Guidebook 链接（同 STRA：房源详情其他字段仍只有管理员和主责助理能改）
alter table public.property_details add column if not exists guidebook_url text;
create or replace function public.set_guidebook_url(p_property bigint, p_url text) returns void
language plpgsql security definer set search_path = public as $$
begin
  if not public.is_staff() then raise exception '没有权限'; end if;
  insert into public.property_details (property_id, guidebook_url) values (p_property, nullif(trim(coalesce(p_url, '')), ''))
  on conflict (property_id) do update set guidebook_url = excluded.guidebook_url;
end $$;
grant execute on function public.set_guidebook_url(bigint, text) to authenticated;
