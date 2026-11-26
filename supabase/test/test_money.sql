-- 给「Gable 07 Granny flat」造一批金额出入假数据（房源档案底部的“金额出入”表格会显示）。
-- 全部带【测试】标记，用 test_money_remove.sql 一键清掉。
do $$
declare pid bigint;
begin
  select id into pid from public.properties where name = 'Gable 07 Granny flat' limit 1;
  if pid is null then raise exception '找不到房源 Gable 07 Granny flat'; end if;

  -- 先清掉上次造的，重复运行不会叠加
  delete from public.review_actions where review_id in (990100001, 990100002);
  delete from public.reviews where id in (990100001, 990100002);
  delete from public.claims where property_id = pid and content like '【测试】%';
  delete from public.work_orders where property_id = pid and description like '【测试】%';
  delete from public.ledger where property_id = pid and reason like '【测试】%';

  -- 收入：索赔到账 2 条（1 条还在处理中，不计入金额）
  insert into public.claims (property_id, platform, occurred_date, content, claimed_amount, status, paid_amount, paid_date) values
    (pid, 'Airbnb', current_date - 40, '【测试】客人损坏沙发垫，平台已赔付', 350, '已赔付', 320, current_date - 25),
    (pid, 'Airbnb', current_date - 18, '【测试】浴室门损坏，平台已赔付', 600, '已赔付', 580, current_date - 6),
    (pid, 'Airbnb', current_date - 3,  '【测试】客人烟熏床单，平台处理中', 200, '平台处理中', null, null);

  -- 支出：差评赔偿 2 条（公司出 / 房东出）
  insert into public.reviews (id, property_id, channel_name, rating, reviewed_at, raw) values
    (990100001, pid, 'Airbnb', 2, now() - interval '30 days', '{"publicReview":"【测试】Place was not clean on arrival."}'),
    (990100002, pid, 'Airbnb', 3, now() - interval '12 days', '{"publicReview":"【测试】Noisy neighbours, WiFi was slow."}');
  insert into public.review_actions (review_id, status, comp_amount, payer, result, note, handled_date) values
    (990100001, '赔偿客人', 60, '公司', '客人已删评', '【测试】退部分房费，客人已删评', current_date - 28),
    (990100002, '赔偿客人', 45, '房东', '等待客人删评', '【测试】补偿一晚的 WiFi 问题', current_date - 10);

  -- 支出：工单费用，清洁 / 维修 / 除草 / 除虫 各一个（含一个没做完的）
  insert into public.work_orders (property_id, type, executor, description, planned_date, done_date, status, amount, payer) values
    (pid, '清洁', '公司派人', '【测试】退房深度清洁（客人弄脏地毯）', current_date - 22, current_date - 22, '已完成', 150, '公司'),
    (pid, '维修', '公司派人', '【测试】修浴室门', current_date - 14, current_date - 14, '已完成', 280, '房东'),
    (pid, '除草', '公司派人', '【测试】院子除草', current_date - 9, current_date - 9, '已完成', 90, '房东'),
    (pid, '除虫', '公司派人', '【测试】蚂蚁处理', current_date + 2, null, '待派单', 120, '待定');

  -- 公司款项：收款 / 退款 / 押金 / 线下转账
  insert into public.ledger (property_id, occurred_date, platform, order_ref, guest_name, check_in, check_out, kind, category, amount, reason, payer, affects_owner, reconciled) values
    (pid, current_date - 20, 'Airbnb', 'HM-TEST01', 'Anna Test', current_date - 24, current_date - 21, '收款', '清洁费', 180, '【测试】清洁费追回', '客人', true, true),
    (pid, current_date - 11, 'Airbnb', 'HM-TEST02', 'Lise Test', current_date - 15, current_date - 12, '退款', '投诉补偿', -95.5, '【测试】客人投诉，退部分房费', '房东', true, false),
    (pid, current_date - 8, 'Booking.com', 'BK-TEST03', 'Andrew Test', current_date - 12, current_date - 9, '押金收取', '押金', 300, '【测试】线下收押金', '无责任', false, false),
    (pid, current_date - 5, 'Booking.com', 'BK-TEST03', 'Andrew Test', current_date - 12, current_date - 9, '押金退还', '押金', -300, '【测试】退房后退押金', '无责任', false, false),
    (pid, current_date - 2, '线下', null, 'Walk-in Test', current_date - 6, current_date - 3, '线下转账', '房费', 420, '【测试】线下单转账到账', '公司', true, false);
end $$;
