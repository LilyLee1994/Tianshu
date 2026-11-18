-- 自动派清洁：每个房源指定默认清洁公司；同一个订单只生成一张清洁单
alter table public.properties add column if not exists cleaner_id uuid references public.profiles(id);
create unique index if not exists work_orders_clean_per_reservation
  on public.work_orders(reservation_id) where type = '清洁' and reservation_id is not null;
