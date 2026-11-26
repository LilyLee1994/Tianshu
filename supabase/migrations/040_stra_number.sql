-- 房源的 STRA 注册编号（NSW 短租登记）。在“新房源上线”里完成「注册 STRA」时填写，会同步显示在房源档案。
alter table public.property_details add column if not exists stra_number text;
