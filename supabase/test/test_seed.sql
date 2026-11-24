-- 测试数据：所有记录的说明里都带「【测试】」，用 test_seed_remove.sql 可以一键删除。
-- 用已有的前 8 个 Hostaway 房源，造索赔、工单（含上个月房东承担的维修费）。
do $$
declare
  p bigint[];
  admin_id uuid;
  lm date := (date_trunc('month', current_date) - interval '1 month')::date;  -- 上个月 1 号
begin
  select array_agg(id order by id) into p from (select id from public.properties where hostaway_id is not null order by id limit 8) x;
  select id into admin_id from public.profiles where role = 'admin' and active order by created_at limit 1;
  if p is null or array_length(p, 1) < 8 then raise exception '房源不足 8 个，请先同步 Hostaway 房源'; end if;

  -- 索赔：各种状态各一条；两条「已赔付」且到账日期在上个月，会进上个月的房东结算
  insert into public.claims (property_id, platform, occurred_date, content, claimed_amount, status, paid_amount, paid_date, created_by) values
    (p[1], 'Airbnb',      current_date - 2,  '【测试】客人损坏沙发垫',        180, '待提交',     null, null, admin_id),
    (p[2], 'Airbnb',      current_date - 5,  '【测试】客人在室内吸烟，需除味', 250, '已提交平台', null, null, admin_id),
    (p[3], 'Booking.com', current_date - 9,  '【测试】浴室门损坏',            320, '平台处理中', null, null, admin_id),
    (p[4], 'Airbnb',      lm + 5,            '【测试】茶几玻璃破裂',          200, '已赔付',     180,  lm + 12, admin_id),
    (p[5], 'Booking.com', lm + 8,            '【测试】地毯污渍',              100, '已赔付',      95,  lm + 18, admin_id),
    (p[6], 'Airbnb',      lm + 3,            '【测试】遥控器丢失',             40, '被驳回',     null, null, admin_id),
    (p[7], 'Airbnb',      lm + 1,            '【测试】小物件缺失',             25, '放弃',       null, null, admin_id);

  -- 上个月已完成、房东承担的费用（会进上个月房东结算的「维修扣款」）
  insert into public.work_orders (property_id, type, executor, description, vendor_name, planned_date, done_date, status, amount, payer, created_by) values
    (p[4], '维修', '公司派人', '【测试】更换水龙头',       '赵师傅', lm + 10, lm + 12, '已完成', 220, '房东', admin_id),
    (p[5], '除草', '公司派人', '【测试】院子除草',         '园艺公司', lm + 14, lm + 15, '已完成',  80, '房东', admin_id),
    (p[2], '维修', '公司派人', '【测试】空调清洗（公司承担，不进结算）', '赵师傅', lm + 6, lm + 7, '已完成', 150, '公司', admin_id);

  -- 进行中的工单，用来看流程和待办
  insert into public.work_orders (property_id, type, executor, description, planned_date, status, payer, urgent, created_by) values
    (p[1], '维修', '公司派人', '【测试】厨房水槽漏水',   current_date + 1, '待派单', '待定', true,  admin_id),
    (p[3], '维修', '公司派人', '【测试】门锁电池更换',   current_date + 2, '已派单', '待定', false, admin_id),
    (p[6], '除虫', '公司派人', '【测试】蚂蚁处理',       current_date + 3, '待确认费用', '待定', false, admin_id);
end $$;

select '已造好：索赔 7 条，工单 6 条。到「房东结算」选上个月，点“重新计算草稿”就能看到。' as 结果;
