-- 清掉 test_money.sql 造的金额假数据
delete from public.review_actions where review_id in (990100001, 990100002);
delete from public.reviews where id in (990100001, 990100002);
delete from public.claims where content like '【测试】%' and property_id = (select id from public.properties where name = 'Gable 07 Granny flat' limit 1);
delete from public.work_orders where description like '【测试】%' and property_id = (select id from public.properties where name = 'Gable 07 Granny flat' limit 1);
delete from public.ledger where reason like '【测试】%' and property_id = (select id from public.properties where name = 'Gable 07 Granny flat' limit 1);
