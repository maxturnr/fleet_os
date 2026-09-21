# Expenses & Income System - Setup Guide

Complete manual expense tracking, income management, and bank movements system.

---

## 🎯 Overview

This system replaces the QuickBooks integration with a simpler, more flexible manual tracking system that includes:

- **Expenses** - Track all vehicle and overhead expenses with VAT
- **Income** - Record deposits, sales, upsells, and warranties
- **Bank Movements** - Transfer money between accounts with automatic balance updates
- **Sale or Return** - Special handling for consignment vehicles

---

## 📋 Features

### Expenses
- ✅ Track expenses per vehicle or as overhead
- ✅ Automatic VAT calculation (Standard 20%, Reduced 5%, Zero, Exempt, Non-VAT)
- ✅ Receipt uploads
- ✅ Multiple expense categories (parts, mechanics, fuel, etc.)
- ✅ Net/VAT breakdown

### Income
- ✅ Deposits and purchase payments
- ✅ Upsells (warranties, services, accessories)
- ✅ Vehicle attribution or general income
- ✅ Automatic vehicle sale price calculation
- ✅ Sale or Return owner payout tracking
- ✅ VAT handling

### Bank Movements
- ✅ Transfer between accounts
- ✅ Automatic balance updates
- ✅ Transfer reasons and references
- ✅ Audit trail

### Sale or Return
- ✅ Mark vehicles as SOR
- ✅ Track owner payout amounts
- ✅ Calculate commission automatically
- ✅ Update correct bank accounts

---

## 🚀 Setup Instructions

### Step 1: Run Database Migration

1. Open Supabase Dashboard → SQL Editor
2. Create new query
3. Copy contents of `supabase/migrations/003_expenses_income_system.sql`
4. Run the query

**This will:**
- Rename `transactions` table to `expenses`
- Create `income` table
- Create `bank_movements` table
- Add sale-or-return fields to `cars` table
- Create income/expense type reference tables
- Set up automatic triggers for balance updates

### Step 2: Verify Tables Created

Run this query to verify:

```sql
SELECT table_name 
FROM information_schema.tables 
WHERE table_schema = 'public' 
AND table_name IN ('expenses', 'income', 'bank_movements', 'income_types', 'expense_types');
```

You should see all 5 tables.

### Step 3: Check Existing Data

Your existing transactions are now in the `expenses` table:

```sql
SELECT COUNT(*) FROM expenses;
```

All your historical data is preserved!

---

## 📊 Using the System

### Managing Expenses

**URL**: `/files/expenses.html?accountId=1`

#### Add an Expense
1. Click "+ Add Expense"
2. Select expense type (Parts, Mechanics, Fuel, etc.)
3. Enter amount (inc VAT)
4. Select VAT status
5. Choose vehicle or mark as overhead
6. Select bank account
7. Add receipt (optional)
8. Save

#### VAT Calculation
- **Standard (20%)**: £120 → Net: £100, VAT: £20
- **Reduced (5%)**: £105 → Net: £100, VAT: £5
- **Zero/Exempt/Non-VAT**: £100 → Net: £100, VAT: £0

---

### Managing Income

**URL**: `/files/income.html?accountId=1`

