-- 每个房源在旧 Account 表里那一行的原文（旧账号、Vrbo、Booking、备注等），原样保留，不加标签。
-- 里面可能有密码，所以和平台账号一样：只有管理员和该房源的负责助理能读。
create table public.property_account_info (
  property_id bigint primary key references public.properties(id) on delete cascade,
  raw text
);
alter table public.property_account_info enable row level security;
grant select, insert, update, delete on public.property_account_info to authenticated;
grant all on public.property_account_info to service_role;
create policy pai_admin on public.property_account_info for all to authenticated using (public.is_admin()) with check (public.is_admin());
create policy pai_assistant_read on public.property_account_info for select to authenticated using (
  exists (select 1 from public.properties p where p.id = property_account_info.property_id and p.assistant_id = auth.uid())
);
-- 之前导入时合并出来的「其他信息」是乱的，清掉
update public.platform_accounts set other_info = null;
