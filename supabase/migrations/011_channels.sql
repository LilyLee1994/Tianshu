-- 用已存的原始数据补渠道名（2000=Airbnb，2005=Booking.com，2002=Vrbo）
update reviews set channel_name = case raw->>'channelId'
  when '2000' then 'Airbnb' when '2005' then 'Booking.com' when '2002' then 'Vrbo'
  else 'channel ' || coalesce(raw->>'channelId','?') end;
update reservations set channel_name = case raw->>'channelId'
  when '2000' then 'Airbnb' when '2005' then 'Booking.com' when '2002' then 'Vrbo'
  else coalesce(channel_name, 'channel ' || coalesce(raw->>'channelId','?')) end;
select 'reviews' as t, channel_name, count(*), min(rating), max(rating) from reviews group by 2
union all
select 'reservations', channel_name, count(*), null, null from reservations group by 2 order by 1, 3 desc;
