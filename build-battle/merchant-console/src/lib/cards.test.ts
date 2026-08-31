import { describe, expect, it } from "vitest"
import {
  CARD_LENGTH,
  MAX_SPEND_LIMIT,
  TEST_BIN,
  canTransition,
  generateCardNumber,
  isLuhnValid,
  lastFour,
  luhnCheckDigit,
  maskCardNumber,
  validateIssue,
} from "./cards"

/**
 * A card number that fails Luhn, or that does not start with the test BIN, is
 * the one defect in here that could look like a real PAN. These pin both.
 */

describe("luhnCheckDigit", () => {
  it("produces the digit that makes a known number valid", () => {
    // 4242424242424242 is the canonical test number; its body checks to 2.
    expect(luhnCheckDigit("424242424242424")).toBe(2)
  })

  it("agrees with isLuhnValid for any generated body", () => {
    const body = "4242123456789"
    expect(isLuhnValid(`${body}${luhnCheckDigit(body)}`)).toBe(true)
  })
})

describe("isLuhnValid", () => {
  it("accepts a valid number and rejects a tampered one", () => {
    expect(isLuhnValid("4242424242424242")).toBe(true)
    expect(isLuhnValid("4242424242424243")).toBe(false)
  })

  it("rejects anything that is not all digits", () => {
    expect(isLuhnValid("4242-4242-4242-4242")).toBe(false)
  })
})

describe("generateCardNumber", () => {
  it("is 16 digits on the test BIN with a valid check digit", () => {
    const number = generateCardNumber()
    expect(number).toHaveLength(CARD_LENGTH)
    expect(number.startsWith(TEST_BIN)).toBe(true)
    expect(isLuhnValid(number)).toBe(true)
  })

  it("stays valid across many draws, not just a lucky one", () => {
    for (let i = 0; i < 500; i++) {
      const number = generateCardNumber()
      expect(number.startsWith(TEST_BIN)).toBe(true)
      expect(isLuhnValid(number)).toBe(true)
    }
  })

  it("is not a hardcoded constant", () => {
    const drawn = new Set(
      Array.from({ length: 50 }, () => generateCardNumber()),
    )
    expect(drawn.size).toBeGreaterThan(1)
  })

  it("is deterministic when given a deterministic source", () => {
    const always = () => 0.5
    expect(generateCardNumber(always)).toBe(generateCardNumber(always))
  })
})

describe("maskCardNumber", () => {
  it("shows the last four and nothing else", () => {
    const number = "4242123456781234"
    const masked = maskCardNumber(lastFour(number))
    expect(masked).toBe("•••• 1234")
    expect(masked).not.toContain(number.slice(0, 12))
  })
})

describe("canTransition", () => {
  it("allows active and frozen to swap", () => {
    expect(canTransition("active", "frozen")).toBe(true)
    expect(canTransition("frozen", "active")).toBe(true)
  })

  it("allows either to be cancelled", () => {
    expect(canTransition("active", "cancelled")).toBe(true)
    expect(canTransition("frozen", "cancelled")).toBe(true)
  })

  it("treats cancelled as terminal", () => {
    expect(canTransition("cancelled", "active")).toBe(false)
    expect(canTransition("cancelled", "frozen")).toBe(false)
    expect(canTransition("cancelled", "cancelled")).toBe(false)
  })

  it("refuses a transition to the status it already has", () => {
    expect(canTransition("active", "active")).toBe(false)
    expect(canTransition("frozen", "frozen")).toBe(false)
  })
})

describe("validateIssue", () => {
  const valid = {
    nickname: "Ad spend",
    merchantId: "mch_01",
    spendLimit: 25000,
    currency: "USD",
  }

  it("accepts a well-formed request", () => {
    const result = validateIssue(valid, "USD")
    expect(result.ok).toBe(true)
    if (result.ok) expect(result.value.spendLimit).toBe(25000)
  })

  it("rejects a missing merchant", () => {
    expect(validateIssue({ ...valid, merchantId: "" }, "USD").ok).toBe(false)
    expect(validateIssue({ ...valid, merchantId: undefined }, "USD").ok).toBe(
      false,
    )
  })

  it("rejects a merchant that does not exist", () => {
    expect(validateIssue(valid, undefined).ok).toBe(false)
  })

  it("rejects a zero or negative limit", () => {
    expect(validateIssue({ ...valid, spendLimit: 0 }, "USD").ok).toBe(false)
    expect(validateIssue({ ...valid, spendLimit: -1 }, "USD").ok).toBe(false)
  })

  it("rejects a limit above 5,000,000 minor units but accepts the boundary", () => {
    expect(
      validateIssue({ ...valid, spendLimit: MAX_SPEND_LIMIT }, "USD").ok,
    ).toBe(true)
    expect(
      validateIssue({ ...valid, spendLimit: MAX_SPEND_LIMIT + 1 }, "USD").ok,
    ).toBe(false)
  })

  it("rejects a float limit, because money is integer minor units", () => {
    expect(validateIssue({ ...valid, spendLimit: 250.5 }, "USD").ok).toBe(false)
  })

  it("rejects a limit that arrived as a string", () => {
    expect(validateIssue({ ...valid, spendLimit: "25000" }, "USD").ok).toBe(
      false,
    )
  })

  it("rejects a currency outside USD, EUR, GBP", () => {
    expect(validateIssue({ ...valid, currency: "JPY" }, "USD").ok).toBe(false)
  })

  it("rejects a currency the merchant does not trade in", () => {
    const result = validateIssue({ ...valid, currency: "GBP" }, "EUR")
    expect(result.ok).toBe(false)
    if (!result.ok) expect(result.message).toContain("EUR")
  })

  it("rejects an unknown category lock but allows none", () => {
    expect(validateIssue({ ...valid, categoryLock: "crypto" }, "USD").ok).toBe(
      false,
    )
    const none = validateIssue(valid, "USD")
    expect(none.ok).toBe(true)
    if (none.ok) expect(none.value.categoryLock).toBeNull()
  })
})