#### Add Income
1. Click "+ Add Income"
2. Select income type:
   - **Deposit** - Customer deposit (counts toward sale price)
   - **Purchase** - Full payment (counts toward sale price)
   - **Warranty** - Extended warranty (doesn't count toward sale price)
   - **Service** - Service package (doesn't count toward sale price)
   - **Accessories** - Extras (doesn't count toward sale price)
3. Select vehicle or "General"
4. Enter amount and VAT status
5. Select bank account
6. Save

#### Vehicle Sale Price
The system automatically calculates `final_sale_price` by summing:
- All deposits
- All purchase payments

Upsells (warranties, services, accessories) are tracked separately and don't inflate the vehicle sale price.

---

### Sale or Return Vehicles

#### Mark Vehicle as SOR
1. Edit vehicle in your system
2. Check "Sale or Return"
3. Enter owner name
4. Enter commission rate (e.g., 10%)

#### Record SOR Sale
1. Go to Income → Add Income
2. Select the SOR vehicle
3. Type: "Purchase"
4. Enter sale amount
5. **Owner Payout Section appears**
6. Enter amount paid back to owner
7. Select payout account
8. System calculates your commission
9. Save

**What happens:**
- Income recorded for full sale amount
- Owner payout amount tracked
- Payout account balance reduced
- Vehicle `final_sale_price` updated
- Your commission = Sale price - Owner payout - Expenses

---

### Bank Movements

**URL**: `/files/bank-movements.html?accountId=1`

#### Transfer Money
1. Click "+ Add Transfer"
2. Select "From Account"
3. Select "To Account"
4. Enter amount
5. Select reason:
   - Working capital
   - Stock purchase
   - Expense payment
   - VAT payment
   - Tax payment
   - Owner withdrawal
   - Owner investment
   - Other (custom)
6. Add reference number
7. Save

**Automatic Updates:**
- From account balance decreases
- To account balance increases
- Audit trail created

---

## 💡 Example Workflows

### Workflow 1: Buy and Sell a Vehicle

1. **Purchase Vehicle**
   - Expenses → Add Expense
   - Type: "Purchase"
   - Amount: £8,000
   - Vehicle: Select vehicle
   - Account: Main Business Account

2. **Repairs**
   - Expenses → Add Expense
   - Type: "Mechanics"
   - Amount: £500
   - Vehicle: Same vehicle

3. **Customer Deposit**
   - Income → Add Income
   - Type: "Deposit"
   - Amount: £1,000
   - Vehicle: Same vehicle

4. **Final Payment**
   - Income → Add Income
   - Type: "Purchase"
   - Amount: £9,000
   - Vehicle: Same vehicle

5. **Sell Warranty**
   - Income → Add Income
   - Type: "Warranty"
   - Amount: £500
   - Vehicle: Same vehicle

**Result:**
- Vehicle sale price: £10,000 (£1,000 + £9,000)
- Total income: £10,500 (includes warranty)
- Total expenses: £8,500
- Profit: £2,000 (£10,500 - £8,500)

---

### Workflow 2: Sale or Return Vehicle

1. **Mark Vehicle as SOR**
   - Vehicle: Stock #123
   - Is Sale or Return: ✓
   - Owner: "John Smith"
   - Commission Rate: 10%

2. **Customer Deposit**
   - Income → Add Income
   - Type: "Deposit"
   - Amount: £2,000
   - Vehicle: Stock #123

3. **Repairs (Your Cost)**
   - Expenses → Add Expense
   - Type: "Mechanics"
   - Amount: £300
   - Vehicle: Stock #123

4. **Final Sale**
   - Income → Add Income
   - Type: "Purchase"
   - Amount: £18,000
   - Vehicle: Stock #123
   - **Owner Payout Section:**
     - Amount paid to owner: £16,000
     - Payout account: Main Business Account

**Result:**
- Total sale: £20,000 (£2,000 + £18,000)
- Owner payout: £16,000
- Your expenses: £300
- Your profit: £3,700 (£20,000 - £16,000 - £300)

---

### Workflow 3: Move Money Between Accounts

1. **Transfer for VAT Payment**
   - Bank Movements → Add Transfer
   - From: Main Business Account
   - To: VAT Account
   - Amount: £5,000
   - Reason: "VAT payment"
   - Reference: "Q4 2024 VAT"

**Result:**
- Main Business Account: -£5,000
- VAT Account: +£5,000
- Audit trail created

---

## 📈 Reports & Views

### Vehicle P&L View

The system includes a `vehicle_profit_loss` view:

```sql
SELECT * FROM vehicle_profit_loss WHERE stock_id = 123;
```

**Shows:**
- Total income
- Deposit received
- Final sale price
- Total expenses
- Profit/Loss
- Net profit (for SOR vehicles)

### Monthly Income Report

```sql
SELECT 
  type,
  COUNT(*) as count,
  SUM(amount) as total,
  SUM(vat_amount) as total_vat
FROM income
WHERE date >= DATE_TRUNC('month', CURRENT_DATE)
GROUP BY type
ORDER BY total DESC;
```

### Expense Breakdown

```sql
SELECT 
  type,
  COUNT(*) as count,
  SUM(amount) as total,
  SUM(vat_amount) as total_vat
FROM expenses
WHERE date >= DATE_TRUNC('month', CURRENT_DATE)
AND is_overhead = false
GROUP BY type
ORDER BY total DESC;
```

---

## 🔧 Customization

### Add Custom Income Types

```sql
INSERT INTO income_types (name, description, default_vat_status, affects_vehicle_sale_price, sort_order)
VALUES ('referral_fee', 'Referral commission', 'exempt', FALSE, 8);
```

### Add Custom Expense Types

```sql
INSERT INTO expense_types (name, description, default_vat_status, sort_order)
VALUES ('software', 'Software subscriptions', 'standard', 14);
```

---

## 🎨 UI Pages

| Page | URL | Purpose |
|------|-----|---------|
| Expenses | `/files/expenses.html` | Manage all expenses |
| Income | `/files/income.html` | Track income and sales |
| Bank Movements | `/files/bank-movements.html` | Transfer between accounts |

All pages support:
- ✅ Filtering and search
- ✅ Date range selection
- ✅ Export capabilities
- ✅ Mobile responsive design

---

## 🔐 Data Integrity

### Automatic Triggers

1. **Vehicle Income Totals**
   - Automatically updates `cars.total_income`
   - Updates `cars.deposit_received`
   - Updates `cars.final_sale_price`

2. **Bank Balance Updates**
   - Automatically adjusts balances on transfers
   - Ensures data consistency

3. **Timestamp Updates**
   - Auto-updates `updated_at` on all changes

---

## 🐛 Troubleshooting

### Expenses not showing?
- Check `expenses` table (renamed from `transactions`)
- Verify `account_id` matches

### Income not updating vehicle sale price?
- Check `income_types` table
- Ensure `affects_vehicle_sale_price = TRUE` for deposits/purchases

### Bank transfer not updating balances?
- Check trigger is enabled
- Verify accounts exist
- Check for constraint violations

---

## 📝 Migration Notes

### From Transactions to Expenses

The migration automatically:
- ✅ Renames `transactions` to `expenses`
- ✅ Preserves all existing data
- ✅ Adds new VAT fields
- ✅ Calculates net/VAT for existing records
- ✅ Sets `is_overhead` based on `stock_id`

### Data Mapping

| Old Field | New Field | Notes |
|-----------|-----------|-------|
| `supplier` | `vendor_name` | Copied automatically |
| `notes` | `memo` | Copied automatically |
| `date` | `transaction_date` | Copied automatically |
| `stock_id` | `stock_id` | Preserved |
| - | `is_overhead` | Set based on stock_id |
| - | `vat_amount` | Calculated |
| - | `net_amount` | Calculated |

---

## ✅ Post-Setup Checklist

- [ ] Database migration completed
- [ ] All 5 tables created
- [ ] Existing expenses data preserved
- [ ] Expense types populated
- [ ] Income types populated
- [ ] Tested adding expense
- [ ] Tested adding income
- [ ] Tested bank transfer
- [ ] Tested SOR vehicle sale
- [ ] Verified balance updates

---

## 🎉 You're Ready!

Your new expense and income tracking system is ready to use. The system is:

- ✅ Simpler than QuickBooks integration
- ✅ More flexible for your workflow
- ✅ Fully manual control
- ✅ Automatic calculations
- ✅ Complete audit trail

**Start by:**
1. Adding your first expense
2. Recording some income
3. Trying a bank transfer

---

**Questions?** Check the SQL migration file for detailed schema information.

**Version**: 3.0  
**Last Updated**: January 2024
