-- 维修向房东多收的部分（收房东 − 师傅成本）自动记入“公司款项”（收款 · 维修加价）。
-- 对房东结算记为“无”：房东已经按“收房东”的金额在结算里扣过了，不能再算一遍。
alter table public.ledger drop constraint if exists ledger_category_check;
alter table public.ledger add constraint ledger_category_check check (category in
  ('房费','清洁费','早入住','晚退房','加人/加晚','延长入住','取消订单','投诉补偿','预防差评','删差评','清洁问题','钥匙/门禁','房东报销','索赔','押金','维修加价','其他'));
alter table public.ledger add column if not exists work_order_id bigint unique references public.work_orders(id) on delete cascade;

create or replace function public.sync_repair_markup_ledger() returns trigger
language plpgsql security definer set search_path = public as $$
declare diff numeric;
begin
  diff := coalesce(new.owner_charge, 0) - coalesce(new.amount, 0);
  if new.type = '维修' and new.payer = '房东' and new.status = '已完成' and new.owner_charge is not null and diff > 0 then
    insert into public.ledger (property_id, occurred_date, platform, kind, category, amount, reason, payer, owner_effect, affects_owner, work_order_id, created_by)
    values (new.property_id, coalesce(new.done_date, current_date), '其他', '收款', '维修加价', diff,
            '【维修加价】' || coalesce(new.description, '') || '（师傅成本 $' || new.amount || '，收房东 $' || new.owner_charge || '，公司赚 $' || diff || '）',
            '房东', '无', false, new.id, auth.uid())
    on conflict (work_order_id) do update set
      property_id = excluded.property_id, occurred_date = excluded.occurred_date, amount = excluded.amount, reason = excluded.reason;
  else
    delete from public.ledger where work_order_id = new.id;
  end if;
  return new;
end $$;
drop trigger if exists trg_repair_markup_ledger on public.work_orders;
create trigger trg_repair_markup_ledger after insert or update on public.work_orders for each row execute function public.sync_repair_markup_ledger();
notify pgrst, 'reload schema';
