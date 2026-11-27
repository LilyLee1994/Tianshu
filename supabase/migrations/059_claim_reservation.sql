-- 索赔可以关联到具体订单（新增索赔时勾选订单）
alter table public.claims add column if not exists reservation_id bigint references public.reservations(id) on delete set null;
