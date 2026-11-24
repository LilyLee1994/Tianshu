-- 公司通用账号：旧 Account 表 admin 页的内容（Google Drive、Gmail、各平台总账号、Hostaway、VPN、保险等）
-- 明文保存，只有管理员能读写。
create table public.company_accounts (
  id bigint generated always as identity primary key,
  reference text not null default '',      -- 名称（原表 Reference 列）
  account text not null default '',
  password text,
  note text,
  extra text,                              -- 原表后面多出来的列，原样保留
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create unique index company_accounts_uq on public.company_accounts(reference, account);
create trigger trg_ca_upd before update on public.company_accounts for each row execute function public.set_updated_at();
alter table public.company_accounts enable row level security;
grant select, insert, update, delete on public.company_accounts to authenticated;
grant all on public.company_accounts to service_role;
create policy ca_admin on public.company_accounts for all to authenticated using (public.is_admin()) with check (public.is_admin());
