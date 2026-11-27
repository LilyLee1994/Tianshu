-- 索赔记入公司款项时，只记“公司留下的部分”（到账金额 − 给房东的金额）。
-- 给房东的那部分不是公司的钱，已经在房东结算里算给房东了；全部给房东（没填“给房东的金额”）时，公司款项里不记。
create or replace function public.sync_claim_ledger() returns trigger
language plpgsql security definer set search_path = public as $$
declare share numeric;
begin
  share := coalesce(new.paid_amount, 0) - coalesce(new.owner_amount, new.paid_amount, 0);
  if new.status in ('已赔付','客人直接赔付') and share > 0 then
    insert into public.ledger (property_id, occurred_date, platform, guest_name, check_out, kind, category, amount, reason, payer, owner_effect, affects_owner, claim_id, created_by)
    values (new.property_id, coalesce(new.paid_date, current_date),
            case when new.platform in ('Airbnb','Booking.com','Terri Scheer','Turvi') then new.platform else '其他' end,
            new.guest_name, new.occurred_date, '收款', '索赔', share,
            '【索赔到账】' || coalesce(new.content, '') || '（到账 $' || new.paid_amount || '，给房东 $' || coalesce(new.owner_amount, 0) || '，公司留 $' || share || '）',
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

-- 按新规则重新整理已有的索赔记录
update public.claims set updated_at = updated_at where status in ('已赔付','客人直接赔付');
