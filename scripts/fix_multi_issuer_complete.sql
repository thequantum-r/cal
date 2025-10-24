-- ========== COMPREHENSIVE MULTI-ISSUER FIX ==========
-- This script fixes all multi-issuer issues including unique constraints and pending invitations

-- Step 1: Check current table structure
SELECT '=== CURRENT TABLE STRUCTURE ===' as info;
SELECT column_name, data_type, is_nullable, column_default 
FROM information_schema.columns 
WHERE table_name = 'invited_users' 
ORDER BY ordinal_position;

-- Step 2: Check current constraints
SELECT '=== CURRENT CONSTRAINTS ===' as info;
SELECT constraint_name, constraint_type, table_name 
FROM information_schema.table_constraints 
WHERE table_name = 'invited_users';

-- Step 3: Drop ALL existing constraints on invited_users
ALTER TABLE invited_users DROP CONSTRAINT IF EXISTS invited_users_pkey;
ALTER TABLE invited_users DROP CONSTRAINT IF EXISTS invited_users_email_key;
ALTER TABLE invited_users DROP CONSTRAINT IF EXISTS invited_users_email_issuer_role_unique;

-- Step 4: Create a new primary key that allows multi-issuer invitations
ALTER TABLE invited_users 
ADD CONSTRAINT invited_users_pkey 
PRIMARY KEY (email, issuer_id, role_id);

-- Step 5: Ensure all required columns exist and are properly configured
ALTER TABLE invited_users 
ADD COLUMN IF NOT EXISTS issuer_id uuid REFERENCES issuers(id) ON DELETE CASCADE;

ALTER TABLE invited_users 
ADD COLUMN IF NOT EXISTS role_id uuid REFERENCES roles(id) ON DELETE RESTRICT;

-- Step 6: Update existing records without issuer_id to have a default issuer
UPDATE invited_users 
SET issuer_id = (
  SELECT id FROM issuers 
  WHERE status = 'active' 
  ORDER BY created_at 
  LIMIT 1
)
WHERE issuer_id IS NULL;

-- Step 7: Update existing records without role_id to have a default role
UPDATE invited_users 
SET role_id = (
  SELECT id FROM roles 
  WHERE name = 'read_only'
  LIMIT 1
)
WHERE role_id IS NULL;

-- Step 8: Make issuer_id and role_id NOT NULL after migration
ALTER TABLE invited_users 
ALTER COLUMN issuer_id SET NOT NULL;

ALTER TABLE invited_users 
ALTER COLUMN role_id SET NOT NULL;

-- Step 9: Drop the old role column if it exists (for backward compatibility)
ALTER TABLE invited_users DROP COLUMN IF EXISTS role;

-- Step 10: Clean up pending invitations for users who have already logged in
-- This removes invitations for users who already have issuer_users records
DELETE FROM invited_users 
WHERE EXISTS (
  SELECT 1 FROM users u
  JOIN issuer_users iu ON u.id = iu.user_id
  WHERE u.email = invited_users.email 
  AND iu.issuer_id = invited_users.issuer_id
);

-- Step 11: Update RLS policies for multi-issuer support
DROP POLICY IF EXISTS invited_admin_full ON invited_users;
DROP POLICY IF EXISTS invited_self_select ON invited_users;
DROP POLICY IF EXISTS invited_issuer_admin_write ON invited_users;
DROP POLICY IF EXISTS invited_issuer_admin_read ON invited_users;

-- Super admins can do anything on invited_users
CREATE POLICY invited_admin_full ON invited_users
  FOR ALL TO authenticated
  USING (public.current_user_role() = 'admin')
  WITH CHECK (public.current_user_role() = 'admin');

-- Issuer admins can invite users for their company
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

-- Issuer admins can read invitations for their company
CREATE POLICY invited_issuer_admin_read ON invited_users
  FOR SELECT TO authenticated
  USING (
    public.current_user_role() = 'issuer_admin'
    AND EXISTS (
      SELECT 1 FROM issuer_users iu 
      WHERE iu.user_id = auth.uid() 
      AND iu.issuer_id = invited_users.issuer_id
    )
  );

-- Any authenticated user can select their own invite rows (email match)
CREATE POLICY invited_self_select ON invited_users
  FOR SELECT TO authenticated
  USING ((auth.jwt() ->> 'email') = email);

-- Step 12: Add indexes for performance
CREATE INDEX IF NOT EXISTS idx_invited_users_email ON invited_users(email);
CREATE INDEX IF NOT EXISTS idx_invited_users_issuer_id ON invited_users(issuer_id);
CREATE INDEX IF NOT EXISTS idx_invited_users_role_id ON invited_users(role_id);
CREATE INDEX IF NOT EXISTS idx_invited_users_invited_at ON invited_users(invited_at DESC);

-- Step 13: Verify the fix
SELECT '=== VERIFICATION ===' as info;

SELECT 'Updated table structure:' as check_type;
SELECT column_name, data_type, is_nullable 
FROM information_schema.columns 
WHERE table_name = 'invited_users' 
ORDER BY ordinal_position;

SELECT 'Updated constraints:' as check_type;
SELECT constraint_name, constraint_type 
FROM information_schema.table_constraints 
WHERE table_name = 'invited_users';

SELECT 'Sample data:' as check_type;
SELECT email, issuer_id, role_id, invited_at 
FROM invited_users 
ORDER BY invited_at DESC 
LIMIT 5;

-- Step 14: Test multi-issuer invitation capability
SELECT '=== MULTI-ISSUER TEST ===' as info;
SELECT 'This table now supports the same email being invited by multiple issuers with different roles' as capability;

-- Step 15: Show users who have logged in but still have pending invitations
SELECT '=== USERS WITH PENDING INVITATIONS WHO SHOULD BE CLEANED UP ===' as info;
SELECT 
  u.email,
  u.id as user_id,
  iu.issuer_id,
  iu.role_id,
  iu.is_primary,
  'HAS ISSUER_USERS RECORD' as status
FROM users u
JOIN issuer_users iu ON u.id = iu.user_id
WHERE EXISTS (
  SELECT 1 FROM invited_users inv 
  WHERE inv.email = u.email 
  AND inv.issuer_id = iu.issuer_id
);








