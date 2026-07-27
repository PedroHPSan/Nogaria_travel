-- is_tenant_member/is_tenant_admin/is_trip_member were `security invoker`.
-- memberships_select's policy calls is_tenant_member(tenant_id), whose body
-- selects from public.memberships -- as an invoker-rights function, that
-- inner select is itself subject to RLS on memberships, which re-evaluates
-- memberships_select, which calls is_tenant_member again, forever. Any query
-- touching memberships (directly, or via tenants/trips policies that also
-- call these functions) recursed until Postgres raised
-- "54001: stack depth limit exceeded", surfaced by PostgREST as a 500.
--
-- Fix: make these SECURITY DEFINER, owned by postgres. memberships has no
-- FORCE ROW LEVEL SECURITY, so the table owner bypasses RLS -- the
-- functions' internal lookups on memberships skip policy evaluation
-- entirely, breaking the recursion. Authorization is unchanged: each
-- function still gates on (select auth.uid()) internally.

create or replace function public.is_tenant_member(p_tenant_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.memberships m
    where m.tenant_id = p_tenant_id
      and m.user_id = (select auth.uid())
  )
$$;

create or replace function public.is_tenant_admin(p_tenant_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.memberships m
    where m.tenant_id = p_tenant_id
      and m.user_id = (select auth.uid())
      and m.role = 'admin'
  )
$$;

create or replace function public.is_trip_member(p_trip_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.trips t
    join public.memberships m on m.tenant_id = t.tenant_id
    where t.id = p_trip_id
      and m.user_id = (select auth.uid())
  )
$$;

-- These are called from RLS policies (`using`/`with check`), not via RPC, so
-- lock down direct execution the same way 20260726131559 did for the other
-- security definer functions.
revoke execute on function public.is_tenant_member(uuid) from public, anon;
revoke execute on function public.is_tenant_admin(uuid) from public, anon;
revoke execute on function public.is_trip_member(uuid) from public, anon;
grant execute on function public.is_tenant_member(uuid) to authenticated;
grant execute on function public.is_tenant_admin(uuid) to authenticated;
grant execute on function public.is_trip_member(uuid) to authenticated;
