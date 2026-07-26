-- Pending team invites, auto-resolved on signup or immediately if the
-- invited email already has an account.

create table public.tenant_invites (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants (id) on delete cascade,
  email text not null,
  role varchar(50) not null check (role in ('admin', 'organizer', 'participant', 'viewer', 'developer')),
  invited_by_id uuid references public.profiles (id) on delete set null,
  created_at timestamptz not null default now(),
  accepted_at timestamptz
);

create unique index tenant_invites_tenant_email_idx on public.tenant_invites (tenant_id, lower(email));
create index tenant_invites_tenant_id_idx on public.tenant_invites (tenant_id);

alter table public.tenant_invites enable row level security;

create policy tenant_invites_all on public.tenant_invites for all
  to authenticated using (public.is_tenant_admin(tenant_id)) with check (public.is_tenant_admin(tenant_id));

grant select, insert, update, delete on public.tenant_invites to authenticated, service_role;

-- Resolve an invite the instant it's created, if the invited email
-- already has a profile (i.e. already has an account).
create function public.resolve_invite_if_profile_exists()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_profile_id uuid;
begin
  select id into v_profile_id
  from public.profiles
  where lower(email) = lower(new.email)
  limit 1;

  if v_profile_id is not null then
    insert into public.memberships (tenant_id, user_id, role)
    values (new.tenant_id, v_profile_id, new.role)
    on conflict (tenant_id, user_id) do nothing;

    update public.tenant_invites
    set accepted_at = now()
    where id = new.id;
  end if;

  return new;
end;
$$;

revoke execute on function public.resolve_invite_if_profile_exists() from public, anon, authenticated;

create trigger on_tenant_invite_created
  after insert on public.tenant_invites
  for each row execute function public.resolve_invite_if_profile_exists();

-- Extend handle_new_user to also resolve any invites waiting for this
-- email, for the case where the invite was created before signup.
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.profiles (id, email, full_name, avatar_url)
  values (
    new.id,
    new.email,
    coalesce(new.raw_user_meta_data->>'full_name', split_part(new.email, '@', 1)),
    new.raw_user_meta_data->>'avatar_url'
  );

  insert into public.memberships (tenant_id, user_id, role)
  select ti.tenant_id, new.id, ti.role
  from public.tenant_invites ti
  where lower(ti.email) = lower(new.email)
    and ti.accepted_at is null
  on conflict (tenant_id, user_id) do nothing;

  update public.tenant_invites
  set accepted_at = now()
  where lower(email) = lower(new.email)
    and accepted_at is null;

  return new;
end;
$$;

revoke execute on function public.handle_new_user() from public, anon, authenticated;

-- Simplify create_tenant_with_owner: derive the slug internally so the
-- onboarding UI only has to ask for one field (the name), and can never
-- hit a "slug already taken" error.
drop function public.create_tenant_with_owner(text, text);

create function public.create_tenant_with_owner(p_name text)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_tenant_id uuid;
  v_base_slug text;
  v_slug text;
begin
  if (select auth.uid()) is null then
    raise exception 'authentication required';
  end if;

  if p_name is null or length(trim(p_name)) = 0 then
    raise exception 'tenant name is required';
  end if;

  v_base_slug := lower(regexp_replace(trim(p_name), '[^a-zA-Z0-9]+', '-', 'g'));
  v_base_slug := trim(both '-' from v_base_slug);
  if v_base_slug = '' then
    v_base_slug := 'tenant';
  end if;
  v_slug := v_base_slug || '-' || substr(gen_random_uuid()::text, 1, 8);

  insert into public.tenants (name, slug)
  values (trim(p_name), v_slug)
  returning id into v_tenant_id;

  insert into public.memberships (tenant_id, user_id, role)
  values (v_tenant_id, (select auth.uid()), 'admin');

  return v_tenant_id;
end;
$$;

revoke execute on function public.create_tenant_with_owner(text) from public, anon;
grant execute on function public.create_tenant_with_owner(text) to authenticated;
