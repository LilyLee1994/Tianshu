-- 负责这套房的助理（和管理员）可以填 / 改 Hostaway 房源 ID，房源的其他基本信息仍然只有管理员能改
create or replace function public.set_hostaway_id(p_property bigint, p_id bigint) returns void
language plpgsql security definer set search_path = public as $$
begin
  if not (public.is_admin() or public.is_my_property(p_property)) then raise exception '没有权限：只有这套房的主责助理或管理员能改'; end if;
  begin
    update public.properties set hostaway_id = p_id where id = p_property;
  exception when unique_violation then
    raise exception '这个 Hostaway 房源 ID 已经关联了别的房源';
  end;
end $$;
grant execute on function public.set_hostaway_id(bigint, bigint) to authenticated;
