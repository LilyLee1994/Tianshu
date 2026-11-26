-- 总览页的「待办清单」：时间、事项、状态（未开始/进行中/已完成），可以指定给某个人
create table public.team_tasks (
  id bigint generated always as identity primary key,
  due_at timestamp not null,                       -- 悉尼时间，按填的原样存，不换算时区
  title text not null,
  status text not null default '未开始' check (status in ('未开始','进行中','已完成')),
  assignee_id uuid references public.profiles(id),
  created_by uuid not null default auth.uid() references public.profiles(id),
  created_at timestamptz not null default now(),
  done_at timestamptz
);
create index team_tasks_open on public.team_tasks(status, due_at);
alter table public.team_tasks enable row level security;
grant select, insert, update, delete on public.team_tasks to authenticated;
grant all on public.team_tasks to service_role;
-- 所有员工都能看到全部待办；谁都能新建、指派给任何人
create policy tt_read on public.team_tasks for select to authenticated using (public.is_staff());
create policy tt_insert on public.team_tasks for insert to authenticated with check (public.is_staff() and created_by = auth.uid());
-- 新建的人、被指派的人、管理员可以改状态和内容；新建的人和管理员可以删除
create policy tt_update on public.team_tasks for update to authenticated
  using (public.is_staff() and (created_by = auth.uid() or assignee_id = auth.uid() or public.is_admin()))
  with check (public.is_staff());
create policy tt_delete on public.team_tasks for delete to authenticated using (created_by = auth.uid() or public.is_admin());
