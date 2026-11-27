-- 维修：amount = 付给师傅的成本；owner_charge = 向房东收取的金额（可以比成本高，差额是公司的利润）
alter table public.work_orders add column if not exists owner_charge numeric(10,2);
