ALTER TABLE cars
ADD COLUMN IF NOT EXISTS purchase_vat_type TEXT;

ALTER TABLE cars
ALTER COLUMN purchase_vat_type SET DEFAULT 'margin';

UPDATE cars
SET purchase_vat_type = 'margin'
WHERE type = 'owned'
  AND (purchase_vat_type IS NULL OR purchase_vat_type = '');
