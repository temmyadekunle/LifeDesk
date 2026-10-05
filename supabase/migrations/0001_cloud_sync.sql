-- Livanta cloud sync schema.
--
-- Design notes:
-- * Every row is owned by exactly one auth user. Row level security below is
--   what enforces that, so a leaked anon key cannot read another household.
-- * `things.id` is the id the browser already generates (crypto.randomUUID, or
--   an `id-...` fallback), so it is stored as text rather than uuid. Changing
--   the id scheme later would orphan rows on devices that have synced.
-- * `updated_at` is written by the client and is the conflict-resolution
--   clock, compared as timestamptz rather than as text.
-- * `deleted_at` is a tombstone. Deletions must propagate, otherwise a delete
--   on one device would be resurrected by the next pull on another.

create table if not exists public.things (
  id                    text primary key,
  user_id               uuid not null references auth.users (id) on delete cascade,
  name                  text not null,
  category              text not null,
  kind                  text not null,
  amount                numeric,
  currency              text not null default 'NGN',
  due_date              date,
  last_handled_date     date,
  recurrence            jsonb,
  service_interval_days integer,
  status                text not null default 'active',
  priority              text not null default 'routine',
  notes                 text,
  details               jsonb not null default '{}'::jsonb,
  created_at            timestamptz not null default now(),
  updated_at            timestamptz not null,
  deleted_at            timestamptz
);

-- The sync cursor reads by (user_id, updated_at); without this it is a
-- sequential scan of the user's whole history on every pull.
create index if not exists things_user_updated_idx
  on public.things (user_id, updated_at desc);

create table if not exists public.settings (
  user_id            uuid primary key references auth.users (id) on delete cascade,
  onboarded          boolean not null default false,
  display_name       text not null default '',
  locale             text not null default 'en',
  data_saver         boolean not null default true,
  notify_urgent      boolean not null default true,
  lead_days          jsonb not null default '[7, 1]'::jsonb,
  managed_categories jsonb not null default '[]'::jsonb,
  updated_at         timestamptz not null
);

-- Alerts are derived from things on each device, so their contents are never
-- uploaded. Only the decision to dismiss one is real data, and that decision
-- is keyed by the stable `${thing.id}:${reason}` alert id.
create table if not exists public.dismissals (
  user_id      uuid not null references auth.users (id) on delete cascade,
  alert_id     text not null,
  dismissed_at timestamptz not null,
  -- Set when the user later restores alerts. "Restore all" has to propagate
  -- too, otherwise a dismissal undone on one device is re-applied by the next
  -- pull from another.
  deleted_at   timestamptz,
  primary key (user_id, alert_id)
);

create index if not exists dismissals_user_idx
  on public.dismissals (user_id);

alter table public.things     enable row level security;
alter table public.settings   enable row level security;
alter table public.dismissals enable row level security;

-- Own-rows-only policies. auth.uid() comes from Supabase's JWT, so these
-- apply per request and cannot be bypassed from the client.
create policy "things are readable by their owner"
  on public.things for select using (auth.uid() = user_id);
create policy "things are insertable by their owner"
  on public.things for insert with check (auth.uid() = user_id);
create policy "things are updatable by their owner"
  on public.things for update using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "things are deletable by their owner"
  on public.things for delete using (auth.uid() = user_id);

create policy "settings are readable by their owner"
  on public.settings for select using (auth.uid() = user_id);
create policy "settings are upsertable by their owner"
  on public.settings for insert with check (auth.uid() = user_id);
create policy "settings are updatable by their owner"
  on public.settings for update using (auth.uid() = user_id) with check (auth.uid() = user_id);

create policy "dismissals are readable by their owner"
  on public.dismissals for select using (auth.uid() = user_id);
create policy "dismissals are insertable by their owner"
  on public.dismissals for insert with check (auth.uid() = user_id);
create policy "dismissals are updatable by their owner"
  on public.dismissals for update using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "dismissals are deletable by their owner"
  on public.dismissals for delete using (auth.uid() = user_id);

-- Realtime is not used by sync today; the publication exists so turning it on
-- later does not need a migration.
alter publication supabase_realtime add table public.things;

-- Guarded upsert. A plain upsert would let a device with a wrong clock
-- overwrite newer data, and this table is the only copy of a user's data, so
-- the guard has to live here where a client bug cannot bypass it. Rows that are
-- not strictly newer are left untouched.
create or replace function public.upsert_things_sync(rows jsonb)
returns void
language plpgsql
security invoker
set search_path = public
as $$
begin
  insert into public.things as t (
    id, user_id, name, category, kind, amount, currency, due_date,
    last_handled_date, recurrence, service_interval_days, status, priority,
    notes, details, created_at, updated_at, deleted_at
  )
  select
    r.id,
    auth.uid(),
    r.name,
    r.category,
    r.kind,
    r.amount,
    r.currency,
    r.due_date,
    r.last_handled_date,
    r.recurrence,
    r.service_interval_days,
    r.status,
    r.priority,
    r.notes,
    coalesce(r.details, '{}'::jsonb),
    coalesce(r.created_at, now()),
    coalesce(r.updated_at, now()),
    r.deleted_at
  from jsonb_to_recordset(rows) as r(
    id text,
    name text,
    category text,
    kind text,
    amount numeric,
    currency text,
    due_date date,
    last_handled_date date,
    recurrence jsonb,
    service_interval_days integer,
    status text,
    priority text,
    notes text,
    details jsonb,
    created_at timestamptz,
    updated_at timestamptz,
    deleted_at timestamptz
  )
  on conflict (id) do update set
    name = excluded.name,
    category = excluded.category,
    kind = excluded.kind,
    amount = excluded.amount,
    currency = excluded.currency,
    due_date = excluded.due_date,
    last_handled_date = excluded.last_handled_date,
    recurrence = excluded.recurrence,
    service_interval_days = excluded.service_interval_days,
    status = excluded.status,
    priority = excluded.priority,
    notes = excluded.notes,
    details = excluded.details,
    updated_at = excluded.updated_at,
    deleted_at = excluded.deleted_at
  where excluded.updated_at > t.updated_at;
end;
$$;

grant execute on function public.upsert_things_sync(jsonb) to authenticated;