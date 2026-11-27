-- 已赔付 / 客人直接赔付的索赔，自动记一笔到“公司款项”（收款 · 索赔）。
-- 对房东结算记为“无”：这笔钱已经通过索赔到账金额进了房东结算，不能算两遍。
alter table public.ledger drop constraint if exists ledger_platform_check;
alter table public.ledger add constraint ledger_platform_check check (platform in ('Airbnb','Booking.com','Vrbo','Terri Scheer','Turvi','直订','线下','其他'));
alter table public.ledger add column if not exists claim_id bigint unique references public.claims(id) on delete cascade;

create or replace function public.sync_claim_ledger() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if new.status in ('已赔付','客人直接赔付') and coalesce(new.paid_amount, 0) > 0 then
    insert into public.ledger (property_id, occurred_date, platform, guest_name, check_out, kind, category, amount, reason, payer, owner_effect, affects_owner, claim_id, created_by)
    values (new.property_id, coalesce(new.paid_date, current_date),
            case when new.platform in ('Airbnb','Booking.com','Terri Scheer','Turvi') then new.platform else '其他' end,
            new.guest_name, new.occurred_date, '收款', '索赔', new.paid_amount,
            '【索赔到账】' || coalesce(new.content, ''),
            case when new.status = '客人直接赔付' then '客人' else '平台' end,
            '无', false, new.id, new.created_by)
    on conflict (claim_id) do update set
      property_id = excluded.property_id, occurred_date = excluded.occurred_date, platform = excluded.platform, guest_name = excluded.guest_name,
      check_out = excluded.check_out, amount = excluded.amount, reason = excluded.reason, payer = excluded.payer;
  else
    delete from public.ledger where claim_id = new.id;
  end if;
  return new;
end $$;
drop trigger if exists trg_claim_ledger on public.claims;
create trigger trg_claim_ledger after insert or update on public.claims for each row execute function public.sync_claim_ledger();

-- 已经赔付过的旧索赔补进来
insert into public.ledger (property_id, occurred_date, platform, guest_name, check_out, kind, category, amount, reason, payer, owner_effect, affects_owner, claim_id, created_by)
select c.property_id, coalesce(c.paid_date, c.occurred_date),
       case when c.platform in ('Airbnb','Booking.com','Terri Scheer','Turvi') then c.platform else '其他' end,
       c.guest_name, c.occurred_date, '收款', '索赔', c.paid_amount, '【索赔到账】' || coalesce(c.content, ''),
       case when c.status = '客人直接赔付' then '客人' else '平台' end, '无', false, c.id, c.created_by
  from public.claims c
 where c.status in ('已赔付','客人直接赔付') and coalesce(c.paid_amount, 0) > 0
on conflict (claim_id) do nothing;
