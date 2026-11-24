-- 老账号带密码：[{email, password, google_password}]
alter table public.property_account_info add column old_list jsonb not null default '[]';
