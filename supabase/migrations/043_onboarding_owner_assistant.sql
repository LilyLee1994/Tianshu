-- 「Guidebook」和「上线」这两步的对接人是这套房的主责助理。
-- 模板里记成“主责助理”，开始上线流程时自动换成这套房助理的名字；已经开始的流程也一并改过来。
update public.onboarding_template set owner = '主责助理' where name in ('Guidebook', '上线');
update public.onboarding_steps s
   set owner = coalesce((select pr.name from public.properties p join public.profiles pr on pr.id = p.assistant_id where p.id = s.property_id), '待分配')
 where s.name in ('Guidebook', '上线') and s.owner in ('客服', '主责助理');
