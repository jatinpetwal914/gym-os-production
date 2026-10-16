-- Allow authenticated requests to evaluate RLS and invoker RPC authorization helpers.
GRANT USAGE ON SCHEMA private TO authenticated;

-- Schema access must not make unrelated private functions callable.
REVOKE EXECUTE ON ALL FUNCTIONS IN SCHEMA private FROM PUBLIC, anon, authenticated;
ALTER DEFAULT PRIVILEGES IN SCHEMA private
  REVOKE EXECUTE ON FUNCTIONS FROM PUBLIC;

GRANT EXECUTE ON FUNCTION private.uid() TO authenticated;
GRANT EXECUTE ON FUNCTION private.current_profile() TO authenticated;
GRANT EXECUTE ON FUNCTION private.role() TO authenticated;
GRANT EXECUTE ON FUNCTION private.gym_id() TO authenticated;
GRANT EXECUTE ON FUNCTION private.is_super_admin() TO authenticated;
GRANT EXECUTE ON FUNCTION private.is_gym_manager() TO authenticated;
GRANT EXECUTE ON FUNCTION private.is_desk_staff() TO authenticated;
GRANT EXECUTE ON FUNCTION private.is_ops_lead() TO authenticated;
GRANT EXECUTE ON FUNCTION private.has_gym(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION private.has_support_gym(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION private.has_branch(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION private.own_member_id() TO authenticated;
GRANT EXECUTE ON FUNCTION private.trains_member(uuid) TO authenticated;
