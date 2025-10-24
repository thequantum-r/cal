-- Complete Issuer Enhancement Migration Script with RLS Policies
-- Run this in your Supabase SQL editor to add all missing fields and RLS policies

-- 1. Add missing class_a_ipo_issuance field to issuers table
ALTER TABLE issuers 
ADD COLUMN IF NOT EXISTS class_a_ipo_issuance TEXT;

-- 2. Add additional missing fields that might be needed based on spreadsheet
ALTER TABLE issuers 
ADD COLUMN IF NOT EXISTS ipo_issuances JSONB DEFAULT '{}';

-- 3. Comments for clarity
COMMENT ON COLUMN issuers.class_a_ipo_issuance IS 'Number of Class A shares to be issued in IPO';
COMMENT ON COLUMN issuers.ipo_issuances IS 'JSON object storing IPO issuance amounts per security type {securityType: amount}';

-- 4. Ensure required_documents table has all needed fields (should already exist)
-- If you need to create it:
CREATE TABLE IF NOT EXISTS required_documents (
    id UUID DEFAULT extensions.uuid_generate_v4() PRIMARY KEY,
    issuer_id UUID REFERENCES issuers(id) ON DELETE CASCADE,
    document_name TEXT NOT NULL,
    status TEXT DEFAULT 'PENDING',
    comments TEXT,
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now()
);

-- Enable RLS on required_documents if not already enabled
ALTER TABLE required_documents ENABLE ROW LEVEL SECURITY;

-- 5. Create RLS policies for required_documents table
-- Drop existing policies if they exist
DROP POLICY IF EXISTS "Users can view documents for their issuer" ON required_documents;
DROP POLICY IF EXISTS "Users can insert documents for their issuer" ON required_documents;
DROP POLICY IF EXISTS "Users can update documents for their issuer" ON required_documents;
DROP POLICY IF EXISTS "Users can delete documents for their issuer" ON required_documents;

-- Allow super_admin to do everything
CREATE POLICY "Super admins can manage all required_documents"
ON required_documents
FOR ALL
TO authenticated
USING (auth.jwt() ->> 'user_role' = 'super_admin')
WITH CHECK (auth.jwt() ->> 'user_role' = 'super_admin');

-- Allow users to view documents for their issuer
CREATE POLICY "Users can view documents for their issuer"
ON required_documents
FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM issuer_users 
    WHERE issuer_users.user_id = auth.uid() 
    AND issuer_users.issuer_id = required_documents.issuer_id
  )
);

-- Allow users to insert documents for their issuer
CREATE POLICY "Users can insert documents for their issuer"
ON required_documents
FOR INSERT
TO authenticated
WITH CHECK (
  EXISTS (
    SELECT 1 FROM issuer_users 
    WHERE issuer_users.user_id = auth.uid() 
    AND issuer_users.issuer_id = required_documents.issuer_id
  )
);

-- Allow users to update documents for their issuer
CREATE POLICY "Users can update documents for their issuer"
ON required_documents
FOR UPDATE
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM issuer_users 
    WHERE issuer_users.user_id = auth.uid() 
    AND issuer_users.issuer_id = required_documents.issuer_id
  )
)
WITH CHECK (
  EXISTS (
    SELECT 1 FROM issuer_users 
    WHERE issuer_users.user_id = auth.uid() 
    AND issuer_users.issuer_id = required_documents.issuer_id
  )
);

-- Allow users to delete documents for their issuer
CREATE POLICY "Users can delete documents for their issuer"
ON required_documents
FOR DELETE
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM issuer_users 
    WHERE issuer_users.user_id = auth.uid() 
    AND issuer_users.issuer_id = required_documents.issuer_id
  )
);

-- 6. Create officers table if needed (officers can also be stored in issuers.officers_directors JSONB)
CREATE TABLE IF NOT EXISTS officers (
    id UUID DEFAULT extensions.uuid_generate_v4() PRIMARY KEY,
    issuer_id UUID REFERENCES issuers(id) ON DELETE CASCADE,
    officer_name TEXT NOT NULL,
    officer_position TEXT NOT NULL,
    ofac_results TEXT DEFAULT 'NULL',
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now()
);

-- Enable RLS on officers
ALTER TABLE officers ENABLE ROW LEVEL SECURITY;

