# Fleet OS: Full App Architecture, Brand System, Data Model, Financial Logic, and How Everything Fits Together

## What Fleet OS Is

Fleet OS is a dealership operations web app built primarily as a single-page application in [`files/FleetOS_v3.html`](/Users/maxturner/Library/Mobile%20Documents/com~apple~CloudDocs/Documents/THG/Fleet%20OS/files/FleetOS_v3.html). It is designed for a used-car business that needs to track stock, sale-or-return cars, expenses, income, bank balances, VAT position, supplier credit, mileage claims, balance sheet exposure, and optional QuickBooks connectivity.

Architecturally, it is not a React or Next.js app. The core product is a large vanilla HTML, CSS, and JavaScript document backed directly by Supabase. Around that core, the repo also contains:

- Serverless endpoints for Google Maps distance and address lookup in `api/`
- Netlify functions for QuickBooks OAuth, webhooks, and balance sync in `netlify/functions/`
- Supabase Edge Functions for an alternative QuickBooks path in `supabase/functions/`
- SQL migrations and one-off setup scripts in `files/` and `supabase/migrations/`
- A lightweight iOS wrapper app in [`fleet ios app/`](/Users/maxturner/Library/Mobile%20Documents/com~apple~CloudDocs/Documents/THG/Fleet%20OS/fleet%20ios%20app)

The important thing to understand is that Fleet OS is operational software first and a polished framework-driven product second. Its design is intentional and distinctive, but its engineering model is pragmatic: one big client, direct Supabase reads and writes, and supporting scripts/functions around it.

## The Product Model in One Sentence

Fleet OS treats the dealership as a financial machine made of vehicles, money in, money out, liabilities, and tax exposure. Every feature exists to answer one of four questions:

1. What stock do we have?
2. What has it cost us?
3. What have we sold and earned?
4. What is the true current financial position of the business?

That is why the app is organized around owned stock, SOR stock, expenses, income, bank movements, P&L, balance sheet, VAT settings, and mileage.

## Brand Name and Product Identity

The brand name throughout the web app is **FleetOS**.

The visual tone is not generic SaaS. It aims for a premium dealer-finance console:

- Dark background
- Metallic gold as the primary accent
- Purple reserved for SOR-specific flows
- Monospace labels for operational UI
- Large editorial display type for headings and KPI emphasis

This gives the app a feeling closer to an internal trading desk or luxury inventory system than a soft consumer dashboard.

## Fonts and Typography System

The main app imports three Google Fonts:

- `Syne`
- `DM Mono`
- `Instrument Sans`

They are used with a very deliberate hierarchy:

### `Syne`

Used for:

- The FleetOS wordmark
- Major page titles
- Large KPI values
- Important metric cards

Why it matters:
`Syne` gives the product a sharper editorial identity. It is the most visibly “brand” font in the interface.

### `DM Mono`

Used for:

- Navigation labels
- Section headings
- Tiny status and metadata labels
- Numbers and finance-oriented microcopy
- Reg/stock badges and compact operational labels

Why it matters:
`DM Mono` signals control, precision, admin tooling, and system state. It makes the app feel like an operational instrument rather than a lifestyle product.

### `Instrument Sans`

Used for:

- Default body text
- Inputs
- Table values
- Form controls

Why it matters:
It keeps the dense interface readable and modern while allowing the display and mono fonts to do the branding and structure work.

## Color System

The main color tokens are defined in CSS custom properties in `:root`.

### Base surfaces

- `--bg: #080808`
- `--surface: #101010`
- `--surface2: #161616`
- `--surface3: #1e1e1e`
- `--border: #222`
- `--border2: #2a2a2a`

These create the layered dark shell of the app.

### Primary brand colors

- `--gold: #c9a84c`
- `--gold2: #e8d08a`
- `--gold-dim: rgba(201,168,76,0.12)`

Gold is the app’s signature color. It marks the product identity, primary actions, premium KPIs, and “important but not error” states.

### Text colors

- `--white: #f0ebe0`
- `--muted: #555`
- `--muted2: #888`

The off-white keeps the UI from looking harsh on the dark background.

### Semantic colors

- `--green: #2ecc71` for positive outcomes and money in
- `--red: #e74c3c` for losses, liabilities, overdue items, and destructive actions
- `--blue: #3498db` for informational states and bank-transfer/doc interactions
- `--purple: #9b59b6` for SOR-specific identity

