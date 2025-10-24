-- Fix RLS policy for required_documents to allow super_admin access
-- Run this script to fix the issue where documents don't show for super admins

-- Drop and recreate the SELECT policy to include super_admin access
DROP POLICY IF EXISTS "Users can view documents for their issuer" ON required_documents;

CREATE POLICY "Users can view documents for their issuer"
ON required_documents
FOR SELECT
TO authenticated
USING (
  -- Allow super admins OR users with issuer relationship
  (auth.jwt() ->> 'user_role' = 'super_admin')
  OR EXISTS (
    SELECT 1 FROM issuer_users 
    WHERE issuer_users.user_id = auth.uid() 
    AND issuer_users.issuer_id = required_documents.issuer_id
  )
);

-- Also update UPDATE policy for consistency
DROP POLICY IF EXISTS "Users can update documents for their issuer" ON required_documents;

CREATE POLICY "Users can update documents for their issuer"
ON required_documents
FOR UPDATE
TO authenticated
USING (
  -- Allow super admins OR users with issuer relationship
  (auth.jwt() ->> 'user_role' = 'super_admin')
  OR EXISTS (
    SELECT 1 FROM issuer_users 
    WHERE issuer_users.user_id = auth.uid() 
    AND issuer_users.issuer_id = required_documents.issuer_id
  )
)
WITH CHECK (
  -- Allow super admins OR users with issuer relationship
  (auth.jwt() ->> 'user_role' = 'super_admin')
  OR EXISTS (
    SELECT 1 FROM issuer_users 
    WHERE issuer_users.user_id = auth.uid() 
    AND issuer_users.issuer_id = required_documents.issuer_id
  )
);

-- Also update DELETE policy for consistency
DROP POLICY IF EXISTS "Users can delete documents for their issuer" ON required_documents;

CREATE POLICY "Users can delete documents for their issuer"
ON required_documents
FOR DELETE
TO authenticated
USING (
  -- Allow super admins OR users with issuer relationship
  (auth.jwt() ->> 'user_role' = 'super_admin')
  OR EXISTS (
    SELECT 1 FROM issuer_users 
    WHERE issuer_users.user_id = auth.uid() 
    AND issuer_users.issuer_id = required_documents.issuer_id
  )
);
