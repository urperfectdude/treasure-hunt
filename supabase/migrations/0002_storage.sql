-- Storage buckets for host location photos and player submission photos.
-- Both are public-read (simplest for a no-auth MVP — game codes are the
-- only "secret", and neither bucket holds anything sensitive beyond that).
-- Uploads are restricted to anon via policy; deletes/updates are not
-- granted to anon at all.

insert into storage.buckets (id, name, public)
values ('location-photos', 'location-photos', true)
on conflict (id) do nothing;

insert into storage.buckets (id, name, public)
values ('submission-photos', 'submission-photos', true)
on conflict (id) do nothing;

create policy "anyone can read location photos" on storage.objects
  for select using (bucket_id = 'location-photos');

create policy "anyone can read submission photos" on storage.objects
  for select using (bucket_id = 'submission-photos');

create policy "anon can upload submission photos" on storage.objects
  for insert with check (bucket_id = 'submission-photos');

-- Location photo uploads happen only from the analyze-location-photo Edge
-- Function (service role), which bypasses RLS — no anon insert policy here.
