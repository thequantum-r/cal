-- Clean up unauthorized users that were created before the auth trigger was disabled
-- This script removes users from both auth.users and public.users tables

-- First, identify users in public.users who are not in invited_users
-- (assuming invited_users table exists)
DELETE FROM public.users 
WHERE id IN (
  SELECT u.id 
  FROM public.users u
  LEFT JOIN public.invited_users i ON u.email = i.email
  WHERE i.email IS NULL
);

-- If invited_users table doesn't exist, you can manually specify which users to keep
-- For example, to keep only specific admin users:
-- DELETE FROM public.users WHERE email NOT IN ('admin@usefficiency.com', 'other-admin@usefficiency.com');

-- Note: This script assumes you have the service role key to delete from auth.users
-- You may need to run this from your application with admin privileges
-- or manually delete users from the Supabase dashboard








