-- 待办清单：加优先级（高/中/低）。时间改按北京时间填，数据库里仍是原样存，不用改。
alter table public.team_tasks add column if not exists priority text not null default '中' check (priority in ('高','中','低'));
