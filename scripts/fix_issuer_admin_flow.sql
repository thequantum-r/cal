-- ========== FIX ISSUER ADMIN FLOW ==========
-- This script fixes the issuer admin assignment and status update issues

-- Step 1: Check current state of issuers and their admins
SELECT '=== CURRENT ISSUERS AND THEIR ADMINS ===' as info;
SELECT 
  i.id as issuer_id,
  i.name,
  i.display_name,
  i.status,
  i.created_at,
  CASE WHEN iu.id IS NOT NULL THEN 'HAS ADMIN' ELSE 'NO ADMIN' END as admin_status,
  u.email as admin_email
FROM issuers i
LEFT JOIN issuer_users iu ON i.id = iu.issuer_id AND iu.role_id = (SELECT id FROM roles WHERE name = 'issuer_admin')
LEFT JOIN users u ON iu.user_id = u.id
ORDER BY i.created_at DESC;

-- Step 2: Check which issuers are missing admin assignments
SELECT '=== ISSUERS MISSING ADMIN ASSIGNMENTS ===' as info;
SELECT 
  i.id,
  i.display_name,
  i.status,
  i.created_at
FROM issuers i
WHERE NOT EXISTS (
  SELECT 1 FROM issuer_users iu 
  WHERE iu.issuer_id = i.id 
  AND iu.role_id = (SELECT id FROM roles WHERE name = 'issuer_admin')
);

-- Step 3: Fix issuer admin assignments for existing issuers
-- For each issuer without an admin, assign the first available admin user
INSERT INTO issuer_users (user_id, issuer_id, role_id, is_primary)
SELECT 
  u.id,
  i.id,
  r.id,
  true
FROM issuers i
CROSS JOIN users u
CROSS JOIN roles r
WHERE r.name = 'issuer_admin'
  AND u.role = 'issuer_admin'
  AND NOT EXISTS (
    SELECT 1 FROM issuer_users iu 
    WHERE iu.issuer_id = i.id 
    AND iu.role_id = (SELECT id FROM roles WHERE name = 'issuer_admin')
  )
  AND NOT EXISTS (
    SELECT 1 FROM issuer_users iu 
    WHERE iu.user_id = u.id 
    AND iu.issuer_id = i.id
  );

-- Step 4: Update all pending issuers to active status
UPDATE issuers 
SET status = 'active'
WHERE status = 'pending';

-- Step 5: Verify the fixes
SELECT '=== VERIFICATION AFTER FIXES ===' as info;
SELECT 
  i.id as issuer_id,
  i.name,
  i.display_name,
  i.status,
  CASE WHEN iu.id IS NOT NULL THEN 'HAS ADMIN' ELSE 'NO ADMIN' END as admin_status,
  u.email as admin_email
FROM issuers i
LEFT JOIN issuer_users iu ON i.id = iu.issuer_id AND iu.role_id = (SELECT id FROM roles WHERE name = 'issuer_admin')
LEFT JOIN users u ON iu.user_id = u.id
ORDER BY i.created_at DESC;

-- Step 6: Show all issuer_users relationships
SELECT '=== ALL ISSUER_USERS RELATIONSHIPS ===' as info;
SELECT 
  u.email,
  r.name as role_name,
  i.display_name as issuer_name,
  iu.is_primary,
  iu.created_at
FROM issuer_users iu
JOIN users u ON iu.user_id = u.id
JOIN roles r ON iu.role_id = r.id
JOIN issuers i ON iu.issuer_id = i.id
ORDER BY i.display_name, r.name;








