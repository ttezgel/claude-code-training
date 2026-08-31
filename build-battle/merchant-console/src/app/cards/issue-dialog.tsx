"use client"

import { Button } from "@/components/Button"
import {
  Drawer,
  DrawerBody,
  DrawerContent,
  DrawerDescription,
  DrawerFooter,
  DrawerHeader,
  DrawerTitle,
  DrawerTrigger,
} from "@/components/Drawer"
import { Input } from "@/components/Input"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/Select"
import { Currency } from "@/data/types"
import { CATEGORY_LOCKS } from "@/lib/cards"
import { formatMoney, parseAmountToMinorUnits } from "@/lib/money"
import { Plus } from "lucide-react"
import { useRouter } from "next/navigation"
import { useState } from "react"

type MerchantOption = { id: string; name: string; currency: Currency }

/**
 * Issue a virtual card.
 *
 * Currency is not a free choice — it is derived from the merchant, because
 * merchants.ts already knows what each one trades in. The server verifies it
 * anyway; this only stops ops from being asked a question with one answer.
 *
 * The full number is shown once, on success. It lives in component state for
 * that one render and is dropped when the drawer closes.
 */
export function IssueCardDialog({
  merchants,
}: {
  merchants: MerchantOption[]
}) {
  const router = useRouter()
  const [open, setOpen] = useState(false)
  const [nickname, setNickname] = useState("")
  const [merchantId, setMerchantId] = useState("")
  const [limit, setLimit] = useState("")
  const [categoryLock, setCategoryLock] = useState<string>("none")
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [issued, setIssued] = useState<{
    number: string
    last4: string
  } | null>(null)
  // One key per open form. A double-click reuses it, so the server returns the
  // card it already made instead of minting a second.
  const [requestId, setRequestId] = useState(() => crypto.randomUUID())

  const merchant = merchants.find((m) => m.id === merchantId)
  const currency = merchant?.currency
  const minorUnits = parseAmountToMinorUnits(limit)

  const reset = () => {
    setNickname("")
    setMerchantId("")
    setLimit("")
    setCategoryLock("none")
    setError(null)
    setIssued(null)
    setSubmitting(false)
    setRequestId(crypto.randomUUID())
  }

  const onOpenChange = (next: boolean) => {
    setOpen(next)
    if (!next) {
      reset()
      router.refresh()
    }
  }

  const submit = async () => {
    setSubmitting(true)
    setError(null)
    try {
      const response = await fetch("/api/cards", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          nickname,
          merchantId,
          spendLimit: minorUnits,
          currency,
          categoryLock: categoryLock === "none" ? null : categoryLock,
          requestId,
        }),
      })
      const body = await response.json()
      if (!response.ok) {
        setError(body.message ?? "Could not issue the card.")
        return
      }
      setIssued({ number: body.number ?? "", last4: body.card.last4 })
    } catch {
      setError("Could not reach the server. Nothing was issued.")
    } finally {
      setSubmitting(false)
    }
  }

  const canSubmit =
    !submitting &&
    nickname.trim().length > 0 &&
    Boolean(merchantId) &&
    minorUnits !== null &&
    minorUnits > 0

  return (
    <Drawer open={open} onOpenChange={onOpenChange}>
      <DrawerTrigger asChild>
        <Button className="w-full gap-2 py-1.5 sm:w-fit">
          <Plus className="-ml-0.5 size-4 shrink-0" aria-hidden="true" />
          Issue card
        </Button>
      </DrawerTrigger>

      <DrawerContent className="sm:max-w-lg">
        <DrawerHeader>
          <DrawerTitle>
            {issued ? "Card issued" : "Issue a virtual card"}
          </DrawerTitle>
          <DrawerDescription>
            {issued
              ? "Copy the number now. It will not be shown again."
              : "Single-merchant, virtual, with a limit from the moment it exists."}
          </DrawerDescription>
        </DrawerHeader>

        <DrawerBody className="space-y-5">
          {issued ? (
            <div className="space-y-4">
              <div className="rounded-md border border-amber-300 bg-amber-50 p-4 dark:border-amber-800 dark:bg-amber-950/40">
                <p className="text-xs font-medium uppercase tracking-wide text-amber-700 dark:text-amber-500">
                  Shown once
                </p>
                <p className="mt-2 font-mono text-lg tabular-nums text-gray-900 dark:text-gray-50">
                  {issued.number.replace(/(.{4})/g, "$1 ").trim()}
                </p>
                <p className="mt-2 text-sm text-amber-800 dark:text-amber-400">
                  Everywhere else in the console this card is ••••{" "}
                  {issued.last4}.
                </p>
              </div>
            </div>
          ) : (
            <>
              <div>
                <label
                  htmlFor="card-nickname"
                  className="text-sm font-medium text-gray-900 dark:text-gray-50"
                >
                  Nickname
                </label>
                <Input
                  id="card-nickname"
                  value={nickname}
                  onChange={(e) => setNickname(e.target.value)}
                  placeholder="Ad spend — Q3"
                  className="mt-2"
                />
              </div>

              <div>
                <label
                  htmlFor="card-merchant"
                  className="text-sm font-medium text-gray-900 dark:text-gray-50"
                >
                  Merchant
                </label>
                <Select value={merchantId} onValueChange={setMerchantId}>
                  <SelectTrigger id="card-merchant" className="mt-2">
                    <SelectValue placeholder="Choose a merchant" />
                  </SelectTrigger>
                  <SelectContent>
                    {merchants.map((m) => (
                      <SelectItem key={m.id} value={m.id}>
                        {m.name} · {m.currency}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div>
                <label
                  htmlFor="card-limit"
                  className="text-sm font-medium text-gray-900 dark:text-gray-50"
                >
                  Spend limit {currency ? `(${currency})` : ""}
                </label>
                <Input
                  id="card-limit"
                  inputMode="decimal"
                  value={limit}
                  onChange={(e) => setLimit(e.target.value)}
                  placeholder="250.00"
                  className="mt-2"
                  aria-describedby="card-limit-hint"
                />
                <p
                  id="card-limit-hint"
                  className="mt-1 text-xs text-gray-500 dark:text-gray-400"
                >
                  {minorUnits !== null && currency
                    ? `${formatMoney(minorUnits, currency)} — stored as ${minorUnits} minor units`
                    : "Up to 5,000,000 minor units."}
                </p>
              </div>

              <div>
                <label
                  htmlFor="card-category"
                  className="text-sm font-medium text-gray-900 dark:text-gray-50"
                >
                  Category lock
                </label>
                <Select value={categoryLock} onValueChange={setCategoryLock}>
                  <SelectTrigger id="card-category" className="mt-2">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">No lock</SelectItem>
                    {CATEGORY_LOCKS.map((c) => (
                      <SelectItem key={c} value={c} className="capitalize">
                        {c}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {error && (
                <p
                  role="alert"
                  className="rounded-md border border-red-300 bg-red-50 p-3 text-sm text-red-700 dark:border-red-900 dark:bg-red-950/40 dark:text-red-400"
                >
                  {error}
                </p>
              )}
            </>
          )}
        </DrawerBody>

        <DrawerFooter className="gap-2">
          {issued ? (
            <Button onClick={() => onOpenChange(false)}>Done</Button>
          ) : (
            <>
              <Button variant="secondary" onClick={() => onOpenChange(false)}>
                Cancel
              </Button>
              <Button
                onClick={submit}
                disabled={!canSubmit}
                isLoading={submitting}
                loadingText="Issuing"
              >
                Issue card
              </Button>
            </>
          )}
        </DrawerFooter>
      </DrawerContent>
    </Drawer>
  )
}
