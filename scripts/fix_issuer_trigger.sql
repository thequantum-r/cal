-- ========== FIX ISSUER STATUS TRIGGER ==========
-- Ensure the trigger properly updates issuer status when issuer admin logs in

-- Drop and recreate the trigger function to ensure it works correctly
DROP FUNCTION IF EXISTS update_issuer_status_on_login() CASCADE;

CREATE OR REPLACE FUNCTION update_issuer_status_on_login()
RETURNS TRIGGER AS $$
BEGIN
  -- When a user with issuer_admin role logs in, update their issuer status to active
  IF EXISTS (
    SELECT 1 FROM issuer_users iu
    JOIN roles r ON iu.role_id = r.id
    WHERE iu.user_id = NEW.id 
    AND r.name = 'issuer_admin'
  ) THEN
    UPDATE issuers 
    SET status = 'active'
    WHERE id IN (
      SELECT issuer_id FROM issuer_users iu
      JOIN roles r ON iu.role_id = r.id
      WHERE iu.user_id = NEW.id 
      AND r.name = 'issuer_admin'
    );
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger to update issuer status when issuer admin logs in
DROP TRIGGER IF EXISTS trigger_update_issuer_status_on_login ON users;
CREATE TRIGGER trigger_update_issuer_status_on_login
  AFTER INSERT ON users
  FOR EACH ROW
  EXECUTE FUNCTION update_issuer_status_on_login();

-- Also create a trigger for when issuer_users are created
CREATE OR REPLACE FUNCTION update_issuer_status_on_issuer_user_create()
RETURNS TRIGGER AS $$
BEGIN
  -- When an issuer_user record is created for an issuer_admin, update issuer status
  IF EXISTS (
    SELECT 1 FROM roles r
    WHERE r.id = NEW.role_id 
    AND r.name = 'issuer_admin'
  ) THEN
    UPDATE issuers 
    SET status = 'active'
    WHERE id = NEW.issuer_id;
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger for issuer_users table
DROP TRIGGER IF EXISTS trigger_update_issuer_status_on_issuer_user_create ON issuer_users;
CREATE TRIGGER trigger_update_issuer_status_on_issuer_user_create
  AFTER INSERT ON issuer_users
  FOR EACH ROW
  EXECUTE FUNCTION update_issuer_status_on_issuer_user_create();

-- Manually update any issuers that should be active but aren't
UPDATE issuers 
SET status = 'active'
WHERE id IN (
  SELECT DISTINCT iu.issuer_id 
  FROM issuer_users iu
  JOIN users u ON iu.user_id = u.id
  JOIN roles r ON iu.role_id = r.id
  WHERE r.name = 'issuer_admin'
  AND iu.issuer_id IS NOT NULL
  AND issuers.status = 'pending'
);

-- Clean up any orphaned pending invitations
DELETE FROM invited_users 
WHERE email IN (
  SELECT email FROM users
) 
AND role_id IN (
  SELECT id FROM roles WHERE name = 'issuer_admin'
);




-- Drop and recreate the trigger function to ensure it works correctly
DROP FUNCTION IF EXISTS update_issuer_status_on_login() CASCADE;

CREATE OR REPLACE FUNCTION update_issuer_status_on_login()
RETURNS TRIGGER AS $$
BEGIN
  -- When a user with issuer_admin role logs in, update their issuer status to active
  IF EXISTS (
    SELECT 1 FROM issuer_users iu
    JOIN roles r ON iu.role_id = r.id
    WHERE iu.user_id = NEW.id 
    AND r.name = 'issuer_admin'
  ) THEN
    UPDATE issuers 
    SET status = 'active'
    WHERE id IN (
      SELECT issuer_id FROM issuer_users iu
      JOIN roles r ON iu.role_id = r.id
      WHERE iu.user_id = NEW.id 
      AND r.name = 'issuer_admin'
    );
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger to update issuer status when issuer admin logs in
DROP TRIGGER IF EXISTS trigger_update_issuer_status_on_login ON users;
CREATE TRIGGER trigger_update_issuer_status_on_login
  AFTER INSERT ON users
  FOR EACH ROW
  EXECUTE FUNCTION update_issuer_status_on_login();

-- Also create a trigger for when issuer_users are created
CREATE OR REPLACE FUNCTION update_issuer_status_on_issuer_user_create()
RETURNS TRIGGER AS $$
BEGIN
  -- When an issuer_user record is created for an issuer_admin, update issuer status
  IF EXISTS (
    SELECT 1 FROM roles r
    WHERE r.id = NEW.role_id 
    AND r.name = 'issuer_admin'
  ) THEN
    UPDATE issuers 
    SET status = 'active'
    WHERE id = NEW.issuer_id;
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger for issuer_users table
DROP TRIGGER IF EXISTS trigger_update_issuer_status_on_issuer_user_create ON issuer_users;
CREATE TRIGGER trigger_update_issuer_status_on_issuer_user_create
  AFTER INSERT ON issuer_users
  FOR EACH ROW
  EXECUTE FUNCTION update_issuer_status_on_issuer_user_create();

-- Manually update any issuers that should be active but aren't
UPDATE issuers 
SET status = 'active'
WHERE id IN (
  SELECT DISTINCT iu.issuer_id 
  FROM issuer_users iu
  JOIN users u ON iu.user_id = u.id
  JOIN roles r ON iu.role_id = r.id
  WHERE r.name = 'issuer_admin'
  AND iu.issuer_id IS NOT NULL
  AND issuers.status = 'pending'
);

-- Clean up any orphaned pending invitations
DELETE FROM invited_users 
WHERE email IN (
  SELECT email FROM users
) 
AND role_id IN (
  SELECT id FROM roles WHERE name = 'issuer_admin'
);






















