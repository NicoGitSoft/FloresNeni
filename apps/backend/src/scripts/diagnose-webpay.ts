import { createHash } from "node:crypto"

import type { ExecArgs } from "@medusajs/framework/types"
import {
  ContainerRegistrationKeys,
  MedusaError,
} from "@medusajs/framework/utils"

import {
  createWebpayTransaction,
  webpayOptionsFromEnv,
} from "../modules/webpay/client"

function safeTokenIdentity(token: string): string {
  return createHash("sha256").update(token).digest("hex").slice(0, 16)
}

function asRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === "object"
    ? (value as Record<string, unknown>)
    : {}
}

function recommendation(
  status: string,
  orderExists: boolean,
  paymentCollectionLinked: boolean | null
): string {
  if (["AUTHORIZED", "CAPTURED", "PARTIALLY_NULLIFIED"].includes(status)) {
    if (!orderExists) {
      return "Do not recommit or replay completion; reconcile the authorized payment against Medusa order/workflow state."
    }
    if (!paymentCollectionLinked) {
      return "Do not replay payment; inspect and repair the Order/payment-collection link after verifying both records."
    }
    return "Order/payment link exists; inspect Medusa payment and cart completion state. Do not recommit."
  }

  if (status === "INITIALIZED") {
    return orderExists
      ? "Do not create another transaction; review the existing Order and workflow before one controlled completion retry."
      : "Remote transaction is unpaid; validate Cart/session totals, then allow at most one normal return completion attempt."
  }

  if (status === "UNAVAILABLE") {
    return "Remote truth is unavailable; do not assume success/failure or retry an economic operation. Re-query or reconcile with Transbank."
  }

  return "Do not mark the Order paid; verify the remote terminal state and review any existing Medusa Order."
}

export default async function diagnoseWebpay({ container }: ExecArgs) {
  const cartId = process.env.NENI_WEBPAY_CART_ID?.trim()
  if (!cartId) {
    throw new MedusaError(
      MedusaError.Types.INVALID_DATA,
      "Define NENI_WEBPAY_CART_ID con el Cart que se debe diagnosticar."
    )
  }

  const query = container.resolve(ContainerRegistrationKeys.QUERY)
  const { data: carts } = await query.graph({
    entity: "cart",
    fields: [
      "id",
      "total",
      "currency_code",
      "completed_at",
      "payment_collection.id",
      "payment_collection.payment_sessions.id",
      "payment_collection.payment_sessions.provider_id",
      "payment_collection.payment_sessions.amount",
      "payment_collection.payment_sessions.status",
      "payment_collection.payment_sessions.data",
    ],
    filters: { id: cartId },
  })
  const cart = carts[0]
  if (!cart) {
    throw new MedusaError(
      MedusaError.Types.NOT_FOUND,
      `No existe el Cart solicitado: ${cartId}.`
    )
  }

  const { data: orderCartLinks } = await query.graph({
    entity: "order_cart",
    fields: ["cart_id", "order_id"],
    filters: { cart_id: cartId },
  })
  const orderId = orderCartLinks[0]?.order_id
  const orders = orderId
    ? await query.graph({
        entity: "order",
        fields: ["id", "payment_collections.id"],
        filters: { id: orderId },
      })
    : { data: [] }
  const order = orders.data[0]
  const paymentCollectionId = cart.payment_collection?.id
  const paymentCollectionLinked =
    order && paymentCollectionId
      ? (order.payment_collections ?? []).some(
          (paymentCollection) =>
            paymentCollection?.id === paymentCollectionId
        )
      : null

  const webpaySessions =
    cart.payment_collection?.payment_sessions?.filter(
      (session) => session?.provider_id === "pp_webpay_webpay"
    ) ?? []
  const transaction = createWebpayTransaction(webpayOptionsFromEnv())
  const paymentSessionReports = await Promise.all(
    webpaySessions.map(async (session) => {
      const data = asRecord(session?.data)
      const token =
        typeof data.token_ws === "string" ? data.token_ws : undefined
      let remote: Record<string, unknown> = {}
      let remoteStatus = token ? "UNAVAILABLE" : "NO_TOKEN"

      if (token) {
        try {
          remote = await transaction.status(token)
          remoteStatus =
            typeof remote.status === "string" ? remote.status : "UNKNOWN"
        } catch {
          remoteStatus = "UNAVAILABLE"
        }
      }

      return {
        paymentSessionId: session?.id,
        providerId: session?.provider_id,
        sessionStatus: session?.status,
        sessionAmount: session?.amount,
        tokenIdentity: token ? safeTokenIdentity(token) : null,
        remoteStatus,
        remoteAmount:
          typeof remote.amount === "number" ? remote.amount : null,
        remoteBuyOrder:
          typeof remote.buy_order === "string" ? remote.buy_order : null,
        remoteSessionId:
          typeof remote.session_id === "string" ? remote.session_id : null,
        remoteRefundBalance:
          typeof remote.balance === "number" ? remote.balance : null,
        recommendation: recommendation(
          remoteStatus,
          Boolean(order),
          paymentCollectionLinked
        ),
      }
    })
  )

  console.log(
    JSON.stringify(
      {
        cartId: cart.id,
        cartTotal: cart.total,
        currencyCode: cart.currency_code,
        cartCompleted: Boolean(cart.completed_at),
        paymentCollectionId: paymentCollectionId ?? null,
        orderId: order?.id ?? null,
        orderExists: Boolean(order),
        orderPaymentCollectionIds:
          order?.payment_collections?.map((paymentCollection) =>
            paymentCollection?.id
          ) ?? [],
        paymentCollectionLinked,
        webpaySessions: paymentSessionReports,
      },
      null,
      2
    )
  )
}
