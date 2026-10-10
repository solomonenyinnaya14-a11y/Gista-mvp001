-- These functions are internal implementation details used by database triggers.
-- They should not be callable directly through the Supabase RPC API by client roles.
REVOKE EXECUTE ON FUNCTION public.refresh_post_growth_status(uuid) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.sync_post_growth_status_from_engagement() FROM PUBLIC, anon, authenticated;
