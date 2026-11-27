-- 索赔对象新增：Terri Scheer（保险）、Turvi
alter table public.claims drop constraint if exists claims_platform_check;
alter table public.claims add constraint claims_platform_check check (platform in ('Airbnb','Booking.com','Terri Scheer','Turvi','其他'));
