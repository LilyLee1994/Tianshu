-- 天枢 第 1 批：账号、房源、合同、工单、清洁费 + 权限（RLS）
-- 在 Supabase 控制台 SQL Editor 里整段粘贴运行一次即可。

-- ========== 通用 ==========
create or replace function public.set_updated_at() returns trigger
language plpgsql as $$ begin new.updated_at = now(); return new; end $$;

-- ========== 用户（对应 Supabase 登录账号） ==========
-- 登录名 = 账号，系统内部用 账号@tianshu.local 当邮箱，用户不需要真实邮箱。
create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  account text not null unique,
  name text not null,
  role text not null check (role in ('admin','assistant','ops','finance','repairman','cleaner')),
  contact text,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create trigger trg_profiles_upd before update on public.profiles for each row execute function public.set_updated_at();

-- 当前登录人的角色 / 是否员工 / 是否管理员（security definer 避免 RLS 递归）
create or replace function public.my_role() returns text
language sql stable security definer set search_path = public as $$
  select role from public.profiles where id = auth.uid() and active
$$;
create or replace function public.is_staff() returns boolean
language sql stable security definer set search_path = public as $$
  select coalesce(public.my_role() in ('admin','assistant','ops','finance'), false)
$$;
create or replace function public.is_admin() returns boolean
language sql stable security definer set search_path = public as $$
  select coalesce(public.my_role() = 'admin', false)
$$;

