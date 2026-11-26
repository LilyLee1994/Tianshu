-- 待办：状态只能由被指派的人改（没指定负责人的，新建的人可以改）；新建的人只负责关闭和删除
create or replace function public.tt_guard() returns trigger language plpgsql as $$
begin
  if auth.uid() is not null then
    if new.status is distinct from old.status and auth.uid() <> coalesce(old.assignee_id, old.created_by) then
      raise exception '待办的状态只有被指派的人能改';
    end if;
    if new.closed_at is distinct from old.closed_at and auth.uid() <> old.created_by then
      raise exception '只有新建这条待办的人才能关闭它';
    end if;
  end if;
  return new;
end $$;
drop trigger if exists trg_tt_close on public.team_tasks;
drop trigger if exists trg_tt_guard on public.team_tasks;
create trigger trg_tt_guard before update on public.team_tasks for each row execute function public.tt_guard();
