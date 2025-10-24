-- ========== DEBUG USER ISSUER DATA ==========
-- This script helps debug the user-issuer relationship issue

-- Step 1: Check the exact data structure
SELECT '=== EXACT DATA STRUCTURE ===' as info;
SELECT 
  u.id as user_id,
  u.email,
  u.role,
  u.created_at as user_created,
  iu.id as issuer_user_id,
  iu.issuer_id,
  iu.is_primary,
  iu.created_at as issuer_user_created,
  i.display_name as issuer_name
FROM users u
LEFT JOIN issuer_users iu ON u.id = iu.user_id
LEFT JOIN issuers i ON iu.issuer_id = i.id
WHERE u.email IN ('pakkiadossraji@gmail.com', 'goartist2001@gmail.com')
ORDER BY u.email;

-- Step 2: Check what the app query should return
SELECT '=== APP QUERY SIMULATION ===' as info;
SELECT 
  u.id,
  u.email,
  u.role,
  u.created_at,
  json_agg(
    json_build_object(
      'issuer_id', iu.issuer_id,
      'is_primary', iu.is_primary
    )
  ) as issuer_users
FROM users u
LEFT JOIN issuer_users iu ON u.id = iu.user_id
WHERE u.email IN ('pakkiadossraji@gmail.com', 'goartist2001@gmail.com')
GROUP BY u.id, u.email, u.role, u.created_at
ORDER BY u.email;

-- Step 3: Check issuer admin's issuer access
SELECT '=== ISSUER ADMIN ACCESS ===' as info;
SELECT 
  u.email,
  u.role,
  iu.issuer_id,
  iu.is_primary,
  i.display_name
FROM users u
JOIN issuer_users iu ON u.id = iu.user_id
JOIN issuers i ON iu.issuer_id = i.id
WHERE u.email = 'goartist2001@gmail.com';

-- Step 4: Check all users for the specific issuer
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








