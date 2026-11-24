-- 索赔：客服向平台发起，登记后由跟进人更新状态和到账金额；「已赔付」的到账金额自动进当月房东结算
create table public.claims (
  id bigint generated always as identity primary key,
  property_id bigint not null references public.properties(id),
  platform text not null default 'Airbnb' check (platform in ('Airbnb','Booking.com','其他')),
  occurred_date date not null default current_date,
  content text not null,
  claimed_amount numeric(10,2),
  status text not null default '待提交' check (status in ('待提交','已提交平台','平台处理中','已赔付','被驳回','放弃')),
  paid_amount numeric(10,2),
  paid_date date,
  photos text[] not null default '{}',
  created_by uuid references public.profiles(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index on public.claims(property_id);
create index on public.claims(paid_date);

alter table public.claims enable row level security;
grant select, insert, update on public.claims to authenticated;
grant all on public.claims to service_role;
create policy claims_read on public.claims for select to authenticated using (public.is_staff());
create policy claims_insert on public.claims for insert to authenticated with check (public.is_staff() and created_by = auth.uid());
create policy claims_update on public.claims for update to authenticated using (public.is_staff()) with check (public.is_staff());

-- 结算单增加「索赔到账」一列
alter table public.owner_statements add column claims_in numeric(12,2) not null default 0;
