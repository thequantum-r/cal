-- ========== FIX ISSUER ASSIGNMENT ==========
-- This script fixes the issuer assignment so the issuer admin manages the correct issuer

-- Step 1: Check current issuer assignments
SELECT '=== CURRENT ISSUER ASSIGNMENTS ===' as info;
SELECT 
  u.email,
  u.role,
  iu.issuer_id,
  iu.is_primary,
  i.display_name as issuer_name
FROM users u
JOIN issuer_users iu ON u.id = iu.user_id
JOIN issuers i ON iu.issuer_id = i.id
WHERE u.email IN ('goartist2001@gmail.com', 'pakkiadossraji@gmail.com')
ORDER BY u.email;

-- Step 2: Check which issuer has pakkiadossraji@gmail.com
SELECT '=== PAKKIADOSSRAJI ISSUER ===' as info;
SELECT 
  u.email,
  iu.issuer_id,
  i.display_name as issuer_name
FROM users u
JOIN issuer_users iu ON u.id = iu.user_id
JOIN issuers i ON iu.issuer_id = i.id
WHERE u.email = 'pakkiadossraji@gmail.com';

-- Step 3: Update goartist2001@gmail.com to manage the correct issuer
-- First, remove the current assignment to Cal Redwood
DELETE FROM issuer_users 
WHERE user_id = (SELECT id FROM users WHERE email = 'goartist2001@gmail.com')
  AND issuer_id = '34212a5a-e7bb-4d9e-a376-b59885ad5f09';

-- Step 4: Update goartist2001@gmail.com to Digital Asset Acquisition Corp (if exists) or insert
UPDATE issuer_users 
SET issuer_id = 'bc1bfd0e-2647-41dc-b870-d4a2f6755cb3',
    role_id = (SELECT id FROM roles WHERE name = 'issuer_admin'),
    is_primary = true
WHERE user_id = (SELECT id FROM users WHERE email = 'goartist2001@gmail.com')
  AND issuer_id = 'bc1bfd0e-2647-41dc-b870-d4a2f6755cb3';

-- If no record exists for Digital Asset, insert one
INSERT INTO issuer_users (user_id, issuer_id, role_id, is_primary)
SELECT 
  u.id,
  'bc1bfd0e-2647-41dc-b870-d4a2f6755cb3' as issuer_id,
  r.id as role_id,
  true as is_primary
FROM users u
CROSS JOIN roles r
WHERE u.email = 'goartist2001@gmail.com'
  AND r.name = 'issuer_admin'
  AND NOT EXISTS (
    SELECT 1 FROM issuer_users iu 
    WHERE iu.user_id = u.id 
    AND iu.issuer_id = 'bc1bfd0e-2647-41dc-b870-d4a2f6755cb3'
  );

-- Step 5: Verify the fix
SELECT '=== VERIFICATION AFTER FIX ===' as info;
SELECT 
  u.email,
  u.role,
  iu.issuer_id,
  iu.is_primary,
  i.display_name as issuer_name
FROM users u
JOIN issuer_users iu ON u.id = iu.user_id
JOIN issuers i ON iu.issuer_id = i.id
WHERE u.email IN ('goartist2001@gmail.com', 'pakkiadossraji@gmail.com')
ORDER BY u.email;

-- Step 6: Show all users for Digital Asset Acquisition Corp
SELECT '=== ALL USERS FOR DIGITAL ASSET ACQUISITION CORP ===' as info;
SELECT 
  u.email,
  u.role,
  iu.is_primary,
  u.created_at
FROM users u
JOIN issuer_users iu ON u.id = iu.user_id
WHERE iu.issuer_id = 'bc1bfd0e-2647-41dc-b870-d4a2f6755cb3'
ORDER BY u.created_at DESC;
