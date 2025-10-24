-- Script to fix authentication and role issues
-- 1. Fix existing user's missing issuer assignment
-- 2. Remove role and role_id columns from users table
-- 3. Update the create_user_from_invitation function

-- Step 1: Fix the existing user's missing issuer assignment
INSERT INTO issuer_users (user_id, issuer_id, role_id, is_primary)
SELECT 
    u.id,
    'e1b53a11-7412-40fc-9d26-822066cd6af2', -- Test issuer ID from the logs
    '72bc76fc-3c19-4cc8-bc04-d631cfe0bc2b', -- shareholder role ID
    true
FROM users u
WHERE u.email = 'pakkiadossraji@gmail.com'
AND NOT EXISTS (
    SELECT 1 FROM issuer_users iu 
    WHERE iu.user_id = u.id 
    AND iu.issuer_id = 'e1b53a11-7412-40fc-9d26-822066cd6af2'
);

-- Step 2: Remove role and role_id columns from users table (CAREFUL - this affects code)
-- First backup the data in case we need to rollback
CREATE TABLE IF NOT EXISTS users_role_backup AS 
SELECT id, email, role, role_id FROM users WHERE role IS NOT NULL OR role_id IS NOT NULL;

-- Remove the columns (this will break existing code that references user.role)
ALTER TABLE users DROP COLUMN IF EXISTS role;
ALTER TABLE users DROP COLUMN IF EXISTS role_id;

-- Step 3: Update the create_user_from_invitation function to not use role/role_id
CREATE OR REPLACE FUNCTION public.create_user_from_invitation(user_id uuid, user_email text)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
AS $function$
DECLARE
    invitation_record record;
BEGIN
    -- Get invitation details
    SELECT * INTO invitation_record
    FROM invited_users 
    WHERE email = user_email
    LIMIT 1;
    
    IF NOT FOUND THEN
        RETURN false;
    END IF;
    
    -- Insert into users table without role/role_id columns
    INSERT INTO users (id, email, is_super_admin, is_owner)
    VALUES (
        user_id,
        user_email,
        (SELECT name FROM roles WHERE id = invitation_record.role_id) = 'superadmin',
        false
    );
    
    -- Create issuer relationship for all non-superadmin roles that have an issuer_id
    IF (SELECT name FROM roles WHERE id = invitation_record.role_id) != 'superadmin' 
       AND invitation_record.issuer_id IS NOT NULL THEN
        INSERT INTO issuer_users (user_id, issuer_id, role_id, is_primary)
        VALUES (user_id, invitation_record.issuer_id, invitation_record.role_id, true);
    END IF;
    
    -- Remove from invited_users (keeping this for now, but in practice we might want to keep it)
    DELETE FROM invited_users WHERE email = user_email;
    
    RETURN true;
END;
$function$;




