-- Two permissive SELECT policies on the same role force Postgres to
-- evaluate both for every query. Merge them into a single policy.

drop policy profiles_select_self on public.profiles;
drop policy profiles_select_tenant_mates on public.profiles;

create policy profiles_select on public.profiles for select
  to authenticated using (
    (select auth.uid()) = id
    or exists (
      select 1 from public.memberships mine
      join public.memberships theirs on theirs.tenant_id = mine.tenant_id
      where mine.user_id = (select auth.uid())
        and theirs.user_id = public.profiles.id
    )
  );
