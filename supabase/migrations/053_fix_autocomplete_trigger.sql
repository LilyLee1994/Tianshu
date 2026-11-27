-- 修复：保存房源档案时报 record "new" has no field "base_status"
-- 原因：同一个触发器函数同时挂在 property_details 和 property_contracts 上，
-- 046 里把表名判断和 new.base_status 写在同一个 if 里，plpgsql 不保证短路，
-- 在 property_details 上也会去读 base_status 而报错。改成先判断表名，再读字段。
create or replace function public.onboarding_autocomplete() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  perform public.onboarding_refresh(new.property_id);
  if tg_table_name = 'property_contracts' and tg_op = 'UPDATE' then
    if new.base_status = '运营中' and old.base_status is distinct from new.base_status then
      update public.onboarding_steps set status = '已完成', done_at = now()
       where property_id = new.property_id and name = '上线' and status <> '已完成';
    end if;
  end if;
  return new;
end $$;
