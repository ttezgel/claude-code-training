import {
  addCard,
  cardByRequestId,
  listCards,
  nextCardId,
  spendForCard,
} from "@/data/cards"
import { merchantById } from "@/data/merchants"
import { Card } from "@/data/types"
import { generateCardNumber, lastFour, validateIssue } from "@/lib/cards"
import { NextRequest, NextResponse } from "next/server"

/**
 * GET  — every issued card, masked.
 * POST — issue one.
 *
 * The client is not trusted. Nickname, merchant, limit, currency, and category
 * are validated here; the merchant's own currency is the authority on what a
 * card may be denominated in.
 *
 * The full number appears in the POST response and nowhere else. It is not
 * written to the store, so no later read can return it.
 */

export function GET() {
  return NextResponse.json({
    cards: listCards().map((card) => ({
      ...card,
      spent: spendForCard(card),
    })),
  })
}

export async function POST(request: NextRequest) {
  let body: unknown
  try {
    body = await request.json()
  } catch {
    return NextResponse.json(
      { message: "Expected a JSON body." },
      { status: 400 },
    )
  }

  const input = (body ?? {}) as Record<string, unknown>

  // Idempotency: the same request id must never mint a second card. A
  // double-clicked form, or a retry after a timeout, gets the original back.
  const requestId =
    typeof input.requestId === "string" && input.requestId
      ? input.requestId
      : null
  if (requestId) {
    const existing = cardByRequestId(requestId)
    if (existing) {
      return NextResponse.json(
        {
          card: { ...existing, spent: spendForCard(existing) },
          replayed: true,
        },
        { status: 200 },
      )
    }
  }

  const merchant = merchantById(
    typeof input.merchantId === "string" ? input.merchantId : "",
  )
  const validation = validateIssue(input, merchant?.currency)
  if (!validation.ok) {
    return NextResponse.json({ message: validation.message }, { status: 422 })
  }

  const number = generateCardNumber()
  const now = new Date().toISOString()
  const card: Card = {
    id: nextCardId(),
    nickname: validation.value.nickname,
    merchantId: validation.value.merchantId,
    spendLimit: validation.value.spendLimit,
    currency: validation.value.currency,
    status: "active",
    last4: lastFour(number),
    numberRef: `ref_${now}`,
    categoryLock: validation.value.categoryLock,
    createdAt: now,
    history: [{ from: null, to: "active", at: now }],
    requestId,
  }
  addCard(card)

  // The one and only time the full number is returned.
  return NextResponse.json(
    { card: { ...card, spent: spendForCard(card) }, number },
    { status: 201 },
  )
}
