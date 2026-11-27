-- 特殊折扣：财务/管理员在 Hostaway 订单里平完账之后，在公司款项里点“已平账”，这笔才按 0 计
alter table public.ledger add column if not exists order_adjusted_at timestamptz;
notify pgrst, 'reload schema';