Purple is especially important because the app visually separates **owned stock** from **sale-or-return stock** as two fundamentally different business models.

## Design Language and UI Structure

The app uses a left sidebar shell with a tabbed single-page layout. There is no route-per-screen architecture in the main app. Instead, the DOM contains multiple tab panels, and the app toggles visibility with `showTab()` and `renderCurrentTab()`.

Main navigation tabs:

- Dashboard
- Owned Stock
- Sale or Return
- Expenses
- Credit Lines
- Income
- Bank Movements
- Overall P&L
- Balance Sheet
- Mileage Tracker
- Settings

There is also legacy support for a `transactions` tab in the JavaScript, but it is not exposed in the current sidebar. That matters because the codebase still carries earlier transaction-oriented workflows while the live UI has shifted toward the richer `expenses` and `income` model.

## Hosting and Deployment Model

The project is configured so the `files/` directory is the deployable web root.

### Netlify

In [`netlify.toml`](/Users/maxturner/Library/Mobile%20Documents/com~apple~CloudDocs/Documents/THG/Fleet%20OS/netlify.toml):

- `publish = "files"`
- `functions = "netlify/functions"`
- `/` rewrites to `/FleetOS_v3.html`
- catch-all also rewrites to `/FleetOS_v3.html`

This means the app is effectively a static SPA with Netlify Functions attached.

### Vercel

In [`vercel.json`](/Users/maxturner/Library/Mobile%20Documents/com~apple~CloudDocs/Documents/THG/Fleet%20OS/vercel.json):

- there is no build step
- output directory is `files`
- rewrites also point everything to `FleetOS_v3.html`

The repo therefore supports both Netlify-style and Vercel-style deployment patterns.

## Core Runtime Architecture

The main runtime model is:

1. Load HTML/CSS/JS from `files/FleetOS_v3.html`
2. Create a Supabase client in-browser with the anon key
3. Use Supabase Auth for login/session restore
4. Resolve the logged-in user to a dealership account in the `accounts` table
5. Load all account-scoped dealership data into in-memory arrays
6. Render the current tab from those arrays
7. Write mutations directly back to Supabase tables and storage

This is a thick-client architecture. Most business logic is in the browser, not on a custom backend.

## Authentication and Account Model

Fleet OS currently uses **Supabase Auth** for login, but the operational business identity is an **account/dealership record** in the `accounts` table.

### Login flow

The browser calls:

- `sb.auth.signInWithPassword(...)`

Then it looks up an active `accounts` row where:

- `user_id = authData.user.id`
- `active = true`

That account record is used to populate:

- `currentUser`
- `accountId`
- `userRole`

So the real access model is:

- Supabase Auth proves identity
- `accounts` defines dealership membership and role context

### Session restore

On page load, `checkAuth()` calls:

- `sb.auth.getSession()`

If a valid session exists, it repeats the `accounts` lookup and restores the app without showing the login screen.

### Local persistence

The app stores some client state in protected wrappers over `localStorage` and `sessionStorage`, including:

- current user object
- current tab
- sidebar collapsed state
- temporary QuickBooks OAuth state

The wrappers are deliberately defensive so the app can still function if storage access fails.

## Multi-User and Dealership Structure

The repo contains both older and newer account models, which is important to state honestly.

### Current practical model in the main app

The app expects:

- one primary dealership account row
- one or more associated users surfaced through `get_dealership_users`
- role values such as `admin`, `user`, `viewer`

Admin-only UI in Settings exposes:

- dealership information
- team member list
- invite-user flow

### How the invite flow works

The current UI does **not** fully provision auth users automatically. Instead, `inviteUser()`:

1. creates a placeholder `accounts` row for the invited person
2. marks it `active: false`
3. stores invite metadata
4. inserts a linking row into `dealership_users`
5. instructs the operator, via toast, to create the actual auth user in Supabase Dashboard

So invitation is partially implemented. It models the business relationship in the database, but final auth-user provisioning is still manual.

### Why this matters

Fleet OS is already multi-user in concept and mostly multi-user in data shape, but not yet fully automated end-to-end in account provisioning.

## Supabase as the System Backbone

Supabase is the central platform for:

- authentication
- PostgreSQL data storage
- RPC functions
- file storage
- optional Edge Functions

