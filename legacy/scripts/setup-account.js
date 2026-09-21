/**
 * One-time script to set up THG Automotive account
 * Generates password hash and SQL to run in Supabase
 */

const crypto = require('crypto')

// Generate a secure random password
function generatePassword() {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz23456789!@#$%'
  let password = ''
  for (let i = 0; i < 16; i++) {
    password += chars.charAt(Math.floor(Math.random() * chars.length))
  }
  return password
}

// Simple password hash using SHA-256 (for demo - in production use bcrypt)
function hashPassword(password) {
  return crypto.createHash('sha256').update(password).digest('hex')
}

// Generate password and hash
const password = generatePassword()
const passwordHash = hashPassword(password)

console.log('═══════════════════════════════════════════')
console.log('THG AUTOMOTIVE ACCOUNT SETUP')
console.log('═══════════════════════════════════════════')
console.log('')
console.log('📧 Email: max@thgautomotive.com')
console.log('🔑 Password:', password)
console.log('')
console.log('⚠️  SAVE THIS PASSWORD - IT WILL NOT BE SHOWN AGAIN!')
console.log('')
console.log('═══════════════════════════════════════════')
console.log('SQL TO RUN IN SUPABASE:')
console.log('═══════════════════════════════════════════')
console.log('')

const sql = `
-- Step 1: Create THG Automotive account
INSERT INTO accounts (dealer_name, settings)
VALUES ('THG Automotive', '{"vat_registered": false}'::jsonb)
RETURNING id;

-- Step 2: Note the account_id returned above, then run:
-- (Replace 1 with the actual account_id if different)

-- Create Max Turner user
INSERT INTO users (account_id, email, password_hash, full_name, role)
VALUES (
  1,
  'max@thgautomotive.com',
  '${passwordHash}',
  'Max Turner',
  'admin'
);

-- Step 3: Link all existing data to this account
UPDATE cars SET account_id = 1 WHERE account_id IS NULL;
UPDATE transactions SET account_id = 1 WHERE account_id IS NULL;
UPDATE balance_sheet SET account_id = 1 WHERE account_id IS NULL;
UPDATE settings SET account_id = 1 WHERE account_id IS NULL;

-- Step 4: Verify
SELECT 
  a.dealer_name,
  u.email,
  u.full_name,
  COUNT(DISTINCT c.id) as total_cars,
  COUNT(DISTINCT t.id) as total_transactions
FROM accounts a
JOIN users u ON u.account_id = a.id
LEFT JOIN cars c ON c.account_id = a.id
LEFT JOIN transactions t ON t.account_id = a.id
WHERE a.id = 1
GROUP BY a.dealer_name, u.email, u.full_name;
`

console.log(sql)
console.log('')
console.log('═══════════════════════════════════════════')
console.log('After running the SQL, send this to Max:')
console.log('═══════════════════════════════════════════')
console.log('')
console.log(`Hi Max,

Your Fleet OS account has been set up!

Dealership: THG Automotive
Email: max@thgautomotive.com
Password: ${password}

Login at: https://fleet-os-nine.vercel.app/

Please change your password after first login.

Best regards,
Fleet OS Team`)
console.log('')
