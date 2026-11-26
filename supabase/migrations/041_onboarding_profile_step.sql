-- 上线流程第 7 步改名：个体表和 Bill 就是房源档案里要填的内容，档案填齐后这一步自动完成
update public.onboarding_template set name = '完善房源档案（个体表 + Bill）' where name = '填写房源个体表和 Bill 表';
update public.onboarding_steps set name = '完善房源档案（个体表 + Bill）' where name = '填写房源个体表和 Bill 表';
