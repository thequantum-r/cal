-- ========== FIX MISSING USER ISSUER RECORDS ==========
-- This script checks and fixes missing issuer_users records

-- Step 1: Check if pakkiadossraji@gmail.com has issuer_users record
SELECT '=== CHECKING USER ISSUER RECORDS ===' as info;
SELECT 
  u.email,
  u.id as user_id,
  u.role,
  CASE WHEN iu.id IS NOT NULL THEN 'HAS ISSUER RECORD' ELSE 'MISSING ISSUER RECORD' END as status,
  iu.issuer_id,
  iu.is_primary
FROM users u
LEFT JOIN issuer_users iu ON u.id = iu.user_id
WHERE u.email = 'pakkiadossraji@gmail.com';

-- Step 2: Check all users and their issuer records
SELECT '=== ALL USERS AND THEIR ISSUER RECORDS ===' as info;
SELECT 
  u.email,
  u.role,
  CASE WHEN iu.id IS NOT NULL THEN 'HAS ISSUER RECORD' ELSE 'MISSING ISSUER RECORD' END as status,
  iu.issuer_id,
  iu.is_primary
FROM users u
LEFT JOIN issuer_users iu ON u.id = iu.user_id
ORDER BY u.email;

-- Step 3: If pakkiadossraji@gmail.com is missing issuer record, create it
-- (This will only run if the user doesn't have an issuer_users record)
INSERT INTO issuer_users (user_id, issuer_id, role_id, is_primary)
SELECT 
  u.id,
  'bc1bfd0e-2647-41dc-b870-d4a2f6755cb3' as issuer_id,
  r.id as role_id,
  true as is_primary
FROM users u
CROSS JOIN roles r
WHERE u.email = 'pakkiadossraji@gmail.com'
  AND r.name = 'transfer_team'
  AND NOT EXISTS (
    SELECT 1 FROM issuer_users iu 
    WHERE iu.user_id = u.id 
    AND iu.issuer_id = 'bc1bfd0e-2647-41dc-b870-d4a2f6755cb3'
  );

-- Step 4: Verify the fix
SELECT '=== VERIFICATION AFTER FIX ===' as info;
SELECT 
  u.email,
  u.role,
  CASE WHEN iu.id IS NOT NULL THEN 'HAS ISSUER RECORD' ELSE 'MISSING ISSUER RECORD' END as status,
  iu.issuer_id,
  iu.is_primary
FROM users u
LEFT JOIN issuer_users iu ON u.id = iu.user_id
WHERE u.email = 'pakkiadossraji@gmail.com';

-- Step 5: Show all users for the issuer
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








