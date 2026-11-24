-- 清洁费表：表里只有「付 Alisa」和「向客人收」两个价，深度清洁价没有，所以三个价都允许为空
alter table public.cleaning_fees
  alter column standard_fee drop not null,
  alter column deep_fee drop not null,
  alter column guest_fee drop not null;
