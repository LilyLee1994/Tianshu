-- 删除所有【测试】数据
delete from public.claims where content like '【测试】%';
delete from public.work_orders where description like '【测试】%';
-- 结算单草稿含测试数据的话，回到房东结算页点“重新计算草稿”即可（已确认的结算单不会被改，测试期间请不要点确认）
select '测试数据已删除。' as 结果;
