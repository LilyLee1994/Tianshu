-- 「运营阶段」和上线流程最后一步「上线」双向同步：
--  · 房源档案里把运营阶段改成「运营中」（已上线）→ 上线流程的「上线」自动完成
--  · 上线流程里「上线」标为已完成 → 房源档案的运营阶段变成「运营中」；改回未完成 → 变回「筹备中」
--  · 开始上线流程时，这套房的运营阶段自动设为「筹备中」（否则新房源默认就是运营中，没法区分）

-- 1) 档案 → 流程：在 044 的函数里加上“运营阶段变成运营中”这一条
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

  full_ok := d.property_id is not null and c.property_id is not null
    and d.bedrooms is not null and d.bathrooms is not null and d.max_guests is not null
    and coalesce(d.beds, blank) <> blank and coalesce(d.lock_code, blank) <> blank
    and coalesce(d.wifi_name, blank) <> blank and coalesce(d.wifi_password, blank) <> blank
    and coalesce(c.water, '未填') <> '未填' and coalesce(c.power, '未填') <> '未填'
    and coalesce(c.gas, '未填') <> '未填' and coalesce(c.internet, '未填') <> '未填' and c.end_date is not null;
  if full_ok then
    update public.onboarding_steps set status = '已完成', done_at = now() where property_id = pid and (name like '%房源档案%' or name like '%个体表%') and status <> '已完成';
  end if;

  -- 运营阶段从别的值改成「运营中」（只在真正改动时算，新建房源时的默认值不算）
  if tg_table_name = 'property_contracts' and tg_op = 'UPDATE' and new.base_status = '运营中' and old.base_status is distinct from new.base_status then
    update public.onboarding_steps set status = '已完成', done_at = now() where property_id = pid and name = '上线' and status <> '已完成';
  end if;
  return new;
end $$;

-- 2) 流程 → 档案
create or replace function public.onboarding_sync_launch() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if new.name <> '上线' then return new; end if;
  if tg_op = 'INSERT' then
    if new.status <> '已完成' then
      update public.property_contracts set base_status = '筹备中' where property_id = new.property_id and base_status <> '筹备中';
    end if;
  elsif old.status is distinct from new.status then
    update public.property_contracts set base_status = case when new.status = '已完成' then '运营中' else '筹备中' end
     where property_id = new.property_id and base_status <> case when new.status = '已完成' then '运营中' else '筹备中' end;
  end if;
  return new;
end $$;
drop trigger if exists trg_ob_launch on public.onboarding_steps;
create trigger trg_ob_launch after insert or update on public.onboarding_steps for each row execute function public.onboarding_sync_launch();

-- 3) 已经在进行的流程：对齐一次
update public.property_contracts c set base_status = '筹备中'
 where exists (select 1 from public.onboarding_steps s where s.property_id = c.property_id and s.name = '上线' and s.status <> '已完成') and c.base_status <> '筹备中';
update public.property_contracts c set base_status = '运营中'
 where exists (select 1 from public.onboarding_steps s where s.property_id = c.property_id and s.name = '上线' and s.status = '已完成') and c.base_status <> '运营中';
