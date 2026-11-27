-- 清洁上报损坏后，助理处理完（联系客人 / 提了索赔 / 不用处理）点“已处理”，总览里的提醒才会消失
alter table public.work_orders add column if not exists damage_handled boolean not null default false;
