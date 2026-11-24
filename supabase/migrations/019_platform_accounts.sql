-- 平台账号：登录邮箱和密码（明文，按你的要求）。
-- 谁能看：管理员，以及「这个账号下有房源分配给自己」的客服助理；其他人读不到这张表。
create table public.platform_accounts (
  id bigint generated always as identity primary key,
  platform text not null default 'Airbnb' check (platform in ('Airbnb','Booking.com','Vrbo','Google','其他')),
  login text not null,
  needs_verification boolean not null default false,
  note text,
  status text not null default '在用' check (status in ('在用','已下线')),
  password text,            -- 平台登录密码
  google_password text,     -- 绑定的 Google 密码
  other_info text,          -- 旧账号、Vrbo、Booking、备注等原表里的其他文字
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (platform, login)
);
create trigger trg_pa_upd before update on public.platform_accounts for each row execute function public.set_updated_at();

alter table public.properties
  add column airbnb_account_id bigint references public.platform_accounts(id),
  add column booking_account_id bigint references public.platform_accounts(id);

alter table public.platform_accounts enable row level security;
grant select, insert, update, delete on public.platform_accounts to authenticated;
grant all on public.platform_accounts to service_role;
create policy pa_admin on public.platform_accounts for all to authenticated using (public.is_admin()) with check (public.is_admin());
create policy pa_assistant_read on public.platform_accounts for select to authenticated using (
  exists (select 1 from public.properties p where p.assistant_id = auth.uid()
          and (p.airbnb_account_id = platform_accounts.id or p.booking_account_id = platform_accounts.id))
);
