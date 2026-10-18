-- Security advisor 0028/0029: public.rls_auto_enable() is SECURITY DEFINER and was callable
-- through /rest/v1/rpc. It only backs the ensure_rls event trigger, which fires without
-- EXECUTE privilege, so revoke it from the API roles and keep the trigger.
revoke execute on function public.rls_auto_enable() from public, anon, authenticated;
