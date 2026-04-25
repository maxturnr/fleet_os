# 🚗 Vehicle Purchase Feature - LIVE!

## 🎉 What's New

**New transaction type: Vehicle Purchase**

Automatically sets the purchase price for a car and handles auction fees separately - matches your bank statement perfectly!

## 🚀 Live Now

**https://fleet-os-nine.vercel.app**

## ✨ How to Use

### Logging a Vehicle Purchase:

1. **Click "Log a Cost"**
2. **Select "Vehicle Purchase"** from Cost Type dropdown
3. **Auction Fee field appears** automatically
4. **Fill in details:**
   - **Date:** Purchase date
   - **Amount:** Total bank transaction (vehicle + auction fee)
   - **Supplier:** Auction house or dealer
   - **Assign to Stock:** Select the vehicle
   - **Auction Fee:** Enter auction fee (if applicable)
   - VAT, Payment Method, Notes

5. **Click "Save"**

### What Happens:

**Example: £5,000 total bank transaction**
- Vehicle price: £4,700
- Auction fee: £300
- Total: £5,000 ✅

**System creates:**
1. **Vehicle Purchase transaction** for £5,000
2. **Sets car's purchase price** to £4,700 (£5,000 - £300)
3. **Updates purchase date** on the car
4. **Creates separate "Auction Fee" transaction** for £300

**Result:**
- ✅ Bank statement matches (£5,000 total)
- ✅ Car shows correct purchase price (£4,700)
- ✅ Auction fee tracked separately (£300)
- ✅ All costs assigned to the vehicle

## 🎯 Features

### Automatic Updates:
- **Purchase price** set on car record
- **Purchase date** updated
- **Auction fee** tracked separately
- **All in one transaction**

### Smart Validation:
- Must select a vehicle for Vehicle Purchase
- Can't save without assigning to stock
- Auction fee is optional (leave blank if none)

### Bank Statement Match:
- Enter total amount from bank
- System splits vehicle price and auction fee
- Perfect reconciliation

## 💡 Use Cases

**Buying from Auction:**
- Total payment: £8,500
- Vehicle: £8,000
- Auction fee: £500
- ✅ One transaction, all tracked correctly

**Private Purchase (no auction fee):**
- Total payment: £6,000
- Vehicle: £6,000
- Auction fee: (leave blank)
- ✅ Simple purchase, no extra fees

**Dealer Purchase with Admin Fee:**
- Total payment: £12,300
- Vehicle: £12,000
- Admin fee: £300 (use auction fee field)
- ✅ Works for any purchase fee

## 📊 Reporting

### In Transactions List:
- Shows "Vehicle Purchase" transaction
- Shows "Auction Fee" transaction (if applicable)
- Both assigned to the vehicle

### In Stock View:
- Purchase price shows correctly
- Direct costs include auction fee
- P&L calculations accurate

### In P&L:
- Vehicle purchase cost tracked
- Auction fees tracked
- Total investment per vehicle clear

## 🔧 Technical Details

**Transaction Types:**
- `Vehicle Purchase` - Main purchase transaction
- `Auction Fee` - Auto-created for auction fees

**Car Updates:**
- `paid` field set to (amount - auction fee)
- `purchase_date` set to transaction date

**Validation:**
- Vehicle Purchase requires stock assignment
- Amount must be > 0
- Auction fee optional (defaults to 0)

## ⚡ Quick Tips

1. **Always select the vehicle** before saving
2. **Enter total bank amount** in Amount field
3. **Add auction fee** if applicable
4. **System does the math** automatically
5. **Check stock record** to verify purchase price

**Perfect for auction purchases and dealer fees!** 🚗✨
