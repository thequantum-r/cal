-- ========== FIX INVITED_USERS SCHEMA ==========
-- Update invited_users table to use role_id instead of role text

-- First, add role_id column to invited_users table
ALTER TABLE invited_users 
ADD COLUMN IF NOT EXISTS role_id uuid REFERENCES roles(id) ON DELETE RESTRICT;

-- Update existing invited_users to use role_id based on role name
UPDATE invited_users SET role_id = (
  SELECT id FROM roles WHERE name = invited_users.role
) WHERE role_id IS NULL AND role IS NOT NULL;

-- Set default role_id for any remaining records
UPDATE invited_users SET role_id = (
  SELECT id FROM roles WHERE name = 'read_only'
) WHERE role_id IS NULL;

-- Make role_id not null after migration
ALTER TABLE invited_users 
ALTER COLUMN role_id SET NOT NULL;

-- Drop the old role column and constraint
ALTER TABLE invited_users DROP COLUMN IF EXISTS role;

-- Update RLS policies for invited_users
DROP POLICY IF EXISTS invited_admin_full ON invited_users;
DROP POLICY IF EXISTS invited_self_select ON invited_users;

-- Admins can do anything on invited_users
CREATE POLICY invited_admin_full ON invited_users
  FOR ALL TO authenticated
  USING (public.current_user_role() = 'admin')
  WITH CHECK (public.current_user_role() = 'admin');

-- Any authenticated user can select their own invite row (email match)
CREATE POLICY invited_self_select ON invited_users
  FOR SELECT TO authenticated
  USING ((auth.jwt() ->> 'email') = email);

-- Add indexes for performance
CREATE INDEX IF NOT EXISTS idx_invited_users_email ON invited_users(email);
CREATE INDEX IF NOT EXISTS idx_invited_users_role_id ON invited_users(role_id);
CREATE INDEX IF NOT EXISTS idx_invited_users_invited_at ON invited_users(invited_at DESC);













