-- Comprehensive fix for RLS policies and current_user_role function (V2)
-- This script drops ALL dependent policies, updates the function, and recreates essential policies

-- Step 1: Drop ALL RLS policies that depend on current_user_role function
-- Based on the error message, we need to drop policies from multiple tables

-- Transfers table policies
DROP POLICY IF EXISTS tr_admin_insert ON transfers;
DROP POLICY IF EXISTS tr_admin_update ON transfers;
DROP POLICY IF EXISTS tr_admin_delete ON transfers;
DROP POLICY IF EXISTS tr_transfer_insert ON transfers;
DROP POLICY IF EXISTS tr_transfer_update ON transfers;
DROP POLICY IF EXISTS tr_read_all ON transfers;

-- Daily snapshots table policies
DROP POLICY IF EXISTS ds_admin_insert ON daily_snapshots;
DROP POLICY IF EXISTS ds_admin_update ON daily_snapshots;
DROP POLICY IF EXISTS ds_admin_delete ON daily_snapshots;
DROP POLICY IF EXISTS ds_transfer_insert ON daily_snapshots;
DROP POLICY IF EXISTS ds_transfer_update ON daily_snapshots;
DROP POLICY IF EXISTS ds_read_all ON daily_snapshots;

-- Users table policies
DROP POLICY IF EXISTS users_admin_manage ON users;
DROP POLICY IF EXISTS users_admin_read_all ON users;
DROP POLICY IF EXISTS users_admin_insert ON users;
DROP POLICY IF EXISTS users_admin_update ON users;
DROP POLICY IF EXISTS users_admin_delete ON users;
DROP POLICY IF EXISTS users_superadmin_all ON users;
DROP POLICY IF EXISTS users_admin_read ON users;

-- Issuers table policies
DROP POLICY IF EXISTS issuers_admin_access ON issuers;
DROP POLICY IF EXISTS issuers_admin_insert ON issuers;
DROP POLICY IF EXISTS issuers_admin_update ON issuers;
DROP POLICY IF EXISTS issuers_admin_delete ON issuers;
DROP POLICY IF EXISTS issuers_read_all ON issuers;
DROP POLICY IF EXISTS issuers_super_admin_read ON issuers;
DROP POLICY IF EXISTS issuers_super_admin_write ON issuers;

-- Shareholders table policies
DROP POLICY IF EXISTS sh_admin_insert ON shareholders;
DROP POLICY IF EXISTS sh_admin_update ON shareholders;
DROP POLICY IF EXISTS sh_admin_delete ON shareholders;
DROP POLICY IF EXISTS sh_transfer_insert ON shareholders;
DROP POLICY IF EXISTS sh_transfer_update ON shareholders;
DROP POLICY IF EXISTS sh_read_all ON shareholders;
DROP POLICY IF EXISTS shareholders_admin_insert ON shareholders;
DROP POLICY IF EXISTS shareholders_admin_update ON shareholders;
DROP POLICY IF EXISTS shareholders_admin_delete ON shareholders;
DROP POLICY IF EXISTS shareholders_transfer_insert ON shareholders;
DROP POLICY IF EXISTS shareholders_transfer_update ON shareholders;

-- Record keeping transactions table policies
DROP POLICY IF EXISTS rkt_admin_insert ON record_keeping_transactions;
DROP POLICY IF EXISTS rkt_admin_update ON record_keeping_transactions;
DROP POLICY IF EXISTS rkt_admin_delete ON record_keeping_transactions;
DROP POLICY IF EXISTS rkt_transfer_insert ON record_keeping_transactions;
DROP POLICY IF EXISTS rkt_transfer_update ON record_keeping_transactions;
DROP POLICY IF EXISTS rkt_read_all ON record_keeping_transactions;
DROP POLICY IF EXISTS rkt_super_admin_read ON record_keeping_transactions;

