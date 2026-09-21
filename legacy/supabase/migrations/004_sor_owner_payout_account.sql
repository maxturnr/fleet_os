-- Store which bank account was used to pay back the owner on sale-or-return deals
ALTER TABLE cars
ADD COLUMN IF NOT EXISTS owner_payout_account_id BIGINT REFERENCES bank_accounts(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_cars_owner_payout_account_id
ON cars(owner_payout_account_id);
