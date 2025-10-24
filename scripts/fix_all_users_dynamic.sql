-- ========== COMPREHENSIVE DYNAMIC USER FIX ==========
-- This script fixes all existing users and makes the system completely dynamic
-- WITHOUT deleting invitations (which causes login problems)

-- Step 1: Check current state of all users
SELECT '=== CURRENT STATE ANALYSIS ===' as info;

SELECT 
  u.email,
  u.role,
  CASE WHEN iu.user_id IS NOT NULL THEN 'YES' ELSE 'NO' END as has_issuer_users_record,
  CASE WHEN inv.email IS NOT NULL THEN 'YES' ELSE 'NO' END as has_invitation,
  COUNT(iu.issuer_id) as issuer_count
FROM public.users u
LEFT JOIN public.issuer_users iu ON u.id = iu.user_id
LEFT JOIN public.invited_users inv ON u.email = inv.email
WHERE u.role NOT IN ('admin')
GROUP BY u.id, u.email, u.role, iu.user_id, inv.email
ORDER BY u.created_at;

-- Step 2: Create missing issuer_users records for all non-admin users
INSERT INTO public.issuer_users (user_id, issuer_id, role_id, is_primary, created_at, updated_at)
SELECT 
  u.id as user_id,
  inv.issuer_id,
  u.role_id,
  true as is_primary,
  NOW() as created_at,
  NOW() as updated_at
FROM public.users u
JOIN public.invited_users inv ON u.email = inv.email
WHERE u.role NOT IN ('admin')
  AND NOT EXISTS (
    SELECT 1 FROM public.issuer_users iu2 
    WHERE iu2.user_id = u.id
  );

-- Step 3: Update all issuers to active status
UPDATE public.issuers 
SET status = 'active', updated_at = NOW()
WHERE status = 'pending'
  AND id IN (
    SELECT DISTINCT issuer_id 
    FROM public.issuer_users
  );

-- Step 4: DO NOT DELETE INVITATIONS - Let the auth callback handle this
-- The auth callback will automatically remove invitations after successful issuer_users creation
-- This prevents login problems

-- Step 5: Verify the comprehensive fix
SELECT '=== VERIFICATION ===' as info;

SELECT 'All users with issuer access:' as check_type;
SELECT 
  u.email,
  u.role,
  COUNT(iu.issuer_id) as issuer_count,
  ARRAY_AGG(i.display_name) as issuer_names
FROM public.users u
LEFT JOIN public.issuer_users iu ON u.id = iu.user_id
LEFT JOIN public.issuers i ON iu.issuer_id = i.id
WHERE u.role NOT IN ('admin')
GROUP BY u.id, u.email, u.role
ORDER BY u.created_at;

SELECT 'Issuer status:' as check_type;
SELECT id, name, display_name, status FROM public.issuers ORDER BY created_at;

SELECT 'Remaining invitations (will be cleaned up by auth callback):' as check_type;
SELECT email, name, issuer_id FROM public.invited_users;

-- Step 6: Test specific user
SELECT '=== SPECIFIC USER TEST ===' as info;
SELECT 
  u.email,
  u.role,
  CASE WHEN iu.user_id IS NOT NULL THEN 'YES' ELSE 'NO' END as has_issuer_users_record,
  CASE WHEN inv.email IS NOT NULL THEN 'YES' ELSE 'NO' END as has_invitation,
  i.display_name as issuer_name
FROM public.users u
LEFT JOIN public.issuer_users iu ON u.id = iu.user_id
LEFT JOIN public.invited_users inv ON u.email = inv.email
LEFT JOIN public.issuers i ON iu.issuer_id = i.id
WHERE u.email = 'pakkiadossraji@gmail.com';

-- Step 7: Test workspace toggle data
SELECT '=== WORKSPACE TOGGLE TEST ===' as info;
SELECT 
  u.email,
  iu.issuer_id,
  iu.is_primary,
  i.name,
  i.display_name,
  i.description
FROM public.users u
JOIN public.issuer_users iu ON u.id = iu.user_id
JOIN public.issuers i ON iu.issuer_id = i.id
WHERE u.email = 'pakkiadossraji@gmail.com'
ORDER BY iu.is_primary DESC, iu.created_at;



