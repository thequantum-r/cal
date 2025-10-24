-- Comprehensive fix for CUSIP data access and RLS policies
-- This script ensures all data is properly accessible based on user roles and issuer access

-- Step 1: Fix CUSIP data access by creating proper RLS policies for all CUSIP-related tables

-- Fix securities table policies
DROP POLICY IF EXISTS securities_super_admin_read ON securities;
DROP POLICY IF EXISTS securities_issuer_read ON securities;
DROP POLICY IF EXISTS securities_super_admin_write ON securities;
DROP POLICY IF EXISTS securities_issuer_admin_write ON securities;

CREATE POLICY securities_read_all ON securities
  FOR SELECT TO authenticated
  USING (
    public.current_user_role() = 'superadmin' OR
    EXISTS (
      SELECT 1 FROM issuer_users iu 
      WHERE iu.user_id = auth.uid() 
      AND iu.issuer_id = securities.issuer_id
    )
  );

CREATE POLICY securities_admin_write ON securities
  FOR ALL TO authenticated
  USING (
    public.current_user_role() = 'superadmin' OR
    EXISTS (
      SELECT 1 FROM issuer_users iu 
      JOIN roles r ON iu.role_id = r.id
      WHERE iu.user_id = auth.uid() 
      AND iu.issuer_id = securities.issuer_id
      AND r.name IN ('admin', 'transfer_team')
    )
  )
  WITH CHECK (
    public.current_user_role() = 'superadmin' OR
    EXISTS (
      SELECT 1 FROM issuer_users iu 
      JOIN roles r ON iu.role_id = r.id
      WHERE iu.user_id = auth.uid() 
      AND iu.issuer_id = securities.issuer_id
      AND r.name IN ('admin', 'transfer_team')
    )
  );

-- Fix cusip_details table policies
DROP POLICY IF EXISTS cusip_details_read_all ON cusip_details;
DROP POLICY IF EXISTS cusip_details_admin_write ON cusip_details;

CREATE POLICY cusip_details_read_all ON cusip_details
  FOR SELECT TO authenticated
  USING (
    public.current_user_role() = 'superadmin' OR
    EXISTS (
      SELECT 1 FROM issuer_users iu 
      WHERE iu.user_id = auth.uid() 
      AND iu.issuer_id = cusip_details.issuer_id
    )
  );

CREATE POLICY cusip_details_admin_write ON cusip_details
  FOR ALL TO authenticated
  USING (
    public.current_user_role() = 'superadmin' OR
    EXISTS (
      SELECT 1 FROM issuer_users iu 
      JOIN roles r ON iu.role_id = r.id
      WHERE iu.user_id = auth.uid() 
      AND iu.issuer_id = cusip_details.issuer_id
      AND r.name IN ('admin', 'transfer_team')
    )
  )
  WITH CHECK (
    public.current_user_role() = 'superadmin' OR
    EXISTS (
      SELECT 1 FROM issuer_users iu 
      JOIN roles r ON iu.role_id = r.id
      WHERE iu.user_id = auth.uid() 
      AND iu.issuer_id = cusip_details.issuer_id
      AND r.name IN ('admin', 'transfer_team')
    )
  );

-- Step 2: Fix shareholders table policies
DROP POLICY IF EXISTS shareholders_read_all ON shareholders;
DROP POLICY IF EXISTS shareholders_admin_write ON shareholders;
DROP POLICY IF EXISTS shareholders_transfer_write ON shareholders;

CREATE POLICY shareholders_read_all ON shareholders
  FOR SELECT TO authenticated
  USING (
    public.current_user_role() = 'superadmin' OR
    EXISTS (
      SELECT 1 FROM issuer_users iu 
      WHERE iu.user_id = auth.uid() 
      AND iu.issuer_id = shareholders.issuer_id
    )
  );

CREATE POLICY shareholders_admin_write ON shareholders
  FOR ALL TO authenticated
  USING (
    public.current_user_role() = 'superadmin' OR
    EXISTS (
      SELECT 1 FROM issuer_users iu 
      JOIN roles r ON iu.role_id = r.id
      WHERE iu.user_id = auth.uid() 
      AND iu.issuer_id = shareholders.issuer_id
      AND r.name IN ('admin', 'transfer_team')
    )
  )
  WITH CHECK (
    public.current_user_role() = 'superadmin' OR
    EXISTS (
      SELECT 1 FROM issuer_users iu 
      JOIN roles r ON iu.role_id = r.id
      WHERE iu.user_id = auth.uid() 
      AND iu.issuer_id = shareholders.issuer_id
      AND r.name IN ('admin', 'transfer_team')
    )
  );

-- Step 3: Fix restriction_templates table policies
DROP POLICY IF EXISTS rt_read_all ON restriction_templates;
DROP POLICY IF EXISTS rt_admin_write ON restriction_templates;

CREATE POLICY rt_read_all ON restriction_templates
  FOR SELECT TO authenticated
  USING (
    public.current_user_role() = 'superadmin' OR
    EXISTS (
      SELECT 1 FROM issuer_users iu 
      WHERE iu.user_id = auth.uid() 
      AND iu.issuer_id = restriction_templates.issuer_id
    )
  );

CREATE POLICY rt_admin_write ON restriction_templates
  FOR ALL TO authenticated
  USING (
    public.current_user_role() = 'superadmin' OR
    EXISTS (
      SELECT 1 FROM issuer_users iu 
      JOIN roles r ON iu.role_id = r.id
      WHERE iu.user_id = auth.uid() 
      AND iu.issuer_id = restriction_templates.issuer_id
      AND r.name IN ('admin', 'transfer_team')
    )
  )
  WITH CHECK (
    public.current_user_role() = 'superadmin' OR
    EXISTS (
      SELECT 1 FROM issuer_users iu 
      JOIN roles r ON iu.role_id = r.id
      WHERE iu.user_id = auth.uid() 
      AND iu.issuer_id = restriction_templates.issuer_id
      AND r.name IN ('admin', 'transfer_team')
    )
  );

-- Step 4: Enable RLS on all tables
ALTER TABLE securities ENABLE ROW LEVEL SECURITY;
ALTER TABLE cusip_details ENABLE ROW LEVEL SECURITY;
ALTER TABLE shareholders ENABLE ROW LEVEL SECURITY;
ALTER TABLE restriction_templates ENABLE ROW LEVEL SECURITY;

-- Step 5: Create a function to get CUSIP data from both tables
CREATE OR REPLACE FUNCTION public.get_issuer_cusips(issuer_uuid uuid)
RETURNS TABLE(
  cusip text,
  issue_name text,
  issue_ticker text,
  security_type text,
  status text,
  source_table text
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  -- Get CUSIPs from securities table
  SELECT 
    s.cusip,
    s.issue_name,
    s.issue_ticker,
    s.security_type,
    s.status,
    'securities' as source_table
  FROM securities s
  WHERE s.issuer_id = issuer_uuid
  AND s.status = 'active'
  
  UNION ALL
  
  -- Get CUSIPs from cusip_details table
  SELECT 
    cd.cusip,
    cd.issue_name,
    cd.issue_ticker,
    cd.security_type,
    cd.status,
    'cusip_details' as source_table
  FROM cusip_details cd
  WHERE cd.issuer_id = issuer_uuid
  AND cd.status = 'active'
  
  ORDER BY cusip;
$$;

-- Step 6: Grant execute permissions
GRANT EXECUTE ON FUNCTION public.get_issuer_cusips(uuid) TO authenticated;

-- Step 7: Verification
SELECT 'CUSIP and data access policies updated successfully' AS status;



