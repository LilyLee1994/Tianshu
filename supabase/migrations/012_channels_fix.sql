-- 渠道号更正：2018 = Airbnb，2005 = Booking.com，其余显示渠道号
update reviews set channel_name = case raw->>'channelId'
  when '2018' then 'Airbnb' when '2005' then 'Booking.com'
  else 'channel ' || coalesce(raw->>'channelId','?') end;
update reservations set channel_name = case raw->>'channelId'
  when '2018' then 'Airbnb' when '2005' then 'Booking.com'
  else 'channel ' || coalesce(raw->>'channelId','?') end;
select 'reviews' as t, channel_name, count(*), min(rating), max(rating) from reviews group by 2
union all
select 'reservations', channel_name, count(*), null, null from reservations group by 2 order by 1, 3 desc;
