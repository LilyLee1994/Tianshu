-- 测试数据：给 zoe 的房源造订单异常提醒、索赔，再加一条 zoe 的排班变更申请。全部带「【测试】」，用 test_alerts_remove.sql 一键删除。
-- 假订单的状态是“cancelled”，不会进房东结算、不会派清洁单，也不会影响清洁费同步。
do $$
declare
  p bigint[];
  asst uuid;
  admin_id uuid;
  rid bigint := 990000000;
begin
  -- 重复运行先清掉上一次的
  delete from public.order_alerts where reservation_id between 990000001 and 990000099;
  delete from public.reservations where id between 990000001 and 990000099;
  delete from public.shift_requests where reason like '【测试】%';
  delete from public.claims where content like '【测试】订单异常%';

  select id into asst from public.profiles where account = 'zoe' limit 1;
  if asst is null then raise exception '系统里没有账号名是 zoe 的助理'; end if;
  select id into admin_id from public.profiles where role = 'admin' and active order by created_at limit 1;
  select array_agg(id order by id) into p from (select id from public.properties where assistant_id = asst order by id limit 4) x;
  if p is null or array_length(p, 1) < 3 then raise exception 'zoe 名下的房源不足 3 个（现在 %）', coalesce(array_length(p, 1), 0); end if;

  insert into public.reservations (id, property_id, channel_name, status, guest_name, arrival_date, departure_date, nights, total_price, cleaning_fee, currency, reserved_at) values
    (rid+1, p[1], 'Airbnb',      'cancelled', '【测试】客人 A', current_date + 10, current_date + 13, 3, 1020, 320, 'AUD', now() - interval '1 day'),
    (rid+2, p[2], 'Booking.com', 'cancelled', '【测试】客人 B', current_date + 5,  current_date + 7,  2, 360,  150, 'AUD', now() - interval '2 days'),
    (rid+3, p[3], 'Airbnb',      'cancelled', '【测试】客人 C', current_date + 20, current_date + 22, 2, 0,    0,   'AUD', now() - interval '3 hours'),
    (rid+4, p[1], 'Airbnb',      'cancelled', '【测试】客人 D', current_date - 3,  current_date - 1,  2, 700,  300, 'AUD', now() - interval '6 days');

  insert into public.order_alerts (reservation_id, kind, property_id, detail, status) values
    (rid+1, '清洁费', p[1], 'Airbnb 入住 ' || (current_date + 10) || '：清洁费 $320，这个房源平时是 $380，低了 $60', '待处理'),
    (rid+2, '房费',   p[2], 'Booking.com 入住 ' || (current_date + 5) || '：每晚均价 $105，只有平时（约 $230）的 46%', '待处理'),
    (rid+3, '房费',   p[3], 'Airbnb 入住 ' || (current_date + 20) || '：订单总价是 0', '待处理');
  insert into public.order_alerts (reservation_id, kind, property_id, detail, status, note, handled_by, handled_at)
    values (rid+4, '清洁费', p[1], 'Airbnb 入住 ' || (current_date - 3) || '：清洁费 $300，这个房源平时是 $380，低了 $80', '已处理', '【测试】房东协商过，这单优惠', (select id from public.profiles where role = 'admin' and active order by created_at limit 1), now() - interval '1 day');

  -- zoe 的排班变更申请（管理员总览会出现“排班”待办）
  insert into public.shift_requests (user_id, month, reason)
  values (asst, (date_trunc('month', current_date) + interval '1 month')::date, '【测试】家里有事，想把 12 号的休息换到 15 号');

  -- zoe 的两条索赔（总览会出现“索赔”待办）
  insert into public.claims (property_id, platform, occurred_date, content, claimed_amount, status, created_by) values
    (p[1], 'Airbnb',      current_date - 1, '【测试】订单异常演示：客人损坏沙发垫', 180, '待提交', admin_id),
    (p[2], 'Booking.com', current_date - 4, '【测试】订单异常演示：浴室门损坏',     320, '待提交', admin_id);
end $$;
select '测试数据已添加（zoe）：3 条待处理订单异常、1 条已处理、2 条索赔、1 条排班变更申请。' as 结果;
