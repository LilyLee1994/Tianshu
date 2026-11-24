-- 订单异常提醒：新订单的清洁费或房费和这个房源平时差得多时，提醒负责人看一眼
create table public.order_alerts (
  reservation_id bigint not null references public.reservations(id) on delete cascade,
  kind text not null check (kind in ('清洁费','房费')),
  property_id bigint references public.properties(id) on delete cascade,
  detail text not null,
  status text not null default '待处理' check (status in ('待处理','已处理')),
  note text,
  handled_by uuid references public.profiles(id),
  handled_at timestamptz,
  created_at timestamptz not null default now(),
  primary key (reservation_id, kind)
);
create index order_alerts_open on public.order_alerts(status, created_at desc);
alter table public.order_alerts enable row level security;
grant select, update on public.order_alerts to authenticated;
grant all on public.order_alerts to service_role;
create policy oa_read on public.order_alerts for select to authenticated using (public.is_staff());
create policy oa_update on public.order_alerts for update to authenticated using (public.is_staff()) with check (public.is_staff());
