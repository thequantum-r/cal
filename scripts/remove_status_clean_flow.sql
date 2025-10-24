-- ========== REMOVE STATUS FIELD AND IMPLEMENT CLEAN FLOW ==========
-- This script removes the status field from issuers table and implements the correct flow:
-- 1. Super admin creates issuer → Issuer added to issuers table
-- 2. Admin email added to invited_users → During issuer creation  
-- 3. Issuer admin logs in → Moved from invited_users to users table
-- 4. No status field needed → Simple and clean

-- Step 1: Remove status field from issuers table
ALTER TABLE issuers DROP COLUMN IF EXISTS status;

-- Step 2: Remove status-related triggers and functions
DROP FUNCTION IF EXISTS update_issuer_status_on_login() CASCADE;
DROP FUNCTION IF EXISTS update_issuer_status_on_issuer_user_create() CASCADE;
DROP TRIGGER IF EXISTS trigger_update_issuer_status_on_login ON users;
DROP TRIGGER IF EXISTS trigger_update_issuer_status_on_issuer_user_create ON issuer_users;

-- Step 3: Clean up any status-related data
-- Remove any pending invitations for users who have already logged in
DELETE FROM invited_users 
WHERE email IN (
  SELECT email FROM users
);

-- Step 4: Update RLS policies to remove status references
-- Drop existing policies
DROP POLICY IF EXISTS issuers_super_admin_read ON issuers;
DROP POLICY IF EXISTS issuers_issuer_admin_read ON issuers;
DROP POLICY IF EXISTS issuers_super_admin_write ON issuers;

-- Create new simplified policies without status
CREATE POLICY issuers_super_admin_read
ON issuers FOR SELECT
TO authenticated
USING ( public.current_user_role() = 'admin' );

CREATE POLICY issuers_issuer_admin_read
ON issuers FOR SELECT
TO authenticated
USING ( 
  EXISTS (
    SELECT 1 FROM issuer_users iu 
    JOIN roles r ON iu.role_id = r.id 
    WHERE iu.user_id = auth.uid() 
    AND iu.issuer_id = issuers.id 
    AND r.name = 'issuer_admin'
  )
);

CREATE POLICY issuers_super_admin_write
ON issuers FOR ALL
TO authenticated
USING ( public.current_user_role() = 'admin' )
WITH CHECK ( public.current_user_role() = 'admin' );

-- Step 5: Update invited_users policies to remove status references
DROP POLICY IF EXISTS invited_admin_full ON invited_users;
DROP POLICY IF EXISTS invited_self_select ON invited_users;
DROP POLICY IF EXISTS invited_issuer_admin_write ON invited_users;
DROP POLICY IF EXISTS invited_issuer_admin_read ON invited_users;

-- Create new simplified policies
CREATE POLICY invited_read_all ON invited_users
  FOR SELECT TO authenticated
  USING ( true );

CREATE POLICY invited_admin_full ON invited_users
  FOR ALL TO authenticated
  USING ( public.current_user_role() = 'admin' )
  WITH CHECK ( public.current_user_role() = 'admin' );

-- Step 6: Update functions to remove status references
CREATE OR REPLACE FUNCTION public.get_pending_invitations()
RETURNS TABLE (
  email text,
  name text,
  issuer_id uuid,
  issuer_name text,
  issuer_display_name text,
  role_name text,
  invited_at timestamptz
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT 
    iu.email,
    iu.name,
    iu.issuer_id,
    i.name as issuer_name,
    i.display_name as issuer_display_name,
    r.name as role_name,
    iu.invited_at
  FROM invited_users iu
  JOIN issuers i ON iu.issuer_id = i.id
  JOIN roles r ON iu.role_id = r.id
  WHERE NOT EXISTS (
    SELECT 1 FROM users u WHERE u.email = iu.email
  )
  ORDER BY iu.invited_at DESC;
$$;

-- Step 7: Update issuer statistics function
CREATE OR REPLACE FUNCTION public.get_issuer_statistics()
RETURNS TABLE (
  total_issuers bigint,
  active_issuers bigint,
  pending_invitations bigint
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT 
    (SELECT COUNT(*) FROM issuers) as total_issuers,
    (SELECT COUNT(*) FROM issuers WHERE EXISTS (
      SELECT 1 FROM issuer_users iu 
      JOIN users u ON iu.user_id = u.id 
      WHERE iu.issuer_id = issuers.id
    )) as active_issuers,
    (SELECT COUNT(*) FROM invited_users WHERE NOT EXISTS (
      SELECT 1 FROM users u WHERE u.email = invited_users.email
    )) as pending_invitations;
$$;

-- Step 8: Verify the changes
SELECT '=== VERIFICATION ===' as info;

SELECT 'Issuers table structure:' as check_type;
SELECT column_name, data_type, is_nullable 
FROM information_schema.columns 
WHERE table_name = 'issuers' 
ORDER BY ordinal_position;

SELECT 'All issuers:' as check_type;
SELECT id, name, display_name, created_at FROM issuers ORDER BY created_at;

SELECT 'Pending invitations:' as check_type;
SELECT email, name, issuer_id FROM invited_users;

SELECT 'Users with issuer access:' as check_type;
SELECT 
  u.email,
  COUNT(iu.issuer_id) as issuer_count
FROM users u
LEFT JOIN issuer_users iu ON u.id = iu.user_id
WHERE u.role != 'admin'
GROUP BY u.id, u.email
ORDER BY u.created_at;
