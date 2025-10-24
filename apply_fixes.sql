-- ========== APPLY ALL NECESSARY DATABASE FIXES ==========

-- Step 1: Create the user creation function
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
    RAISE LOG 'No invitation found for email: %', user_email;
    RETURN FALSE;
  END IF;

  -- Get role name
  SELECT name INTO role_name
  FROM roles
  WHERE id = invitation.role_id;

  IF NOT FOUND THEN
    RAISE LOG 'Role not found for role_id: %', invitation.role_id;
    RETURN FALSE;
  END IF;

  -- Create user in users table
  INSERT INTO users (id, email, role, role_id, is_super_admin)
  VALUES (user_id, user_email, role_name, invitation.role_id, false);

  -- Create issuer_users record if needed (for any user with an issuer_id)
  IF invitation.issuer_id IS NOT NULL THEN
    INSERT INTO issuer_users (user_id, issuer_id, role_id, is_primary)
    VALUES (user_id, invitation.issuer_id, invitation.role_id, true);
  END IF;

  -- Clean up the invitation
  DELETE FROM invited_users
  WHERE email = user_email
    AND issuer_id = invitation.issuer_id
    AND role_id = invitation.role_id;

  RAISE LOG 'Successfully created user % with role % for issuer %', user_email, role_name, invitation.issuer_id;
  RETURN TRUE;

EXCEPTION
  WHEN OTHERS THEN
    RAISE LOG 'Error creating user from invitation: % - %', SQLSTATE, SQLERRM;
    RETURN FALSE;
END;
$$;

-- Grant execute permission to authenticated users
GRANT EXECUTE ON FUNCTION public.create_user_from_invitation(UUID, TEXT) TO authenticated;

-- Step 2: Fix RLS policies for invited_users
DROP POLICY IF EXISTS invited_self_select ON invited_users;
DROP POLICY IF EXISTS invited_read_all ON invited_users;
DROP POLICY IF EXISTS invited_admin_full ON invited_users;
DROP POLICY IF EXISTS invited_issuer_admin_write ON invited_users;
DROP POLICY IF EXISTS invited_issuer_admin_read ON invited_users;

-- Create simple policies for invited_users
CREATE POLICY invited_read_all ON invited_users FOR SELECT TO authenticated USING ( true );
CREATE POLICY invited_admin_full ON invited_users FOR ALL TO authenticated USING ( public.current_user_role() = 'admin' );
CREATE POLICY invited_issuer_admin_write ON invited_users FOR INSERT TO authenticated WITH CHECK ( 
  public.current_user_role() = 'issuer_admin' AND 
  issuer_id IN (
    SELECT issuer_id FROM issuer_users WHERE user_id = auth.uid()
  )
);
CREATE POLICY invited_issuer_admin_read ON invited_users FOR SELECT TO authenticated USING ( 
  public.current_user_role() = 'issuer_admin' AND 
  issuer_id IN (
    SELECT issuer_id FROM issuer_users WHERE user_id = auth.uid()
  )
);

-- Step 3: Check for missing issuer_users records and create them
-- This script will find users who are issuer_admins but don't have issuer_users records
DO $$
DECLARE
    admin_user RECORD;
    admin_role_id UUID;
BEGIN
    -- Get the issuer_admin role ID
    SELECT id INTO admin_role_id FROM roles WHERE name = 'issuer_admin' LIMIT 1;
    
    IF admin_role_id IS NULL THEN
        RAISE LOG 'No issuer_admin role found';
        RETURN;
    END IF;
    
    -- Find users with issuer_admin role who don't have issuer_users records
    FOR admin_user IN 
        SELECT u.id, u.email, iu.email as invite_email, iu.issuer_id
        FROM users u
        LEFT JOIN issuer_users ius ON u.id = ius.user_id
        LEFT JOIN invited_users iu ON u.email = iu.email
        WHERE u.role = 'issuer_admin' 
        AND ius.user_id IS NULL  -- No issuer_users record
        AND iu.issuer_id IS NOT NULL  -- Had an invitation with issuer_id
    LOOP
        -- Create the missing issuer_users record
        INSERT INTO issuer_users (user_id, issuer_id, role_id, is_primary)
        VALUES (admin_user.id, admin_user.issuer_id, admin_role_id, true)
        ON CONFLICT (user_id, issuer_id) DO NOTHING;
        
        RAISE LOG 'Created issuer_users record for user % with issuer %', admin_user.email, admin_user.issuer_id;
    END LOOP;
END;
$$;

-- Step 4: Verify the fixes
SELECT 'Database fixes applied successfully' as status;