-- ========== 房东 ==========
create table public.owners (
  id bigint generated always as identity primary key,
  name text not null,
  contact text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create trigger trg_owners_upd before update on public.owners for each row execute function public.set_updated_at();

-- ========== 物业 ==========
create table public.properties (
  id bigint generated always as identity primary key,
  name text not null unique,
  address text,
  region text,
  assistant_id uuid references public.profiles(id),   -- 主责助理
  owner_id bigint references public.owners(id),
  commission_rate numeric(5,4) not null default 0.15,
  airbnb_url text,
  booking_url text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create trigger trg_properties_upd before update on public.properties for each row execute function public.set_updated_at();
create index on public.properties(assistant_id);

-- 当前登录人是不是这个物业的主责助理
create or replace function public.is_my_property(pid bigint) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.properties where id = pid and assistant_id = auth.uid())
$$;

-- ========== 物业基本情况（锁盒密码、WiFi 等） ==========
create table public.property_details (
  property_id bigint primary key references public.properties(id) on delete cascade,
  bedrooms int, bathrooms int, max_guests int,
  beds text,
  appliances text[] not null default '{}',
  lock_location text, lock_code text,
  wifi_name text, wifi_password text,
  parking text, bin_day text, notes text,
  updated_at timestamptz not null default now()
);
create trigger trg_pd_upd before update on public.property_details for each row execute function public.set_updated_at();

-- ========== 合同（水电燃气网络谁负责 + 到期日） ==========
create table public.property_contracts (
  property_id bigint primary key references public.properties(id) on delete cascade,
  water text not null default '未填',
  power text not null default '未填',
  gas text not null default '未填',
  internet text not null default '未填',
  recharge_back text not null default '未填',
  end_date date,
  base_status text not null default '运营中' check (base_status in ('筹备中','运营中')),
  updated_at timestamptz not null default now()
);
create trigger trg_pc_upd before update on public.property_contracts for each row execute function public.set_updated_at();

-- ========== 工单 ==========
create table public.work_orders (
  id bigint generated always as identity primary key,
  property_id bigint not null references public.properties(id),
  type text not null check (type in ('清洁','维修','除草','除虫')),
  executor text check (executor in ('公司派人','房东自己')),
  description text,
  assigned_to uuid references public.profiles(id),     -- 指派给（赵师傅 / 清洁公司账号）
  vendor_name text,
  planned_date date,
  done_date date,
  status text not null default '待派单',
  amount numeric(10,2),
  payer text not null default '待定' check (payer in ('公司','房东','待定')),
  owner_notified boolean not null default false,
  urgent boolean not null default false,               -- 次日有入住
  damage_report text,
  damage_photos text[] not null default '{}',
  photos text[] not null default '{}',
  reservation_id bigint,                               -- 以后关联订单
  created_by uuid references public.profiles(id) default auth.uid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create trigger trg_wo_upd before update on public.work_orders for each row execute function public.set_updated_at();
create index on public.work_orders(property_id, created_at desc);
create index on public.work_orders(assigned_to);
create index on public.work_orders(status);

-- ========== 清洁费（按生效日期留历史） ==========
create table public.cleaning_fees (
  id bigint generated always as identity primary key,
  property_id bigint not null references public.properties(id) on delete cascade,
  standard_fee numeric(8,2) not null,     -- 付清洁公司：普通清洁
  deep_fee numeric(8,2) not null,         -- 付清洁公司：深度清洁
  guest_fee numeric(8,2) not null,        -- 向客人收取
  effective_date date not null,
  updated_by uuid references public.profiles(id) default auth.uid(),
  created_at timestamptz not null default now(),
  unique (property_id, effective_date)
);

-- ========== 权限：先全部锁死，再按角色放开 ==========
alter table public.profiles enable row level security;
alter table public.owners enable row level security;
alter table public.properties enable row level security;
alter table public.property_details enable row level security;
alter table public.property_contracts enable row level security;
alter table public.work_orders enable row level security;
alter table public.cleaning_fees enable row level security;

grant select, insert, update, delete on
  public.profiles, public.owners, public.properties, public.property_details,
  public.property_contracts, public.work_orders, public.cleaning_fees
to authenticated;

-- profiles：自己能看自己，员工能看全部；只有管理员能增改
create policy profiles_read on public.profiles for select to authenticated
  using (id = auth.uid() or public.is_staff());
create policy profiles_admin_write on public.profiles for all to authenticated
  using (public.is_admin()) with check (public.is_admin());

-- owners：管理员和财务
create policy owners_read on public.owners for select to authenticated
  using (public.my_role() in ('admin','finance'));
create policy owners_admin_write on public.owners for all to authenticated
  using (public.is_admin()) with check (public.is_admin());

-- properties：员工都能看（客服要能查全部房源接电话）；只有管理员能增改
create policy properties_read on public.properties for select to authenticated
  using (public.is_staff());
create policy properties_admin_write on public.properties for all to authenticated
  using (public.is_admin()) with check (public.is_admin());

-- property_details：员工都能看；管理员或该物业主责助理能改
create policy pd_read on public.property_details for select to authenticated
  using (public.is_staff());
create policy pd_write on public.property_details for all to authenticated
  using (public.is_admin() or public.is_my_property(property_id))
  with check (public.is_admin() or public.is_my_property(property_id));

-- property_contracts：员工都能看（含客服，财务信息对客服可见）；管理员或主责助理能改
create policy pc_read on public.property_contracts for select to authenticated
  using (public.is_staff());
create policy pc_write on public.property_contracts for all to authenticated
  using (public.is_admin() or public.is_my_property(property_id))
  with check (public.is_admin() or public.is_my_property(property_id));

-- work_orders：员工看全部；员工都能新建；管理员/运营/财务/主责助理能改；
-- 维修师傅和清洁公司只能看派给自己的单（他们提交完成情况走后端函数，下一批做）
create policy wo_staff_read on public.work_orders for select to authenticated
  using (public.is_staff());
create policy wo_worker_read on public.work_orders for select to authenticated
  using (assigned_to = auth.uid());
create policy wo_staff_insert on public.work_orders for insert to authenticated
  with check (public.is_staff());
create policy wo_staff_update on public.work_orders for update to authenticated
  using (public.my_role() in ('admin','ops','finance') or public.is_my_property(property_id))
  with check (public.my_role() in ('admin','ops','finance') or public.is_my_property(property_id));
create policy wo_admin_delete on public.work_orders for delete to authenticated
  using (public.is_admin());

-- cleaning_fees：员工都能看；管理员和财务能改
create policy cf_read on public.cleaning_fees for select to authenticated
  using (public.is_staff());
create policy cf_write on public.cleaning_fees for all to authenticated
  using (public.my_role() in ('admin','finance')) with check (public.my_role() in ('admin','finance'));
