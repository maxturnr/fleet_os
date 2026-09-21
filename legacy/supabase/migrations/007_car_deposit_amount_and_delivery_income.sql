ALTER TABLE cars
ADD COLUMN IF NOT EXISTS deposit_amount NUMERIC(10,2) DEFAULT 0;

UPDATE cars
SET deposit_amount = COALESCE(deposit_amount, deposit_received, 0)
WHERE deposit_amount IS NULL OR deposit_amount = 0;

INSERT INTO income_types (name, description, default_vat_status, affects_vehicle_sale_price, sort_order)
VALUES ('delivery', 'Delivery fee charged to customer', 'standard', FALSE, 8)
ON CONFLICT (name) DO NOTHING;
