-- 助理也能新增房源：新增的房源主责助理只能是自己（分配给别人仍然由管理员来做）
create policy properties_assistant_insert on public.properties for insert to authenticated
  with check (public.my_role() = 'assistant' and assistant_id = auth.uid());
