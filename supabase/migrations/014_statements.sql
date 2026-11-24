-- 房东结算单：每月每个房源一张，草稿 → 已确认 → 已付；确认后不能再改
create table public.fee_rules (key text primary key, value numeric not null, note text);
insert into public.fee_rules values
  ('platform_fee_rate', 0.155, '平台费率（不含 GST）'),
  ('gst_rate', 0.10, 'GST');

create table public.owner_statements (
  id bigint generated always as identity primary key,
  property_id bigint not null references public.properties(id) on delete cascade,
  month date not null,                       -- 当月 1 号
  reservations int not null default 0,
  nights int not null default 0,
  rental_income numeric(12,2) not null default 0,   -- 房费（不含清洁费），按退房日归月
  commission_rate numeric(5,4) not null default 0.15,
  commission numeric(12,2) not null default 0,
  platform_fee numeric(12,2) not null default 0,
  gst numeric(12,2) not null default 0,
  owner_costs numeric(12,2) not null default 0,     -- 房东承担的维修等工单费用
  adjustment numeric(12,2) not null default 0,      -- 手工调整（索赔到账、差评赔偿、代缴水电网扣回等，正数加给房东，负数扣掉）
  adjustment_note text,
  payable numeric(12,2) not null default 0,
  status text not null default '草稿' check (status in ('草稿','已确认','已付')),
  confirmed_at timestamptz, paid_at timestamptz,
  generated_at timestamptz not null default now(),
  unique (property_id, month)
);
create index on public.owner_statements(month);

alter table public.fee_rules enable row level security;
alter table public.owner_statements enable row level security;
grant select on public.fee_rules, public.owner_statements to authenticated;
grant all on public.fee_rules, public.owner_statements to service_role;
create policy fr_read on public.fee_rules for select to authenticated using (public.is_staff());
create policy os_read on public.owner_statements for select to authenticated using (public.is_staff());
