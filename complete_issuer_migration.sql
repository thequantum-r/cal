-- Complete Issuer Enhancement Migration Script
-- Run this in your Supabase SQL editor to add all missing fields

-- 1. Add missing class_a_ipo_issuance field to issuers table
ALTER TABLE issuers 
ADD COLUMN IF NOT EXISTS class_a_ipo_issuance TEXT;

-- 2. Add additional missing fields that might be needed based on spreadsheet
ALTER TABLE issuers 
ADD COLUMN IF NOT EXISTS ipo_issuances JSONB DEFAULT '{}';

-- 3. Comments for clarity
COMMENT ON COLUMN issuers.class_a_ipo_issuance IS 'Number of Class A shares to be issued in IPO';
COMMENT ON COLUMN issuers.ipo_issuances IS 'JSON object storing IPO issuance amounts per security type {securityType: amount}';

-- 4. Ensure required_documents table has all needed fields (should already exist)
-- If you need to create it:
CREATE TABLE IF NOT EXISTS required_documents (
    id UUID DEFAULT extensions.uuid_generate_v4() PRIMARY KEY,
    issuer_id UUID REFERENCES issuers(id) ON DELETE CASCADE,
    document_name TEXT NOT NULL,
    status TEXT DEFAULT 'PENDING',
    comments TEXT,
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now()
);

-- Enable RLS on required_documents if not already enabled
ALTER TABLE required_documents ENABLE ROW LEVEL SECURITY;

-- 5. Create officers table if needed (officers can also be stored in issuers.officers_directors JSONB)
CREATE TABLE IF NOT EXISTS officers (
    id UUID DEFAULT extensions.uuid_generate_v4() PRIMARY KEY,
    issuer_id UUID REFERENCES issuers(id) ON DELETE CASCADE,
    officer_name TEXT NOT NULL,
    officer_position TEXT NOT NULL,
    ofac_results TEXT DEFAULT 'NULL',
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now()
);

-- Enable RLS on officers
ALTER TABLE officers ENABLE ROW LEVEL SECURITY;

-- 6. Ensure securities table has all needed fields
-- Add any missing fields to securities table
ALTER TABLE securities 
ADD COLUMN IF NOT EXISTS authorized_shares BIGINT,
ADD COLUMN IF NOT EXISTS ipo_issuance_amount TEXT;

-- 7. Add indexes for better performance
CREATE INDEX IF NOT EXISTS idx_required_documents_issuer_id ON required_documents(issuer_id);
CREATE INDEX IF NOT EXISTS idx_officers_issuer_id ON officers(issuer_id);
CREATE INDEX IF NOT EXISTS idx_securities_issuer_id ON securities(issuer_id);

-- 8. Update existing records to ensure data consistency
UPDATE issuers 
SET ipo_issuances = '{}' 
WHERE ipo_issuances IS NULL;

-- Verification queries (run these to check the migration worked):
/*
SELECT column_name, data_type, is_nullable 
FROM information_schema.columns 
WHERE table_name = 'issuers' 
ORDER BY ordinal_position;

SELECT column_name, data_type, is_nullable 
FROM information_schema.columns 
WHERE table_name = 'securities' 
ORDER BY ordinal_position;

SELECT column_name, data_type, is_nullable 
FROM information_schema.columns 
WHERE table_name = 'required_documents' 
ORDER BY ordinal_position;

SELECT column_name, data_type, is_nullable 
FROM information_schema.columns 
WHERE table_name = 'officers' 
ORDER BY ordinal_position;
*/

