# Mileage Tracker Setup Guide

## Overview
The mileage tracker helps you claim back tax deductions at 45p per mile for business travel. This feature automatically calculates distances between postcodes and tracks your total tax-deductible mileage.

## Setup Steps

### 1. Run Database Migration
Open your Supabase SQL Editor and run the SQL file:
```
files/ADD_MILEAGE_TRACKER.sql
```

This creates the `mileage_trips` table with all necessary fields.

### 2. Verify Setup
After running the SQL, you should see:
- ✅ `mileage_trips` table created
- ✅ Indexes created for performance
- ✅ Row Level Security disabled (matching your other tables)

### 3. Access the Feature
1. Open FleetOS_v3.html
2. Click **"Mileage Tracker"** in the top navigation
3. Click **"+ Add Trip"** to record your first journey

## How to Use

### Adding a Trip
1. **Trip Date**: Select when the journey took place
2. **Starting Address**: Enter your starting postcode or full address
3. **Destination Address**: Enter where you went (postcode or address)
4. **Purpose**: What the trip was for (e.g., "Client meeting", "Vehicle collection")
5. **Car Used**: 
   - Select from your stock if you used a car in inventory
   - Choose "Other" to manually enter details (e.g., personal car)
6. **Distance**: Auto-calculated when you enter both addresses
   - You can manually override if needed
7. **Return Journey**: Select "Yes" to automatically double the mileage

### Features

#### Automatic Distance Calculation
- Enter start and end postcodes
- Distance automatically calculated using UK postcode data
- Uses straight-line distance (as-the-crow-flies) in miles
- Adjust manually if you know the actual road distance

#### Tax Deduction Tracking
- **Rate**: 45p per mile (HMRC standard rate)
- **Total Miles**: Sum of all trips in selected period
- **Total Claim**: Automatic calculation of tax deduction amount

#### Filtering
- **This Week**: Last 7 days of trips
- **This Month**: Last 30 days
- **This Year**: All trips from Jan 1st
- **Custom Range**: Set your own date range

#### Car Assignment
- Link trips to cars in your stock
- Or note down personal/other vehicles
- Helps track which vehicles are used for business

## Tax Deduction Information

### HMRC Mileage Allowance (2024/25)
- **First 10,000 miles**: 45p per mile
- **Over 10,000 miles**: 25p per mile

**Note**: The tracker currently uses 45p for all miles. You may need to manually adjust for miles over 10,000 when filing your tax return.

### What Qualifies as Business Mileage?
✅ **Allowed**:
- Trips to meet clients
- Vehicle collections/deliveries
- Business errands (parts, supplies)
- Bank visits for business
- Meetings with suppliers

❌ **Not Allowed**:
- Home to regular place of work
- Personal errands
- Commuting

### Record Keeping
Keep records of:
- Date of journey
- Start and end locations
- Business purpose
- Miles traveled
- Vehicle used

The mileage tracker stores all this automatically!

## Database Schema

```sql
CREATE TABLE mileage_trips (
  id BIGSERIAL PRIMARY KEY,
  account_id BIGINT NOT NULL,
  trip_date DATE NOT NULL,
  start_address TEXT NOT NULL,
  start_postcode TEXT NOT NULL,
  end_address TEXT NOT NULL,
  end_postcode TEXT NOT NULL,
  purpose TEXT,
  car_id BIGINT (references cars table),
  car_notes TEXT,
  distance_miles NUMERIC(10,2) NOT NULL,
  is_return_journey BOOLEAN DEFAULT FALSE,
  rate_per_mile NUMERIC(10,2) DEFAULT 0.45,
  total_claim NUMERIC(10,2) GENERATED (calculated automatically),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);
```

## Tips

1. **Regular Updates**: Log trips weekly to avoid forgetting details
2. **Accurate Addresses**: Use full postcodes for best distance calculation
3. **Purpose Notes**: Be specific - helps if HMRC asks questions
4. **Return Journeys**: Don't forget to mark return trips
5. **Export Data**: Use filters to generate reports for specific tax periods

## Support

If you encounter issues:
1. Check the browser console for errors
2. Verify the database table was created correctly
3. Ensure you have an active internet connection (for distance calculation)
4. Check that postcodes are valid UK format

## Future Enhancements (Optional)

Potential additions:
- Export to CSV for accountant
- Route-based distance (not just straight-line)
- Automatic rate adjustment at 10,000 miles
- Monthly/annual summary reports
- Integration with accounting software
