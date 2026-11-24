-- 测试数据：订单异常提醒 + 一条排班变更申请。全部带「【测试】」，用 test_alerts_remove.sql 一键删除。
-- 假订单的状态是“cancelled”，不会进房东结算、不会派清洁单，也不会影响清洁费同步。
do $$
declare
  p bigint[];
  asst uuid;
  rid bigint := 990000000;
begin
  -- 优先用已经分配了负责助理的房源
  select array_agg(id order by id) into p from (select id from public.properties where assistant_id is not null order by id limit 4) x;
  if p is null or array_length(p, 1) < 3 then
    select array_agg(id order by id) into p from (select id from public.properties order by id limit 4) x;
  end if;
  if p is null or array_length(p, 1) < 3 then raise exception '房源不足 3 个'; end if;

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

  -- 一条排班变更申请（管理员总览会出现“排班”待办）
  select id into asst from public.profiles where role = 'assistant' and active order by created_at limit 1;
  if asst is not null then
    insert into public.shift_requests (user_id, month, reason)
    values (asst, (date_trunc('month', current_date) + interval '1 month')::date, '【测试】家里有事，想把 12 号的休息换到 15 号');
  end if;
end $$;
select '测试数据已添加：3 条待处理订单异常、1 条已处理、1 条排班变更申请。' as 结果;
