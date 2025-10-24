-- Comprehensive fix for transfer journal and role management (CORRECTED)
-- This script fixes RLS policies, updates functions, and ensures proper access

-- Step 1: Check which transfer journal table exists and create policies accordingly
DO $$
BEGIN
  -- Check if transfer_journal table exists
  IF EXISTS (SELECT FROM information_schema.tables WHERE table_name = 'transfer_journal') THEN
    -- Drop existing transfer journal policies
    DROP POLICY IF EXISTS tj_read_all ON transfer_journal;
    DROP POLICY IF EXISTS tj_admin_write ON transfer_journal;
    DROP POLICY IF EXISTS tj_transfer_insert ON transfer_journal;
    DROP POLICY IF EXISTS tj_transfer_update ON transfer_journal;

    -- Create comprehensive transfer journal policies
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

    -- Enable RLS on transfer_journal if not already enabled
    ALTER TABLE transfer_journal ENABLE ROW LEVEL SECURITY;
    
    RAISE NOTICE 'Created policies for transfer_journal table';
  END IF;

  -- Check if transfer_journal_records table exists
  IF EXISTS (SELECT FROM information_schema.tables WHERE table_name = 'transfer_journal_records') THEN
    -- Drop existing transfer journal records policies
    DROP POLICY IF EXISTS tjr_read_all ON transfer_journal_records;
    DROP POLICY IF EXISTS tjr_admin_write ON transfer_journal_records;
    DROP POLICY IF EXISTS tjr_transfer_insert ON transfer_journal_records;
    DROP POLICY IF EXISTS tjr_transfer_update ON transfer_journal_records;

    -- Create comprehensive transfer journal records policies
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

    -- Enable RLS on transfer_journal_records if not already enabled
    ALTER TABLE transfer_journal_records ENABLE ROW LEVEL SECURITY;
    
    RAISE NOTICE 'Created policies for transfer_journal_records table';
  END IF;

  -- If neither table exists, create the transfer_journal table
  IF NOT EXISTS (SELECT FROM information_schema.tables WHERE table_name = 'transfer_journal') 
     AND NOT EXISTS (SELECT FROM information_schema.tables WHERE table_name = 'transfer_journal_records') THEN
    
    -- Create transfer_journal table
    CREATE TABLE IF NOT EXISTS transfer_journal (
      id uuid primary key default uuid_generate_v4(),
      issuer_id uuid references issuers(id) on delete cascade not null,
      cusip text not null,
      transaction_type text not null,
      share_quantity integer not null,
      created_by uuid references auth.users(id) on delete set null,
      shareholder_id uuid references shareholders(id) on delete cascade not null,
      restriction_id uuid references restriction_templates(id) on delete set null,
      credit_debit text not null check (credit_debit in ('Credit', 'Debit')),
      credit_date date,
      debit_date date,
      status text default 'Active' check (status in ('Active', 'Pending', 'Completed', 'Cancelled')),
      notes text,
      created_at timestamptz default now(),
      updated_at timestamptz default now()
    );

    -- Create policies for the new table
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

    ALTER TABLE transfer_journal ENABLE ROW LEVEL SECURITY;
    
    RAISE NOTICE 'Created transfer_journal table and policies';
  END IF;
END $$;

-- Step 2: Create function to get all user roles for an issuer
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

-- Step 3: Create function to get user's primary role for an issuer
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

-- Step 4: Update current_user_role function to handle multiple roles better
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

-- Step 5: Create function to get all user roles across all issuers
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

-- Step 6: Grant execute permissions
GRANT EXECUTE ON FUNCTION public.get_user_roles_for_issuer(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_user_primary_role_for_issuer(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_all_user_roles() TO authenticated;

-- Step 7: Verification
SELECT 'Transfer journal and role management updated successfully' AS status;



