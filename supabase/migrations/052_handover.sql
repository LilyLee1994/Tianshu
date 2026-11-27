-- 交接备注：助理休息前给代班人留话，挂在房源上，只能新增，不能改删
create table if not exists public.handover_notes (
  id bigint generated always as identity primary key,
  property_id bigint not null references public.properties(id) on delete cascade,
  note text not null,
  created_by uuid default auth.uid() references public.profiles(id),
  created_at timestamptz not null default now()
);
create index if not exists handover_notes_prop on public.handover_notes(property_id, created_at desc);

alter table public.handover_notes enable row level security;
grant select, insert on public.handover_notes to authenticated;
grant all on public.handover_notes to service_role;
drop policy if exists handover_read on public.handover_notes;
drop policy if exists handover_insert on public.handover_notes;
create policy handover_read on public.handover_notes for select to authenticated using (public.is_staff());
create policy handover_insert on public.handover_notes for insert to authenticated with check (public.is_staff() and created_by = auth.uid());
