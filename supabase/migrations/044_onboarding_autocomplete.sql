-- 在房源档案里填了 STRA 编号 / Guidebook 链接 / 补齐了档案，上线流程里对应的步骤自动标为「已完成」。
-- 放在数据库里做，所以不管从哪里填（房源档案、上线流程页、导入），都会同步；总览里的待办是读这些步骤的状态，也会跟着消失。
create or replace function public.onboarding_autocomplete() returns trigger
language plpgsql security definer set search_path = public as $$
declare
  d public.property_details; c public.property_contracts; pid bigint := new.property_id; full_ok boolean;
  blank constant text := '';
begin
  select * into d from public.property_details where property_id = pid;
  select * into c from public.property_contracts where property_id = pid;

  if coalesce(d.guidebook_url, blank) <> blank then
    update public.onboarding_steps set status = '已完成', done_at = now() where property_id = pid and name ilike '%guidebook%' and status <> '已完成';
  end if;
  if coalesce(d.stra_number, blank) <> blank then
    update public.onboarding_steps set status = '已完成', done_at = now() where property_id = pid and name ilike '%stra%' and status <> '已完成';
  end if;

  -- 房源档案填齐：个体表（卧室/卫生间/可住人数/床/锁盒密码/WiFi）+ Bill（水电燃气网络谁交费 + 合同到期日）
  full_ok := d.property_id is not null and c.property_id is not null
    and d.bedrooms is not null and d.bathrooms is not null and d.max_guests is not null
    and coalesce(d.beds, blank) <> blank and coalesce(d.lock_code, blank) <> blank
    and coalesce(d.wifi_name, blank) <> blank and coalesce(d.wifi_password, blank) <> blank
    and coalesce(c.water, '未填') <> '未填' and coalesce(c.power, '未填') <> '未填'
    and coalesce(c.gas, '未填') <> '未填' and coalesce(c.internet, '未填') <> '未填' and c.end_date is not null;
  if full_ok then
    update public.onboarding_steps set status = '已完成', done_at = now() where property_id = pid and (name like '%房源档案%' or name like '%个体表%') and status <> '已完成';
  end if;
  return new;
end $$;

drop trigger if exists trg_ob_auto_d on public.property_details;
create trigger trg_ob_auto_d after insert or update on public.property_details for each row execute function public.onboarding_autocomplete();
drop trigger if exists trg_ob_auto_c on public.property_contracts;
create trigger trg_ob_auto_c after insert or update on public.property_contracts for each row execute function public.onboarding_autocomplete();

-- 已经填好的，现在补一次
update public.onboarding_steps s set status = '已完成', done_at = now()
 where s.status <> '已完成' and s.name ilike '%guidebook%'
   and exists (select 1 from public.property_details d where d.property_id = s.property_id and coalesce(d.guidebook_url, '') <> '');
update public.onboarding_steps s set status = '已完成', done_at = now()
 where s.status <> '已完成' and s.name ilike '%stra%'
   and exists (select 1 from public.property_details d where d.property_id = s.property_id and coalesce(d.stra_number, '') <> '');
