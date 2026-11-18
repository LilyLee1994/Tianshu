-- 有些房东自己做清洁：这类房源不自动派清洁单
alter table public.properties add column if not exists cleaning_by text not null default '清洁公司'
  check (cleaning_by in ('清洁公司', '房东自己'));
