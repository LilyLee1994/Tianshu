-- 房源的 STRA 注册编号（NSW 短租登记）。在“新房源上线”里完成「注册 STRA」时填写，会同步显示在房源档案。
alter table public.property_details add column if not exists stra_number text;

-- 任何员工都能在“新房源上线”里填 STRA 编号（房源详情本身只有管理员和主责助理能改，所以用函数单独放开这一个字段）
create or replace function public.set_stra_number(p_property bigint, p_stra text) returns void
language plpgsql security definer set search_path = public as $$
begin
  if not public.is_staff() then raise exception '没有权限'; end if;
  insert into public.property_details (property_id, stra_number) values (p_property, nullif(trim(coalesce(p_stra, '')), ''))
  on conflict (property_id) do update set stra_number = excluded.stra_number;
end $$;
grant execute on function public.set_stra_number(bigint, text) to authenticated;
