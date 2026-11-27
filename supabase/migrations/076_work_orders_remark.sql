-- 工单备注；主责助理可以删除自己房源下还没完成的工单（已完成的不能删，清洁公司账单要用）
alter table public.work_orders add column if not exists remark text;
drop policy if exists wo_assistant_delete on public.work_orders;
create policy wo_assistant_delete on public.work_orders for delete to authenticated
  using (public.is_my_property(property_id) and status in ('待派单','已派单','已取消'));
notify pgrst, 'reload schema';