The main app depends on direct browser access to Supabase tables. This is why many migrations explicitly disable RLS: the current architecture expects the frontend to write directly without a heavy API layer.

## Main Data Domains

The app is financially centered, so the schema is organized around operational records rather than abstract domain entities.

### `accounts`

Represents the dealership or account context.

Used for:

- dealership identity
- user linkage
- active/inactive status
- profile fields
- role fields

### `cars`

The most important domain table for stock.

Used for both:

- owned cars
- sale-or-return cars

Key fields include:

- `type`
- `stock_number`
- `reg`
- `make`
- `model`
- `paid`
- `purchase_date`
- `advertised`
- `sold`
- `status`
- `owner_name`
- `min_price`
- `sale_price`
- `received_date`
- `fee`
- `fee_vat`
- `deposit_amount`
- `deposit_date`
- `handover_date`
- `purchase_vat_type`
- `owner_payout_amount`
- `owner_payout_date`
- `owner_payout_account_id`

This table is where Fleet OS collapses stock tracking and much of the vehicle lifecycle into one operational record.

### `expenses`

This is effectively the evolved version of the older `transactions` model.

Used for:

- vehicle prep costs
- overhead
- purchases
- refunds
- supplier bills
- credit-line items

Important fields include:

- `type`
- `supplier`
- `amount`
- `net_amount`
- `vat_amount`
- `vat_status`
- `stock_id`
- `is_overhead`
- `bank_account_id`
- `payment_status`
- `due_date`
- `paid_date`
- `refund_amount`
- `refund_date`
- `credit_reference`

### `income`

Tracks money in, including:

- deposits
- vehicle purchases/completion money
- delivery income
- warranties
- services
- accessories
- finance commission
- other upsells

Important fields include:

- `type`
- `amount`
- `net_amount`
- `vat_amount`
- `vat_status`
- `stock_id`
- `is_general`
- `bank_account_id`
- `payment_method`
- `reference`
- `description`
- `receipt_url`

It also carries SOR-specific payout fields:

- `is_sale_or_return`
- `owner_payout_amount`
- `owner_payout_date`
- `owner_payout_account_id`

### `bank_accounts`

Stores dealership-controlled bank accounts.

Used for:

- default payment sources
- balance tracking
- settlement of credit expenses
- owner payout references
- general bank visibility in Settings and Balance Sheet

### `bank_movements`

Represents transfers between bank accounts.

Used for:

- moving money internally
- tracking why balances shifted

### `balance_sheet`

Stores manual balance-sheet-side adjustments, such as:

- debtors
- parts owed
- mechanics owed
- other liabilities

It works alongside auto-calculated values rather than replacing them.

### `mileage_trips`

Tracks business mileage and reimbursement claims.

Important fields include:

- `trip_date`
- `start_address`
- `start_postcode`
- `end_address`
- `end_postcode`
- `purpose`
- `car_id`
- `car_notes`
- `distance_miles`
- `is_return_journey`
- `rate_per_mile`
- `total_claim`

### `transaction_splits`

Lets one cost be allocated across multiple vehicles.

This matters because dealership costs are often shared or ambiguous at the moment they are paid.

### `transaction_documents`

Stores uploaded files linked to expenses/transactions, such as:

- invoices
- receipts
- images
- PDFs

### `settings`

A key-value table used for operational flags like:

- `vat_registered`
- `vat_effective_date`
- `qb_connected`

## Load Strategy: How the App Builds Its In-Memory World

The `loadAll()` function is the heart of the app.

When a user is authenticated, it loads in parallel:

- owned cars
- SOR cars
- expenses
- income
- transaction splits
- bank accounts
- balance sheet row
- settings
- transaction documents
- mileage trips
- dealership users via RPC

Those results are stored in browser arrays such as:

- `ownedCars`
- `sorCars`
- `transactions`
- `expenses`
- `income`
- `transactionSplits`
- `bankAccounts`
- `mileageTrips`
- `dealershipUsers`

Then the app renders whichever tab is active.

This means Fleet OS behaves like a mini client-side state container without a framework. The “store” is just plain JavaScript arrays.

## Owned Stock: How It Works

Owned stock is the core dealership inventory model.

### Business logic

Owned cars are vehicles the business has actually bought and therefore put capital into. They matter in three different ways:

