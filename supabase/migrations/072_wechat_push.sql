-- 微信通知：每个人可以填一个 PushPlus 的 token，派单、师傅完成时系统自动给对应的人发微信
alter table public.profiles add column if not exists wechat_token text;
notify pgrst, 'reload schema';
