-- 通用设置表：目前用来存企业微信群机器人的 webhook 地址（师傅群 / 清洁群 / 助理群），只有管理员能读写
create table if not exists public.app_settings (
  key text primary key,
  value text,
  updated_at timestamptz not null default now()
);
alter table public.app_settings enable row level security;
drop policy if exists app_settings_admin on public.app_settings;
create policy app_settings_admin on public.app_settings
  for all using (public.is_admin()) with check (public.is_admin());
notify pgrst, 'reload schema';