-- Control book daily summary table policies
DROP POLICY IF EXISTS cb_admin_insert ON control_book_daily_summary;
DROP POLICY IF EXISTS cb_admin_update ON control_book_daily_summary;
DROP POLICY IF EXISTS cb_admin_delete ON control_book_daily_summary;
DROP POLICY IF EXISTS control_book_super_admin_read ON control_book_daily_summary;

-- Shareholder positions table policies
DROP POLICY IF EXISTS sp_admin_insert ON shareholder_positions;
DROP POLICY IF EXISTS sp_admin_update ON shareholder_positions;
DROP POLICY IF EXISTS sp_admin_delete ON shareholder_positions;

-- Market values table policies
DROP POLICY IF EXISTS market_values_admin_write ON market_values;

-- Roles table policies
DROP POLICY IF EXISTS roles_admin_insert ON roles;
DROP POLICY IF EXISTS roles_admin_update ON roles;
DROP POLICY IF EXISTS roles_admin_delete ON roles;
DROP POLICY IF EXISTS roles_read_all ON roles;
DROP POLICY IF EXISTS roles_superadmin_insert ON roles;
DROP POLICY IF EXISTS roles_superadmin_update ON roles;
DROP POLICY IF EXISTS roles_superadmin_delete ON roles;

-- Invited users table policies
DROP POLICY IF EXISTS invited_admin_full ON invited_users;
DROP POLICY IF EXISTS invited_issuer_admin_write ON invited_users;
DROP POLICY IF EXISTS invited_issuer_admin_read ON invited_users;
DROP POLICY IF EXISTS invited_users_admin_insert ON invited_users;
DROP POLICY IF EXISTS invited_users_admin_update ON invited_users;
DROP POLICY IF EXISTS invited_users_admin_delete ON invited_users;
DROP POLICY IF EXISTS invited_users_read_all ON invited_users;
DROP POLICY IF EXISTS invited_users_superadmin_all ON invited_users;
DROP POLICY IF EXISTS invited_users_admin_all ON invited_users;
DROP POLICY IF EXISTS invited_superadmin_all ON invited_users;
DROP POLICY IF EXISTS invited_admin_manage ON invited_users;

-- Issuer users table policies
DROP POLICY IF EXISTS issuer_users_admin_insert ON issuer_users;
DROP POLICY IF EXISTS issuer_users_admin_update ON issuer_users;
DROP POLICY IF EXISTS issuer_users_admin_delete ON issuer_users;
DROP POLICY IF EXISTS issuer_users_read_all ON issuer_users;
DROP POLICY IF EXISTS issuer_users_user_access ON issuer_users;

-- Additional policies from the screenshot
DROP POLICY IF EXISTS record_keeping_super_admin_read ON record_keeping_book;
DROP POLICY IF EXISTS share_restrictions_super_admin_read ON share_restrictions;
DROP POLICY IF EXISTS tj_read_all ON transfer_journal;
DROP POLICY IF EXISTS tj_admin_write ON transfer_journal;
DROP POLICY IF EXISTS rt_read_all ON restriction_templates;
DROP POLICY IF EXISTS sr_read_all ON shareholder_restrictions;
DROP POLICY IF EXISTS cusip_details_admin_insert ON cusip_details;
DROP POLICY IF EXISTS cusip_details_admin_update ON cusip_details;
DROP POLICY IF EXISTS cusip_details_admin_delete ON cusip_details;

-- Additional policies from the latest error
DROP POLICY IF EXISTS securities_admin_access ON securities;
DROP POLICY IF EXISTS control_book_super_admin_read ON control_book;

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

CREATE POLICY users_admin_manage ON users
  FOR ALL TO authenticated
  USING (public.current_user_role() = 'superadmin')
  WITH CHECK (public.current_user_role() = 'superadmin');

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

-- Shareholders policies
CREATE POLICY sh_read_all ON shareholders
  FOR SELECT TO authenticated
  USING (
    public.current_user_role() = 'superadmin' OR
    EXISTS (
      SELECT 1 FROM issuer_users iu
      WHERE iu.issuer_id = shareholders.issuer_id
      AND iu.user_id = auth.uid()
      AND public.current_user_role() IN ('admin', 'transfer_team', 'shareholder')
    )
  );

