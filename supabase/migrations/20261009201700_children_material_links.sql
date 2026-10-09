-- A children's church lesson can be a link (a YouTube or Vimeo video, Google
-- Slides…) instead of an uploaded file — videos are often bigger than the
-- upload limit. Also allows more slide and video formats. Idempotent.
alter table resources alter column file_path drop not null;
alter table resources alter column file_name drop not null;
alter table resources alter column mime drop not null;
alter table resources add column if not exists link_url text check (link_url is null or char_length(link_url) <= 500);
alter table resources drop constraint if exists resources_file_or_link;
alter table resources add constraint resources_file_or_link check (file_path is not null or link_url is not null);

update storage.buckets set allowed_mime_types = array[
  'image/png', 'image/jpeg', 'image/webp', 'image/svg+xml',
  'application/pdf', 'application/postscript', 'application/illustrator',
  'application/msword', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'application/vnd.openxmlformats-officedocument.presentationml.presentation',
  'application/vnd.ms-powerpoint', 'application/vnd.oasis.opendocument.presentation',
  'application/x-iwork-keynote-sffkey', 'application/vnd.apple.keynote',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  'audio/mpeg', 'audio/mp4', 'video/mp4', 'video/quicktime', 'video/webm',
  'application/zip'
] where id = 'resources';
