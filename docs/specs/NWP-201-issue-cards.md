# NWP-201 · Issue virtual cards from the console — implementation spec

Ticket: `docs/tickets/NWP-201.md` · Branch: `NWP-201-issue-cards`

## Current state

There is no cards code in this repository today. `src/app/` has `overview/`,
`payments/`, `disputes/`, and `payouts/`; there is no `cards/` route and no
`src/app/api/cards/`. `merchant-console/CLAUDE.md` says as much: "Cards is
NWP-201 and does not exist yet."

What already exists and must be reused rather than rebuilt:

| Existing | Where | Why it matters here |
| --- | --- | --- |
| In-memory store on `globalThis` | `src/data/store.ts:34` | Cards join it as another array. No DB — persistence is NWP-203 |
| Merchants, each with a `currency` | `src/data/merchants.ts:7` | Every merchant already declares USD/GBP/EUR. A card's currency must agree |
| `formatMoney(minorUnits, currency)` | `src/lib/money.ts:15` | The only place a decimal point appears. Do not write a second formatter |
| `Currency` union, `Merchant`, `Payment` | `src/data/types.ts:1` | `Card` extends this file rather than starting a new one |
| Payment query builder | `src/data/queries.ts:45` | Spend is derived from real payments through this, not invented |
| Drawer (Radix dialog) | `src/components/Drawer.tsx` | There is no `Dialog.tsx` despite what `.claude/rules/components.md` implies |
| Table, Button, Input, Select, Badge | `src/components/` | The list and form are built from these |

## Domain rules this must respect

From `merchant-console/CLAUDE.md` and `.claude/rules/`:

1. **Money is integer minor units.** A $250.00 limit is `25000`. Formatted once,
   at the edge, next to its currency code.
2. **Storage and bucketing are UTC.** `createdAt` is an ISO UTC string, matching
   `Payment.createdAt`.
3. **Validate on the server.** Merchant, limit, currency, and status transitions
   are checked in the route handler against an allowlist. Client checks are a
   convenience, never the enforcement.
4. **Card numbers.** Generated server-side on the `4242` BIN with a valid Luhn
   check digit. The full number is returned exactly once, in the creation
   response, and is never stored on the record.
5. **Status is a state machine.** `active ⇄ frozen`, either to `cancelled`,
   and `cancelled` is terminal.

## Files this will touch

Server first, in this order. Nothing in the UI is written until the route is
verified by test and by curl.

| # | File | Change |
| --- | --- | --- |
| 1 | `src/data/types.ts` | Add `Card`, `CardStatus`, `CardStatusEvent` |
| 2 | `src/lib/cards.ts` | **new** — Luhn generator on the 4242 BIN, `maskCard`, `canTransition`, limit/currency validation |
| 3 | `src/lib/cards.test.ts` | **new** — Luhn validity, BIN prefix, uniqueness, masking, every legal and illegal transition, validation boundaries |
| 4 | `src/data/store.ts` | Add `cards: Card[]` to the store |
| 5 | `src/data/cards.ts` | Card queries: list, by id, spend derived from real payments |
| 6 | `src/app/api/cards/route.ts` | `GET` list · `POST` issue, validated, reveal-once |
| 7 | `src/app/api/cards/[id]/route.ts` | `GET` detail · `PATCH` guarded status transition |
| 8 | `src/app/cards/page.tsx` | `/cards` list: nickname, merchant, masked number, limit, status, created |
| 9 | `src/app/cards/issue-dialog.tsx` | Issue form + one-time reveal on success |
| 10 | `src/app/cards/card-actions.tsx` | Freeze/unfreeze and cancel-with-confirm, no full reload |
| 11 | `src/app/cards/[id]/page.tsx` | Detail: full record, spend against limit, audit trail |
| 12 | `src/components/ui/navigation/AppSidebar.tsx` | Add the Cards link |

## Decisions taken deliberately

- **Currency is derived from the merchant, and the server verifies it.**
  `merchants.ts` already knows each merchant's currency, so an ops user cannot
  issue a GBP card against a EUR merchant. The form derives it; the route
  rejects a mismatch with 422 rather than trusting the form.
- **Spend is honest.** `spent` is not a random number. It is derived from
  captured payments for that merchant through the existing query builder, and
  the derivation is stated on the detail page. A card issued today against a
  merchant with no captured payments shows 0 and a bar at 0%.
- **Issue is idempotent.** The client generates a request id per open form; the
  route stores it on the card and returns the existing card on a repeat rather
  than minting a second. A double-click cannot create two cards.
- **The full number never lands on the record.** `Card` has `last4` and
  `numberRef` only. The full PAN exists solely in the POST response body.
- **Audit trail.** Every status change appends `{ from, to, at }` to the card
  and is rendered on the detail page.

## How this will be verified

- `npm test` — unit tests on the generator, the mask, the state machine, and
  the validators. Each would fail without the change.
- `curl` against `POST /api/cards` for each rejection: missing merchant, zero,
  negative, over 5,000,000, bad currency, currency/merchant mismatch, and a
  replayed request id.
- `curl` against `PATCH` for `cancelled → active`, which must be refused.
- Browser: issue a card, confirm the number appears once, reload and confirm it
  is masked, freeze and unfreeze without a reload, cancel behind a confirm.

## Out of scope

Persistence, auth, real network calls, and editing a limit after issue — per
the ticket. No database, no ORM, no migration.
