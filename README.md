# Pitch Money

The money view for [Pitch DMS](https://app.pitchdms.com). Same Supabase project, same login, no sync — every number is read live from the DMS tables through a set of financial views.

This repo used to be Fleet OS / Pierfront (a single 13k-line HTML file on its own Supabase project). That has been retired on the `pitch-money-v1` branch; git history has it if you ever need it.

## What it does (v1)

- **Dashboard** — estimated net position, cash in bank, capital tied up in stock, stock value, realised vs unrealised profit (30 / 90 / YTD / custom), "where has the money gone?", VAT and corporation-tax estimates.
- **Vehicles** — every car with stand-in cost, projected margin, realised profit, days in stock. Filters: in stock / sold / all, date range, search.
- **Vehicle detail** — full cost breakdown with who added what, add / edit / delete a cost, attach a receipt.
- **Snap receipt** — photo or PDF → Claude reads amount, date, supplier, type → pick the car → written into the DMS in one tap.
- **Ask AI** — natural-language questions answered from the live financial context (Claude), with conversation history per user.
- **Tax & export** — margin-scheme VAT and corporation-tax estimates with editable assumptions, and a CSV export for the accountant.
- **Activity** — feed of costs, sales, overheads and stock arrivals.

## Stack

Next.js 14 (App Router) · TypeScript · Tailwind (Pitch DMS "fleet" tokens) · `@supabase/ssr` · Anthropic SDK. Deployed on Vercel (region `arn1`, same as the DMS).

## Data layer (all in the `pitch` Supabase project)

Migration: `supabase/migrations/20260921_pitch_money_v1.sql` (already applied).

| Object | Purpose |
| --- | --- |
| `v_vehicle_financials` | One row per vehicle: purchase price, total costs, stand-in cost, sale/advertised price, margin-scheme VAT, realised & projected profit, days in stock. Formulas mirror `src/lib/finance/pnl.ts` + `vat.ts` in the DMS. |
| `v_cost_lines` | Every `vehicle_costs` row joined with the mirrored `expenses` row (for creator + receipt). |
| `v_overheads` | Non-vehicle expenses. |
| `v_activity` | Union feed of costs / sales / overheads / stock-in. |
| `pm_dashboard(dealership)` | Headline numbers + "where the money went". Uses the DMS's `v_account_balance` for cash. |
| `pm_period_summary(start, end, dealership)` | Realised P&L, overheads, VAT and corp-tax estimate for a range. |
| `pm_add_vehicle_cost` / `pm_update_vehicle_cost` / `pm_delete_vehicle_cost` | Write the **same two rows the DMS writes** (`vehicle_costs` + `expenses` mirror) so both apps agree. |
| `ai_conversations` | Chat history (RLS: own rows only). |
| `pm_tax_assumptions` | Editable corp-tax / VAT rate per dealership. |

Every view and RPC is scoped inside Postgres by `pm_user_dealership_ids()` (active rows in `dealership_users`), so a user can only ever see their own dealership(s).

Receipts go to the DMS's existing public `invoices` bucket under `expenses/<dealership>/…`, exactly like the DMS's own expense upload, so they show in both apps.

## Running locally

```bash
cp .env.example .env.local   # fill in the keys
npm install
npm run dev                  # http://localhost:3100
```

Environment variables:

| Name | Where |
| --- | --- |
| `NEXT_PUBLIC_SUPABASE_URL` / `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Same values as the Pitch DMS project |
| `SUPABASE_SERVICE_ROLE_KEY` | Server-only; receipt uploads |
| `ANTHROPIC_API_KEY` (+ optional `ANTHROPIC_MODEL`) | AI assistant + receipt reading |
| `NEXT_PUBLIC_DMS_URL` | Links back to the DMS |
| `AUTH_COOKIE_DOMAIN` / `NEXT_PUBLIC_AUTH_COOKIE_DOMAIN` | Optional. Set both apps to `.pitchdms.com` for true single sign-on across subdomains (see below). |

## Shared login

Both apps use the same Supabase Auth project, so the same email/password works in each. Sessions are stored in cookies per hostname, so today you sign in once per app. To make one login carry across `app.pitchdms.com` and `money.pitchdms.com`, set the cookie domain to `.pitchdms.com` in **both** apps (`AUTH_COOKIE_DOMAIN` here; in the DMS pass `cookieOptions: { domain: '.pitchdms.com' }` to `createBrowserClient` / `createServerClient`).

## Roles

`dealership_users.role` → Pitch Money role: `owner`/`admin` → owner, `manager` → manager, `sales`/`member` → sales, anything else → viewer (read-only). Tax pages are owner/manager only; viewers can't add costs.

## Not in v1 (on purpose)

Double-entry ledger, bank feeds, QuickBooks/Xero two-way sync, multi-branch consolidation, native apps. Marking a car as sold stays in the DMS (deals/invoices live there); the vehicle page links straight to it.
