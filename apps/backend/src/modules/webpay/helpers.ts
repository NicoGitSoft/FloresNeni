import { BigNumber, MedusaError } from "@medusajs/framework/utils"

type TransactionIdentity = {
  amount: number
  buy_order: string
  session_id: string
}

export function toClpIntegerAmount(value: unknown): number {
  if (
    typeof value !== "number" &&
    typeof value !== "string" &&
    !(value instanceof BigNumber)
  ) {
    throw new MedusaError(
      MedusaError.Types.INVALID_DATA,
      "Webpay requiere un monto CLP entero, positivo y seguro."
    )
  }

  const amount = new BigNumber(value as never).numeric

  if (!Number.isSafeInteger(amount) || amount <= 0) {
    throw new MedusaError(
      MedusaError.Types.INVALID_DATA,
      "Webpay requiere un monto CLP entero, positivo y seguro."
    )
  }

  return amount
}

export function assertClpCurrency(currencyCode?: string): void {
  if (currencyCode?.toLowerCase() !== "clp") {
    throw new MedusaError(
      MedusaError.Types.INVALID_DATA,
      "Webpay Neni v1 admite únicamente CLP."
    )
  }
}

export function createBuyOrder(now = Date.now(), entropy = Math.random()): string {
  const time = now.toString(36).toUpperCase()
  const random = Math.floor(entropy * 0xffffff)
    .toString(36)
    .toUpperCase()
    .padStart(5, "0")
  return `NENI-${time}-${random}`.slice(0, 26)
}

export function createSessionId(cartId?: string): string {
  const source = cartId?.trim() || `NENI-${Date.now().toString(36)}`
  if (source.length > 61) {
    throw new MedusaError(
      MedusaError.Types.INVALID_DATA,
      "session_id Webpay excede 61 caracteres."
    )
  }
  return source
}

export function assertApprovedCommit(
  result: Record<string, unknown>,
  expected: TransactionIdentity
): void {
  if (result.status !== "AUTHORIZED" || result.response_code !== 0) {
    throw new MedusaError(
      MedusaError.Types.UNEXPECTED_STATE,
      `Webpay no autorizó la transacción (status=${result.status ?? "unknown"}, response_code=${result.response_code ?? "unknown"}).`
    )
  }

  assertTransactionIdentity(result, expected)
}

export function assertTransactionIdentity(
  result: Record<string, unknown>,
  expected: TransactionIdentity
): void {
  if (result.amount !== expected.amount) {
    throw new MedusaError(
      MedusaError.Types.UNEXPECTED_STATE,
      "El monto consultado a Webpay no coincide con el monto de la sesión."
    )
  }

  if (result.buy_order !== expected.buy_order) {
    throw new MedusaError(
      MedusaError.Types.UNEXPECTED_STATE,
      "La buy_order consultada a Webpay no coincide."
    )
  }

  if (result.session_id !== expected.session_id) {
    throw new MedusaError(
      MedusaError.Types.UNEXPECTED_STATE,
      "La session_id consultada a Webpay no coincide."
    )
  }
}

export function mapWebpayStatus(
  status?: string
): "pending" | "captured" | "canceled" | "error" {
  switch (status) {
    case "AUTHORIZED":
    case "CAPTURED":
    case "PARTIALLY_NULLIFIED":
      return "captured"
    case "REVERSED":
    case "NULLIFIED":
      return "canceled"
    case "FAILED":
      return "error"
    case "INITIALIZED":
    default:
      return "pending"
  }
}
