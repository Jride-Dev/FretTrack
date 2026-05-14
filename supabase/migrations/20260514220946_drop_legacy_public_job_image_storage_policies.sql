drop policy if exists "job_images_public_select" on storage.objects;
drop policy if exists "job_images_public_insert" on storage.objects;
drop policy if exists "job_images_public_update" on storage.objects;
drop policy if exists "job_images_public_delete" on storage.objects;

update storage.buckets
set public = false
where id = 'job-images';