-- 7. Create RLS policies for officers table (similar to required_documents)
DROP POLICY IF EXISTS "Users can view officers for their issuer" ON officers;
DROP POLICY IF EXISTS "Users can insert officers for their issuer" ON officers;
DROP POLICY IF EXISTS "Users can update officers for their issuer" ON officers;
DROP POLICY IF EXISTS "Users can delete officers for their issuer" ON officers;

-- Super admin policy for officers
CREATE POLICY "Super admins can manage all officers"
ON officers
FOR ALL
TO authenticated
USING (auth.jwt() ->> 'user_role' = 'super_admin')
WITH CHECK (auth.jwt() ->> 'user_role' = 'super_admin');

-- Regular user policies for officers
CREATE POLICY "Users can view officers for their issuer"
ON officers
FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM issuer_users 
    WHERE issuer_users.user_id = auth.uid() 
    AND issuer_users.issuer_id = officers.issuer_id
  )
);

CREATE POLICY "Users can insert officers for their issuer"
ON officers
FOR INSERT
TO authenticated
WITH CHECK (
  EXISTS (
    SELECT 1 FROM issuer_users 
    WHERE issuer_users.user_id = auth.uid() 
    AND issuer_users.issuer_id = officers.issuer_id
  )
);

CREATE POLICY "Users can update officers for their issuer"
ON officers
FOR UPDATE
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM issuer_users 
    WHERE issuer_users.user_id = auth.uid() 
    AND issuer_users.issuer_id = officers.issuer_id
  )
)
WITH CHECK (
  EXISTS (
    SELECT 1 FROM issuer_users 
    WHERE issuer_users.user_id = auth.uid() 
    AND issuer_users.issuer_id = officers.issuer_id
  )
);

CREATE POLICY "Users can delete officers for their issuer"
ON officers
FOR DELETE
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM issuer_users 
    WHERE issuer_users.user_id = auth.uid() 
    AND issuer_users.issuer_id = officers.issuer_id
  )
);

-- 8. Ensure securities table has all needed fields
-- Add any missing fields to securities table
ALTER TABLE securities 
ADD COLUMN IF NOT EXISTS authorized_shares BIGINT,
ADD COLUMN IF NOT EXISTS ipo_issuance_amount TEXT;

-- 9. Add indexes for better performance
CREATE INDEX IF NOT EXISTS idx_required_documents_issuer_id ON required_documents(issuer_id);
CREATE INDEX IF NOT EXISTS idx_officers_issuer_id ON officers(issuer_id);
CREATE INDEX IF NOT EXISTS idx_securities_issuer_id ON securities(issuer_id);

-- 10. Update existing records to ensure data consistency
UPDATE issuers 
SET ipo_issuances = '{}' 
WHERE ipo_issuances IS NULL;

-- 11. Temporary policy to allow super_admin to create documents during issuer creation
-- This allows the enhanced modal to work properly for super admins
CREATE POLICY "Allow document creation during issuer setup"
ON required_documents
FOR INSERT
TO authenticated
WITH CHECK (
  -- Allow super admins or if no issuer_users relationship exists yet (during creation)
  auth.jwt() ->> 'user_role' = 'super_admin'
  OR NOT EXISTS (SELECT 1 FROM issuer_users WHERE issuer_id = required_documents.issuer_id)
);

-- You can remove the above policy after testing, but the proper policies should work once issuer_users relationships are established

-- Verification queries (run these to check the migration worked):
/*
SELECT column_name, data_type, is_nullable 
FROM information_schema.columns 
WHERE table_name = 'issuers' 
ORDER BY ordinal_position;

SELECT column_name, data_type, is_nullable 
FROM information_schema.columns 
WHERE table_name = 'securities' 
ORDER BY ordinal_position;

SELECT column_name, data_type, is_nullable 
FROM information_schema.columns 
WHERE table_name = 'required_documents' 
ORDER BY ordinal_position;

SELECT column_name, data_type, is_nullable 
FROM information_schema.columns 
WHERE table_name = 'officers' 
ORDER BY ordinal_position;

-- Check RLS policies
SELECT schemaname, tablename, policyname, permissive, roles, cmd, qual 
FROM pg_policies 
WHERE tablename IN ('required_documents', 'officers');
*/
