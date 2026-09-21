# Multi-Tenant Account System

## Overview

Fleet OS now supports multiple dealerships (accounts) with individual user logins.

## Database Structure

### `accounts` table
- Represents a dealership
- Contains dealer name and settings
- One account can have multiple users

### `users` table
- Individual people who can log in
- Each user belongs to one account
- Roles: `admin`, `user`, `viewer`

### Data Isolation
All data tables (`cars`, `transactions`, `balance_sheet`, `settings`) now have an `account_id` column to ensure data is isolated per dealership.

## Setup Instructions

### 1. Run the Schema Migration

In Supabase SQL Editor, run:
```sql
-- See files/accounts_migration.sql
```

This creates the `accounts` and `users` tables and adds `account_id` to all existing tables.

### 2. Create THG Automotive Account (ONE-TIME)

In Supabase SQL Editor, run:
```sql
-- See files/ONE_TIME_SETUP.sql
```

This will:
- Create the THG Automotive account
- Create Max Turner as admin user
- Link all existing data to this account

### 3. Login Credentials

**Email:** max@thgautomotive.com  
**Password:** KreFSSn8!@SSxdV%

⚠️ **IMPORTANT:** Save this password securely! Change it after first login.

## User Roles

- **admin** - Full access, can manage users, all CRUD operations
- **user** - Can view and edit data, cannot manage users
- **viewer** - Read-only access

## Adding New Users (Future)

To add more users to THG Automotive:

```sql
INSERT INTO users (account_id, email, password_hash, full_name, role)
VALUES (
  1, -- THG Automotive account_id
  'user@thgautomotive.com',
  '<password_hash>',
  'User Name',
  'user' -- or 'admin' or 'viewer'
);
```

## Adding New Dealerships (Future)

To add a new dealership:

```sql
-- Create account
INSERT INTO accounts (dealer_name, settings)
VALUES ('New Dealership Name', '{"vat_registered": false}'::jsonb)
RETURNING id;

-- Create first user (use returned account_id)
INSERT INTO users (account_id, email, password_hash, full_name, role)
VALUES (
  <account_id>,
  'admin@newdealership.com',
  '<password_hash>',
  'Admin Name',
  'admin'
);
```

## Password Hashing

Passwords are hashed using SHA-256. To generate a password hash:

```bash
node scripts/setup-account.js
```

Or manually:
```javascript
const crypto = require('crypto')
const hash = crypto.createHash('sha256').update('your_password').digest('hex')
console.log(hash)
```

## Frontend Integration (Next Steps)

The frontend will need to be updated to:
1. Replace hardcoded login with database authentication
2. Store `account_id` and `user_id` in session
3. Filter all queries by `account_id`
4. Add user management UI for admins

## Security Notes

- All queries must filter by `account_id` to prevent data leakage
- Row Level Security (RLS) is currently disabled - consider enabling for production
- Password hashing uses SHA-256 (consider upgrading to bcrypt for production)
- Implement password reset functionality
- Add email verification for new users
- Consider adding 2FA for admin users

## Migration Checklist

- [x] Create accounts and users tables
- [x] Add account_id to all data tables
- [x] Create THG Automotive account
- [x] Create Max Turner user
- [x] Link existing data to account
- [ ] Update frontend authentication
- [ ] Add account_id filtering to all queries
- [ ] Build user management UI
- [ ] Add password change functionality
- [ ] Add password reset flow