1. They consume cash
2. They accumulate prep cost
3. They count as assets until sold

### Owned car fields that matter most

- `paid`: acquisition cost
- `advertised`: current advertised value
- `sold`: realized sale value
- `deposit_amount`
- `deposit_date`
- `handover_date`
- `purchase_vat_type`
- `status`

### Status model

Owned stock statuses:

- `In Stock`
- `Deposited`
- `Sold`
- `Part Exchange`

### Derived logic

For each owned car, the app calculates:

- direct costs
- reclaimable VAT on eligible costs
- VAT due on sale/margin
- gross/pre-tax profit
- corporation tax estimate
- net profit
- net gain percentage
- lifecycle timings such as days to advertise, deposit, and handover

### Lifecycle syncing from income

Owned cars are also synchronized from the `income` table:

- deposit rows update `deposit_amount` and `deposit_date`
- purchase rows can define handover/completion timing
- total vehicle sale income can auto-sync `sold`

This is a strong example of the app’s philosophy: the `cars` table is not isolated. It is continuously enriched by linked financial records.

## Sale or Return (SOR): How It Works

SOR cars are not owned by the dealership. That distinction changes everything financially.

### Business meaning

For SOR:

- the car is not a dealership asset
- the dealership does not carry the purchase price as working capital
- the business earns a retained fee or commission
- direct prep costs can still hit the dealership

### Why the app gives SOR a separate identity

SOR uses:

- purple visual language
- separate table tab
- different P&L treatment
- different balance-sheet treatment

### Key SOR fields

- `owner_name`
- `min_price`
- `sale_price`
- `fee`
- `fee_vat`
- `owner_payout_amount`
- `owner_payout_date`
- `owner_payout_account_id`

### Financial model

The app calculates:

- gross retained fee
- fee VAT treatment
- net fee
- direct prep costs
- extra income
- pre-tax profit
- after-tax profit

SOR cars are intentionally excluded from balance-sheet stock assets.

## Expenses and Cost Tracking

The `Expenses` tab is the main cost engine of the app.

### What counts as an expense

The current UI supports types such as:

- purchase
- parts
- mechanics
- bodywork
- valeting
- MOT
- warranty
- tax
- fuel
- advertising
- other

### Expense assignment model

Each expense can be:

- linked to a vehicle via `stock_id`
- marked overhead if no vehicle is linked

This distinction is crucial because:

- vehicle-linked costs flow into unit economics
- overhead flows into business-level P&L

### Payment model

An expense can be:

- paid immediately from a bank account
- put on supplier credit

If on credit, it becomes part of a vendor credit line until settled.

### Refund handling

Each expense can carry:

- `refund_amount`
- `refund_date`

The UI and calculations use **net expense after refund**, not simple headline amount.

## Credit Lines

Credit Lines is essentially a filtered and grouped view over expenses whose `payment_status` is `credit`.

### What it does

It groups outstanding credit expenses by supplier and shows:

- grouped vendor exposure
- oldest due date
- total outstanding amount
- underlying expense rows

### Why it matters

This feature turns unpaid expenses into a real liabilities view rather than leaving them hidden inside raw cost logs.

It also feeds balance-sheet liability logic through `getOutstandingCreditTotal()`.

## Income Tracking

The `Income` tab captures money in.

### Supported types

- deposit
- purchase
- delivery
- upsell_warranty
- upsell_service
- upsell_accessories
- upsell_other
- finance_commission
- other

### Core design principle

Fleet OS separates:

- vehicle sale money
- extra deal income
- general business income

This allows the app to build both:

- unit economics per car
- wider business-level P&L

### SOR-specific income behavior

If the income row is a SOR vehicle purchase/completion payment, the UI can also capture:

- owner payout amount
- owner payout account

The app then computes retained commission based on gross collected minus owner payout.

## Bank Accounts and Cash Movement

The app has a fully explicit bank-account model.

### Bank accounts

Users can create multiple bank accounts with:

- name
- type
- balance
- account number
- sort code
- default flag

### Balance mutation rules

Fleet OS updates bank balances when:

- expenses are created or edited
- income is created or edited
- owner payouts are recorded
- credit expenses are settled

That reconciliation is done in client code through helpers like:

