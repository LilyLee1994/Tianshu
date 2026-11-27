-- 维修工月度结算：记录每张工单是否已经和师傅结算过
alter table public.work_orders add column if not exists settled_at timestamptz;
create index if not exists work_orders_done_type on public.work_orders(done_date, type);
