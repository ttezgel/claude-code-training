import { Divider } from "@/components/Divider"
import { CardStatusBadge } from "@/components/ui/cards/CardStatusBadge"
import { cardById, spendForCard } from "@/data/cards"
import { merchantById } from "@/data/merchants"
import { maskCardNumber } from "@/lib/cards"
import { formatDate } from "@/lib/dates"
import { formatMoney } from "@/lib/money"
import { cx } from "@/lib/utils"
import Link from "next/link"
import { notFound } from "next/navigation"
import { CardActions } from "../card-actions"

const AMBER_AT = 80

export default async function CardDetailPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params
  const card = cardById(id)
  if (!card) notFound()

  const merchant = merchantById(card.merchantId)
  const spent = spendForCard(card)
  const percent = card.spendLimit > 0 ? (spent / card.spendLimit) * 100 : 0
  const shown = Math.min(100, percent)
  const isAmber = percent >= AMBER_AT

  return (
    <section aria-label={`Card ${card.nickname}`} className="p-4 sm:p-6">
      <Link
        href="/cards"
        className="text-sm text-blue-600 hover:underline dark:text-blue-500"
      >
        ← All cards
      </Link>

      <div className="mt-4 flex flex-col justify-between gap-3 sm:flex-row sm:items-start">
        <div>
          <h1 className="text-lg font-semibold text-gray-900 dark:text-gray-50">
            {card.nickname}
          </h1>
          <p className="mt-1 font-mono tabular-nums text-gray-500">
            {maskCardNumber(card.last4)}
          </p>
        </div>
        <div className="flex items-center gap-3">
          <CardStatusBadge status={card.status} />
          <CardActions
            cardId={card.id}
            status={card.status}
            nickname={card.nickname}
          />
        </div>
      </div>

      <Divider />

      <div className="max-w-md">
        <div className="flex items-baseline justify-between">
          <h2 className="text-sm font-medium text-gray-900 dark:text-gray-50">
            Spend against limit
          </h2>
          <p className="text-sm tabular-nums text-gray-500">
            {Math.round(percent)}%
          </p>
        </div>
        <div
          className="mt-2 h-2 w-full overflow-hidden rounded-full bg-gray-200 dark:bg-gray-800"
          role="progressbar"
          aria-valuenow={Math.round(shown)}
          aria-valuemin={0}
          aria-valuemax={100}
          aria-label={`${Math.round(percent)} percent of the spend limit used`}
        >
          <div
            className={cx(
              "h-full rounded-full",
              isAmber
                ? "bg-amber-500 dark:bg-amber-500"
                : "bg-blue-500 dark:bg-blue-500",
            )}
            style={{ width: `${shown}%` }}
          />
        </div>
        <p className="mt-2 text-sm tabular-nums text-gray-500">
          {formatMoney(spent, card.currency)} of{" "}
          {formatMoney(card.spendLimit, card.currency)}
        </p>
        <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
          Derived from captured {card.currency} payments for {merchant?.name}{" "}
          made since this card was issued. Not a stored figure.
        </p>
      </div>

      <Divider />

      <dl className="grid grid-cols-1 gap-x-8 gap-y-4 sm:grid-cols-2">
        <Field label="Merchant" value={merchant?.name ?? card.merchantId} />
        <Field label="Currency" value={card.currency} />
        <Field
          label="Spend limit"
          value={`${formatMoney(card.spendLimit, card.currency)} (${card.spendLimit} minor units)`}
        />
        <Field
          label="Category lock"
          value={card.categoryLock ?? "No lock"}
          capitalize={Boolean(card.categoryLock)}
        />
        <Field label="Created" value={formatDate(card.createdAt)} />
        <Field label="Card ID" value={card.id} mono />
      </dl>

      <Divider />

      <h2 className="text-sm font-medium text-gray-900 dark:text-gray-50">
        History
      </h2>
      <ol className="mt-3 space-y-2">
        {card.history.map((event, index) => (
          <li
            key={`${event.at}-${index}`}
            className="flex flex-wrap items-baseline gap-x-2 text-sm text-gray-600 dark:text-gray-400"
          >
            <span className="tabular-nums text-gray-500">
              {formatDate(event.at)}
            </span>
            <span className="text-gray-900 dark:text-gray-50">
              {event.from === null
                ? `Issued as ${event.to}`
                : `${event.from} → ${event.to}`}
            </span>
          </li>
        ))}
      </ol>
    </section>
  )
}

function Field({
  label,
  value,
  mono,
  capitalize,
}: {
  label: string
  value: string
  mono?: boolean
  capitalize?: boolean
}) {
  return (
    <div>
      <dt className="text-sm text-gray-500 dark:text-gray-400">{label}</dt>
      <dd
        className={cx(
          "mt-0.5 text-sm text-gray-900 dark:text-gray-50",
          mono && "font-mono",
          capitalize && "capitalize",
        )}
      >
        {value}
      </dd>
    </div>
  )
}