- `applyBankBalanceDelta`
- `reconcileExpenseBankBalance`
- `reconcileIncomeBankBalance`
- `reconcileSorOwnerPayout`

### Important architectural point

Balances are not recomputed from a ledger every render. They are stored and incrementally adjusted. That is operationally convenient, but it means correctness depends on mutation flows being accurate.

### Bank movements

Bank-to-bank transfers are recorded separately in `bank_movements`, preserving the reason and reference for internal cash movement.

## Document Uploads and File Storage

Fleet OS supports document uploads for expenses/transactions and invoice uploads for income.

### Storage model

Files are uploaded to the Supabase Storage bucket:

- `transaction-documents`

The metadata is stored in:

- `transaction_documents`

### File types

The UI accepts:

- images
- PDFs
- common document formats in some flows

### How it works

1. User selects or captures file
2. Browser uploads file to Supabase Storage
3. App inserts metadata row into `transaction_documents` or updates `income.receipt_url`
4. UI renders view/download links

### Why this is useful

It makes the financial record auditable. Costs and income are not just numbers; they can be backed by actual receipts and invoices.

## Mileage Tracker and Maps Integration

The mileage feature exists to track reclaimable business mileage.

### Flow

1. User enters start and destination addresses
2. Browser queries `/api/autocomplete`
3. Browser resolves selected place via `/api/place-details`
4. Browser calculates driving distance via `/api/distance`
5. If Google Maps is unavailable, it falls back to straight-line distance
6. Claim preview is computed at 45p per mile

### Important detail

The app’s UI text and logic use **45p per mile** flat for now.

That is operationally simple, but it does not implement the full higher/lower HMRC threshold model across total yearly mileage. The repository docs explicitly note this as a simplification.

### Why mileage exists in a dealership app

Because dealership operations generate frequent business travel:

- collections
- deliveries
- supplier runs
- bank trips
- vehicle movement

Fleet OS treats this as part of real business profitability, not as an external accountant-only concern.

## Dashboard: What It Summarizes

The Dashboard is the operational headline layer.

It gives:

- KPI summaries
- profit chart
- stock overview
- recent transactions

Its job is not to expose every field. Its job is to compress the current business state into an at-a-glance briefing.

## Profit and Loss Logic

The P&L screen is one of the most opinionated parts of the whole app.

Its central accounting idea is:

**Only sold cars belong in the true P&L. Unsold owned stock is working capital, not a realized loss.**

That principle shapes the whole calculation model.

### Owned-car P&L

For sold owned cars, the app uses:

- sale revenue
- extra income
- buy cost
- direct prep cost
- sale VAT due
- reclaimable VAT

The owned-car profit formula is effectively:

`sale price + extra income net - buy cost - direct costs - net VAT`

### SOR P&L

For sold SOR cars, the app uses:

- net retained fee
- extra income
- direct costs

The app does not treat the whole sale value as dealership revenue because the vehicle is not owned stock.

### Overhead

Any expense with no `stock_id` is overhead and reduces business-level P&L rather than vehicle-level margin.

### Mileage

Mileage refunds due back to the business are added as a positive adjustment in period P&L.

### Corporation tax

The app estimates corporation tax at:

- `19%`

and then shows net profit after tax.

### Dividends

Dividend-type transactions are separated from operating costs and shown after net profit, allowing retained profit to be surfaced.

## Balance Sheet Logic

The Balance Sheet page translates operational activity into business position.

### Assets

The asset side includes:

- bank balances
- current stock value
- debtors
- mileage refunds due
- VAT reclaim due

### Liabilities

Liabilities include:

- parts owed
- mechanics owed
- vendor credit lines
- corporation tax reserve
- VAT owed
- other liabilities

### Net worth

The app then calculates:

`total assets - total liabilities`

to show business net worth.

### Key conceptual rule

Owned stock is included as an asset.

SOR stock is not.

That is one of the cleanest and most important distinctions in the whole system.

## VAT: How It Actually Works

The VAT system in Fleet OS is more nuanced than a simple on/off toggle.

Two global settings matter:

- `vat_registered`
- `vat_effective_date`

These are stored in the `settings` table and surfaced in Settings and the sidebar VAT badge.

### `isVatActiveOn(date)`

This helper is the gatekeeper for VAT behavior.

Its logic is:

- if not VAT registered, VAT is inactive
- if there is no effective date, VAT applies immediately when registration is on
- if there is an effective date, VAT logic only applies on or after that date

