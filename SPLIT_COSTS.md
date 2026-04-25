# 🔀 Split Cost Feature - LIVE!

## 🎉 What's New

**Split a single transaction across multiple cars!**

Perfect for when you pay a parts bill or mechanic invoice that covers work on multiple vehicles.

## 🚀 Live Now

**https://fleet-os-nine.vercel.app**

## 📋 Setup Required

**Run this SQL in Supabase first:**

```sql
-- 1. CREATE TRANSACTION SPLITS TABLE
CREATE TABLE IF NOT EXISTS transaction_splits (
  id BIGSERIAL PRIMARY KEY,
  transaction_id BIGINT NOT NULL REFERENCES transactions(id) ON DELETE CASCADE,
  car_id BIGINT NOT NULL REFERENCES cars(id) ON DELETE CASCADE,
  amount NUMERIC NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 2. CREATE INDEXES
CREATE INDEX IF NOT EXISTS idx_transaction_splits_transaction_id ON transaction_splits(transaction_id);
CREATE INDEX IF NOT EXISTS idx_transaction_splits_car_id ON transaction_splits(car_id);

-- 3. DISABLE RLS
ALTER TABLE transaction_splits DISABLE ROW LEVEL SECURITY;
```

Or just run the file: `files/ADD_SPLIT_COSTS.sql`

## ✨ How to Use

### When Logging a New Cost:

1. **Click "Log a Cost"** button
2. **Fill in the details** (date, total amount, supplier, type, etc.)
3. **At the bottom**, click **"🔀 Split Cost"** button
4. **Split section appears** below
5. **Click "+ Add Line"** for each car
6. **Select the car** from dropdown
7. **Enter the amount** for that car
8. **Repeat** for all cars (add as many as needed)
9. **Total must match** the transaction amount (turns green when correct)
10. **Click "Save"**

**To cancel split:** Click **"✕ Cancel Split"** button

### When Editing an Existing Transaction:

1. **Click any transaction** to expand it
2. **In "Assign to Stock" dropdown**, select **"🔀 Split across multiple cars"**
3. **Split section appears** below
4. **Click "+ Add Car"** to add each car
5. **Select the car** from dropdown
6. **Enter the amount** for that car
7. **Repeat** for each car
8. **Total must match** the transaction amount (turns green when correct)
9. **Click "Save Changes"**

### Example:

**Parts bill: £450**
- Car 1 (STK-001): £180
- Car 2 (STK-002): £150
- Car 3 (STK-003): £120
- **Total: £450** ✅

### Visual Feedback:

- **Total shows in gold** as you add amounts
- **Turns RED** if total exceeds transaction amount
- **Turns GREEN** when total matches exactly
- **Can't save** unless total matches

### In the Table:

Split transactions show:
- **🔀 SPLIT** badge in the "Assigned To" column
- Click to expand and see/edit the split breakdown

## 🎯 Features

- ✅ **Split across unlimited cars**
- ✅ **Real-time total validation**
- ✅ **Visual feedback** (red/green)
- ✅ **Direct costs automatically include splits**
- ✅ **P&L calculations work correctly**
- ✅ **Easy to edit** - just click and modify
- ✅ **Remove splits** with X button
- ✅ **Add more splits** anytime

## 💡 Use Cases

Perfect for:
- **Parts bills** covering multiple cars
- **Mechanic invoices** for several vehicles
- **Bulk purchases** (tyres, oil, etc.)
- **Shared costs** across your fleet
- **Credit account payments** that cover multiple jobs

## 🔧 Technical

- Splits stored in `transaction_splits` table
- Main transaction has `car_reg = 'SPLIT'`
- `getDirectCosts()` includes both direct and split amounts
- Deleting a transaction auto-deletes its splits (CASCADE)
- Converting from split to single car removes all splits

## 📊 Reporting

- **Direct costs** on each car include their split amounts
- **P&L calculations** work correctly
- **Stock valuations** accurate
- **Transaction list** shows split badge

**No more manual calculations or workarounds!** 🎉
