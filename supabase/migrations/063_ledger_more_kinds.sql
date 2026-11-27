-- 公司款项：增加支出类型和类别（参考退款/平台扣款对账表）
alter table public.ledger drop constraint if exists ledger_kind_check;
alter table public.ledger add constraint ledger_kind_check check (kind in
  ('收款','退款','协商退款','清洁问题退款','押金收取','押金退还','线下转账','线下转出','平台扣款','赔付房东','垫付费用'));
alter table public.ledger drop constraint if exists ledger_category_check;
alter table public.ledger add constraint ledger_category_check check (category in
  ('房费','清洁费','早入住','晚退房','加人/加晚','延长入住','取消订单','投诉补偿','预防差评','删差评','清洁问题','钥匙/门禁','房东报销','索赔','押金','其他'));
