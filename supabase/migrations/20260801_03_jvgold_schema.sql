-- ============================================================================
-- 03 · THE JV GOLD OPERATIONAL SCHEMA
--
-- Deep Waters' tables stay in `public`, frozen, as the archive. JV Gold gets a
-- clean `jvgold` schema shaped to app/lib/ops/types.ts rather than inheriting a
-- club roster's assumptions.
--
-- Two deliberate departures from the legacy design:
--   * Money is integer CENTS everywhere. The legacy tables used `numeric`
--     dollars, which invites float drift the moment anything is averaged.
--   * `kind` allows all six things Jesse actually sells. The legacy column only
--     permitted private|group, so a partner session silently became a group.
-- ============================================================================

begin;

create schema if not exists jvgold;
grant usage on schema jvgold to authenticated;

-- ------------------------------------------------------------------- enums
do $$ begin
  if not exists (select 1 from pg_type where typname='session_kind') then
    create type jvgold.session_kind as enum
      ('private','partner','clinic','workout','camp','group');
  end if;
  if not exists (select 1 from pg_type where typname='session_status') then
    create type jvgold.session_status as enum
      ('scheduled','completed','cancelled','no-show');
  end if;
  if not exists (select 1 from pg_type where typname='client_status') then
    create type jvgold.client_status as enum
      ('Active','Trial','Paid In Full','Owes Balance','Inactive');
  end if;
  if not exists (select 1 from pg_type where typname='event_source') then
    create type jvgold.event_source as enum ('jvgold','google');
  end if;
end $$;

-- ----------------------------------------------------------------- clients
create table if not exists jvgold.clients (
  id                  uuid primary key default gen_random_uuid(),
  name                text not null,
  guardian            text,
  email               text,
  phone               text,
  level               text check (level in ('Youth','HS','College','Adult')),
  school              text,
  date_of_birth       date,
  status              jvgold.client_status not null default 'Trial',
  family_group        text,
  tags                text[] not null default '{}',
  -- compliance
  usaw_card_number    text,
  insurance_provider  text,
  insurance_policy_number text,
  emergency_contact_name  text,
  emergency_contact_phone text,
  waiver_signed       boolean not null default false,
  -- packages
  sessions_purchased  integer not null default 0,
  sessions_used       integer not null default 0,
  sessions_remaining  integer generated always as
                        (greatest(sessions_purchased - sessions_used, 0)) stored,
  lifetime_value_cents bigint not null default 0,
  -- provenance
  source              text not null default 'manual'
                        check (source in ('site','shopify','manual','import')),
  shopify_customer_id text,
  legacy_athlete_id   uuid references public.athletes (id),
  notes               text,
  joined_at           timestamptz not null default now(),
  last_session_at     timestamptz,
  created_at          timestamptz not null default now(),
  updated_at          timestamptz not null default now()
);

comment on column jvgold.clients.legacy_athlete_id is
  'Set when this client was carried over from the frozen Deep Waters roster, '
  'so the archive and the live record stay traceable to each other.';

-- ---------------------------------------------------------------- sessions
create table if not exists jvgold.sessions (
  id            uuid primary key default gen_random_uuid(),
  starts_at     timestamptz not null,
  ends_at       timestamptz not null,
  kind          jvgold.session_kind not null,
  status        jvgold.session_status not null default 'scheduled',
  offering_id   text,
  location      text,
  focus         text,
  amount_cents  bigint not null default 0 check (amount_cents >= 0),
  paid          boolean not null default false,
  paid_at       timestamptz,
  method        text check (method in ('Venmo','Zelle','Cash','Card','Check','Shopify')),
  capacity      integer,
  notes         text,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now(),
  constraint sessions_time_order check (ends_at > starts_at)
);

create table if not exists jvgold.session_clients (
  session_id uuid not null references jvgold.sessions (id) on delete cascade,
  client_id  uuid not null references jvgold.clients  (id) on delete cascade,
  attended   boolean,
  primary key (session_id, client_id)
);

