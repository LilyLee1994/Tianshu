-- 新建房源时，自动补上空的“基本情况”和“合同”两行，前端直接编辑即可
create or replace function public.create_property_children() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  insert into public.property_details(property_id) values (new.id) on conflict do nothing;
  insert into public.property_contracts(property_id) values (new.id) on conflict do nothing;
  return new;
end $$;

create trigger trg_property_children after insert on public.properties
  for each row execute function public.create_property_children();
