-- 标准清洁费（来自「清洁费」表）：AIRBNB 列、ALISA 列各存一份，用来和 Hostaway 订单里的实际清洁费对比
alter table public.property_details
  add column if not exists std_clean_airbnb numeric(8,2),
  add column if not exists std_clean_alisa  numeric(8,2),
  add column if not exists std_clean_guests int,        -- 表里的“入住人数”
  add column if not exists std_clean_sofa   boolean;    -- 表里的“含（sofa）”
