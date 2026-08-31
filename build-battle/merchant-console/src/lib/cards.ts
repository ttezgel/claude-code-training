import { Currency, CardStatus } from "@/data/types"

/**
 * Virtual card issuing.
 *
 * Numbers are generated here, server-side, on the 4242 test BIN with a valid
 * Luhn check digit. Nothing in this repository may resemble a real PAN.
 *
 * The full number is returned once by the creation route and never stored.
 * Everything that persists carries the last four and an opaque reference.
 */

export const TEST_BIN = "4242"
export const CARD_LENGTH = 16
export const MAX_SPEND_LIMIT = 5_000_000
export const CURRENCIES: readonly Currency[] = ["USD", "EUR", "GBP"]

export const CATEGORY_LOCKS = [
  "advertising",
  "software",
  "travel",
  "contractors",
  "utilities",
] as const

export type CategoryLock = (typeof CATEGORY_LOCKS)[number]

/**
 * Luhn check digit for a partial number.
 *
 * Doubles every second digit from the right of the final number, which — since
 * the check digit occupies the rightmost slot — means doubling from the right
 * of the body we are given.
 */
export function luhnCheckDigit(partial: string): number {
  let sum = 0
  let double = true
  for (let i = partial.length - 1; i >= 0; i--) {
    let digit = partial.charCodeAt(i) - 48
    if (double) {
      digit *= 2
      if (digit > 9) digit -= 9
    }
    double = !double
    sum += digit
  }
  return (10 - (sum % 10)) % 10
}

/** True when a complete number satisfies Luhn. */
export function isLuhnValid(number: string): boolean {
  if (!/^\d+$/.test(number)) return false
  const body = number.slice(0, -1)
  const check = number.charCodeAt(number.length - 1) - 48
  return luhnCheckDigit(body) === check
}

/**
 * A 16-digit number on the test BIN with a valid check digit.
 *
 * `random` is injectable so tests are deterministic; production passes nothing
 * and gets Math.random.
 */
export function generateCardNumber(random: () => number = Math.random): string {
  const middleLength = CARD_LENGTH - TEST_BIN.length - 1
  let middle = ""
  for (let i = 0; i < middleLength; i++) {
    middle += Math.floor(random() * 10).toString()
  }
  const body = `${TEST_BIN}${middle}`
  return `${body}${luhnCheckDigit(body)}`
}

/** Display form. The only shape a card number takes after creation. */
export function maskCardNumber(last4: string): string {
  return `•••• ${last4}`
}

export function lastFour(number: string): string {
  return number.slice(-4)
}

/**
 * Status transitions.
 *
 * active ⇄ frozen, either to cancelled, and cancelled is terminal.
 */
const TRANSITIONS: Record<CardStatus, readonly CardStatus[]> = {
  active: ["frozen", "cancelled"],
  frozen: ["active", "cancelled"],
  cancelled: [],
}

export function canTransition(from: CardStatus, to: CardStatus): boolean {
  return TRANSITIONS[from].includes(to)
}

export function isCardStatus(value: unknown): value is CardStatus {
  return value === "active" || value === "frozen" || value === "cancelled"
}

export type IssueInput = {
  nickname?: unknown
  merchantId?: unknown
  spendLimit?: unknown
  currency?: unknown
  categoryLock?: unknown
}

export type ValidIssue = {
  nickname: string
  merchantId: string
  spendLimit: number
  currency: Currency
  categoryLock: CategoryLock | null
}

export type IssueValidation =
  | { ok: true; value: ValidIssue }
  | { ok: false; message: string }

/**
 * Validate an issue request. The client is not trusted: this runs in the route
 * handler, and every rejection returns a message safe to show a user.
 *
 * `merchantCurrency` is the currency the chosen merchant actually trades in.
 * A card cannot be issued in a currency its merchant does not use — the form
 * derives it, and this verifies it anyway.
 */
export function validateIssue(
  input: IssueInput,
  merchantCurrency: Currency | undefined,
): IssueValidation {
  const nickname =
    typeof input.nickname === "string" ? input.nickname.trim() : ""
  if (!nickname) return { ok: false, message: "Give the card a nickname." }

  if (typeof input.merchantId !== "string" || !input.merchantId) {
    return { ok: false, message: "Choose a merchant." }
  }
  if (!merchantCurrency) {
    return { ok: false, message: "That merchant does not exist." }
  }

  const spendLimit = input.spendLimit
  if (typeof spendLimit !== "number" || !Number.isInteger(spendLimit)) {
    return {
      ok: false,
      message: "Spend limit must be a whole number of minor units.",
    }
  }
  if (spendLimit <= 0) {
    return { ok: false, message: "Spend limit must be greater than zero." }
  }
  if (spendLimit > MAX_SPEND_LIMIT) {
    return {
      ok: false,
      message: "Spend limit cannot exceed 5,000,000 minor units.",
    }
  }

  if (!CURRENCIES.includes(input.currency as Currency)) {
    return { ok: false, message: "Currency must be USD, EUR, or GBP." }
  }
  const currency = input.currency as Currency
  if (currency !== merchantCurrency) {
    return {
      ok: false,
      message: `That merchant trades in ${merchantCurrency}, so the card cannot be issued in ${currency}.`,
    }
  }

  let categoryLock: CategoryLock | null = null
  if (input.categoryLock !== undefined && input.categoryLock !== null) {
    if (!CATEGORY_LOCKS.includes(input.categoryLock as CategoryLock)) {
      return { ok: false, message: "Unknown merchant category." }
    }
    categoryLock = input.categoryLock as CategoryLock
  }

  return {
    ok: true,
    value: { nickname, merchantId: input.merchantId, spendLimit, currency, categoryLock },
  }
}
