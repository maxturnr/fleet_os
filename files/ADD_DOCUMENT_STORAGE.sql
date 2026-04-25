-- ═══════════════════════════════════════════════════════════
-- ADD DOCUMENT STORAGE FOR RECEIPTS/INVOICES
-- Run this in Supabase SQL Editor
-- ═══════════════════════════════════════════════════════════

-- 1. CREATE DOCUMENTS TABLE
CREATE TABLE IF NOT EXISTS transaction_documents (
  id BIGSERIAL PRIMARY KEY,
  transaction_id BIGINT NOT NULL REFERENCES transactions(id) ON DELETE CASCADE,
  file_name TEXT NOT NULL,
  file_path TEXT NOT NULL,
  file_type TEXT,
  file_size BIGINT,
  uploaded_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 2. CREATE INDEX
CREATE INDEX IF NOT EXISTS idx_transaction_documents_transaction_id ON transaction_documents(transaction_id);

-- 3. DISABLE RLS
ALTER TABLE transaction_documents DISABLE ROW LEVEL SECURITY;

-- 4. VERIFY
SELECT 
  'Document storage table created!' as status,
  (SELECT COUNT(*) FROM transaction_documents) as documents_count;

-- ═══════════════════════════════════════════════════════════
-- NEXT STEPS - DO THIS IN SUPABASE DASHBOARD:
-- ═══════════════════════════════════════════════════════════
-- 1. Go to Storage in Supabase Dashboard
-- 2. Create a new bucket called: transaction-documents
-- 3. Set it to PUBLIC (or configure RLS policies as needed)
-- 4. Done!
