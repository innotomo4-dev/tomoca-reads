-- TOMOCA Reads · Supabase PostgreSQL schema
-- Run this once in Supabase Dashboard > SQL Editor before deploying the app.

create table if not exists public.organizations (
  id text primary key,
  name text not null,
  stripe_customer_id text unique,
  stripe_subscription_id text unique,
  subscription_status text not null default 'inactive',
  current_period_end bigint,
  updated bigint not null default 0
);

insert into public.organizations(id,name,subscription_status,updated)
values ('tomoca','TOMOCA','inactive',0)
on conflict (id) do nothing;

create table if not exists public.admin_accounts (
  id text primary key,
  email text not null unique,
  salt text not null,
  password_hash text not null,
  password_iterations integer not null default 600000,
  created bigint not null
);

create table if not exists public.admin_sessions (
  id text primary key,
  account_id text not null references public.admin_accounts(id) on delete cascade,
  expires bigint not null
);
create index if not exists idx_admin_sessions_expires on public.admin_sessions(expires);

create table if not exists public.admin_login_attempts (
  id text primary key,
  attempts integer not null,
  expires bigint not null
);
create index if not exists idx_admin_login_attempts_expires on public.admin_login_attempts(expires);

-- Reader session IDs are SHA-256 hashes of the raw cookie tokens.
create table if not exists public.sessions (
  id text primary key,
  branch text not null,
  created bigint not null,
  expires bigint not null
);
create index if not exists idx_sessions_expires on public.sessions(expires);
create index if not exists idx_sessions_branch_created on public.sessions(branch,created);

-- One reusable QR token per branch per Addis Ababa calendar day.
create table if not exists public.codes (
  id text primary key,
  branch text not null,
  day text not null,
  created bigint not null,
  expires bigint not null,
  unique(branch,day)
);
create index if not exists idx_codes_expires on public.codes(expires);
create index if not exists idx_codes_branch_day on public.codes(branch,day);

create table if not exists public.editions (
  id text primary key,
  data jsonb not null,
  updated bigint not null
);

create table if not exists public.registrations (
  phone text primary key,
  branch text not null,
  consent boolean not null default true,
  created bigint not null,
  notice text not null
);
create index if not exists idx_registrations_created on public.registrations(created);

create table if not exists public.daily_branch_metrics (
  day text not null,
  branch text not null,
  sessions bigint not null default 0,
  primary key(day,branch)
);

create table if not exists public.story_overrides (
  url text primary key,
  title text not null,
  summary text not null,
  hidden boolean not null default false,
  updated bigint not null
);
create index if not exists idx_story_overrides_updated on public.story_overrides(updated);

create table if not exists public.system_locks (
  name text primary key,
  expires bigint not null
);

create or replace function public.increment_branch_metric(p_day text,p_branch text)
returns void
language plpgsql
security definer
set search_path=public
as $$
begin
  insert into public.daily_branch_metrics(day,branch,sessions)
  values(p_day,p_branch,1)
  on conflict(day,branch)
  do update set sessions=public.daily_branch_metrics.sessions+1;
end;
$$;

create or replace function public.create_reader_session(p_id text,p_branch text,p_created bigint,p_expires bigint,p_day text)
returns void
language plpgsql
security definer
set search_path=public
as $$
begin
  insert into public.sessions(id,branch,created,expires)
  values(p_id,p_branch,p_created,p_expires);
  insert into public.daily_branch_metrics(day,branch,sessions)
  values(p_day,p_branch,1)
  on conflict(day,branch)
  do update set sessions=public.daily_branch_metrics.sessions+1;
end;
$$;

create or replace function public.get_or_create_daily_code(p_branch text,p_day text,p_id text,p_created bigint,p_expires bigint)
returns table(id text,expires bigint)
language plpgsql
security definer
set search_path=public
as $$
begin
  insert into public.codes(id,branch,day,created,expires)
  values(p_id,p_branch,p_day,p_created,p_expires)
  on conflict(branch,day) do nothing;
  return query select c.id,c.expires from public.codes c where c.branch=p_branch and c.day=p_day limit 1;
end;
$$;

create or replace function public.increment_login_attempt(p_id text,p_expires bigint)
returns integer
language plpgsql
security definer
set search_path=public
as $$
declare n integer;
begin
  insert into public.admin_login_attempts(id,attempts,expires)
  values(p_id,1,p_expires)
  on conflict(id)
  do update set attempts=public.admin_login_attempts.attempts+1,expires=greatest(public.admin_login_attempts.expires,excluded.expires)
  returning attempts into n;
  return n;
