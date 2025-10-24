-- Fix current_user_role function to work with new database structure
-- The function needs to work with the users_with_roles view instead of the old users table

-- Drop the old function
DROP FUNCTION IF EXISTS public.current_user_role();

-- Create new function that works with the new structure
CREATE OR REPLACE FUNCTION public.current_user_role()
RETURNS text
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  -- Check if user is superadmin first
  SELECT CASE 
    WHEN u.is_super_admin = true THEN 'superadmin'
    ELSE COALESCE(
      (
        SELECT r.name
        FROM issuer_users iu
        JOIN roles r ON iu.role_id = r.id
        WHERE iu.user_id = auth.uid()
        ORDER BY 
          CASE r.name
            WHEN 'admin' THEN 1
            WHEN 'transfer_team' THEN 2  
            WHEN 'shareholder' THEN 3
            ELSE 4
          END
        LIMIT 1
      ), 
      'read_only'
    )
  END
  FROM users u
  WHERE u.id = auth.uid();
$$;

-- Grant execute permission
GRANT EXECUTE ON FUNCTION public.current_user_role() TO authenticated;



