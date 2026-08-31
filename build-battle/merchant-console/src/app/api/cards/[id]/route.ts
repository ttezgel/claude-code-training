import { applyCardStatus, cardById, spendForCard } from "@/data/cards"
import { canTransition, isCardStatus } from "@/lib/cards"
import { NextRequest, NextResponse } from "next/server"

/**
 * GET   — one card, masked. The full number is never available here.
 * PATCH — a guarded status change.
 *
 * The state machine is enforced server-side: active ⇄ frozen, either to
 * cancelled, and cancelled is terminal. A client that asks for a forbidden
 * transition is refused whatever its UI allowed.
 */

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params
  const card = cardById(id)
  if (!card) {
    return NextResponse.json({ message: "Card not found." }, { status: 404 })
  }
  return NextResponse.json({ card: { ...card, spent: spendForCard(card) } })
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params
  const card = cardById(id)
  if (!card) {
    return NextResponse.json({ message: "Card not found." }, { status: 404 })
  }

  let body: unknown
  try {
    body = await request.json()
  } catch {
    return NextResponse.json(
      { message: "Expected a JSON body." },
      { status: 400 },
    )
  }

  const status = (body as Record<string, unknown>)?.status
  if (!isCardStatus(status)) {
    return NextResponse.json(
      { message: "Status must be active, frozen, or cancelled." },
      { status: 422 },
    )
  }

  if (!canTransition(card.status, status)) {
    return NextResponse.json(
      {
        message:
          card.status === "cancelled"
            ? "A cancelled card is cancelled for good."
            : `A ${card.status} card cannot become ${status}.`,
      },
      { status: 409 },
    )
  }

  applyCardStatus(card, status, new Date().toISOString())
  return NextResponse.json({ card: { ...card, spent: spendForCard(card) } })
}
