-- 照片存储：私有桶。师傅/清洁公司可以上传，只有员工能查看。
insert into storage.buckets (id, name, public) values ('work-photos', 'work-photos', false)
on conflict (id) do nothing;

create policy wp_upload on storage.objects for insert to authenticated
  with check (bucket_id = 'work-photos');

create policy wp_staff_read on storage.objects for select to authenticated
  using (bucket_id = 'work-photos' and public.is_staff());
