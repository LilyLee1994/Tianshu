-- 公司款项：新增“平台扣款”类型；“影响房东结算”升级为三档；房东结算单增加“公司款项”一栏
alter table public.ledger drop constraint if exists ledger_kind_check;
alter table public.ledger add constraint ledger_kind_check check (kind in ('收款','退款','押金收取','押金退还','线下转账','平台扣款'));

alter table public.ledger add column if not exists owner_effect text not null default '无';
alter table public.ledger drop constraint if exists ledger_owner_effect_check;
alter table public.ledger add constraint ledger_owner_effect_check check (owner_effect in ('无','补房东','扣房东'));
-- 之前勾过“影响房东结算”的：支出算扣房东，收入算补房东
update public.ledger set owner_effect = case when amount < 0 then '扣房东' else '补房东' end where affects_owner and owner_effect = '无';

alter table public.owner_statements add column if not exists ledger_adj numeric(12,2) not null default 0;
