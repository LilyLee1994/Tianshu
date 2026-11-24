-- 房源的老账号（原表“旧帐号”列，以及备注里写着“老账号/旧帐号”的邮箱）
alter table public.property_account_info add column old_accounts text[] not null default '{}';
