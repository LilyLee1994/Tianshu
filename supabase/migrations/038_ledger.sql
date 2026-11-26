-- 公司款项（款项登记）：每笔和订单相关的收款、退款、押金、线下转账。
-- 金额带正负：收入为正，支出（退款、退押金）为负。页面上填的是正数，系统按“类型”自动加正负号。
create table public.ledger (
  id bigint generated always as identity primary key,
  property_id bigint not null references public.properties(id),
  occurred_date date not null default current_date,
  platform text not null default 'Airbnb' check (platform in ('Airbnb','Booking.com','Vrbo','直订','线下','其他')),
  order_ref text,
  guest_name text,
  check_in date,
  check_out date,
  kind text not null check (kind in ('收款','退款','押金收取','押金退还','线下转账')),
  category text not null default '其他' check (category in ('房费','清洁费','早入住','晚退房','加人/加晚','延长入住','取消订单','投诉补偿','预防差评','索赔','押金','其他')),
  amount numeric(12,2) not null,
  reason text,
  payer text check (payer in ('公司','房东','清洁公司','客人','平台','无责任')),
  affects_owner boolean not null default false,      -- 影响房东结算
  reconciled boolean not null default false,         -- 已对账
  created_by uuid references public.profiles(id) default auth.uid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create trigger trg_ledger_upd before update on public.ledger for each row execute function public.set_updated_at();
create index on public.ledger(property_id, occurred_date desc);
create index on public.ledger(occurred_date);

alter table public.ledger enable row level security;
grant select, insert, update, delete on public.ledger to authenticated;
grant all on public.ledger to service_role;
create policy ledger_read on public.ledger for select to authenticated using (public.is_staff());
create policy ledger_insert on public.ledger for insert to authenticated with check (public.is_staff());
create policy ledger_update on public.ledger for update to authenticated using (public.is_staff()) with check (public.is_staff());
create policy ledger_delete on public.ledger for delete to authenticated using (public.is_admin());
-- 修改记录（025 迁移里的功能）：如果 025 已经运行过就挂上；没运行过就先跳过，之后运行 025 再重新运行本文件即可
do $$ begin
  if exists (select 1 from pg_proc where proname = 'log_edit' and pronamespace = 'public'::regnamespace) then
    drop trigger if exists trg_log_ledger on public.ledger;
    create trigger trg_log_ledger after insert or update or delete on public.ledger for each row execute function public.log_edit();
  end if;
end $$;
