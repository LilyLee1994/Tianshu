-- 房源档案：是否自营（公司自己租下来运营的房子，不是替房东托管）
alter table public.property_details add column if not exists self_operated boolean not null default false;
