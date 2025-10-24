-- Comprehensive fix for RLS policies and current_user_role function
-- This script drops all dependent policies, updates the function, and recreates essential policies

-- Step 1: Drop all RLS policies that depend on current_user_role function
DROP POLICY IF EXISTS users_admin_insert ON users;
DROP POLICY IF EXISTS users_admin_update ON users;
DROP POLICY IF EXISTS users_admin_delete ON users;
DROP POLICY IF EXISTS sh_admin_insert ON shareholders;
DROP POLICY IF EXISTS sh_admin_update ON shareholders;
DROP POLICY IF EXISTS sh_admin_delete ON shareholders;
DROP POLICY IF EXISTS sh_transfer_insert ON shareholders;
DROP POLICY IF EXISTS sh_transfer_update ON shareholders;
DROP POLICY IF EXISTS rkt_admin_insert ON record_keeping_transactions;
DROP POLICY IF EXISTS rkt_admin_update ON record_keeping_transactions;
DROP POLICY IF EXISTS rkt_admin_delete ON record_keeping_transactions;
DROP POLICY IF EXISTS rkt_transfer_insert ON record_keeping_transactions;
DROP POLICY IF EXISTS rkt_transfer_update ON record_keeping_transactions;
DROP POLICY IF EXISTS cb_admin_insert ON control_book_daily_summary;
DROP POLICY IF EXISTS cb_admin_update ON control_book_daily_summary;
DROP POLICY IF EXISTS cb_admin_delete ON control_book_daily_summary;
DROP POLICY IF EXISTS sp_admin_insert ON shareholder_positions;
DROP POLICY IF EXISTS sp_admin_update ON shareholder_positions;
DROP POLICY IF EXISTS sp_admin_delete ON shareholder_positions;
DROP POLICY IF EXISTS market_values_admin_write ON market_values;
DROP POLICY IF EXISTS roles_admin_insert ON roles;
DROP POLICY IF EXISTS roles_admin_update ON roles;
DROP POLICY IF EXISTS roles_admin_delete ON roles;
DROP POLICY IF EXISTS invited_admin_full ON invited_users;
DROP POLICY IF EXISTS invited_issuer_admin_write ON invited_users;
DROP POLICY IF EXISTS invited_issuer_admin_read ON invited_users;

-- Step 2: Drop the old function
DROP FUNCTION IF EXISTS public.current_user_role();

-- Step 3: Create new function that works with the new structure
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

-- Step 4: Grant execute permission
GRANT EXECUTE ON FUNCTION public.current_user_role() TO authenticated;

-- Step 5: Recreate essential RLS policies

-- Users table policies
CREATE POLICY users_self_select ON users
  FOR SELECT TO authenticated
  USING (auth.uid() = id);

-- Roles table policies
CREATE POLICY roles_read_all ON roles
  FOR SELECT TO authenticated
  USING (true);

CREATE POLICY roles_admin_insert ON roles
  FOR INSERT TO authenticated
  WITH CHECK (public.current_user_role() IN ('superadmin', 'admin'));

CREATE POLICY roles_admin_update ON roles
  FOR UPDATE TO authenticated
  USING (public.current_user_role() IN ('superadmin', 'admin'))
  WITH CHECK (public.current_user_role() IN ('superadmin', 'admin'));

CREATE POLICY roles_admin_delete ON roles
  FOR DELETE TO authenticated
  USING (public.current_user_role() IN ('superadmin', 'admin'));

-- Invited users policies
CREATE POLICY invited_admin_full ON invited_users
  FOR ALL TO authenticated
  USING (public.current_user_role() IN ('superadmin', 'admin'))
  WITH CHECK (public.current_user_role() IN ('superadmin', 'admin'));

CREATE POLICY invited_self_select ON invited_users
  FOR SELECT TO authenticated
  USING ((auth.jwt() ->> 'email') = email);

-- Issuer users policies
CREATE POLICY issuer_users_self_select ON issuer_users
  FOR SELECT TO authenticated
  USING (auth.uid() = user_id OR public.current_user_role() IN ('superadmin', 'admin'));

-- Issuers policies  
CREATE POLICY issuers_read_all ON issuers
  FOR SELECT TO authenticated
  USING (
    public.current_user_role() = 'superadmin' OR
    EXISTS (
      SELECT 1 FROM issuer_users iu 
      WHERE iu.user_id = auth.uid() 
      AND iu.issuer_id = issuers.id
    )
  );

CREATE POLICY issuers_admin_write ON issuers
  FOR ALL TO authenticated
  USING (public.current_user_role() = 'superadmin')
  WITH CHECK (public.current_user_role() = 'superadmin');

-- Enable RLS on key tables if not already enabled
ALTER TABLE users ENABLE ROW LEVEL SECURITY;
ALTER TABLE roles ENABLE ROW LEVEL SECURITY;
ALTER TABLE invited_users ENABLE ROW LEVEL SECURITY;
ALTER TABLE issuer_users ENABLE ROW LEVEL SECURITY;
ALTER TABLE issuers ENABLE ROW LEVEL SECURITY;

-- Verification
SELECT 'RLS policies and function updated successfully' AS status;



