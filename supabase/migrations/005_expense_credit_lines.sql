-- Add vendor credit-line support to expenses.
ALTER TABLE expenses
ADD COLUMN IF NOT EXISTS payment_status TEXT DEFAULT 'paid',
ADD COLUMN IF NOT EXISTS due_date DATE,
ADD COLUMN IF NOT EXISTS paid_date DATE,
ADD COLUMN IF NOT EXISTS paid_from_account_id BIGINT REFERENCES bank_accounts(id) ON DELETE SET NULL,
ADD COLUMN IF NOT EXISTS refund_amount NUMERIC(10,2) DEFAULT 0,
ADD COLUMN IF NOT EXISTS refund_date DATE,
ADD COLUMN IF NOT EXISTS credit_reference TEXT;

UPDATE expenses
SET payment_status = 'paid'
WHERE payment_status IS NULL;

UPDATE expenses
SET refund_amount = 0
WHERE refund_amount IS NULL;

ALTER TABLE expenses
ALTER COLUMN payment_status SET DEFAULT 'paid';

ALTER TABLE expenses
ALTER COLUMN refund_amount SET DEFAULT 0;

CREATE INDEX IF NOT EXISTS idx_expenses_payment_status ON expenses(payment_status);
CREATE INDEX IF NOT EXISTS idx_expenses_due_date ON expenses(due_date);
CREATE INDEX IF NOT EXISTS idx_expenses_paid_from_account_id ON expenses(paid_from_account_id);
CREATE INDEX IF NOT EXISTS idx_expenses_refund_date ON expenses(refund_date);
CREATE INDEX IF NOT EXISTS idx_expenses_supplier_payment_status ON expenses(supplier, payment_status);
