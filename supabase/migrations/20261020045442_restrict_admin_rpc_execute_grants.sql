-- Keep privileged admin RPCs available to signed-in clients that pass
-- their in-function private.is_gista_admin()/private.is_gista_owner() checks,
-- while removing default PUBLIC/anon execution privileges.

REVOKE EXECUTE ON FUNCTION public.admin_get_verification_review(uuid) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.admin_list_user_management(text, integer, integer) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.admin_record_personal_identity_review(uuid, text, text) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.admin_review_gista_verification(uuid, text, text, text) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.admin_search_verification_users(text) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.get_gista_admin_analytics(integer) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.search_gista_admin_users(text) FROM PUBLIC, anon;

GRANT EXECUTE ON FUNCTION public.admin_get_verification_review(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.admin_list_user_management(text, integer, integer) TO authenticated;
GRANT EXECUTE ON FUNCTION public.admin_record_personal_identity_review(uuid, text, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.admin_review_gista_verification(uuid, text, text, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.admin_search_verification_users(text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_gista_admin_analytics(integer) TO authenticated;
GRANT EXECUTE ON FUNCTION public.search_gista_admin_users(text) TO authenticated;