### Why the VAT effective date matters

This allows the dealership to keep historical pre-registration records in the same system without incorrectly applying VAT rules to old trades.

So the effective date does not just decorate the settings screen. It actively controls:

- income VAT treatment
- expense VAT reclaim behavior
- owned-stock purchase reclaim logic
- owned-stock sale VAT logic
- SOR fee VAT logic
- overall VAT position calculations

## VAT on Owned Cars

Owned cars support two purchase-side VAT modes:

- `margin`
- `standard`

### Purchase side

If an owned vehicle purchase is:

- `standard`, and VAT is active on the purchase date, the app can reclaim input VAT from the purchase amount
- `margin`, there is no purchase VAT reclaim

### Sale side

For owned cars:

- if the VAT type is `standard`, the app prefers explicit standard VAT from linked income rows; otherwise it falls back to `salePrice * 0.20`
- if the VAT type is `margin`, VAT due is calculated as `max(0, salePrice - paid) / 6`

That `/6` logic is the classic VAT-on-margin shorthand for 20% VAT embedded within the margin.

### Net VAT effect on owned-car profitability

Owned car profit does not simply subtract headline sale VAT. It subtracts:

- sale VAT due
- minus reclaimable VAT on eligible direct costs

That produces a **net VAT position** per vehicle.

## VAT on Expenses

Expenses normalize VAT status to one of:

- `standard`
- `margin`
- `no-vat`

The app then uses `getVatComponents()`:

- `standard` means amount is treated as VAT-inclusive and net is `amount / 1.20`
- all other statuses currently return full amount as net and zero VAT

Operationally, that means Fleet OS is opinionated and simplified:

- standard VAT gets explicit net/VAT split
- margin/no-vat are tracked, but only standard drives explicit reclaim math through `getVatComponents()`

## VAT on SOR

SOR fee VAT is modeled separately with:

- `none`
- `inclusive`
- `additional`

### Inclusive

The fee includes VAT, so net fee is `fee / 1.2`, and VAT due is the embedded difference.

### Additional

The fee is treated as fee plus VAT. The net fee remains the fee, and VAT due is calculated on top.

### None

No VAT due on fee.

This is the right conceptual split for commission-style work.

## VAT Breakdown Across the Business

The app’s `getVatBreakdown(from, to)` function assembles the period VAT position from multiple sources:

### VAT due

- standard VAT on qualifying income
- margin VAT on sold owned cars
- SOR fee VAT

### VAT reclaim

- reclaimable VAT on owned purchases with standard VAT
- reclaimable VAT on qualifying standard-rated expenses

### Final business VAT position

`netVatDue = incomeVatDue - totalVatReclaim`

This feeds both:

- the P&L presentation
- the Balance Sheet’s VAT asset/liability treatment

## QuickBooks Integration: Intended Architecture

The repo contains a substantial QuickBooks integration layer.

### Main goals

- connect a dealership account to QuickBooks Online
- store OAuth tokens securely server-side
- receive webhook events
- fetch changed entities from QuickBooks
- normalize them into Fleet OS transaction records
- prompt the user to assign them to vehicles or overhead

### Data model

The QuickBooks integration adds tables such as:

- `quickbooks_connections`
- `financial_accounts`
- `webhook_events`
- `notifications`
- `sync_jobs`
- `transaction_categories`

### OAuth flow via Netlify

Netlify functions provide:

- `qb-connect.ts`: starts OAuth
- `qb-callback.ts`: exchanges code, fetches company info, stores tokens
- `qb-sync-balances.ts`: syncs bank balances
- `qb-webhook.ts`: receives signed webhook events

### QuickBooks service layer

[`services/quickbooks.ts`](/Users/maxturner/Library/Mobile%20Documents/com~apple~CloudDocs/Documents/THG/Fleet%20OS/services/quickbooks.ts) handles:

- token refresh
- API requests
- fetching purchases, expenses, bills, deposits, bank accounts
- normalizing QB data into app transactions

### Webhook path

1. QuickBooks sends webhook to serverless endpoint
2. Signature is verified
3. Realm is mapped to dealership account
4. Raw event is saved in `webhook_events`
5. Supported entities are fetched from QB API
6. Data is normalized and upserted
7. Unassigned items trigger notifications

