-- ========== APPLY MULTI-ISSUER FIX ==========
-- This script fixes the unique constraint issue and cleans up pending invitations

-- Step 1: Drop existing constraints that prevent multi-issuer invitations
ALTER TABLE invited_users DROP CONSTRAINT IF EXISTS invited_users_pkey;
ALTER TABLE invited_users DROP CONSTRAINT IF EXISTS invited_users_email_key;
ALTER TABLE invited_users DROP CONSTRAINT IF EXISTS invited_users_email_issuer_role_unique;

-- Step 2: Create new composite primary key that allows multi-issuer invitations
ALTER TABLE invited_users 
ADD CONSTRAINT invited_users_pkey 
PRIMARY KEY (email, issuer_id, role_id);

-- Step 3: Ensure required columns exist
ALTER TABLE invited_users 
ADD COLUMN IF NOT EXISTS issuer_id uuid REFERENCES issuers(id) ON DELETE CASCADE;

ALTER TABLE invited_users 
ADD COLUMN IF NOT EXISTS role_id uuid REFERENCES roles(id) ON DELETE RESTRICT;

-- Step 4: Update existing records with default values
UPDATE invited_users 
SET issuer_id = (
  SELECT id FROM issuers 
  WHERE status = 'active' 
  ORDER BY created_at 
  LIMIT 1
)
WHERE issuer_id IS NULL;

UPDATE invited_users 
SET role_id = (
  SELECT id FROM roles 
  WHERE name = 'read_only'
  LIMIT 1
)
WHERE role_id IS NULL;

-- Step 5: Make columns NOT NULL
ALTER TABLE invited_users 
ALTER COLUMN issuer_id SET NOT NULL;

ALTER TABLE invited_users 
ALTER COLUMN role_id SET NOT NULL;

-- Step 6: Clean up pending invitations for users who have already logged in
DELETE FROM invited_users 
WHERE EXISTS (
  SELECT 1 FROM users u
  JOIN issuer_users iu ON u.id = iu.user_id
  WHERE u.email = invited_users.email 
  AND iu.issuer_id = invited_users.issuer_id
);

-- Step 7: Update RLS policies
DROP POLICY IF EXISTS invited_admin_full ON invited_users;
DROP POLICY IF EXISTS invited_self_select ON invited_users;
DROP POLICY IF EXISTS invited_issuer_admin_write ON invited_users;
DROP POLICY IF EXISTS invited_issuer_admin_read ON invited_users;

-- Super admins can do anything
CREATE POLICY invited_admin_full ON invited_users
  FOR ALL TO authenticated
  USING (public.current_user_role() = 'admin')
  WITH CHECK (public.current_user_role() = 'admin');

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

-- Users can see their own invitations
CREATE POLICY invited_self_select ON invited_users
  FOR SELECT TO authenticated
  USING ((auth.jwt() ->> 'email') = email);

-- Step 8: Add performance indexes
CREATE INDEX IF NOT EXISTS idx_invited_users_email ON invited_users(email);
CREATE INDEX IF NOT EXISTS idx_invited_users_issuer_id ON invited_users(issuer_id);
CREATE INDEX IF NOT EXISTS idx_invited_users_role_id ON invited_users(role_id);
CREATE INDEX IF NOT EXISTS idx_invited_users_invited_at ON invited_users(invited_at DESC);

-- Step 9: Verification
SELECT '=== FIX APPLIED SUCCESSFULLY ===' as status;
SELECT 'Multi-issuer invitations are now supported' as message;








