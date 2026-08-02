-- ============================================================================
-- 01 · SECURE THE DATABASE
--
-- Problem being fixed:
--   athletes / sessions / session_athletes each carried a policy of the form
--       FOR ALL TO authenticated USING (true)
--   Combined with public signup being enabled, that meant ANY person who
--   created an account could read every row — including minors' dates of
--   birth, insurance policy numbers and emergency contacts. The anon key is
--   published in the browser bundle by design, so "authenticated" was not a
--   meaningful barrier.
--
-- Fix: membership in an explicit staff table, checked by auth.uid().
--
-- NOTE: closing public signup is a project-level Auth setting and CANNOT be
-- done from SQL. It must be turned off in the Supabase dashboard
-- (Authentication -> Providers -> Email -> disable "Enable sign ups").
-- ============================================================================

begin;

-- ---------------------------------------------------------------- staff table
create table if not exists public.staff (
  user_id    uuid primary key references auth.users (id) on delete cascade,
  email      text not null,
  role       text not null default 'coach'
             check (role in ('owner', 'coach', 'admin')),
  created_at timestamptz not null default now()
);

comment on table public.staff is
  'Allowlist of humans permitted to read athlete records. Being merely '
  'authenticated grants nothing — a row here is required.';

alter table public.staff enable row level security;

-- Staff may read the roster (so the app can show who has access). Only the
-- service role may modify it, so nobody can grant themselves access.
drop policy if exists "staff can read staff" on public.staff;
create policy "staff can read staff"
  on public.staff for select to authenticated
  using (exists (select 1 from public.staff s where s.user_id = auth.uid()));

-- ------------------------------------------------------- seed known operators
-- Only accounts that already existed and have signed in. Remy is included as a
-- Deep Waters co-founder; remove that row when Deep Waters is fully cut over.
insert into public.staff (user_id, email, role) values
  ('c5a44a32-0016-4d4f-a735-be2dbea6c7f2', 'samsutton@rich-habits.com',     'admin'),
  ('19e4bab6-d29d-401d-bc43-bd24cf1497f7', 'jessevasquezwins@gmail.com',    'owner'),
  ('e08ef8a5-3c17-4a71-b9db-e3f6035e9d7e', 'remy@deepwaterswrestling.com',  'coach')
on conflict (user_id) do nothing;

-- ------------------------------------------------------------ helper function
-- security definer so it can read public.staff regardless of the caller's own
-- policies; search_path pinned to defeat search-path hijacking.
create or replace function public.is_staff()
returns boolean
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select exists (select 1 from public.staff s where s.user_id = auth.uid());
$$;

revoke all on function public.is_staff() from public;
grant execute on function public.is_staff() to authenticated;

-- -------------------------------------------------------- replace the policies
-- athletes
drop policy if exists "shared athletes access"        on public.athletes;
drop policy if exists "athletes are private to owner" on public.athletes;
create policy "staff manage athletes"
  on public.athletes for all to authenticated
  using (public.is_staff()) with check (public.is_staff());

-- sessions
drop policy if exists "shared sessions access"        on public.sessions;
drop policy if exists "sessions are private to owner" on public.sessions;
create policy "staff manage sessions"
  on public.sessions for all to authenticated
  using (public.is_staff()) with check (public.is_staff());

-- session_athletes
drop policy if exists "shared links access"        on public.session_athletes;
drop policy if exists "links are private to owner" on public.session_athletes;
create policy "staff manage session_athletes"
  on public.session_athletes for all to authenticated
  using (public.is_staff()) with check (public.is_staff());

-- registrations
-- Anonymous INSERT is intentional and preserved: the public registration form
-- must work for a parent who is not signed in. Reading them is staff-only.
drop policy if exists "staff can read registrations"   on public.registrations;
drop policy if exists "staff can update registrations" on public.registrations;
create policy "staff read registrations"
  on public.registrations for select to authenticated using (public.is_staff());
create policy "staff update registrations"
  on public.registrations for update to authenticated
  using (public.is_staff()) with check (public.is_staff());

-- Force RLS so even a table owner connecting over Postgres is subject to it.
alter table public.athletes         force row level security;
alter table public.sessions         force row level security;
alter table public.session_athletes force row level security;
alter table public.registrations    force row level security;
alter table public.staff            force row level security;

commit;
