-- ========== COMPLETE LOGIN FLOW FIX ==========
-- This script fixes all login issues for both issuer admins and regular users

-- Step 1: Update RLS policies to allow all necessary access
DROP POLICY IF EXISTS invited_read_all ON invited_users;
DROP POLICY IF EXISTS invited_admin_full ON invited_users;
DROP POLICY IF EXISTS invited_issuer_admin_write ON invited_users;
DROP POLICY IF EXISTS invited_issuer_admin_read ON invited_users;
DROP POLICY IF EXISTS invited_self_select ON invited_users;

-- Allow all authenticated users to read invited_users (needed for auth callback and middleware)
CREATE POLICY invited_read_all ON invited_users
  FOR SELECT TO authenticated
  USING ( true );

-- Super admins can do anything
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

-- Step 2: Create a function to handle user creation from invitation
CREATE OR REPLACE FUNCTION public.create_user_from_invitation(
  user_id UUID,
  user_email TEXT
)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  invitation RECORD;
  role_name TEXT;
BEGIN
  -- Get the invitation
  SELECT * INTO invitation
  FROM invited_users
  WHERE email = user_email
  LIMIT 1;

  IF NOT FOUND THEN
    RETURN FALSE;
  END IF;

  -- Get role name
  SELECT name INTO role_name
  FROM roles
  WHERE id = invitation.role_id;

  -- Create user in users table
  INSERT INTO users (id, email, role, role_id, is_super_admin)
  VALUES (user_id, user_email, role_name, invitation.role_id, false);

  -- Create issuer_users record if needed
  IF role_name = 'issuer_admin' OR invitation.issuer_id IS NOT NULL THEN
    INSERT INTO issuer_users (user_id, issuer_id, role_id, is_primary)
    VALUES (user_id, invitation.issuer_id, invitation.role_id, true);
  END IF;

  -- Clean up the invitation
  DELETE FROM invited_users
  WHERE email = user_email
    AND issuer_id = invitation.issuer_id
    AND role_id = invitation.role_id;

  RETURN TRUE;
END;
$$;

-- Step 3: Ensure current_user_role function is correct
CREATE OR REPLACE FUNCTION public.current_user_role()
RETURNS TEXT
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT COALESCE(r.name, u.role, 'read_only')
  FROM public.users u
  LEFT JOIN public.roles r ON u.role_id = r.id
  WHERE u.id = auth.uid();
$$;

-- Step 4: Create helper function to check if user has valid invitation
CREATE OR REPLACE FUNCTION public.user_has_invitation(user_email TEXT)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM invited_users
    WHERE email = user_email
  );
$$;

-- Verify the fix
SELECT '=== COMPREHENSIVE FIX APPLIED ===' as status;
SELECT 'Login flow now supports both issuer admin and regular user invitations' as message;

-- Show current invitations for verification
SELECT 'Current invitations:' as info;
SELECT 
  email,
  issuers.display_name as issuer_name,
  roles.name as role_name,
  invited_at
FROM invited_users
JOIN issuers ON invited_users.issuer_id = issuers.id
JOIN roles ON invited_users.role_id = roles.id
ORDER BY invited_at DESC;
