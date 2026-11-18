-- 服务端函数用 service_role 身份访问数据库，需要明确授权
-- （建项目时没勾“自动开放新表”，所以要手动给）
grant usage on schema public to service_role;
grant all on all tables in schema public to service_role;
grant all on all sequences in schema public to service_role;
grant execute on all functions in schema public to service_role;

-- 以后新建的表也自动给 service_role（只给服务端，不开放给浏览器）
alter default privileges in schema public grant all on tables to service_role;
alter default privileges in schema public grant all on sequences to service_role;
alter default privileges in schema public grant execute on functions to service_role;