end;
$$;

create or replace function public.claim_system_lock(p_name text,p_ttl_ms bigint)
returns boolean
language plpgsql
security definer
set search_path=public
as $$
declare affected integer;
declare now_ms bigint := floor(extract(epoch from clock_timestamp())*1000)::bigint;
begin
  insert into public.system_locks(name,expires)
  values(p_name,now_ms+p_ttl_ms)
  on conflict(name)
  do update set expires=excluded.expires
  where public.system_locks.expires < now_ms;
  get diagnostics affected = row_count;
  return affected > 0;
end;
$$;

create or replace function public.release_system_lock(p_name text)
returns void
language sql
security definer
set search_path=public
as $$ delete from public.system_locks where name=p_name; $$;

create or replace function public.tomoca_cleanup(p_now bigint,p_registration_cutoff bigint,p_override_cutoff bigint)
returns jsonb
language plpgsql
security definer
set search_path=public
as $$
declare
  n_sessions integer; n_codes integer; n_admin_sessions integer; n_attempts integer; n_registrations integer; n_overrides integer;
begin
  delete from public.sessions where expires < p_now; get diagnostics n_sessions = row_count;
  delete from public.codes where expires < p_now; get diagnostics n_codes = row_count;
  delete from public.admin_sessions where expires < p_now; get diagnostics n_admin_sessions = row_count;
  delete from public.admin_login_attempts where expires < p_now; get diagnostics n_attempts = row_count;
  delete from public.registrations where created < p_registration_cutoff; get diagnostics n_registrations = row_count;
  delete from public.story_overrides where updated < p_override_cutoff; get diagnostics n_overrides = row_count;
  delete from public.system_locks where expires < p_now;
  return jsonb_build_object(
    'sessions',n_sessions,'codes',n_codes,'adminSessions',n_admin_sessions,
    'loginAttempts',n_attempts,'registrations',n_registrations,'storyOverrides',n_overrides
  );
end;
$$;

-- The browser never talks to Supabase directly. All database operations use the
-- server-side Supabase secret key (service_role database role) through Vercel route handlers. Enable RLS and
-- intentionally create no anon/authenticated policies.
alter table public.organizations enable row level security;
alter table public.admin_accounts enable row level security;
alter table public.admin_sessions enable row level security;
alter table public.admin_login_attempts enable row level security;
alter table public.sessions enable row level security;
alter table public.codes enable row level security;
alter table public.editions enable row level security;
alter table public.registrations enable row level security;
alter table public.daily_branch_metrics enable row level security;
alter table public.story_overrides enable row level security;
alter table public.system_locks enable row level security;

revoke all on table public.organizations, public.admin_accounts, public.admin_sessions, public.admin_login_attempts, public.sessions, public.codes, public.editions, public.registrations, public.daily_branch_metrics, public.story_overrides, public.system_locks from anon, authenticated;
revoke execute on function public.increment_branch_metric(text,text) from public, anon, authenticated;
revoke execute on function public.create_reader_session(text,text,bigint,bigint,text) from public, anon, authenticated;
revoke execute on function public.get_or_create_daily_code(text,text,text,bigint,bigint) from public, anon, authenticated;
revoke execute on function public.increment_login_attempt(text,bigint) from public, anon, authenticated;
revoke execute on function public.claim_system_lock(text,bigint) from public, anon, authenticated;
revoke execute on function public.release_system_lock(text) from public, anon, authenticated;
revoke execute on function public.tomoca_cleanup(bigint,bigint,bigint) from public, anon, authenticated;


grant all on table public.organizations, public.admin_accounts, public.admin_sessions, public.admin_login_attempts, public.sessions, public.codes, public.editions, public.registrations, public.daily_branch_metrics, public.story_overrides, public.system_locks to service_role;
grant execute on function public.increment_branch_metric(text,text) to service_role;
grant execute on function public.create_reader_session(text,text,bigint,bigint,text) to service_role;
grant execute on function public.get_or_create_daily_code(text,text,text,bigint,bigint) to service_role;
grant execute on function public.increment_login_attempt(text,bigint) to service_role;
grant execute on function public.claim_system_lock(text,bigint) to service_role;
grant execute on function public.release_system_lock(text) to service_role;
grant execute on function public.tomoca_cleanup(bigint,bigint,bigint) to service_role;