-- --------------------------------------------------------- calendar events
-- Superset able to hold both a JV Gold session and an imported Google event.
create table if not exists jvgold.calendar_events (
  id              uuid primary key default gen_random_uuid(),
  source          jvgold.event_source not null default 'jvgold',
  session_id      uuid references jvgold.sessions (id) on delete cascade,
  google_event_id text,
  google_calendar_id text,
  title           text not null,
  starts_at       timestamptz not null,
  ends_at         timestamptz not null,
  all_day         boolean not null default false,
  location        text,
  notes           text,
  recurrence      text,
  attendees       jsonb not null default '[]'::jsonb,
  color_id        text,
  -- Imported Google events Jesse has not claimed must not be edited in-app;
  -- writing back before two-way sync exists would diverge from his phone.
  read_only       boolean not null default false,
  synced_at       timestamptz,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now(),
  constraint events_time_order check (ends_at >= starts_at),
  constraint google_events_need_an_id
    check (source <> 'google' or google_event_id is not null)
);

create unique index if not exists calendar_events_google_uniq
  on jvgold.calendar_events (google_calendar_id, google_event_id)
  where google_event_id is not null;

-- ---------------------------------------------------------------- payments
create table if not exists jvgold.payments (
  id               uuid primary key default gen_random_uuid(),
  client_id        uuid references jvgold.clients (id) on delete set null,
  session_id       uuid references jvgold.sessions (id) on delete set null,
  amount_cents     bigint not null check (amount_cents <> 0),
  fee_cents        bigint not null default 0,
  refunded_cents   bigint not null default 0,
  currency         text not null default 'USD',
  method           text,
  stream           text not null default 'private-lesson',
  shopify_order_id text,
  occurred_at      timestamptz not null default now(),
  created_at       timestamptz not null default now()
);

-- ---------------------------------------------------------------- products
create table if not exists jvgold.products (
  id                     uuid primary key default gen_random_uuid(),
  handle                 text not null unique,
  title                  text not null,
  description            text,
  status                 text not null default 'draft'
                           check (status in ('active','draft','archived')),
  price_cents            bigint not null default 0 check (price_cents >= 0),
  compare_at_cents       bigint check (compare_at_cents >= 0),
  sku                    text,
  inventory              integer,
  tags                   text[] not null default '{}',
  offering_id            text,
  image_url              text,
  shopify_product_id     text,
  shopify_variant_id     text,
  synced_at              timestamptz,
  created_at             timestamptz not null default now(),
  updated_at             timestamptz not null default now()
);

-- ------------------------------------------------------------ updated_at
create or replace function jvgold.touch_updated_at()
returns trigger language plpgsql as $$
begin new.updated_at = now(); return new; end $$;

do $$
declare t text;
begin
  foreach t in array array['clients','sessions','calendar_events','products'] loop
    execute format(
      'drop trigger if exists touch_updated_at on jvgold.%I;
       create trigger touch_updated_at before update on jvgold.%I
       for each row execute function jvgold.touch_updated_at();', t, t);
  end loop;
end $$;

-- --------------------------------------------------------------- indexes
create index if not exists clients_status_idx   on jvgold.clients (status);
create index if not exists clients_name_idx     on jvgold.clients (lower(name));
create index if not exists sessions_starts_idx  on jvgold.sessions (starts_at desc);
create index if not exists events_range_idx     on jvgold.calendar_events (starts_at, ends_at);
create index if not exists payments_when_idx    on jvgold.payments (occurred_at);
create index if not exists payments_client_idx  on jvgold.payments (client_id);

-- ------------------------------------------------------------------- RLS
-- Same staff allowlist as the archive. Being authenticated grants nothing.
do $$
declare t text;
begin
  foreach t in array array['clients','sessions','session_clients',
                           'calendar_events','payments','products'] loop
    execute format('alter table jvgold.%I enable row level security;', t);
    execute format('alter table jvgold.%I force row level security;', t);
    execute format('drop policy if exists "staff manage %s" on jvgold.%I;', t, t);
    execute format(
      'create policy "staff manage %s" on jvgold.%I for all to authenticated
       using (public.is_staff()) with check (public.is_staff());', t, t);
    execute format('grant select, insert, update, delete on jvgold.%I to authenticated;', t);
  end loop;
end $$;

commit;
