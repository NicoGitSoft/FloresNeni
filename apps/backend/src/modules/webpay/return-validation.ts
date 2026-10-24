import { MedusaError } from "@medusajs/framework/utils"

import {
  assertApprovedCommit,
  assertTransactionIdentity,
  toClpIntegerAmount,
} from "./helpers"

const WEBPAY_PROVIDER_ID = "pp_webpay_webpay"
const PROCESSABLE_PAYMENT_STATUSES = new Set([
  "pending",
  "requires_more",
  "authorized",
  "captured",
  "pending_authorization",
])

export function classifyReturnTokens(
  token?: string,
  abortToken?: string
): "payment" | "aborted" | "invalid" | "missing" {
  if (token && abortToken) {
    return "invalid"
  }
  if (abortToken) {
    return "aborted"
  }
  return token ? "payment" : "missing"
}

type PaymentSession = {
  provider_id?: string
  amount?: unknown
  status?: string
  data?: Record<string, unknown>
}

export function selectReturnSession(
  sessions: PaymentSession[],
  token: string,
  cartId: string,
  cartTotal: unknown,
  currencyCode: string
): {
  amount: number
  buy_order: string
  session_id: string
} {
  if (currencyCode.toLowerCase() !== "clp") {
    throw new MedusaError(
      MedusaError.Types.INVALID_DATA,
      "El carrito asociado al retorno Webpay no está en CLP."
    )
  }

  const amount = toClpIntegerAmount(cartTotal)
  const matches = sessions.filter(
    (candidate) =>
      candidate.provider_id === WEBPAY_PROVIDER_ID &&
      candidate.data?.token_ws === token
  )

  if (matches.length !== 1) {
    throw new MedusaError(
      MedusaError.Types.NOT_FOUND,
      "No existe una única sesión Webpay asociada al token recibido."
    )
  }

  const [session] = matches
  const processableSessions = sessions.filter((candidate) =>
    PROCESSABLE_PAYMENT_STATUSES.has(candidate.status ?? "")
  )
  if (processableSessions.length !== 1 || processableSessions[0] !== session) {
    throw new MedusaError(
      MedusaError.Types.INVALID_DATA,
      "El carrito tiene más de una sesión de pago activa; no se puede completar de forma determinista."
    )
  }

  const sessionAmount = toClpIntegerAmount(session.amount)
  const dataAmount = toClpIntegerAmount(session.data?.amount)
  const buyOrder = session.data?.buy_order
  const sessionId = session.data?.session_id

  if (
    sessionAmount !== amount ||
    dataAmount !== amount ||
    sessionId !== cartId ||
    typeof buyOrder !== "string" ||
    buyOrder.length === 0 ||
    ["error", "canceled"].includes(session.status ?? "")
  ) {
    throw new MedusaError(
      MedusaError.Types.INVALID_DATA,
      "La sesión Webpay no coincide con el estado actual del carrito."
    )
  }

  return { amount, buy_order: buyOrder, session_id: cartId }
}

export function assertReturnTransaction(
  result: Record<string, unknown>,
  expected: {
    amount: number
    buy_order: string
    session_id: string
  }
): void {
  if (result.status === "AUTHORIZED") {
    assertApprovedCommit(result, expected)
    return
  }

  if (result.status !== "INITIALIZED") {
    throw new MedusaError(
      MedusaError.Types.UNEXPECTED_STATE,
      "El estado remoto Webpay no permite completar este carrito."
    )
  }

  assertTransactionIdentity(result, expected)
}

export function assertCompletedReturnState(input: {
  orderId?: string
  cartCompleted: boolean
  paymentSessionStatus?: string
  paymentCollectionLinked: boolean
}): void {
  if (
    !input.orderId ||
    !input.cartCompleted ||
    !["authorized", "captured"].includes(input.paymentSessionStatus ?? "") ||
    !input.paymentCollectionLinked
  ) {
    throw new MedusaError(
      MedusaError.Types.UNEXPECTED_STATE,
      "La finalización de Medusa no confirmó una Order con el pago vinculado y autorizado."
    )
  }
}
