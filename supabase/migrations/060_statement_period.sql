-- 房东结算单改成按日期范围生成：每张结算单有起止日期（含首尾），原来的整月结算单自动补上当月 1 号到月底
alter table public.owner_statements add column if not exists period_start date;
alter table public.owner_statements add column if not exists period_end date;
update public.owner_statements
   set period_start = month, period_end = (month + interval '1 month' - interval '1 day')::date
 where period_start is null;
alter table public.owner_statements alter column period_start set not null;
alter table public.owner_statements alter column period_end set not null;
alter table public.owner_statements drop constraint if exists owner_statements_property_id_month_key;
alter table public.owner_statements drop constraint if exists owner_statements_property_period_key;
alter table public.owner_statements add constraint owner_statements_property_period_key unique (property_id, period_start, period_end);
create index if not exists owner_statements_period on public.owner_statements(period_start, period_end);
