-- Fix the create_user_from_invitation function to handle all role types properly
CREATE OR REPLACE FUNCTION public.create_user_from_invitation(user_id uuid, user_email text)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
AS $function$
DECLARE
    invitation_record record;
    role_name text;
BEGIN
    -- Get invitation details
    SELECT * INTO invitation_record
    FROM invited_users 
    WHERE email = user_email
    LIMIT 1;
    
    IF NOT FOUND THEN
        RETURN false;
    END IF;
    
    -- Get the actual role name from the role_id
    SELECT name INTO role_name
    FROM roles 
    WHERE id = invitation_record.role_id;
    
    -- Insert into users table with correct role
    INSERT INTO users (id, email, role_id, role)
    VALUES (
        user_id,
        user_email, 
        invitation_record.role_id,
        role_name  -- Use the actual role name instead of hardcoded logic
    );
    
    -- Create issuer relationship for all non-superadmin roles that have an issuer_id
    IF role_name != 'superadmin' AND invitation_record.issuer_id IS NOT NULL THEN
        INSERT INTO issuer_users (user_id, issuer_id, role_id, is_primary)
        VALUES (user_id, invitation_record.issuer_id, invitation_record.role_id, true);
    END IF;
    
    -- Remove from invited_users
    DELETE FROM invited_users WHERE email = user_email;
    
    RETURN true;
END;
$function$;

-- Also fix the existing user who has the wrong role
UPDATE users 
SET role = 'shareholder' 
WHERE email = 'pakkiadossraji@gmail.com' AND role = 'read_only';

-- Create the missing issuer assignment for the existing user
INSERT INTO issuer_users (user_id, issuer_id, role_id, is_primary)
SELECT 
    u.id,
    'f4b146ba-834e-4d41-b3bc-36e4020c0e6e', -- The issuer ID from the invitation
    u.role_id,
    true
FROM users u
WHERE u.email = 'pakkiadossraji@gmail.com'
AND NOT EXISTS (
    SELECT 1 FROM issuer_users iu 
    WHERE iu.user_id = u.id 
    AND iu.issuer_id = 'f4b146ba-834e-4d41-b3bc-36e4020c0e6e'
);






