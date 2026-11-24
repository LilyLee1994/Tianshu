-- 房东结算口径：房费 × 0.835（平台费 16.5%，含 GST）× 0.835（佣金 15% × 1.1，含 GST）
insert into public.fee_rules values ('platform_fee_rate', 0.165, '平台费率（已含 GST）'), ('gst_rate', 0.10, 'GST')
on conflict (key) do update set value = excluded.value, note = excluded.note;
