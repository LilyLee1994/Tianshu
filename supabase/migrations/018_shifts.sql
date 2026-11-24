-- 排班：每人每月休息 4 天、居家办公 4 天，月底自己填，提交后锁定，改要管理员批准
alter table public.profiles
  add column partner_id uuid references public.profiles(id),   -- 搭档：自己休息时由搭档代班
  add column backup_id  uuid references public.profiles(id);   -- 备选：搭档也休息时找谁

create table public.shifts (
  user_id uuid not null references public.profiles(id) on delete cascade,
  date date not null,
  kind text not null check (kind in ('休息','居家')),
  primary key (user_id, date)
);
create table public.shift_months (
  user_id uuid not null references public.profiles(id) on delete cascade,
  month date not null,
  status text not null default '草稿' check (status in ('草稿','已提交')),
  submitted_at timestamptz,
  primary key (user_id, month)
);
create table public.shift_requests (
  id bigint generated always as identity primary key,
  user_id uuid not null references public.profiles(id) on delete cascade,
  month date not null,
  reason text,
  status text not null default '待审批' check (status in ('待审批','已批准','已驳回')),
  created_at timestamptz not null default now(),
  decided_at timestamptz
);

alter table public.shifts enable row level security;
alter table public.shift_months enable row level security;
alter table public.shift_requests enable row level security;
grant select on public.shifts, public.shift_months, public.shift_requests to authenticated;
grant all on public.shifts, public.shift_months, public.shift_requests to service_role;
create policy sh_read on public.shifts for select to authenticated using (public.is_staff());
create policy shm_read on public.shift_months for select to authenticated using (public.is_staff());
create policy shr_read on public.shift_requests for select to authenticated using (public.is_staff());
