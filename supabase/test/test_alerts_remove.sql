-- 删除订单异常和排班变更的测试数据
delete from public.order_alerts where reservation_id between 990000001 and 990000099;
delete from public.reservations where id between 990000001 and 990000099;
delete from public.shift_requests where reason like '【测试】%';
delete from public.claims where content like '【测试】订单异常%';
select '订单异常的测试数据已删除。' as 结果;
