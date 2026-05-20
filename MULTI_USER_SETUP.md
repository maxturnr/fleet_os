# Multi-User System Setup Guide

## Overview
FleetOS now supports multiple users per dealership with role-based access control. Each user can add their own expenses and mileage, with full attribution tracking showing who created each entry.

## Features Implemented

### 1. **User Roles**
- **Admin**: Full access + user management capabilities
- **User**: Can add/edit data (default role)
- **Viewer**: Read-only access (future implementation)

### 2. **User Attribution**
All data entries now track:
- **Created By**: Who added the entry
- **Driver/Assigned To**: Who the entry is for (can be different from creator)

Example: "Driver: Paul, Added by: Max"

### 3. **Settings Page**
New Settings tab with two sections:
- **My Profile**: View/edit personal information
- **Dealership & Users** (Admin only): Manage team members

## Setup Instructions

### Step 1: Run Database Migration
Execute the SQL migration in Supabase SQL Editor:

```bash
files/ADD_MULTI_USER_SYSTEM.sql
```

This will:
- Add user profile fields to accounts table
- Create dealership_users linking table
- Add audit columns (created_by, driver, etc.) to all relevant tables
- Create helper functions for user management

### Step 2: Update Existing Account
Your existing account needs to be configured with the new fields:

```sql
-- Update your account with full name and admin role
UPDATE accounts 
SET full_name = 'Max Turner',
    role = 'admin'
WHERE dealer_name = 'THG Automotive';
```

### Step 3: Verify Setup
Run this query to check everything is configured:

```sql
SELECT 
  a.dealer_name,
  a.full_name,
  a.role,
  a.primary_email,
  au.email as auth_email
FROM accounts a
LEFT JOIN auth.users au ON au.id = a.user_id
WHERE a.dealer_name = 'THG Automotive';
```

## Using the Multi-User System

### Adding New Users (Admin Only)

1. **Navigate to Settings**
   - Click "Settings" in the top navigation
   - Click "Dealership & Users" tab

2. **Invite a User**
   - Click "+ Invite User"
   - Enter email, full name, and select role
   - Click "Send Invitation"

3. **Create Auth User in Supabase**
   - Go to Supabase Dashboard → Authentication → Users
   - Click "Add User"
   - Use the same email from the invitation
   - Set a temporary password
   - Enable "Auto Confirm User"
   - Copy the user's UUID

4. **Link Auth User to Account**
   ```sql
   -- Find the invited account
   SELECT id, full_name, primary_email, active 
   FROM accounts 
   WHERE primary_email = 'newuser@example.com';
   
   -- Link the auth user (replace UUIDs)
   UPDATE accounts 
   SET user_id = 'AUTH-USER-UUID-HERE'::uuid,
       active = true
   WHERE id = ACCOUNT_ID_FROM_ABOVE;
   ```

5. **User Can Now Log In**
   - The new user can log in with their email and password
   - They'll see data for your dealership
   - Their role determines what they can access

### User Attribution in Action

#### Transactions
When adding a cost:
- **Created By** is automatically set to the logged-in user
- Shows in the "Added By" column
- Example: "Added By: Max"

#### Mileage Tracker
When adding a trip:
- **Driver** can be selected from dropdown (defaults to current user)
- **Created By** is automatically set to the logged-in user
- Shows both Driver and Added By columns
- Example: "Driver: Paul, Added By: Max"

## Database Schema Changes

### New Tables
- `dealership_users`: Links users to dealerships with roles

### New Columns on `accounts`
- `full_name`: User's display name
- `role`: admin/user/viewer
- `phone`: Optional phone number
- `invited_by`: UUID of admin who invited them
- `invited_at`: Invitation timestamp
- `last_login`: Last login timestamp

### New Columns on `transactions`
- `created_by_user_id`: UUID of user who created
- `created_by_name`: Name for display
- `assigned_to_user_id`: UUID of user it's assigned to
- `assigned_to_name`: Name for display

### New Columns on `mileage_trips`
- `created_by_user_id`: UUID of user who created
- `created_by_name`: Name for display
- `driver_user_id`: UUID of driver
- `driver_name`: Driver's name for display

### New Columns on `cars` and `bank_accounts`
- `created_by_user_id`: UUID of user who created
- `created_by_name`: Name for display

## UI Changes

### Navigation
- New "Settings" tab in top navigation

### Settings Page
- **My Profile**: Edit phone number (name/email read-only)
- **Dealership & Users** (Admin only):
  - View all users
  - See roles, status, last login
  - Activate/deactivate users
  - Invite new users

### Transactions Table
- New "Added By" column shows who created each transaction

### Mileage Tracker
- New "Driver" column shows who drove
- New "Added By" column shows who logged it
- Driver selector in add trip form

## Security Notes

1. **Row Level Security (RLS)**: Currently disabled for simplicity. Consider enabling for production.

2. **User Invitations**: Currently requires manual Supabase Auth user creation. Future enhancement: automated email invitations.

3. **Role Enforcement**: UI hides admin features from non-admins, but backend validation should be added for production.

## Troubleshooting

### User Can't See Dealership Data
Check the dealership_users link:
```sql
SELECT * FROM dealership_users 
WHERE user_account_id = (
  SELECT id FROM accounts WHERE user_id = 'USER-UUID-HERE'
);
```

### "Added By" Shows as "System"
This means the record was created before the multi-user system. You can update:
```sql
UPDATE transactions 
SET created_by_user_id = 'YOUR-USER-UUID',
    created_by_name = 'Your Name'
WHERE created_by_user_id IS NULL;
```

### Admin Tab Not Showing
Check user role:
```sql
SELECT role FROM accounts WHERE user_id = 'YOUR-USER-UUID';
```

Should return 'admin'. If not:
```sql
UPDATE accounts SET role = 'admin' WHERE user_id = 'YOUR-USER-UUID';
```

## Future Enhancements

1. **Automated Email Invitations**: Use Supabase Edge Functions to send invitation emails
2. **Permission System**: Granular permissions beyond roles
3. **Activity Log**: Track all user actions
4. **User Groups**: Organize users into teams
5. **Data Filtering**: Filter views by user (e.g., "My Transactions")

## Support

For issues or questions:
1. Check the troubleshooting section above
2. Review the SQL migration file for database structure
3. Check browser console for JavaScript errors
4. Verify Supabase connection and permissions
