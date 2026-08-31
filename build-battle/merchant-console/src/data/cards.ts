import { sumMinorUnits } from "@/lib/money"
import { filterPayments } from "./queries"
import { store } from "./store"
import { Card, CardStatus } from "./types"

/**
 * Card reads and writes against the in-memory store.
 *
 * Spend is derived, never invented. It is the sum of captured card payments
 * for the card's merchant made *after* the card was issued, which is why a
 * card issued a moment ago honestly shows zero.
 *
 * Payment filtering goes through the builder in queries.ts. There is no second
 * one here.
 */

export function listCards(): Card[] {
  return [...store.cards].sort((a, b) => b.createdAt.localeCompare(a.createdAt))
}

export function cardById(id: string): Card | null {
  return store.cards.find((card) => card.id === id) ?? null
}

export function cardByRequestId(requestId: string): Card | null {
  return store.cards.find((card) => card.requestId === requestId) ?? null
}

/**
 * Spend against a card, in the card's currency.
 *
 * Only payments in the same currency are summed — mixing currencies produces a
 * meaningless number even when it looks right.
 */
export function spendForCard(card: Card): number {
  const payments = filterPayments({
    merchantId: card.merchantId,
    status: "captured",
    from: card.createdAt,
  })
  return sumMinorUnits(
    payments
      .filter((payment) => payment.currency === card.currency)
      .map((payment) => payment.amount),
  )
}

export function nextCardId(): string {
  const highest = store.cards.reduce((max, card) => {
    const n = Number(card.id.replace("card_", ""))
    return Number.isFinite(n) && n > max ? n : max
  }, 0)
  return `card_${String(highest + 1).padStart(4, "0")}`
}

export function addCard(card: Card): Card {
  store.cards.push(card)
  return card
}

/** Applies a transition that has already been checked with canTransition. */
export function applyCardStatus(card: Card, to: CardStatus, at: string): Card {
  card.history.push({ from: card.status, to, at })
  card.status = to
  return card
}
