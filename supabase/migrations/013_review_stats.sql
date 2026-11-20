-- 每个房源、每个平台的评价平均分（Airbnb 是 10 分制的偶数，页面里除以 2 换成 5 星；Booking 本来就是 10 分制）
create or replace view public.review_stats with (security_invoker = true) as
  select property_id, channel_name, count(*)::int as n, round(avg(rating), 2) as avg_rating, max(reviewed_at) as last_review_at
  from public.reviews
  where property_id is not null and rating is not null
  group by property_id, channel_name;
grant select on public.review_stats to authenticated;
