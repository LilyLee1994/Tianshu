-- 对房东结算新增选项“特殊折扣”：这笔钱要做到订单里（在 Hostaway 订单金额里体现），不单独补扣房东
alter table public.ledger drop constraint if exists ledger_owner_effect_check;
alter table public.ledger add constraint ledger_owner_effect_check check (owner_effect in ('无','补房东','扣房东','特殊折扣'));
