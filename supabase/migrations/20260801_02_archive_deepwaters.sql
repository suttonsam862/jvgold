-- ============================================================================
-- 02 · ARCHIVE DEEP WATERS AS JV GOLD HISTORICAL INCOME
--
-- Deep Waters is being disconnected from this database. Its trading history is
-- not deleted — it becomes JV Gold's opening book: the record of what Jesse's
-- first club actually earned between May and July 2026.
--
-- Everything that exists right now is Deep Waters. Everything created from here
-- is JV Gold. A single `org` column carries that line, and legacy rows are
-- frozen so a later JV Gold feature can never silently rewrite club history.
-- ============================================================================

begin;

-- ------------------------------------------------------------------- lineage
do $$
begin
  if not exists (select 1 from pg_type where typname = 'org_code') then
    create type public.org_code as enum ('deep-waters', 'jvgold');
  end if;
end $$;

alter table public.athletes      add column if not exists org public.org_code not null default 'jvgold';
alter table public.sessions      add column if not exists org public.org_code not null default 'jvgold';
alter table public.registrations add column if not exists org public.org_code not null default 'jvgold';

-- Frozen marker. Set on legacy rows; a trigger below refuses to change them.
alter table public.athletes      add column if not exists archived_at timestamptz;
alter table public.sessions      add column if not exists archived_at timestamptz;
alter table public.registrations add column if not exists archived_at timestamptz;

-- --------------------------------------------------------------- backfill
-- Everything predating this migration belongs to Deep Waters.
update public.athletes      set org = 'deep-waters', archived_at = now() where archived_at is null;
update public.sessions      set org = 'deep-waters', archived_at = now() where archived_at is null;
update public.registrations set org = 'deep-waters', archived_at = now() where archived_at is null;

-- ------------------------------------------------------- freeze the archive
create or replace function public.reject_archived_writes()
returns trigger
language plpgsql
as $$
begin
  if tg_op = 'DELETE' then
    if old.archived_at is not null then
      raise exception
        'Row % in % is archived Deep Waters history and cannot be deleted.',
        old.id, tg_table_name
        using hint = 'Archived club records are immutable. Create a JV Gold row instead.';
    end if;
    return old;
  end if;

  if old.archived_at is not null then
    raise exception
      'Row % in % is archived Deep Waters history and cannot be modified.',
      old.id, tg_table_name
      using hint = 'Archived club records are immutable. Create a JV Gold row instead.';
  end if;
  return new;
end;
$$;

drop trigger if exists freeze_archive on public.athletes;
create trigger freeze_archive before update or delete on public.athletes
  for each row execute function public.reject_archived_writes();

drop trigger if exists freeze_archive on public.sessions;
create trigger freeze_archive before update or delete on public.sessions
  for each row execute function public.reject_archived_writes();

drop trigger if exists freeze_archive on public.registrations;
create trigger freeze_archive before update or delete on public.registrations
  for each row execute function public.reject_archived_writes();

-- --------------------------------------------------- historical income views
-- Money is exposed in integer CENTS to match app/lib/ops/types.ts. The
-- underlying columns are numeric dollars; rounding happens once, here.
create or replace view public.deep_waters_income as
select
  'registration'::text                       as stream,
  r.source                                   as channel,
  date_trunc('month', r.created_at)::date    as month,
  count(*)::int                              as entries,
  round(sum(r.total) * 100)::bigint          as gross_cents
from public.registrations r
where r.org = 'deep-waters'
group by 1, 2, 3
union all
select
  'private-lesson'::text,
  coalesce(s.method, 'unrecorded'),
  date_trunc('month', s.date)::date,
  count(*)::int,
  round(sum(s.amount) * 100)::bigint
from public.sessions s
where s.org = 'deep-waters' and s.amount is not null
group by 1, 2, 3;

comment on view public.deep_waters_income is
  'Deep Waters trading history rolled up by stream, channel and month, in '
  'integer cents. This is JV Gold''s opening book — read-only by construction.';

create or replace view public.deep_waters_summary as
select
  (select count(*) from public.athletes      where org = 'deep-waters') as athletes,
  (select count(*) from public.sessions      where org = 'deep-waters') as sessions,
  (select count(*) from public.registrations where org = 'deep-waters') as registrations,
  (select coalesce(round(sum(total) * 100), 0)::bigint
     from public.registrations where org = 'deep-waters')              as registration_cents,
  (select coalesce(round(sum(amount) * 100), 0)::bigint
     from public.sessions where org = 'deep-waters')                   as session_cents,
  (select min(created_at)::date from public.registrations where org = 'deep-waters') as first_activity,
  (select max(created_at)::date from public.registrations where org = 'deep-waters') as last_activity;

-- Views inherit the base tables' RLS, so these stay staff-only.
grant select on public.deep_waters_income  to authenticated;
grant select on public.deep_waters_summary to authenticated;

create index if not exists athletes_org_idx      on public.athletes (org);
create index if not exists sessions_org_idx      on public.sessions (org);
create index if not exists registrations_org_idx on public.registrations (org);

commit;
