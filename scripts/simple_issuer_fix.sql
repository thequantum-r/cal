-- ========== SIMPLE ISSUER FIX ==========
-- This script checks and fixes the issuer assignment issue

-- Step 1: Check current state
SELECT '=== CURRENT STATE ===' as info;
SELECT 
  u.email,
  u.role,
  iu.issuer_id,
  i.display_name as issuer_name
FROM users u
JOIN issuer_users iu ON u.id = iu.user_id
JOIN issuers i ON iu.issuer_id = i.id
WHERE u.email IN ('goartist2001@gmail.com', 'pakkiadossraji@gmail.com')
ORDER BY u.email;

-- Step 2: The fix - Update goartist2001@gmail.com to the correct issuer
-- This will work whether the record exists or not
UPDATE issuer_users 
SET issuer_id = 'bc1bfd0e-2647-41dc-b870-d4a2f6755cb3',
    role_id = (SELECT id FROM roles WHERE name = 'issuer_admin'),
    is_primary = true
WHERE user_id = (SELECT id FROM users WHERE email = 'goartist2001@gmail.com');

-- Step 3: Verify the fix
SELECT '=== AFTER FIX ===' as info;
SELECT 
  u.email,
  u.role,
  iu.issuer_id,
  i.display_name as issuer_name
FROM users u
JOIN issuer_users iu ON u.id = iu.user_id
JOIN issuers i ON iu.issuer_id = i.id
WHERE u.email IN ('goartist2001@gmail.com', 'pakkiadossraji@gmail.com')
ORDER BY u.email;

-- Step 4: Show all users for Digital Asset Acquisition Corp
SELECT '=== DIGITAL ASSET USERS ===' as info;
SELECT 
  u.email,
  u.role,
  iu.is_primary,
  u.created_at
FROM users u
JOIN issuer_users iu ON u.id = iu.user_id
WHERE iu.issuer_id = 'bc1bfd0e-2647-41dc-b870-d4a2f6755cb3'
ORDER BY u.created_at DESC;