### Important implementation reality

There are two overlapping QuickBooks approaches in the repo:

- a more complete Netlify/server-side service architecture
- an older/lightweight Supabase Edge Function path used directly from the browser in `FleetOS_v3.html`

The frontend currently calls a Supabase function endpoint for QB auth exchange, while the repo also contains a fuller Netlify OAuth flow. So QuickBooks support is real, but the integration surface has some duplication and evolution still visible in the codebase.

## Google Maps and Address APIs

The app uses serverless APIs in `api/` to keep the Google Maps key out of the browser:

- `api/autocomplete.js`
- `api/place-details.js`
- `api/distance.js`

These support:

- address autocomplete
- place lookup for coordinates
- driving-distance calculation

If `GOOGLE_MAPS_API_KEY` is absent or the API fails, the distance endpoint falls back to a Haversine straight-line calculation.

That gives the feature resilience even in incomplete deployments.

## iOS App Relationship

The iOS app is not a separate native product implementation. It is a SwiftUI shell around the live web app loaded in a `WKWebView`.

This means:

- the iOS app inherits web functionality
- product behavior remains aligned across platforms
- the web app remains the source of truth

So when documenting “the app,” the web app is the real product and the iOS wrapper is just a delivery shell.

## Notable Architectural Strengths

### Strong domain focus

The app is unusually specific about dealership financial reality. It clearly distinguishes:

- owned versus SOR stock
- realized profit versus working capital
- overhead versus unit costs
- bank balance versus paper profit

### Fast iteration model

Because the browser writes directly to Supabase, features can be added quickly without building a large custom backend.

### High operational visibility

The app does not hide finance logic. It surfaces:

- tax
- VAT
- liabilities
- deposits
- owner payouts
- vendor credit

That is a major product strength.

## Notable Architectural Tradeoffs

### Large single-file frontend

Most business logic lives in one large HTML file. That makes iteration fast, but long-term maintainability and testability are harder.

### Direct client writes

Because the browser writes directly to Supabase, correctness and security depend heavily on schema discipline and eventual RLS hardening.

### Incremental balance mutation

Bank balances are adjusted by mutation flows rather than rebuilt from a ledger each time. That is efficient, but can drift if an edge case is missed.

### Evolving schema history

The repo shows multiple generations of migrations and partial transitions:

- `transactions` to `expenses`
- custom users to Supabase Auth
- older and newer QuickBooks approaches

This is normal for a working internal product, but it is part of the real architecture.

## The Best Way to Understand How It All Fits Together

Fleet OS is a dealership finance operating system built around one unifying model:

- cars are inventory or consignment units
- expenses are money out
- income is money in
- bank accounts are current liquidity
- VAT and corporation tax are obligations created by trading
- balance sheet is the current business position after combining all of the above

From that perspective:

- **Owned Stock** explains capital deployed and unit profit
- **SOR** explains fee-based consignment profit
- **Expenses** explain operational and prep cost
- **Credit Lines** explain deferred supplier liabilities
- **Income** explains cash received and deal extras
- **Bank Movements** explain internal cash repositioning
- **P&L** explains realized performance
- **Balance Sheet** explains current business strength and exposure
- **Mileage** captures recoverable business-use travel value
- **Settings** controls VAT regime, users, and bank account structure
- **Supabase** stores and synchronizes everything
- **QuickBooks** is the intended external accounting sync layer

That is the whole system in one sentence:

**Fleet OS turns dealership operations into a continuously updated financial picture, with the vehicle as the central unit and the dealership account as the container around it.**

## Final Assessment

Fleet OS is not a generic stock tracker and not just an accounting dashboard. It is a purpose-built dealership operating model expressed as a web app. Its strongest idea is that profitability is not one number at month end; it is the interaction between stock, prep, sales, deposits, VAT, tax, liabilities, and cash movement at every stage of the vehicle lifecycle.

The branding, typography, and dark premium UI give that model a clear identity. Supabase gives it a direct and fast data backbone. The accounting logic, especially around owned versus SOR stock and VAT-effective-date behavior, is what makes it a real operating system rather than just a CRUD tool.

If you want, the next useful follow-up would be a second markdown file that breaks this essay into:

- screen-by-screen documentation
- table-by-table database documentation
- or an onboarding guide for a new developer inheriting the codebase
