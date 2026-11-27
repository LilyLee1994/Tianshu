-- 清洁单只在退房当天发企业微信通知，记录通知过没有，避免重复发
alter table public.work_orders add column if not exists notified_at timestamptz;
notify pgrst, 'reload schema';
