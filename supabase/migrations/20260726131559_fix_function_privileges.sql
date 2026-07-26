-- Postgres grants EXECUTE to PUBLIC by default on function creation, which
-- makes anon (and, for handle_new_user, even authenticated) able to call
-- these SECURITY DEFINER functions directly via RPC. Lock that down:
-- handle_new_user is trigger-only and should not be directly callable by
-- anyone; create_tenant_with_owner is meant for authenticated users only.

revoke execute on function public.handle_new_user() from public, anon, authenticated;

revoke execute on function public.create_tenant_with_owner(text, text) from public, anon;
grant execute on function public.create_tenant_with_owner(text, text) to authenticated;
