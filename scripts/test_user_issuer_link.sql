-- ========== TEST USER ISSUER LINK ==========
-- This script verifies that users are properly linked to issuers

-- Step 1: Check the specific user's issuer relationship
SELECT '=== USER ISSUER RELATIONSHIP ===' as info;
SELECT 
  u.email,
  u.role,
  iu.issuer_id,
  iu.is_primary,
  i.display_name as issuer_name,
  i.status as issuer_status
FROM users u
JOIN issuer_users iu ON u.id = iu.user_id
JOIN issuers i ON iu.issuer_id = i.id
WHERE u.email = 'pakkiadossraji@gmail.com';

-- Step 2: Check all users for the specific issuer
SELECT '=== ALL USERS FOR ISSUER ===' as info;
SELECT 
  u.email,
  u.role,
  iu.is_primary,
  u.created_at
FROM users u
JOIN issuer_users iu ON u.id = iu.user_id
WHERE iu.issuer_id = 'bc1bfd0e-2647-41dc-b870-d4a2f6755cb3'
ORDER BY u.created_at DESC;

-- Step 3: Check issuer details
SELECT '=== ISSUER DETAILS ===' as info;
SELECT 
  id,
  name,
  display_name,
  status,
  created_at
FROM issuers
WHERE id = 'bc1bfd0e-2647-41dc-b870-d4a2f6755cb3';

-- Step 4: Test the query that should be used in the app
SELECT '=== APP QUERY TEST ===' as info;
SELECT 
  u.id,
  u.email,
  u.role,
  u.created_at,
  iu.issuer_id,
  iu.is_primary
FROM users u
JOIN issuer_users iu ON u.id = iu.user_id
WHERE iu.issuer_id = 'bc1bfd0e-2647-41dc-b870-d4a2f6755cb3'
ORDER BY u.created_at DESC;








