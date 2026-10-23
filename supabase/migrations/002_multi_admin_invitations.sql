-- TOMOCA Reads · multi-administrator invitations
-- Existing deployments: run this after 001_tomoca_reads.sql.

create table if not exists public.admin_invitations (
  id text primary key, -- SHA-256 digest of the raw one-time activation token
  email text not null,
  invited_by text references public.admin_accounts(id) on delete set null,
  created bigint not null,
  expires bigint not null,
  used_at bigint
);

create index if not exists idx_admin_invitations_email on public.admin_invitations(email);
create index if not exists idx_admin_invitations_expires on public.admin_invitations(expires);

-- Consume an invitation atomically. If the email already has an admin account,
-- this acts as an administrator-authorized password reset; otherwise it creates
-- a new administrator. The one-time token is marked used in the same transaction.
create or replace function public.activate_admin_invitation(
  p_token_hash text,
  p_account_id text,
  p_salt text,
  p_password_hash text,
  p_password_iterations integer,
  p_now bigint
)
returns table(account_id text, admin_email text)
language plpgsql
security definer
set search_path=public
as $$
declare
  v_inv public.admin_invitations%rowtype;
  v_account_id text;
begin
  select * into v_inv
  from public.admin_invitations
  where id=p_token_hash
    and used_at is null
    and expires>p_now
  for update;

  if not found then
    return;
  end if;

  select id into v_account_id
  from public.admin_accounts
  where email=v_inv.email
  limit 1;

  if v_account_id is null then
    v_account_id:=p_account_id;
    insert into public.admin_accounts(id,email,salt,password_hash,password_iterations,created)
    values(v_account_id,v_inv.email,p_salt,p_password_hash,p_password_iterations,p_now);
  else
    update public.admin_accounts
    set salt=p_salt,
        password_hash=p_password_hash,
        password_iterations=p_password_iterations
    where id=v_account_id;

    -- A password reset invalidates all existing sessions for that administrator.
    delete from public.admin_sessions where account_id=v_account_id;
  end if;

  update public.admin_invitations
  set used_at=p_now
  where id=p_token_hash;

  return query select v_account_id,v_inv.email;
end;
$$;

-- Extend maintenance so expired/used invitation records do not accumulate.
create or replace function public.tomoca_cleanup(
  p_now bigint,
  p_registration_cutoff bigint,
  p_override_cutoff bigint
)
returns jsonb
language plpgsql
security definer
set search_path=public
as $$
declare
  n_sessions integer;
  n_codes integer;
  n_admin_sessions integer;
  n_attempts integer;
  n_registrations integer;
  n_overrides integer;
  n_invitations integer;
begin
  delete from public.sessions where expires < p_now; get diagnostics n_sessions = row_count;
  delete from public.codes where expires < p_now; get diagnostics n_codes = row_count;
  delete from public.admin_sessions where expires < p_now; get diagnostics n_admin_sessions = row_count;
  delete from public.admin_login_attempts where expires < p_now; get diagnostics n_attempts = row_count;
  delete from public.registrations where created < p_registration_cutoff; get diagnostics n_registrations = row_count;
  delete from public.story_overrides where updated < p_override_cutoff; get diagnostics n_overrides = row_count;
  delete from public.system_locks where expires < p_now;
  delete from public.admin_invitations where expires < p_now or (used_at is not null and used_at < p_now-604800000); get diagnostics n_invitations = row_count;

  return jsonb_build_object(
    'sessions',n_sessions,
    'codes',n_codes,
    'adminSessions',n_admin_sessions,
    'loginAttempts',n_attempts,
    'registrations',n_registrations,
    'storyOverrides',n_overrides,
    'adminInvitations',n_invitations
  );
end;
$$;

alter table public.admin_invitations enable row level security;
revoke all on table public.admin_invitations from anon, authenticated;
revoke execute on function public.activate_admin_invitation(text,text,text,text,integer,bigint) from public, anon, authenticated;

grant all on table public.admin_invitations to service_role;
grant execute on function public.activate_admin_invitation(text,text,text,text,integer,bigint) to service_role;
