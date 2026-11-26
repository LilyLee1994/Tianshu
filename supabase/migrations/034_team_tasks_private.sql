-- 待办清单：只有「新建的人」和「被指派的人」能看到；已完成的由新建的人点「关闭」，关闭后这条就从两边消失
alter table public.team_tasks add column if not exists closed_at timestamptz;

drop policy if exists tt_read on public.team_tasks;
drop policy if exists tt_update on public.team_tasks;
drop policy if exists tt_delete on public.team_tasks;
create policy tt_read on public.team_tasks for select to authenticated
  using (created_by = auth.uid() or assignee_id = auth.uid());
create policy tt_update on public.team_tasks for update to authenticated
  using (created_by = auth.uid() or assignee_id = auth.uid())
  with check (created_by = auth.uid() or assignee_id = auth.uid());
create policy tt_delete on public.team_tasks for delete to authenticated using (created_by = auth.uid());

-- 只有新建的人能关闭
create or replace function public.tt_only_creator_closes() returns trigger language plpgsql as $$
begin
  if new.closed_at is distinct from old.closed_at and auth.uid() is not null and auth.uid() <> old.created_by then
    raise exception '只有新建这条待办的人才能关闭它';
  end if;
  return new;
end $$;
drop trigger if exists trg_tt_close on public.team_tasks;
create trigger trg_tt_close before update on public.team_tasks for each row execute function public.tt_only_creator_closes();
