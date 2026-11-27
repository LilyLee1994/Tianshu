-- 索赔增加“入住人姓名”；清洁上报生成的索赔，用该清洁对应的退房订单补上
alter table public.claims add column if not exists guest_name text;

update public.claims c set guest_name = r.guest_name
from public.work_orders w
join public.reservations r on r.id = w.reservation_id
where c.work_order_id = w.id and c.guest_name is null and r.guest_name is not null;