CREATE POLICY sh_admin_insert ON shareholders
  FOR INSERT TO authenticated
  WITH CHECK (
    public.current_user_role() = 'superadmin' OR
    EXISTS (
      SELECT 1 FROM issuer_users iu
      WHERE iu.issuer_id = shareholders.issuer_id
      AND iu.user_id = auth.uid()
      AND public.current_user_role() IN ('admin', 'transfer_team')
    )
  );

CREATE POLICY sh_admin_update ON shareholders
  FOR UPDATE TO authenticated
  USING (
    public.current_user_role() = 'superadmin' OR
    EXISTS (
      SELECT 1 FROM issuer_users iu
      WHERE iu.issuer_id = shareholders.issuer_id
      AND iu.user_id = auth.uid()
      AND public.current_user_role() IN ('admin', 'transfer_team')
    )
  );

CREATE POLICY sh_admin_delete ON shareholders
  FOR DELETE TO authenticated
  USING (
    public.current_user_role() = 'superadmin' OR
    EXISTS (
      SELECT 1 FROM issuer_users iu
      WHERE iu.issuer_id = shareholders.issuer_id
      AND iu.user_id = auth.uid()
      AND public.current_user_role() IN ('admin', 'transfer_team')
    )
  );

-- Record keeping transactions policies
CREATE POLICY rkt_read_all ON record_keeping_transactions
  FOR SELECT TO authenticated
  USING (
    public.current_user_role() = 'superadmin' OR
    EXISTS (
      SELECT 1 FROM issuer_users iu
      WHERE iu.issuer_id = record_keeping_transactions.issuer_id
      AND iu.user_id = auth.uid()
      AND public.current_user_role() IN ('admin', 'transfer_team', 'shareholder')
    )
  );

CREATE POLICY rkt_admin_insert ON record_keeping_transactions
  FOR INSERT TO authenticated
  WITH CHECK (
    public.current_user_role() = 'superadmin' OR
    EXISTS (
      SELECT 1 FROM issuer_users iu
      WHERE iu.issuer_id = record_keeping_transactions.issuer_id
      AND iu.user_id = auth.uid()
      AND public.current_user_role() IN ('admin', 'transfer_team')
    )
  );

CREATE POLICY rkt_admin_update ON record_keeping_transactions
  FOR UPDATE TO authenticated
  USING (
    public.current_user_role() = 'superadmin' OR
    EXISTS (
      SELECT 1 FROM issuer_users iu
      WHERE iu.issuer_id = record_keeping_transactions.issuer_id
      AND iu.user_id = auth.uid()
      AND public.current_user_role() IN ('admin', 'transfer_team')
    )
  );

CREATE POLICY rkt_admin_delete ON record_keeping_transactions
  FOR DELETE TO authenticated
  USING (
    public.current_user_role() = 'superadmin' OR
    EXISTS (
      SELECT 1 FROM issuer_users iu
      WHERE iu.issuer_id = record_keeping_transactions.issuer_id
      AND iu.user_id = auth.uid()
      AND public.current_user_role() IN ('admin', 'transfer_team')
    )
  );

-- Enable RLS on key tables if not already enabled
ALTER TABLE users ENABLE ROW LEVEL SECURITY;
ALTER TABLE roles ENABLE ROW LEVEL SECURITY;
ALTER TABLE invited_users ENABLE ROW LEVEL SECURITY;
ALTER TABLE issuer_users ENABLE ROW LEVEL SECURITY;
ALTER TABLE issuers ENABLE ROW LEVEL SECURITY;
ALTER TABLE shareholders ENABLE ROW LEVEL SECURITY;
ALTER TABLE record_keeping_transactions ENABLE ROW LEVEL SECURITY;

-- Verification
SELECT 'RLS policies and function updated successfully' AS status;