-- WITHOUT deleting invitations (which causes login problems)

-- Step 1: Check current state of all users
SELECT '=== CURRENT STATE ANALYSIS ===' as info;

SELECT 
  u.email,
  u.role,
  CASE WHEN iu.user_id IS NOT NULL THEN 'YES' ELSE 'NO' END as has_issuer_users_record,
  CASE WHEN inv.email IS NOT NULL THEN 'YES' ELSE 'NO' END as has_invitation,
  COUNT(iu.issuer_id) as issuer_count
FROM public.users u
LEFT JOIN public.issuer_users iu ON u.id = iu.user_id
LEFT JOIN public.invited_users inv ON u.email = inv.email
WHERE u.role NOT IN ('admin')
GROUP BY u.id, u.email, u.role, iu.user_id, inv.email
ORDER BY u.created_at;

-- Step 2: Create missing issuer_users records for all non-admin users
INSERT INTO public.issuer_users (user_id, issuer_id, role_id, is_primary, created_at, updated_at)
SELECT 
  u.id as user_id,
  inv.issuer_id,
  u.role_id,
  true as is_primary,
  NOW() as created_at,
  NOW() as updated_at
FROM public.users u
JOIN public.invited_users inv ON u.email = inv.email
WHERE u.role NOT IN ('admin')
  AND NOT EXISTS (
    SELECT 1 FROM public.issuer_users iu2 
    WHERE iu2.user_id = u.id
  );

-- Step 3: Update all issuers to active status
UPDATE public.issuers 
SET status = 'active', updated_at = NOW()
WHERE status = 'pending'
  AND id IN (
    SELECT DISTINCT issuer_id 
    FROM public.issuer_users
  );

-- Step 4: DO NOT DELETE INVITATIONS - Let the auth callback handle this
-- The auth callback will automatically remove invitations after successful issuer_users creation
-- This prevents login problems

-- Step 5: Verify the comprehensive fix
SELECT '=== VERIFICATION ===' as info;

SELECT 'All users with issuer access:' as check_type;
SELECT 
  u.email,
  u.role,
  COUNT(iu.issuer_id) as issuer_count,
  ARRAY_AGG(i.display_name) as issuer_names
FROM public.users u
LEFT JOIN public.issuer_users iu ON u.id = iu.user_id
LEFT JOIN public.issuers i ON iu.issuer_id = i.id
WHERE u.role NOT IN ('admin')
GROUP BY u.id, u.email, u.role
ORDER BY u.created_at;

SELECT 'Issuer status:' as check_type;
SELECT id, name, display_name, status FROM public.issuers ORDER BY created_at;

SELECT 'Remaining invitations (will be cleaned up by auth callback):' as check_type;
SELECT email, name, issuer_id FROM public.invited_users;

-- Step 6: Test specific user
SELECT '=== SPECIFIC USER TEST ===' as info;
SELECT 
  u.email,
  u.role,
  CASE WHEN iu.user_id IS NOT NULL THEN 'YES' ELSE 'NO' END as has_issuer_users_record,
  CASE WHEN inv.email IS NOT NULL THEN 'YES' ELSE 'NO' END as has_invitation,
  i.display_name as issuer_name
FROM public.users u
LEFT JOIN public.issuer_users iu ON u.id = iu.user_id
LEFT JOIN public.invited_users inv ON u.email = inv.email
LEFT JOIN public.issuers i ON iu.issuer_id = i.id
WHERE u.email = 'pakkiadossraji@gmail.com';

-- Step 7: Test workspace toggle data
SELECT '=== WORKSPACE TOGGLE TEST ===' as info;
SELECT 
  u.email,
  iu.issuer_id,
  iu.is_primary,
  i.name,
  i.display_name,
  i.description
FROM public.users u
JOIN public.issuer_users iu ON u.id = iu.user_id
JOIN public.issuers i ON iu.issuer_id = i.id
WHERE u.email = 'pakkiadossraji@gmail.com'
ORDER BY iu.is_primary DESC, iu.created_at;






















