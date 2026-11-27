-- 索赔增加两个状态：联系客人中、客人直接赔付
alter table public.claims drop constraint if exists claims_status_check;
alter table public.claims add constraint claims_status_check
  check (status in ('待提交','联系客人中','客人直接赔付','已提交平台','平台处理中','已赔付','被驳回','放弃'));
