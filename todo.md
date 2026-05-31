# Mobile Redesign TODO

## Bottom Nav Bar (5 items)
- Dashboard (home icon)
- Stock (car icon) 
- Transactions (arrow icon)
- Income (money in icon)
- More (hamburger/dots → opens slide-up menu)

## Hamburger/More Menu (slide-up overlay)
- Credit Lines
- P&L
- Balance Sheet
- Mileage Tracker
- Settings

## CSS Changes
1. `@media (max-width: 768px)` breakpoint for mobile
2. Hide sidebar entirely
3. Main content full width, no margin
4. Bottom nav bar fixed at bottom
5. Add top header bar with logo + optional hamburger
6. Tables: hide less important columns, show on row click (drawer)

## Table Column Visibility on Mobile
### Stock (Owned): Show Vehicle, Paid, Status. Hide: Advertised, Sold For, Direct Costs, VAT, Pre-Tax Profit
### Stock (SOR): Show Vehicle, Sale Price, Status. Hide: Fee, Costs, VAT, Pre-Tax Profit
### Transactions: Show Transaction, For, Amount. Hide: User, Account, Invoice
### Income: Show Date, Type, Amount. Hide: Vehicle, Description, VAT
### Mileage: Show Date, Miles, Claim. Hide: From, To, Purpose, Car, Driver, Return, Added By

## Implementation
- Add mobile CSS media queries
- Add bottom nav HTML after main-content
- Add mobile hamburger menu overlay HTML
- Add mobile header bar inside main-content
- Modify showTab to close mobile menu
- Add padding-bottom to main-content for bottom nav
- Ensure drawers/modals work on mobile (full-width)
