# Statement Generation Feature

## Overview

The Statement Generation feature allows users to generate formal shareholder statements as of specific dates, based on the spreadsheet reference format. This feature provides comprehensive reporting capabilities with the ability to download statements as PDF files.

## Features

### Core Functionality
- **Date-based Reporting**: Generate statements as of any specific date
- **Multi-CUSIP Support**: Include all holdings across different CUSIPs for a shareholder
- **Market Value Integration**: Automatic calculation of market values based on price per share
- **Restrictions Display**: Show full text of any restrictions on shares
- **Transaction History**: Include recent transactions for the statement period
- **PDF Export**: Download statements as professionally formatted PDF files

### Database Schema

The feature uses several new tables:

1. **`market_values`** - Stores price per share data per CUSIP per date
2. **`shareholder_statements`** - Main statement records
3. **`statement_details`** - Detailed holdings information for each statement
4. **`statement_transactions`** - Recent transactions included in statements

### Key Database Functions

- `generate_shareholder_statement()` - Main function to create complete statements
- `get_market_value_as_of_date()` - Get market value for a specific date
- `get_shareholder_position_as_of_date()` - Get shareholder position as of date
- `get_shareholder_restrictions_text()` - Get full restrictions text
- `generate_statement_number()` - Auto-generate unique statement numbers

## UI Flow

### 1. Statement Generation Page
**Location**: `/issuer/[issuerId]/statements`

**Main Components**:
- **Statement Generation Form**: Select shareholder and statement date
- **Market Values Management**: View and manage price per share data
- **Statement Preview**: Preview statement before generation
- **Generated Statements**: List of previously generated statements

### 2. User Interface Flow

```
1. User navigates to Statement Generation page
   ↓
2. Selects a shareholder from dropdown
   ↓
3. Chooses statement date (as of date)
   ↓
4. Optionally previews statement data
   ↓
5. Generates statement (creates database record)
   ↓
6. Downloads PDF statement
```

### 3. Market Value Management

**For Admins Only**:
- Click "Manage" button in Market Values section
- Add/update price per share for specific CUSIPs and dates
- View historical price data
- Set source (manual, API, calculated)

## Statement Content

### Header Information
- Company name and statement title
- Statement date
- Auto-generated statement number

### Shareholder Information
- Full name
- Account number
- Tax ID (TIN)
- Email address

### Security Holdings Table
- **Security Type**: Company name, security class, CUSIP
- **Shares Outstanding**: Number of shares owned as of statement date
- **Market Value**: Calculated value (shares × price per share)
- **Restrictions**: Indicator if shares are restricted

### Recent Transactions Table
- Transaction type and date
- Number of shares
- Price per share
- Total value

### Restrictions Section
- Full text of any restrictions applicable to the shares
- "No restrictions apply" if none exist

## Market Value Handling

### Input vs. Automatic
**Market values are manual input** - Admins must set price per share data for each CUSIP and date. The system does not automatically fetch market prices.

### Market Value Sources
1. **Manual Entry**: Direct input by administrators
2. **API Feed**: Future integration with market data providers
3. **Calculated**: System-calculated values (future feature)

### Date-based Lookup
The system uses the most recent market value on or before the statement date for calculations.

## PDF Generation

### Format
- Professional A4 layout
- Company branding and header
- Structured tables for holdings and transactions
- Footer with contact information

### Content
- All statement data formatted for print
- Tables with proper column alignment
- Page breaks for long statements
- Contact information at bottom

## Setup Instructions

### 1. Apply Database Schema
```bash
node scripts/apply_statement_schema.mjs
```

### 2. Install Dependencies
```bash
npm install pdfkit
```

### 3. Configure Market Values
1. Navigate to Statement Generation page
2. Click "Manage" in Market Values section (admin only)
3. Add price per share data for each CUSIP
4. Set appropriate dates for historical values

### 4. Generate First Statement
1. Select a shareholder
2. Choose statement date
3. Preview statement data
4. Generate and download PDF

## Usage Examples

### Basic Statement Generation
1. Go to `/issuer/[issuerId]/statements`
2. Select shareholder "John Smith"
3. Set statement date to "2024-01-31"
4. Click "Generate Statement"
5. Download PDF

### Market Value Management
1. Click "Manage" in Market Values section
2. Select CUSIP "123456789"
3. Set date to "2024-01-31"
4. Enter price "$10.50"
5. Save market value

### Statement Preview
1. Select shareholder and date
2. Click "Preview Statement"
3. Review holdings and calculations
4. Proceed with generation if correct

## Technical Details

### Database Relationships
- `shareholder_statements` → `shareholders` (many-to-one)
- `shareholder_statements` → `issuers` (many-to-one)
- `statement_details` → `shareholder_statements` (many-to-one)
- `statement_transactions` → `shareholder_statements` (many-to-one)

### Security
- Row Level Security (RLS) enabled on all tables
- Admin-only access for market value management
- Read access for all authenticated users

### Performance
- Indexed on key fields for fast queries
- Efficient date-based lookups
- Optimized for large datasets

## Future Enhancements

### Planned Features
1. **Automatic Market Data**: Integration with market data APIs
2. **Bulk Generation**: Generate statements for multiple shareholders
3. **Email Delivery**: Send statements directly to shareholders
4. **Custom Templates**: Configurable statement layouts
5. **Audit Trail**: Track statement generation history

### API Integration
- Real-time market price feeds
- Automated valuation updates
- External data validation

## Troubleshooting

### Common Issues

**"No market value found"**
- Ensure market values are set for the statement date
- Check that CUSIP exists in market_values table

**"Statement generation failed"**
- Verify shareholder has positions on the statement date
- Check database permissions and RLS policies

**"PDF download error"**
- Ensure pdfkit dependency is installed
- Check server logs for detailed error messages

### Data Validation
- Statement dates cannot be in the future
- Market values must be positive numbers
- Shareholder must have active status
- CUSIP must exist in cusip_details table

## Support

For technical support or questions about the Statement Generation feature, contact the development team or refer to the system documentation.



