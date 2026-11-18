-- Hostaway 每日同步的数据：订单、日历快照、评价、同步记录
create table public.reservations (
  id bigint primary key,                       -- Hostaway 订单 ID
  property_id bigint references public.properties(id),
  listing_id bigint,
  channel_name text,
  status text,
  guest_name text,
  arrival_date date, departure_date date, nights int,
  total_price numeric(12,2), cleaning_fee numeric(12,2), channel_commission numeric(12,2),
  currency text,
  reserved_at timestamptz,
  raw jsonb,                                   -- 原始数据全存，字段以后再补
  synced_at timestamptz not null default now()
);
create index on public.reservations(property_id, arrival_date);

-- 每天拍一次未来 180 天的价格和是否已订（以后自建定价系统的数据基础）
create table public.calendar_snapshots (
  property_id bigint not null references public.properties(id) on delete cascade,
  date date not null,
  snapshot_date date not null,
  price numeric(10,2),
  status text,
  is_available boolean,
  min_stay int,
  primary key (property_id, date, snapshot_date)
);
create index on public.calendar_snapshots(snapshot_date);

create table public.reviews (
  id bigint primary key,
  property_id bigint references public.properties(id),
  listing_id bigint,
  channel_name text,
  rating numeric(5,2),
  reviewed_at timestamptz,
  raw jsonb,
  synced_at timestamptz not null default now()
);
create index on public.reviews(property_id, reviewed_at desc);

create table public.sync_runs (
  id bigint generated always as identity primary key,
  kind text not null,
  started_at timestamptz not null default now(),
  finished_at timestamptz,
  ok boolean,
  summary jsonb,
  error text
);

alter table public.reservations enable row level security;
alter table public.calendar_snapshots enable row level security;
alter table public.reviews enable row level security;
alter table public.sync_runs enable row level security;

grant select on public.reservations, public.calendar_snapshots, public.reviews, public.sync_runs to authenticated;
create policy res_read on public.reservations for select to authenticated using (public.is_staff());
create policy cal_read on public.calendar_snapshots for select to authenticated using (public.is_staff());
create policy rev_read on public.reviews for select to authenticated using (public.is_staff());
create policy sync_read on public.sync_runs for select to authenticated using (public.is_staff());
