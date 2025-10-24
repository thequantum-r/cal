-- Add security_holdings column to shareholders table
ALTER TABLE shareholders 
ADD COLUMN IF NOT EXISTS security_holdings TEXT;

-- Add comment to describe the column
COMMENT ON COLUMN shareholders.security_holdings IS 'JSON string containing all security holdings for this shareholder';


