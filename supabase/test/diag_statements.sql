-- 诊断：为什么房东结算只有 46 套？（只读，不改任何数据）把结果整张截图发我
select '1 房源总数（未归档）' as 项目, count(*)::text as 数量 from public.properties where legacy = false
union all select '2 已对上 Hostaway 的房源', count(*)::text from public.properties where hostaway_id is not null
union all select '3 订单总数', count(*)::text from public.reservations
union all select '4 订单里没对上房源的', count(*)::text from public.reservations where property_id is null
union all select '5 订单最早退房日', coalesce(min(departure_date)::text, '-') from public.reservations
union all select '6 订单最晚退房日', coalesce(max(departure_date)::text, '-') from public.reservations
union all select '7 有订单的房源数（全部时间）', count(distinct property_id)::text from public.reservations where property_id is not null
union all select '8 本月(2026-11)退房、有订单的房源数', count(distinct property_id)::text from public.reservations where departure_date >= '2026-11-01' and departure_date < '2026-12-01' and property_id is not null and status !~* 'cancel|inquiry|declin|expire|denied'
union all select '9 上月(2026-10)退房、有订单的房源数', count(distinct property_id)::text from public.reservations where departure_date >= '2026-10-01' and departure_date < '2026-11-01' and property_id is not null and status !~* 'cancel|inquiry|declin|expire|denied'
union all select '10 上上月(2026-09)退房、有订单的房源数', count(distinct property_id)::text from public.reservations where departure_date >= '2026-09-01' and departure_date < '2026-10-01' and property_id is not null and status !~* 'cancel|inquiry|declin|expire|denied'
union all select '11 已生成的结算单（按月）' || ' ' || month::text, count(*)::text from public.owner_statements group by month
order by 1;
