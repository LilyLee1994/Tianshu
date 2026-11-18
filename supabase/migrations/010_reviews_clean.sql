-- 评价整理：用已存的原始数据补全渠道，删掉「房东评客人」和没有评分的
update reviews set channel_name = case (raw->>'channelId')
    when '2000' then 'Airbnb' when '2002' then 'Booking.com'
    else coalesce(channel_name, raw->>'channelName') end
  where channel_name is null;
update reviews set rating = (raw->>'rating')::numeric
  where rating is null and raw->>'rating' ~ '^[0-9.]+$';
delete from reviews
  where coalesce(raw->>'type','') ~* 'host.?to.?guest' or rating is null;
select channel_name, count(*), min(rating), max(rating) from reviews group by 1;
