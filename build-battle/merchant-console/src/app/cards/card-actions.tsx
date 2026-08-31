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
} from "@/components/Drawer"
import { CardStatus } from "@/data/types"
import { useRouter } from "next/navigation"
import { useState, useTransition } from "react"

/**
 * Freeze, unfreeze, and cancel.
 *
 * The status change goes through the guarded PATCH, so the server decides
 * whether a transition is legal. Cancel sits behind a confirmation because it
 * is terminal — nothing comes back from cancelled.
 *
 * router.refresh() re-renders the server component in place; there is no full
 * page reload.
 */
export function CardActions({
  cardId,
  status,
  nickname,
}: {
  cardId: string
  status: CardStatus
  nickname: string
}) {
  const router = useRouter()
  const [pending, startTransition] = useTransition()
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [confirming, setConfirming] = useState(false)

  const change = async (next: CardStatus) => {
    setBusy(true)
    setError(null)
    try {
      const response = await fetch(`/api/cards/${cardId}`, {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ status: next }),
      })
      if (!response.ok) {
        const body = await response.json().catch(() => ({}))
        setError(body.message ?? "That change was refused.")
        return
      }
      setConfirming(false)
      startTransition(() => router.refresh())
    } catch {
      setError("Could not reach the server.")
    } finally {
      setBusy(false)
    }
  }

  if (status === "cancelled") {
    return (
      <span className="text-sm text-gray-500 dark:text-gray-400">
        Cancelled — no further changes
      </span>
    )
  }

  const working = busy || pending

  return (
    <div className="flex items-center gap-2">
      <Button
        variant="secondary"
        className="py-1"
        disabled={working}
        onClick={() => change(status === "active" ? "frozen" : "active")}
      >
        {status === "active" ? "Freeze" : "Unfreeze"}
      </Button>

      <Button
        variant="ghost"
        className="py-1 text-red-600 hover:bg-red-50 dark:text-red-500 dark:hover:bg-red-950/40"
        disabled={working}
        onClick={() => setConfirming(true)}
      >
        Cancel card
      </Button>

      {error && (
        <span role="alert" className="text-sm text-red-600 dark:text-red-500">
          {error}
        </span>
      )}

      <Drawer open={confirming} onOpenChange={setConfirming}>
        <DrawerContent className="sm:max-w-md">
          <DrawerHeader>
            <DrawerTitle>Cancel this card?</DrawerTitle>
            <DrawerDescription>
              {nickname} will stop working immediately. Cancelling is permanent
              — the card cannot be reactivated afterwards.
            </DrawerDescription>
          </DrawerHeader>
          <DrawerBody />
          <DrawerFooter className="gap-2">
            <Button variant="secondary" onClick={() => setConfirming(false)}>
              Keep the card
            </Button>
            <Button
              variant="destructive"
              disabled={working}
              onClick={() => change("cancelled")}
            >
              Cancel card
            </Button>
          </DrawerFooter>
        </DrawerContent>
      </Drawer>
    </div>
  )
}
