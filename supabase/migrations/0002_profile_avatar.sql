-- Profile picture.
--
-- Added separately from 0001 rather than edited into it: 0001 has already been
-- applied to real projects, and changing a migration that has run does nothing
-- on those databases. New work goes in a new numbered file.
--
-- The value is a small square data URL rather than a storage path or a bytea
-- blob. The picture is already reduced to a couple of hundred pixels on the
-- device before it is ever stored (lib/avatar.ts), so it is small enough to
-- travel inside the settings row, which means a profile photo follows the user
-- across devices through the same conflict resolution as everything else in
-- settings, with no second table and no second sync path.
--
-- Nullable, so an account that never set a photo does not carry the column's
-- weight in every row.

alter table public.settings
  add column if not exists avatar text;

comment on column public.settings.avatar is
  'Profile picture as a base64 image data URL, reduced on-device before upload. Null when unset.';
