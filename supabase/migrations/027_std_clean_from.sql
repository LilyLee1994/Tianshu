-- 标准清洁费改为“按 Hostaway 为准”后，记录从哪天起生效；这天之前入住的旧订单不再参与核对
alter table public.property_details add column if not exists std_clean_from date;
