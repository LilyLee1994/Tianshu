-- 索赔到账的钱不一定全给房东：新增“给房东的金额”。不填（空）就是全部给房东。房东结算里“索赔到账”按这个金额算。
alter table public.claims add column if not exists owner_amount numeric(12,2);
alter table public.claims drop constraint if exists claims_owner_amount_check;
alter table public.claims add constraint claims_owner_amount_check check (owner_amount is null or owner_amount >= 0);

-- 公司款项里自动记的那笔，说明里写上给房东多少
create or replace function public.sync_claim_ledger() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if new.status in ('已赔付','客人直接赔付') and coalesce(new.paid_amount, 0) > 0 then
    insert into public.ledger (property_id, occurred_date, platform, guest_name, check_out, kind, category, amount, reason, payer, owner_effect, affects_owner, claim_id, created_by)
    values (new.property_id, coalesce(new.paid_date, current_date),
            case when new.platform in ('Airbnb','Booking.com','Terri Scheer','Turvi') then new.platform else '其他' end,
            new.guest_name, new.occurred_date, '收款', '索赔', new.paid_amount,
            '【索赔到账】' || coalesce(new.content, '') ||
              case when new.owner_amount is not null and new.owner_amount <> new.paid_amount then '（其中给房东 $' || new.owner_amount || '）' else '' end,
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
