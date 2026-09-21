-- Store refunds separately from expenses while keeping them visible in expense reporting.

CREATE TABLE IF NOT EXISTS expense_refunds (
  id BIGSERIAL PRIMARY KEY,
  account_id BIGINT NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
  expense_id BIGINT REFERENCES expenses(id) ON DELETE SET NULL,
  migrated_from_expense_id BIGINT UNIQUE REFERENCES expenses(id) ON DELETE SET NULL,
  supplier TEXT,
  amount NUMERIC(10,2) NOT NULL CHECK (amount > 0),
  bank_account_id BIGINT REFERENCES bank_accounts(id) ON DELETE SET NULL,
  stock_id BIGINT REFERENCES cars(id) ON DELETE SET NULL,
  is_overhead BOOLEAN DEFAULT FALSE,
  date DATE NOT NULL DEFAULT CURRENT_DATE,
  notes TEXT,
  source TEXT DEFAULT 'manual',
  created_by_user_id UUID REFERENCES auth.users(id),
  created_by_name TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_expense_refunds_account_id ON expense_refunds(account_id);
CREATE INDEX IF NOT EXISTS idx_expense_refunds_date ON expense_refunds(date);
CREATE INDEX IF NOT EXISTS idx_expense_refunds_stock_id ON expense_refunds(stock_id);
CREATE INDEX IF NOT EXISTS idx_expense_refunds_bank_account_id ON expense_refunds(bank_account_id);
CREATE INDEX IF NOT EXISTS idx_expense_refunds_expense_id ON expense_refunds(expense_id);

ALTER TABLE IF EXISTS expense_refunds DISABLE ROW LEVEL SECURITY;

DROP TRIGGER IF EXISTS update_expense_refunds_updated_at ON expense_refunds;
CREATE TRIGGER update_expense_refunds_updated_at
  BEFORE UPDATE ON expense_refunds
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

DO $migration$
DECLARE
  has_refund_amount boolean;
  has_refund_date boolean;
  refund_date_expr text;
  migrate_sql text;
  clear_sql text;
BEGIN
  SELECT EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'expenses'
      AND column_name = 'refund_amount'
  ) INTO has_refund_amount;

  SELECT EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'expenses'
      AND column_name = 'refund_date'
  ) INTO has_refund_date;

  IF has_refund_amount THEN
    refund_date_expr := CASE
      WHEN has_refund_date THEN 'COALESCE(e.refund_date, e.date, CURRENT_DATE)'
      ELSE 'COALESCE(e.date, CURRENT_DATE)'
    END;

    migrate_sql := '
      INSERT INTO expense_refunds (
        account_id,
        expense_id,
        migrated_from_expense_id,
        supplier,
        amount,
        bank_account_id,
        stock_id,
        is_overhead,
        date,
        notes,
        source,
        created_by_user_id,
        created_by_name,
        created_at,
        updated_at
      )
      SELECT
        e.account_id,
        e.id,
        e.id,
        e.supplier,
        e.refund_amount,
        COALESCE(e.paid_from_account_id, e.bank_account_id),
        e.stock_id,
        COALESCE(e.is_overhead, e.stock_id IS NULL),
        ' || refund_date_expr || ',
        CASE
          WHEN COALESCE(NULLIF(TRIM(e.notes), ''''), '''') = '''' THEN ''Migrated from embedded expense refund''
          ELSE e.notes
        END,
        COALESCE(e.source, ''migration''),
        e.created_by_user_id,
        e.created_by_name,
        COALESCE(e.created_at, NOW()),
        NOW()
      FROM expenses e
      WHERE COALESCE(e.refund_amount, 0) > 0
      ON CONFLICT (migrated_from_expense_id) DO NOTHING
    ';
    EXECUTE migrate_sql;

    clear_sql := 'UPDATE expenses SET refund_amount = 0' ||
      CASE WHEN has_refund_date THEN ', refund_date = NULL' ELSE '' END ||
      ' WHERE COALESCE(refund_amount, 0) > 0';
    EXECUTE clear_sql;
  END IF;
END
$migration$;
