-- 助理可以读到「自己房源的老账号」对应的平台账号记录（用来按邮箱查老账号的密码）
drop policy if exists pa_assistant_read on public.platform_accounts;
create policy pa_assistant_read on public.platform_accounts for select to authenticated using (
  exists (select 1 from public.properties p where p.assistant_id = auth.uid()
          and (p.airbnb_account_id = platform_accounts.id or p.booking_account_id = platform_accounts.id))
  or exists (select 1 from public.property_account_info i join public.properties p on p.id = i.property_id
             where p.assistant_id = auth.uid() and lower(platform_accounts.login) = any(i.old_accounts))
);
