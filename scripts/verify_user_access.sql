-- ========== VERIFY USER ACCESS ==========
-- This script checks the current state and fixes any access issues

-- Step 1: Check current state of the problematic user
SELECT '=== CURRENT USER STATE ===' as info;
SELECT 
  u.email,
  u.id as user_id,
  u.role,
  CASE WHEN iu.id IS NOT NULL THEN 'HAS ISSUER ACCESS' ELSE 'NO ISSUER ACCESS' END as issuer_status,
  CASE WHEN inv.email IS NOT NULL THEN 'HAS INVITATION' ELSE 'NO INVITATION' END as invitation_status,
  iu.issuer_id,
  iu.role_id,
  iu.is_primary
FROM users u
LEFT JOIN issuer_users iu ON u.id = iu.user_id
LEFT JOIN invited_users inv ON u.email = inv.email
WHERE u.email = 'pakkiadossraji@gmail.com';

-- Step 2: Check all users and their access status
SELECT '=== ALL USERS ACCESS STATUS ===' as info;
SELECT 
  u.email,
  u.role,
  CASE WHEN iu.id IS NOT NULL THEN 'HAS ISSUER ACCESS' ELSE 'NO ISSUER ACCESS' END as issuer_status,
  CASE WHEN inv.email IS NOT NULL THEN 'HAS INVITATION' ELSE 'NO INVITATION' END as invitation_status,
  COUNT(iu.id) as issuer_count
FROM users u
LEFT JOIN issuer_users iu ON u.id = iu.user_id
LEFT JOIN invited_users inv ON u.email = inv.email
GROUP BY u.email, u.role, iu.id, inv.email
ORDER BY u.email;

-- Step 3: Show users who should have access but might be blocked
SELECT '=== USERS WHO SHOULD HAVE ACCESS ===' as info;
SELECT 
  u.email,
  u.role,
  'SHOULD HAVE ACCESS' as status,
  'Has issuer_users record' as reason
FROM users u
JOIN issuer_users iu ON u.id = iu.user_id
WHERE u.role != 'admin'

UNION ALL

SELECT 
  u.email,
  u.role,
  'SHOULD HAVE ACCESS' as status,
  'Has pending invitation' as reason
FROM users u
JOIN invited_users inv ON u.email = inv.email
WHERE u.role != 'admin';

-- Step 4: Show users who might be blocked
SELECT '=== USERS WHO MIGHT BE BLOCKED ===' as info;
SELECT 
  u.email,
  u.role,
  'MIGHT BE BLOCKED' as status,
  'No issuer access and no invitation' as reason
FROM users u
LEFT JOIN issuer_users iu ON u.id = iu.user_id
LEFT JOIN invited_users inv ON u.email = inv.email
WHERE u.role != 'admin' 
  AND iu.id IS NULL 
  AND inv.email IS NULL;

-- Step 5: Verify the fix worked
SELECT '=== VERIFICATION ===' as info;
SELECT 'If the user pakkiadossraji@gmail.com shows "HAS ISSUER ACCESS" above, they should now be able to login' as message;








