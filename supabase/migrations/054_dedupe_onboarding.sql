-- 清理重复的上线步骤（同一房源、同一序号、同一名称只留最早的一条），模板同理
delete from public.onboarding_steps a
 using public.onboarding_steps b
 where a.property_id = b.property_id and a.seq = b.seq and a.name = b.name and a.id > b.id;

delete from public.onboarding_template a
 using public.onboarding_template b
 where a.seq = b.seq and a.name = b.name and a.ctid > b.ctid;

-- 以后不会再重复
create unique index if not exists onboarding_steps_uniq on public.onboarding_steps(property_id, seq, name);
