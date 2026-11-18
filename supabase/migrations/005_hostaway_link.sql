-- 房源和 Hostaway 挂牌关联
alter table public.properties add column if not exists hostaway_id bigint unique;
alter table public.properties add column if not exists hostaway_synced_at timestamptz;
