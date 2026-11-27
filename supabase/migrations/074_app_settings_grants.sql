-- 补上 app_settings 的表级授权（已运行过 073 的人只需运行这一个）
grant select, insert, update, delete on public.app_settings to authenticated;
grant all on public.app_settings to service_role;
notify pgrst, 'reload schema';
