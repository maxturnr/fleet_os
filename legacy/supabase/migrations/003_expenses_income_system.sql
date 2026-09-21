-- ═══════════════════════════════════════════════════════════
-- EXPENSES & INCOME SYSTEM
-- Manual expense tracking, income management, and bank movements
-- ═══════════════════════════════════════════════════════════

-- 1. RENAME TRANSACTIONS TO EXPENSES
-- Keep existing data, just rename the table
ALTER TABLE IF EXISTS transactions RENAME TO expenses;

-- Add new columns for expenses
ALTER TABLE expenses ADD COLUMN IF NOT EXISTS receipt_url TEXT;
ALTER TABLE expenses ADD COLUMN IF NOT EXISTS vat_status TEXT DEFAULT 'standard'; -- 'standard', 'reduced', 'zero', 'exempt', 'non-vat'
ALTER TABLE expenses ADD COLUMN IF NOT EXISTS vat_amount NUMERIC(10,2) DEFAULT 0;
ALTER TABLE expenses ADD COLUMN IF NOT EXISTS net_amount NUMERIC(10,2);
ALTER TABLE expenses ADD COLUMN IF NOT EXISTS is_overhead BOOLEAN DEFAULT FALSE;
ALTER TABLE expenses ADD COLUMN IF NOT EXISTS created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW();
ALTER TABLE expenses ADD COLUMN IF NOT EXISTS updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW();

-- Update existing expenses to calculate net/vat if not set
UPDATE expenses 
SET 
  net_amount = CASE 
    WHEN vat_status = 'standard' THEN ROUND(amount / 1.20, 2)
    WHEN vat_status = 'reduced' THEN ROUND(amount / 1.05, 2)
    ELSE amount
  END,
  vat_amount = CASE 
    WHEN vat_status = 'standard' THEN ROUND(amount - (amount / 1.20), 2)
    WHEN vat_status = 'reduced' THEN ROUND(amount - (amount / 1.05), 2)
    ELSE 0
  END,
  is_overhead = CASE WHEN stock_id IS NULL THEN TRUE ELSE FALSE END
WHERE net_amount IS NULL;

-- Create indexes for expenses
CREATE INDEX IF NOT EXISTS idx_expenses_stock_id ON expenses(stock_id);
CREATE INDEX IF NOT EXISTS idx_expenses_account_id ON expenses(account_id);
CREATE INDEX IF NOT EXISTS idx_expenses_date ON expenses(date);
CREATE INDEX IF NOT EXISTS idx_expenses_type ON expenses(type);
CREATE INDEX IF NOT EXISTS idx_expenses_is_overhead ON expenses(is_overhead);

