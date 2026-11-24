-- 修改记录：谁、什么时候、改了哪个字段（旧值 → 新值）。由数据库触发器自动记，页面上改的都会留痕。
-- 只记「登录用户」的操作；同步脚本（后台程序）的写入不记，避免刷屏。只有管理员能看。
create table public.edit_log (
  id bigint generated always as identity primary key,
  table_name text not null,
  row_id text not null,
  label text,
  action text not null check (action in ('新增','修改','删除')),
  changes jsonb,                       -- 修改：{字段:{old,new}}；新增/删除：整行
  actor uuid,
  actor_name text,
  at timestamptz not null default now()
);
create index edit_log_row on public.edit_log(table_name, row_id, at desc);
create index edit_log_at on public.edit_log(at desc);
alter table public.edit_log enable row level security;
grant select on public.edit_log to authenticated;
grant all on public.edit_log to service_role;
create policy el_admin_read on public.edit_log for select to authenticated using (public.is_admin());

-- 账号表上直接记「最后修改人」
alter table public.platform_accounts add column updated_by uuid, add column updated_by_name text;
alter table public.company_accounts add column updated_by uuid, add column updated_by_name text;

create or replace function public.set_editor() returns trigger language plpgsql security definer set search_path = public as $$
begin
  if auth.uid() is not null then
    new.updated_by := auth.uid();
    new.updated_by_name := (select name from public.profiles where id = auth.uid());
  end if;
  return new;
end $$;
create trigger trg_pa_editor before insert or update on public.platform_accounts for each row execute function public.set_editor();
create trigger trg_ca_editor before insert or update on public.company_accounts for each row execute function public.set_editor();

create or replace function public.log_edit() returns trigger language plpgsql security definer set search_path = public as $$
declare o jsonb; n jsonb; diff jsonb; rid text; lbl text; who text;
begin
  if auth.uid() is null then return coalesce(new, old); end if;
  who := (select name from public.profiles where id = auth.uid());
  o := case when tg_op = 'INSERT' then null else to_jsonb(old) end;
  n := case when tg_op = 'DELETE' then null else to_jsonb(new) end;
  rid := coalesce(n->>'id', o->>'id', n->>'property_id', o->>'property_id');
  lbl := coalesce(n->>'name', o->>'name', n->>'login', o->>'login', n->>'reference', o->>'reference', '房源#' || rid);
  if tg_op = 'UPDATE' then
    select jsonb_object_agg(k, jsonb_build_object('old', o->k, 'new', n->k)) into diff
      from jsonb_object_keys(n) k
     where (o->k) is distinct from (n->k) and k not in ('updated_at','updated_by','updated_by_name','created_at');
    if diff is null then return new; end if;
    insert into public.edit_log(table_name,row_id,label,action,changes,actor,actor_name) values (tg_table_name,rid,lbl,'修改',diff,auth.uid(),who);
  elsif tg_op = 'INSERT' then
    insert into public.edit_log(table_name,row_id,label,action,changes,actor,actor_name) values (tg_table_name,rid,lbl,'新增',null,auth.uid(),who);
  else
    insert into public.edit_log(table_name,row_id,label,action,changes,actor,actor_name) values (tg_table_name,rid,lbl,'删除',o,auth.uid(),who);
  end if;
  return coalesce(new, old);
end $$;

create trigger trg_log_pa after insert or update or delete on public.platform_accounts for each row execute function public.log_edit();
create trigger trg_log_ca after insert or update or delete on public.company_accounts for each row execute function public.log_edit();
create trigger trg_log_pai after insert or update or delete on public.property_account_info for each row execute function public.log_edit();
create trigger trg_log_prop after update or delete on public.properties for each row execute function public.log_edit();
create trigger trg_log_pd after update on public.property_details for each row execute function public.log_edit();
create trigger trg_log_pc after update on public.property_contracts for each row execute function public.log_edit();
