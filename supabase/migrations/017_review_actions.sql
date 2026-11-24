-- 差评处理：每条差评一条处理记录。选「赔偿客人」时填金额和谁出，房东承担的金额进当月房东结算
create table public.review_actions (
  review_id bigint primary key references public.reviews(id) on delete cascade,
  status text not null default '待处理' check (status in ('待处理','已回复','已申诉','赔偿客人','无需处理')),
  comp_amount numeric(10,2),
  payer text check (payer in ('公司','房东')),
  result text check (result in ('等待客人删评','客人已删评','客人没删')),
  note text,
  handled_date date,
  handled_by uuid references public.profiles(id) default auth.uid(),
  updated_at timestamptz not null default now()
);
create index on public.review_actions(handled_date);

alter table public.review_actions enable row level security;
grant select, insert, update on public.review_actions to authenticated;
grant all on public.review_actions to service_role;
create policy ra_read on public.review_actions for select to authenticated using (public.is_staff());
create policy ra_insert on public.review_actions for insert to authenticated with check (public.is_staff());
create policy ra_update on public.review_actions for update to authenticated using (public.is_staff()) with check (public.is_staff());

alter table public.owner_statements add column review_comp numeric(12,2) not null default 0;  -- 房东承担的差评赔偿
