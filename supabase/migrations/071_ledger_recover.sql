-- 公司先垫付、事后向客人追回的支出（比如跑腿、额外清洁）：一条记录就够了，用“追回状态”标记
-- 待追回 = 钱还没要回来，照常算公司支出；已追回 = 客人已经付了，这笔支出抵掉，按 0 计
alter table public.ledger add column if not exists recover_status text not null default '无';
alter table public.ledger drop constraint if exists ledger_recover_status_check;
alter table public.ledger add constraint ledger_recover_status_check check (recover_status in ('无','待追回','已追回'));
notify pgrst, 'reload schema';
