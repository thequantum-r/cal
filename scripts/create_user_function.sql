-- ========== CREATE USER FROM INVITATION FUNCTION ==========
-- This function atomically creates a user and their relationships from an invitation

-- Step 1: Create the function to handle user creation from invitation
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

-- Step 2: Grant execute permission to authenticated users
GRANT EXECUTE ON FUNCTION public.create_user_from_invitation(UUID, TEXT) TO authenticated;

-- Step 3: Verify the function was created
SELECT 'Function created successfully' as status;
