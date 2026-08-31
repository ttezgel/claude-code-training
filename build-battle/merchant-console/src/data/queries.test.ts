import { describe, expect, it } from "vitest"
import { sortPayments } from "./queries"
import { Payment } from "./types"

/**
 * Amounts are integer minor units. Sorting them as text put 9000 after 10000,
 * which made every amount-sorted page and every amount-sorted export wrong in
 * a way that looked plausible. These pin the numeric order.
 */

const base: Payment = {
  id: "pay_0001",
  merchantId: "mch_01",
  amount: 0,
  currency: "USD",
  status: "captured",
  method: "card",
  cardBrand: "visa",
  last4: "4242",
  createdAt: "2026-03-14T10:15:00.000Z",
  description: "Order",
}

const withAmounts = (...amounts: number[]): Payment[] =>
  amounts.map((amount, i) => ({ ...base, id: `pay_${i}`, amount }))

describe("sortPayments by amount", () => {
  it("orders ascending by value, not by text", () => {
    const sorted = sortPayments(withAmounts(10000, 9000, 250), "amount", "asc")
    expect(sorted.map((p) => p.amount)).toEqual([250, 9000, 10000])
  })

  it("orders descending by value", () => {
    const sorted = sortPayments(withAmounts(250, 10000, 9000), "amount", "desc")
    expect(sorted.map((p) => p.amount)).toEqual([10000, 9000, 250])
  })

  it("keeps 9000 below 10000, the case text sorting got wrong", () => {
    const sorted = sortPayments(withAmounts(10000, 9000), "amount", "asc")
    expect(sorted[0].amount).toBe(9000)
  })

  it("does not mutate the array it was given", () => {
    const input = withAmounts(10000, 250)
    sortPayments(input, "amount", "asc")
    expect(input.map((p) => p.amount)).toEqual([10000, 250])
  })
})

describe("sortPayments by createdAt", () => {
  it("still defaults to newest first", () => {
    const older = { ...base, id: "old", createdAt: "2026-01-01T00:00:00.000Z" }
    const newer = { ...base, id: "new", createdAt: "2026-06-01T00:00:00.000Z" }
    expect(sortPayments([older, newer]).map((p) => p.id)).toEqual([
      "new",
      "old",
    ])
  })
})
