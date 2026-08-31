import { generateCardNumber, lastFour } from "@/lib/cards"
import { Card } from "./types"

/**
 * A few cards that already exist, so the list is not empty on a cold start and
 * the spend bar has something real to render.
 *
 * Their created dates are backdated deliberately: spend is derived from
 * payments made after a card was issued, so a card issued a moment ago
 * truthfully shows zero. These are old enough to have accrued some.
 *
 * Numbers are generated the same way the route generates them — 4242 BIN,
 * valid Luhn — and only the last four is kept, exactly as at issue time.
 */

const SEEDED: ReadonlyArray<{
  id: string
  nickname: string
  merchantId: string
  spendLimit: number
  currency: Card["currency"]
  status: Card["status"]
  categoryLock: string | null
  createdAt: string
}> = [
  {
    id: "card_0001",
    nickname: "Ad spend — Q3",
    merchantId: "mch_01",
    spendLimit: 500000,
    currency: "USD",
    status: "active",
    categoryLock: "advertising",
    createdAt: "2026-07-02T09:00:00.000Z",
  },
  {
    id: "card_0002",
    nickname: "Design contractors",
    merchantId: "mch_04",
    spendLimit: 120000,
    currency: "GBP",
    status: "frozen",
    categoryLock: "contractors",
    createdAt: "2026-07-18T14:30:00.000Z",
  },
  {
    id: "card_0003",
    nickname: "Warehouse utilities",
    merchantId: "mch_05",
    spendLimit: 80000,
    currency: "EUR",
    status: "active",
    categoryLock: "utilities",
    createdAt: "2026-08-05T08:15:00.000Z",
  },
]

export function seedCards(): Card[] {
  return SEEDED.map((seed) => {
    const number = generateCardNumber()
    return {
      ...seed,
      last4: lastFour(number),
      numberRef: `ref_${seed.id}`,
      history: [{ from: null, to: seed.status, at: seed.createdAt }],
      requestId: null,
    }
  })
}
