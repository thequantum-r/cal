-- Migration: Add missing class_a_ipo_issuance field to issuers table
-- This field was referenced in the modal but missing from the database schema

ALTER TABLE issuers 
ADD COLUMN IF NOT EXISTS class_a_ipo_issuance TEXT;

-- Update the comment to reflect the purpose of this field
COMMENT ON COLUMN issuers.class_a_ipo_issuance IS 'Number of Class A shares to be issued in IPO';

