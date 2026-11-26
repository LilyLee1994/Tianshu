-- 新房源上线流程：一套标准步骤（模板），每个新房源开始上线时按模板生成一份，逐项跟进。
create table public.onboarding_template (
  seq int primary key,
  name text not null,
  owner text                      -- 默认对接人（文字，可以写多个人/角色）
);
insert into public.onboarding_template (seq, name, owner) values
  (1, '签合同', 'Niu'),
  (2, '注册 STRA', 'Niu'),
  (3, '家具软装的安装和运输', 'Alisa、Adam、家具商、赵师傅'),
  (4, 'Initial cleaning 和 set up', 'Alisa'),
  (5, '拍照', 'Jackson、Axel'),
  (6, '检查', 'Alisa'),
  (7, '填写房源个体表和 Bill 表', '待安排'),
  (8, 'Guidebook', '客服'),
  (9, '上线', '客服'),
  (10, '仓储', '待安排');

create table public.onboarding_steps (
  id bigint generated always as identity primary key,
  property_id bigint not null references public.properties(id) on delete cascade,
  seq int not null,
  name text not null,
  owner text,
  status text not null default '未完成' check (status in ('未完成','进行中','已完成')),
  note text,
  done_at timestamptz,
  updated_at timestamptz not null default now()
);
create index on public.onboarding_steps(property_id, seq);
create trigger trg_ob_upd before update on public.onboarding_steps for each row execute function public.set_updated_at();

alter table public.onboarding_template enable row level security;
alter table public.onboarding_steps enable row level security;
grant select, insert, update, delete on public.onboarding_template, public.onboarding_steps to authenticated;
grant all on public.onboarding_template, public.onboarding_steps to service_role;
create policy obt_read on public.onboarding_template for select to authenticated using (public.is_staff());
create policy obt_admin on public.onboarding_template for all to authenticated using (public.is_admin()) with check (public.is_admin());
create policy obs_read on public.onboarding_steps for select to authenticated using (public.is_staff());
create policy obs_insert on public.onboarding_steps for insert to authenticated with check (public.is_staff());
create policy obs_update on public.onboarding_steps for update to authenticated using (public.is_staff()) with check (public.is_staff());
create policy obs_delete on public.onboarding_steps for delete to authenticated using (public.is_staff());
