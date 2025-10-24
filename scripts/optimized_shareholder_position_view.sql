-- Optimized Shareholder Position View
-- This view contains only the essential data needed for position calculations
-- Related data (shareholder details, restriction details, issuer details) should be fetched separately when needed

CREATE OR REPLACE VIEW shareholder_position AS
SELECT 
    shareholder_id,
    restriction_id,
    cusip,
    share_balance,
    issuer_id
FROM shareholder_restrictions
WHERE EXISTS (
    SELECT 1 FROM restriction_templates rt 
    WHERE rt.id = restriction_id AND rt.is_active = true
);

-- Add index for better performance
CREATE INDEX IF NOT EXISTS idx_shareholder_position_lookup 
ON shareholder_restrictions (shareholder_id, issuer_id, cusip);

-- Optional: Create a comprehensive view if you still need all the JOINed data for other use cases
-- This can be used for reports or other features that need all the data at once
CREATE OR REPLACE VIEW shareholder_position_comprehensive AS
SELECT 
    sr.shareholder_id,
    sr.restriction_id,
    sr.cusip,
    sr.share_balance,
    sr.issuer_id,
    s.first_name,
    s.last_name,
    s.account_number,
    rt.code AS restriction_code,
    rt.legend AS restriction_legend,
    i.display_name AS issuer_name
FROM shareholder_restrictions sr
JOIN shareholders s ON sr.shareholder_id = s.id
JOIN restriction_templates rt ON sr.restriction_id = rt.id
JOIN issuers i ON sr.issuer_id = i.id
WHERE rt.is_active = true;

-- Usage examples:
-- 1. For statement generation (lean approach):
-- SELECT * FROM shareholder_position WHERE shareholder_id = 'xxx' AND issuer_id = 'yyy';

-- 2. For comprehensive reports (when you need all data):
-- SELECT * FROM shareholder_position_comprehensive WHERE shareholder_id = 'xxx' AND issuer_id = 'yyy';

-- 3. For fetching related data separately (most efficient):
-- SELECT * FROM shareholder_position WHERE shareholder_id = 'xxx' AND issuer_id = 'yyy';
-- SELECT * FROM shareholders WHERE id = 'xxx';
-- SELECT * FROM restriction_templates WHERE id IN ('restriction_ids');
-- SELECT * FROM issuers WHERE id = 'yyy';






