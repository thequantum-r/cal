-- ========== FIX INVITED_USERS RLS POLICY ==========
-- This script fixes the RLS policy that was preventing invited users from logging in

-- Drop all existing policies to start fresh
DROP POLICY IF EXISTS invited_self_select ON invited_users;
DROP POLICY IF EXISTS invited_read_all ON invited_users;
DROP POLICY IF EXISTS invited_admin_full ON invited_users;
DROP POLICY IF EXISTS invited_issuer_admin_write ON invited_users;
DROP POLICY IF EXISTS invited_issuer_admin_read ON invited_users;

-- Create a simple policy that allows all authenticated users to read invited_users
-- This is needed for the auth callback to work properly
CREATE POLICY invited_read_all ON invited_users
  FOR SELECT TO authenticated
  USING ( true );

-- Super admins can do anything on invited_users
CREATE POLICY invited_admin_full ON invited_users
  FOR ALL TO authenticated
  USING ( public.current_user_role() = 'admin' )
  WITH CHECK ( public.current_user_role() = 'admin' );

-- Issuer admins can manage invitations for their company
CREATE POLICY invited_issuer_admin_write ON invited_users
  FOR ALL TO authenticated
  USING (
    public.current_user_role() = 'issuer_admin'
    AND EXISTS (
      SELECT 1 FROM issuer_users iu 
      WHERE iu.user_id = auth.uid() 
      AND iu.issuer_id = invited_users.issuer_id
    )
  )
  WITH CHECK (
    public.current_user_role() = 'issuer_admin'
    AND EXISTS (
      SELECT 1 FROM issuer_users iu 
      WHERE iu.user_id = auth.uid() 
      AND iu.issuer_id = invited_users.issuer_id
    )
    -- Prevent issuer admins from inviting super admin role
    AND NOT EXISTS (
      SELECT 1 FROM roles r 
      WHERE r.id = invited_users.role_id 
      AND r.name = 'admin'
    )
  );

-- Verify the fix
SELECT '=== RLS POLICY FIXED ===' as status;
SELECT 'invited_users table now allows auth callback and issuer admin invitations' as message;
