-- 房源档案里“编辑账号”：管理员，以及这套房的主责助理都能用。
-- 一次性完成：改当前账号 / 换新账号（旧账号自动变老账号）/ 老账号增删改（含密码）。
-- 用函数做是因为助理本来没有改账号库和房源的权限，这里在函数里检查“是不是自己的房源”，再统一写入；修改记录里仍然记的是操作人本人。
create or replace function public.save_property_accounts(
  p_property bigint, p_replace boolean, p_login text, p_password text, p_google text, p_olds jsonb
) returns void language plpgsql security definer set search_path = public as $$
declare
  v_login text := trim(p_login);
  v_pw text := nullif(trim(coalesce(p_password, '')), '');
  v_gp text := nullif(trim(coalesce(p_google, '')), '');
  v_cur_id bigint;
  v_prev public.platform_accounts;
  v_id bigint;
  v_list jsonb := coalesce(p_olds, '[]'::jsonb);
  o jsonb; em text; opw text; ogp text;
  v_emails text[] := '{}';
begin
  if auth.uid() is null then raise exception '请先登录'; end if;
  if not (public.is_admin() or exists (select 1 from public.properties where id = p_property and assistant_id = auth.uid())) then
    raise exception '没有权限修改这套房的账号';
  end if;
  if v_login = '' then raise exception '登录邮箱要填'; end if;

  select airbnb_account_id into v_cur_id from public.properties where id = p_property;
  if v_cur_id is not null then select * into v_prev from public.platform_accounts where id = v_cur_id; end if;

  if p_replace or v_cur_id is null then
    select id into v_id from public.platform_accounts where platform = 'Airbnb' and lower(login) = lower(v_login) limit 1;
    if v_id is not null then
      update public.platform_accounts set password = v_pw, google_password = v_gp where id = v_id;
    else
      insert into public.platform_accounts (platform, login, password, google_password) values ('Airbnb', v_login, v_pw, v_gp) returning id into v_id;
    end if;
    update public.properties set airbnb_account_id = v_id where id = p_property;
    -- 原来的账号变成老账号
    if v_prev.id is not null and lower(v_prev.login) <> lower(v_login) then
      v_list := jsonb_build_array(jsonb_build_object('email', v_prev.login, 'password', coalesce(v_prev.password, ''), 'google', coalesce(v_prev.google_password, ''))) || v_list;
    end if;
  else
    update public.platform_accounts set login = v_login, password = v_pw, google_password = v_gp where id = v_cur_id;
  end if;

  -- 老账号：邮箱统一存小写；密码存进账号库（没有就新建，标记已下线）
  for o in select * from jsonb_array_elements(v_list) loop
    em := lower(trim(coalesce(o->>'email', '')));
    if em = '' or em = lower(v_login) or em = any(v_emails) then continue; end if;
    v_emails := v_emails || em;
    opw := nullif(trim(coalesce(o->>'password', '')), '');
    ogp := nullif(trim(coalesce(o->>'google', '')), '');
    select id into v_id from public.platform_accounts where platform = 'Airbnb' and lower(login) = em limit 1;
    if v_id is not null then
      update public.platform_accounts set password = opw, google_password = ogp where id = v_id;
    elsif opw is not null or ogp is not null then
      insert into public.platform_accounts (platform, login, status, password, google_password) values ('Airbnb', em, '已下线', opw, ogp);
    end if;
  end loop;

  insert into public.property_account_info (property_id, old_accounts) values (p_property, v_emails)
  on conflict (property_id) do update set old_accounts = excluded.old_accounts;
end $$;
grant execute on function public.save_property_accounts(bigint, boolean, text, text, text, jsonb) to authenticated;
