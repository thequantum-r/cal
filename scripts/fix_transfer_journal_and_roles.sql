-- Comprehensive fix for transfer journal and role management
-- This script fixes RLS policies, updates functions, and ensures proper access

-- Step 1: Drop existing transfer journal policies
DROP POLICY IF EXISTS tj_read_all ON transfer_journal;
DROP POLICY IF EXISTS tj_admin_write ON transfer_journal;
DROP POLICY IF EXISTS tj_transfer_insert ON transfer_journal;
DROP POLICY IF EXISTS tj_transfer_update ON transfer_journal;

-- Step 2: Create comprehensive transfer journal policies
CREATE POLICY tj_read_all ON transfer_journal
  FOR SELECT TO authenticated
  USING (
    public.current_user_role() = 'superadmin' OR
    EXISTS (
      SELECT 1 FROM issuer_users iu 
      WHERE iu.user_id = auth.uid() 
      AND iu.issuer_id = transfer_journal.issuer_id
    )
  );

CREATE POLICY tj_admin_write ON transfer_journal
  FOR ALL TO authenticated
  USING (
    public.current_user_role() = 'superadmin' OR
    EXISTS (
      SELECT 1 FROM issuer_users iu 
      JOIN roles r ON iu.role_id = r.id
      WHERE iu.user_id = auth.uid() 
      AND iu.issuer_id = transfer_journal.issuer_id
      AND r.name IN ('admin', 'transfer_team')
    )
  )
  WITH CHECK (
    public.current_user_role() = 'superadmin' OR
    EXISTS (
      SELECT 1 FROM issuer_users iu 
      JOIN roles r ON iu.role_id = r.id
      WHERE iu.user_id = auth.uid() 
      AND iu.issuer_id = transfer_journal.issuer_id
      AND r.name IN ('admin', 'transfer_team')
    )
  );

-- Step 3: Create function to get all user roles for an issuer
CREATE OR REPLACE FUNCTION public.get_user_roles_for_issuer(issuer_uuid uuid)
RETURNS text[]
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT ARRAY_AGG(r.name ORDER BY 
    CASE r.name
      WHEN 'admin' THEN 1
      WHEN 'transfer_team' THEN 2
      WHEN 'shareholder' THEN 3
      ELSE 4
    END
  )
  FROM issuer_users iu
  JOIN roles r ON iu.role_id = r.id
  WHERE iu.user_id = auth.uid()
  AND iu.issuer_id = issuer_uuid;
$$;

-- Step 4: Create function to get user's primary role for an issuer
CREATE OR REPLACE FUNCTION public.get_user_primary_role_for_issuer(issuer_uuid uuid)
RETURNS text
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT r.name
  FROM issuer_users iu
  JOIN roles r ON iu.role_id = r.id
  WHERE iu.user_id = auth.uid()
  AND iu.issuer_id = issuer_uuid
  ORDER BY 
    CASE r.name
      WHEN 'admin' THEN 1
      WHEN 'transfer_team' THEN 2
      WHEN 'shareholder' THEN 3
      ELSE 4
    END
  LIMIT 1;
$$;

-- Step 5: Update current_user_role function to handle multiple roles better
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

-- Step 6: Create function to get all user roles across all issuers
CREATE OR REPLACE FUNCTION public.get_all_user_roles()
RETURNS TABLE(issuer_id uuid, issuer_name text, roles text[])
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT 
    iu.issuer_id,
    i.name as issuer_name,
    ARRAY_AGG(r.name ORDER BY 
      CASE r.name
        WHEN 'admin' THEN 1
        WHEN 'transfer_team' THEN 2
        WHEN 'shareholder' THEN 3
        ELSE 4
      END
    ) as roles
  FROM issuer_users iu
  JOIN issuers i ON iu.issuer_id = i.id
  JOIN roles r ON iu.role_id = r.id
  WHERE iu.user_id = auth.uid()
  GROUP BY iu.issuer_id, i.name
  ORDER BY i.name;
$$;

-- Step 7: Grant execute permissions
GRANT EXECUTE ON FUNCTION public.get_user_roles_for_issuer(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_user_primary_role_for_issuer(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_all_user_roles() TO authenticated;

-- Step 8: Enable RLS on transfer_journal if not already enabled
ALTER TABLE transfer_journal ENABLE ROW LEVEL SECURITY;

-- Step 9: Create additional policies for other tables that might be missing
-- Transfer journal records table policies
DROP POLICY IF EXISTS tjr_read_all ON transfer_journal_records;
CREATE POLICY tjr_read_all ON transfer_journal_records
  FOR SELECT TO authenticated
  USING (
    public.current_user_role() = 'superadmin' OR
    EXISTS (
      SELECT 1 FROM issuer_users iu 
      WHERE iu.user_id = auth.uid() 
      AND iu.issuer_id = transfer_journal_records.issuer_id
    )
  );

DROP POLICY IF EXISTS tjr_admin_write ON transfer_journal_records;
CREATE POLICY tjr_admin_write ON transfer_journal_records
  FOR ALL TO authenticated
  USING (
    public.current_user_role() = 'superadmin' OR
    EXISTS (
      SELECT 1 FROM issuer_users iu 
      JOIN roles r ON iu.role_id = r.id
      WHERE iu.user_id = auth.uid() 
      AND iu.issuer_id = transfer_journal_records.issuer_id
      AND r.name IN ('admin', 'transfer_team')
    )
  )
  WITH CHECK (
    public.current_user_role() = 'superadmin' OR
    EXISTS (
      SELECT 1 FROM issuer_users iu 
      JOIN roles r ON iu.role_id = r.id
      WHERE iu.user_id = auth.uid() 
      AND iu.issuer_id = transfer_journal_records.issuer_id
      AND r.name IN ('admin', 'transfer_team')
    )
  );

-- Step 10: Verification
SELECT 'Transfer journal and role management updated successfully' AS status;



