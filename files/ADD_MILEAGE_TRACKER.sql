-- ═══════════════════════════════════════════════════════════
-- MILEAGE TRACKER - DATABASE SETUP
-- Run this in Supabase SQL Editor to add mileage tracking
-- ═══════════════════════════════════════════════════════════

-- CREATE MILEAGE_TRIPS TABLE
CREATE TABLE IF NOT EXISTS mileage_trips (
  id BIGSERIAL PRIMARY KEY,
  account_id BIGINT NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
  trip_date DATE NOT NULL,
  start_address TEXT NOT NULL,
  start_postcode TEXT NOT NULL,
  end_address TEXT NOT NULL,
  end_postcode TEXT NOT NULL,
  purpose TEXT,
  car_id BIGINT REFERENCES cars(id) ON DELETE SET NULL,
  car_notes TEXT,
  distance_miles NUMERIC(10,2) NOT NULL,
  is_return_journey BOOLEAN DEFAULT FALSE,
  rate_per_mile NUMERIC(10,2) DEFAULT 0.45,
  total_claim NUMERIC(10,2) GENERATED ALWAYS AS (distance_miles * rate_per_mile) STORED,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- CREATE INDEX
CREATE INDEX IF NOT EXISTS idx_mileage_trips_account_id ON mileage_trips(account_id);
CREATE INDEX IF NOT EXISTS idx_mileage_trips_trip_date ON mileage_trips(trip_date);
CREATE INDEX IF NOT EXISTS idx_mileage_trips_car_id ON mileage_trips(car_id);

-- DISABLE RLS (matching other tables)
ALTER TABLE mileage_trips DISABLE ROW LEVEL SECURITY;

-- VERIFY SETUP
SELECT 
  'Mileage Tracker Setup Complete!' as status,
  (SELECT COUNT(*) FROM mileage_trips) as total_trips;
