-- 清洁费初始数据（来自「清洁费」表）：
--   1) 标了“房东自己清洁”的房源 → 清洁由谁做 = 房东自己
--   其余房源默认就是 Alisa 清洁。向客人收取的清洁费从 Hostaway 自动拉，这里不填价格。
-- 房源名按字母数字匹配（忽略大小写、空格、符号）。
create temp table _own(name text);
insert into _own values ('Burwood G04'),('Burwood S1'),('BurwoodS2'),('BurwoodS6'),('Canterbury 129'),('Canterbury 521'),('Chatswood219'),('Lidcombe1001'),('Panania 26');
update public.properties p set cleaning_by = '房东自己'
 where exists (select 1 from _own o where lower(regexp_replace(o.name,'[^a-zA-Z0-9]','','g')) = lower(regexp_replace(p.name,'[^a-zA-Z0-9]','','g')));


-- 之前如果运行过旧版本，清掉里面的“付 Alisa”价格（现在不记这个）
update public.cleaning_fees set standard_fee = null, deep_fee = null;

-- 看看有哪些房源被标成了房东自己清洁
select name as 房东自己清洁的房源 from public.properties where cleaning_by = '房东自己' order by name;
