-- 从 Hostaway 同步来的历史房源：已经在运营，合同信息查不到，不需要登记
alter table public.properties add column if not exists legacy boolean not null default false;
update public.properties set legacy = true where hostaway_id is not null;
