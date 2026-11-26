-- 补流程的场景：房子早就在运营了，之后才补上线流程。
-- 开始流程时，档案里已经填好的 STRA 编号 / Guidebook / 个体表和 Bill，对应的步骤要马上自动完成（之前只在改档案的时候才会检查）。
create or replace function public.onboarding_refresh(pid bigint) returns void
language plpgsql security definer set search_path = public as $$
declare
  d public.property_details; c public.property_contracts; full_ok boolean; blank constant text := '';
begin
  select * into d from public.property_details where property_id = pid;
  select * into c from public.property_contracts where property_id = pid;
  if coalesce(d.guidebook_url, blank) <> blank then
    update public.onboarding_steps set status = '已完成', done_at = now() where property_id = pid and name ilike '%guidebook%' and status <> '已完成';
  end if;
  if coalesce(d.stra_number, blank) <> blank then
    update public.onboarding_steps set status = '已完成', done_at = now() where property_id = pid and name ilike '%stra%' and status <> '已完成';
  end if;
  full_ok := d.property_id is not null and c.property_id is not null
    and d.bedrooms is not null and d.bathrooms is not null and d.max_guests is not null
    and coalesce(d.beds, blank) <> blank and coalesce(d.lock_code, blank) <> blank
    and coalesce(d.wifi_name, blank) <> blank and coalesce(d.wifi_password, blank) <> blank
    and coalesce(c.water, '未填') <> '未填' and coalesce(c.power, '未填') <> '未填'
    and coalesce(c.gas, '未填') <> '未填' and coalesce(c.internet, '未填') <> '未填' and c.end_date is not null;
  if full_ok then
    update public.onboarding_steps set status = '已完成', done_at = now() where property_id = pid and (name like '%房源档案%' or name like '%个体表%') and status <> '已完成';
  end if;
end $$;

create or replace function public.onboarding_autocomplete() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  perform public.onboarding_refresh(new.property_id);
  if tg_table_name = 'property_contracts' and tg_op = 'UPDATE' and new.base_status = '运营中' and old.base_status is distinct from new.base_status then
    update public.onboarding_steps set status = '已完成', done_at = now() where property_id = new.property_id and name = '上线' and status <> '已完成';
  end if;
  return new;
end $$;

create or replace function public.onboarding_on_insert() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  perform public.onboarding_refresh(new.property_id);
  return new;
end $$;
drop trigger if exists trg_ob_refresh on public.onboarding_steps;
create trigger trg_ob_refresh after insert on public.onboarding_steps for each row execute function public.onboarding_on_insert();