-- 2. INCOME TABLE
-- Track all income: deposits, sales, upsells, warranties, etc.
CREATE TABLE IF NOT EXISTS income (
  id BIGSERIAL PRIMARY KEY,
  account_id BIGINT NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
  
  -- Income details
  type TEXT NOT NULL, -- 'deposit', 'purchase', 'upsell_warranty', 'upsell_service', 'upsell_other', 'other'
  amount NUMERIC(10,2) NOT NULL,
  net_amount NUMERIC(10,2),
  vat_amount NUMERIC(10,2) DEFAULT 0,
  vat_status TEXT DEFAULT 'standard', -- 'standard', 'reduced', 'zero', 'exempt', 'non-vat'
  
  -- Vehicle attribution
  stock_id BIGINT REFERENCES cars(id) ON DELETE SET NULL,
  is_general BOOLEAN DEFAULT FALSE, -- true if not attributed to specific vehicle
  
  -- Payment details
  bank_account_id BIGINT REFERENCES accounts(id) ON DELETE SET NULL,
  payment_method TEXT, -- 'bank_transfer', 'cash', 'card', 'finance', 'other'
  reference TEXT,
  
  -- Sale or Return specific
  is_sale_or_return BOOLEAN DEFAULT FALSE,
  owner_payout_amount NUMERIC(10,2), -- Amount paid back to owner
  owner_payout_date DATE,
  owner_payout_account_id BIGINT REFERENCES accounts(id) ON DELETE SET NULL,
  
  -- Metadata
  date DATE NOT NULL DEFAULT CURRENT_DATE,
  description TEXT,
  notes TEXT,
  receipt_url TEXT,
  
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create indexes for income
CREATE INDEX idx_income_account_id ON income(account_id);
CREATE INDEX idx_income_stock_id ON income(stock_id);
CREATE INDEX idx_income_date ON income(date);
CREATE INDEX idx_income_type ON income(type);
CREATE INDEX idx_income_is_general ON income(is_general);
CREATE INDEX idx_income_is_sale_or_return ON income(is_sale_or_return);

-- 3. BANK MOVEMENTS TABLE
-- Track transfers between accounts
CREATE TABLE IF NOT EXISTS bank_movements (
  id BIGSERIAL PRIMARY KEY,
  account_id BIGINT NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
  
  -- Movement details
  from_account_id BIGINT NOT NULL REFERENCES accounts(id) ON DELETE RESTRICT,
  to_account_id BIGINT NOT NULL REFERENCES accounts(id) ON DELETE RESTRICT,
  amount NUMERIC(10,2) NOT NULL CHECK (amount > 0),
  
  -- Metadata
  date DATE NOT NULL DEFAULT CURRENT_DATE,
  reason TEXT NOT NULL, -- Why the transfer is happening
  reference TEXT, -- Bank reference number
  notes TEXT,
  
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  
  -- Ensure we don't transfer to same account
  CONSTRAINT different_accounts CHECK (from_account_id != to_account_id)
);

-- Create indexes for bank movements
CREATE INDEX idx_bank_movements_account_id ON bank_movements(account_id);
CREATE INDEX idx_bank_movements_from_account ON bank_movements(from_account_id);
CREATE INDEX idx_bank_movements_to_account ON bank_movements(to_account_id);
CREATE INDEX idx_bank_movements_date ON bank_movements(date);

-- 4. UPDATE CARS TABLE
-- Add sale or return fields
ALTER TABLE cars ADD COLUMN IF NOT EXISTS is_sale_or_return BOOLEAN DEFAULT FALSE;
ALTER TABLE cars ADD COLUMN IF NOT EXISTS sale_or_return_owner TEXT;
ALTER TABLE cars ADD COLUMN IF NOT EXISTS sale_or_return_terms TEXT;
ALTER TABLE cars ADD COLUMN IF NOT EXISTS sale_or_return_commission_rate NUMERIC(5,2); -- Percentage
ALTER TABLE cars ADD COLUMN IF NOT EXISTS total_income NUMERIC(10,2) DEFAULT 0; -- Cached total from income table
ALTER TABLE cars ADD COLUMN IF NOT EXISTS deposit_received NUMERIC(10,2) DEFAULT 0;
ALTER TABLE cars ADD COLUMN IF NOT EXISTS final_sale_price NUMERIC(10,2); -- Actual price sold for
ALTER TABLE cars ADD COLUMN IF NOT EXISTS owner_payout_amount NUMERIC(10,2); -- For sale or return
ALTER TABLE cars ADD COLUMN IF NOT EXISTS owner_payout_date DATE;

-- Create index for sale or return
CREATE INDEX IF NOT EXISTS idx_cars_is_sale_or_return ON cars(is_sale_or_return);

-- 5. INCOME TYPES REFERENCE TABLE
-- Predefined income types for consistency
CREATE TABLE IF NOT EXISTS income_types (
  id BIGSERIAL PRIMARY KEY,
  name TEXT NOT NULL UNIQUE,
  description TEXT,
  default_vat_status TEXT DEFAULT 'standard',
  affects_vehicle_sale_price BOOLEAN DEFAULT FALSE, -- Does this count toward vehicle sale price?
  is_active BOOLEAN DEFAULT TRUE,
  sort_order INTEGER DEFAULT 0
);

-- Insert default income types
INSERT INTO income_types (name, description, default_vat_status, affects_vehicle_sale_price, sort_order) VALUES
  ('deposit', 'Customer deposit on vehicle', 'standard', TRUE, 1),
  ('purchase', 'Full vehicle purchase payment', 'standard', TRUE, 2),
  ('upsell_warranty', 'Extended warranty sale', 'standard', FALSE, 3),
  ('upsell_service', 'Service package sale', 'standard', FALSE, 4),
  ('upsell_accessories', 'Accessories or extras', 'standard', FALSE, 5),
  ('upsell_other', 'Other upsell products', 'standard', FALSE, 6),
  ('finance_commission', 'Finance commission earned', 'exempt', FALSE, 7),
  ('other', 'Other income', 'standard', FALSE, 99)
ON CONFLICT (name) DO NOTHING;

-- 6. EXPENSE TYPES REFERENCE TABLE
-- Predefined expense types for consistency
CREATE TABLE IF NOT EXISTS expense_types (
  id BIGSERIAL PRIMARY KEY,
  name TEXT NOT NULL UNIQUE,
  description TEXT,
  default_vat_status TEXT DEFAULT 'standard',
  is_active BOOLEAN DEFAULT TRUE,
  sort_order INTEGER DEFAULT 0
);

-- Insert default expense types
INSERT INTO expense_types (name, description, default_vat_status, sort_order) VALUES
  ('purchase', 'Vehicle purchase cost', 'standard', 1),
  ('parts', 'Parts and components', 'standard', 2),
  ('mechanics', 'Mechanical work and repairs', 'standard', 3),
  ('bodywork', 'Bodywork and paint', 'standard', 4),
  ('valeting', 'Cleaning and valeting', 'standard', 5),
  ('mot', 'MOT test', 'non-vat', 6),
  ('tax', 'Road tax', 'non-vat', 7),
  ('transport', 'Vehicle transport/delivery', 'standard', 8),
  ('fuel', 'Fuel costs', 'standard', 9),
  ('advertising', 'Marketing and advertising', 'standard', 10),
  ('rent', 'Premises rent', 'exempt', 11),
  ('utilities', 'Electricity, water, etc', 'standard', 12),
  ('insurance', 'Insurance premiums', 'exempt', 13),
  ('other', 'Other expenses', 'standard', 99)
ON CONFLICT (name) DO NOTHING;

-- 7. TRIGGERS FOR UPDATED_AT
-- Auto-update timestamps
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Apply to expenses
DROP TRIGGER IF EXISTS update_expenses_updated_at ON expenses;
CREATE TRIGGER update_expenses_updated_at
  BEFORE UPDATE ON expenses
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- Apply to income
DROP TRIGGER IF EXISTS update_income_updated_at ON income;
CREATE TRIGGER update_income_updated_at
  BEFORE UPDATE ON income
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- Apply to bank_movements
DROP TRIGGER IF EXISTS update_bank_movements_updated_at ON bank_movements;
CREATE TRIGGER update_bank_movements_updated_at
  BEFORE UPDATE ON bank_movements
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- 8. FUNCTION TO UPDATE VEHICLE TOTALS
-- Automatically update vehicle income totals when income is added/updated
CREATE OR REPLACE FUNCTION update_vehicle_income_totals()
RETURNS TRIGGER AS $$
BEGIN
  -- Update the vehicle's total income and deposit
  IF NEW.stock_id IS NOT NULL THEN
    UPDATE cars SET
      total_income = (
        SELECT COALESCE(SUM(amount), 0)
        FROM income
        WHERE stock_id = NEW.stock_id
      ),
      deposit_received = (
        SELECT COALESCE(SUM(amount), 0)
        FROM income
        WHERE stock_id = NEW.stock_id AND type = 'deposit'
      ),
      final_sale_price = (
        SELECT COALESCE(SUM(i.amount), 0)
        FROM income i
        JOIN income_types it ON i.type = it.name
        WHERE i.stock_id = NEW.stock_id AND it.affects_vehicle_sale_price = TRUE
      )
    WHERE id = NEW.stock_id;
  END IF;
  
  -- Also update for OLD stock_id if it changed
  IF TG_OP = 'UPDATE' AND OLD.stock_id IS NOT NULL AND OLD.stock_id != NEW.stock_id THEN
    UPDATE cars SET
      total_income = (
        SELECT COALESCE(SUM(amount), 0)
        FROM income
        WHERE stock_id = OLD.stock_id
      ),
      deposit_received = (
        SELECT COALESCE(SUM(amount), 0)
        FROM income
        WHERE stock_id = OLD.stock_id AND type = 'deposit'
      ),
      final_sale_price = (
        SELECT COALESCE(SUM(i.amount), 0)
        FROM income i
        JOIN income_types it ON i.type = it.name
        WHERE i.stock_id = OLD.stock_id AND it.affects_vehicle_sale_price = TRUE
      )
    WHERE id = OLD.stock_id;
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Apply trigger to income
DROP TRIGGER IF EXISTS update_vehicle_totals_on_income ON income;
CREATE TRIGGER update_vehicle_totals_on_income
  AFTER INSERT OR UPDATE ON income
  FOR EACH ROW
  EXECUTE FUNCTION update_vehicle_income_totals();

-- 9. FUNCTION TO UPDATE ACCOUNT BALANCES ON BANK MOVEMENTS
-- Automatically update account balances when money is moved
CREATE OR REPLACE FUNCTION update_balances_on_movement()
RETURNS TRIGGER AS $$
BEGIN
  -- Deduct from source account
  UPDATE accounts 
  SET balance = balance - NEW.amount
  WHERE id = NEW.from_account_id;
  
  -- Add to destination account
  UPDATE accounts 
  SET balance = balance + NEW.amount
  WHERE id = NEW.to_account_id;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Apply trigger to bank_movements
DROP TRIGGER IF EXISTS update_balances_on_bank_movement ON bank_movements;
CREATE TRIGGER update_balances_on_bank_movement
  AFTER INSERT ON bank_movements
  FOR EACH ROW
  EXECUTE FUNCTION update_balances_on_movement();

-- 10. VIEWS FOR REPORTING

-- Vehicle P&L view with income
CREATE OR REPLACE VIEW vehicle_profit_loss AS
SELECT 
  c.id as stock_id,
  c.stock_number,
  c.make,
  c.model,
  c.reg,
  c.is_sale_or_return,
  
  -- Income
  c.total_income,
  c.deposit_received,
  c.final_sale_price,
  
  -- Expenses
  COALESCE(SUM(e.amount), 0) as total_expenses,
  
  -- Profit/Loss
  COALESCE(c.final_sale_price, 0) - COALESCE(SUM(e.amount), 0) as profit_loss,
  
  -- Sale or Return
  c.owner_payout_amount,
  CASE 
    WHEN c.is_sale_or_return THEN 
      COALESCE(c.final_sale_price, 0) - COALESCE(c.owner_payout_amount, 0) - COALESCE(SUM(e.amount), 0)
    ELSE 
      COALESCE(c.final_sale_price, 0) - COALESCE(SUM(e.amount), 0)
  END as net_profit
  
FROM cars c
LEFT JOIN expenses e ON c.id = e.stock_id
GROUP BY c.id, c.stock_number, c.make, c.model, c.reg, c.is_sale_or_return, 
         c.total_income, c.deposit_received, c.final_sale_price, c.owner_payout_amount;

-- ═══════════════════════════════════════════════════════════
-- MIGRATION COMPLETE
-- ═══════════════════════════════════════════════════════════
