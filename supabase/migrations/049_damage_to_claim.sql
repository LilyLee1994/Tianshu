-- 清洁上报损坏 → 自动生成一条"待提交"索赔，并把已有的上报补进去
alter table public.claims add column if not exists work_order_id bigint references public.work_orders(id);
create unique index if not exists claims_work_order_uq on public.claims(work_order_id) where work_order_id is not null;

insert into public.claims (property_id, platform, occurred_date, content, status, photos, work_order_id)
select w.property_id, 'Airbnb', coalesce(w.done_date, w.created_at::date), '【清洁上报损坏】' || w.damage_report, '待提交',
       coalesce(w.damage_photos, '{}'), w.id
from public.work_orders w
where w.damage_report is not null and w.status <> '已取消'
  and not exists (select 1 from public.claims c where c.work_order_id = w.id);

update public.work_orders set damage_handled = true where damage_report is not null;
