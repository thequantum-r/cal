-- Complete authentication and role fix script
-- This script handles all dependencies and fixes all issues without blocking

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

-- Step 2: Set existing user as non-superadmin
UPDATE users 
SET is_super_admin = false, is_owner = false
WHERE email = 'pakkiadossraji@gmail.com';

-- Step 3: Backup role data before removing columns
CREATE TABLE IF NOT EXISTS users_role_backup AS 
SELECT id, email, role, role_id, created_at FROM users 
WHERE role IS NOT NULL OR role_id IS NOT NULL;

-- Step 4: Drop dependent view first (this is what was causing the error)
DROP VIEW IF EXISTS users_with_roles CASCADE;

-- Step 5: Now we can safely drop the columns
ALTER TABLE users DROP COLUMN IF EXISTS role CASCADE;
ALTER TABLE users DROP COLUMN IF EXISTS role_id CASCADE;

-- Step 6: Create a new view that gets role information from issuer_users
CREATE OR REPLACE VIEW users_with_roles AS
SELECT 
    u.id,
    u.email,
    u.created_at,
    u.is_super_admin,
    u.is_owner,
    -- For superadmins, show 'superadmin' as their primary role
    CASE 
        WHEN u.is_super_admin = true THEN 'superadmin'
        ELSE COALESCE(primary_role.role_name, 'read_only')
    END as role,
    CASE 
        WHEN u.is_super_admin = true THEN (SELECT id FROM roles WHERE name = 'superadmin')
        ELSE primary_role.role_id
    END as role_id,
    CASE 
        WHEN u.is_super_admin = true THEN (SELECT name FROM roles WHERE name = 'superadmin')
        ELSE primary_role.role_name
    END as role_name,
    CASE 
        WHEN u.is_super_admin = true THEN (SELECT display_name FROM roles WHERE name = 'superadmin')
        ELSE primary_role.role_display_name
    END as role_display_name,
    CASE 
        WHEN u.is_super_admin = true THEN (SELECT description FROM roles WHERE name = 'superadmin')
        ELSE primary_role.role_description
    END as role_description,
    CASE 
        WHEN u.is_super_admin = true THEN (SELECT permissions FROM roles WHERE name = 'superadmin')
        ELSE primary_role.role_permissions
    END as role_permissions,
    CASE 
        WHEN u.is_super_admin = true THEN (SELECT is_system_role FROM roles WHERE name = 'superadmin')
        ELSE primary_role.is_system_role
    END as is_system_role
FROM users u
LEFT JOIN (
    -- Get the primary role for each user (highest privilege role)
    SELECT DISTINCT ON (iu.user_id)
        iu.user_id,
        iu.role_id,
        r.name as role_name,
        r.display_name as role_display_name,
        r.description as role_description,
        r.permissions as role_permissions,
        r.is_system_role
    FROM issuer_users iu
    JOIN roles r ON iu.role_id = r.id
    ORDER BY iu.user_id, 
        CASE r.name
            WHEN 'admin' THEN 1
            WHEN 'transfer_team' THEN 2  
            WHEN 'shareholder' THEN 3
            ELSE 4
        END
) primary_role ON u.id = primary_role.user_id;

-- Step 7: Update the create_user_from_invitation function
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
    
    -- Keep the invitation for admin management (don't delete automatically)
    -- DELETE FROM invited_users WHERE email = user_email;
    
    RETURN true;
END;
$function$;




