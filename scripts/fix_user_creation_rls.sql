-- Fix RLS policies to allow user creation during auth callback
-- This policy allows users to create their own record during the auth flow

-- Drop all existing policies on users table
DROP POLICY IF EXISTS users_admin_write ON users;
DROP POLICY IF EXISTS users_self_read ON users;
DROP POLICY IF EXISTS users_admin_read_all ON users;
DROP POLICY IF EXISTS users_self_insert ON users;
DROP POLICY IF EXISTS users_admin_manage ON users;

-- Create a new policy that allows users to insert their own record
CREATE POLICY users_self_insert ON users
  FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = id);

-- Create a policy for admins to manage all users
CREATE POLICY users_admin_manage ON users
  FOR ALL TO authenticated
  USING (public.current_user_role() = 'admin')
  WITH CHECK (public.current_user_role() = 'admin');

-- Create a policy for users to read their own record
CREATE POLICY users_self_read ON users
  FOR SELECT TO authenticated
  USING (auth.uid() = id);

-- Create a policy for admins to read all users
CREATE POLICY users_admin_read_all ON users
  FOR SELECT TO authenticated
  USING (public.current_user_role() = 'admin');

-- This ensures that:
-- 1. New users can create their own record during auth callback
-- 2. Users can read their own record
-- 3. Admins can manage all users
-- 4. Admins can read all users
