import type { MedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import {
  ContainerRegistrationKeys,
  MedusaError,
} from "@medusajs/framework/utils"

import { completeCartWorkflow } from "@medusajs/medusa/core-flows"

import {
  createWebpayTransaction,
  webpayOptionsFromEnv,
} from "../../../modules/webpay/client"
import {
  assertCompletedReturnState,
  assertReturnTransaction,
  classifyReturnTokens,
  selectReturnSession,
} from "../../../modules/webpay/return-validation"

const WEBPAY_PROVIDER_ID = "pp_webpay_webpay"
const PROCESSABLE_PAYMENT_STATUSES = new Set([
  "pending",
  "requires_more",
  "authorized",
  "captured",
  "pending_authorization",
])

type WebpayReturnProof = {
  token: string
  remoteStatus: Record<string, unknown>
  expected: {
    amount: number
    buy_order: string
    session_id: string
  }
}

completeCartWorkflow.hooks.validate(({ input, cart }) => {
  const sessions =
    cart.payment_collection?.payment_sessions?.filter(
      (candidate) => candidate != null
    ) ?? []
  const activeWebpaySessions = sessions.filter(
    (candidate) =>
      candidate?.provider_id === WEBPAY_PROVIDER_ID &&
      PROCESSABLE_PAYMENT_STATUSES.has(String(candidate.status))
  )

  if (!activeWebpaySessions.length) {
    return
  }

  const proof = (
    input as typeof input & { webpay_return?: WebpayReturnProof }
  ).webpay_return
  if (!proof) {
    throw new MedusaError(
      MedusaError.Types.NOT_ALLOWED,
      "Las sesiones Webpay deben completarse desde el retorno validado del proveedor."
    )
  }

  const expected = selectReturnSession(
    sessions,
    proof.token,
    cart.id,
    cart.total,
    cart.currency_code
  )
  if (
    expected.amount !== proof.expected.amount ||
    expected.buy_order !== proof.expected.buy_order ||
    expected.session_id !== proof.expected.session_id
  ) {
    throw new MedusaError(
      MedusaError.Types.INVALID_DATA,
      "La sesión Webpay cambió durante el retorno; el pago no se completó."
    )
  }
  assertReturnTransaction(proof.remoteStatus, expected)
})

function value(req: MedusaRequest, key: string): string | undefined {
  const queryValue = req.query?.[key]
  if (typeof queryValue === "string" && queryValue) {
    return queryValue
  }

  const body = req.body as Record<string, unknown> | undefined
  const bodyValue = body?.[key]
  return typeof bodyValue === "string" && bodyValue ? bodyValue : undefined
}

function storefrontUrl(path: string): string {
  const base = process.env.STOREFRONT_URL ?? "http://localhost:4321"
  return new URL(path, base).toString()
}

async function handler(req: MedusaRequest, res: MedusaResponse) {
  const token = value(req, "token_ws")
  const abortToken = value(req, "TBK_TOKEN")
  const returnType = classifyReturnTokens(token, abortToken)

  if (returnType === "invalid") {
    return res.redirect(303, storefrontUrl("/pay?webpay=invalid-return"))
  }

  if (returnType === "aborted") {
    return res.redirect(303, storefrontUrl("/pay?webpay=aborted"))
  }

  if (returnType === "missing" || !token) {
    return res.redirect(303, storefrontUrl("/pay?webpay=missing-token"))
  }

  try {
    // The callback validates the remote transaction before the single
    // top-level Medusa completion workflow invokes provider authorization.
    const transaction = createWebpayTransaction(webpayOptionsFromEnv())
    const externalStatus = await transaction.status(token)
    const cartId = externalStatus.session_id

    if (typeof cartId !== "string" || !cartId.startsWith("cart_")) {
      throw new MedusaError(
        MedusaError.Types.INVALID_DATA,
        "El retorno Webpay no contiene un cart_id válido."
      )
    }

    const query = req.scope.resolve(ContainerRegistrationKeys.QUERY)
    const { data: carts } = await query.graph({
      entity: "cart",
      fields: [
        "id",
        "total",
        "currency_code",
        "items.id",
        "payment_collection.id",
        "payment_collection.payment_sessions.id",
        "payment_collection.payment_sessions.amount",
        "payment_collection.payment_sessions.provider_id",
        "payment_collection.payment_sessions.status",
        "payment_collection.payment_sessions.data",
      ],
      filters: { id: cartId },
    })

    const cart = carts[0]
    if (!cart) {
      throw new MedusaError(
        MedusaError.Types.NOT_FOUND,
        "No existe el carrito asociado al retorno Webpay."
      )
    }

    if (!cart.items?.length) {
      throw new MedusaError(
        MedusaError.Types.INVALID_DATA,
        "No se puede completar un carrito vacío."
      )
    }

    const paymentCollectionId = cart.payment_collection?.id
    if (!paymentCollectionId) {
      throw new MedusaError(
        MedusaError.Types.NOT_FOUND,
        "El carrito no tiene una Payment Collection."
      )
    }

    const expected = selectReturnSession(
      cart.payment_collection?.payment_sessions?.filter(
        (candidate) => candidate != null
      ) ?? [],
      token,
      cartId,
      cart.total,
      cart.currency_code
    )
    assertReturnTransaction(externalStatus, expected)

    const workflowInput = {
      id: cartId,
      webpay_return: {
        token,
        remoteStatus: externalStatus,
        expected,
      },
    }
    const { result } = await completeCartWorkflow(req.scope).run({
      input: workflowInput,
    })

    if (!result?.id) {
      throw new MedusaError(
        MedusaError.Types.UNEXPECTED_STATE,
        "Medusa no devolvió un order_id al completar el carrito."
      )
    }

    const [{ data: completedCarts }, { data: orders }] = await Promise.all([
      query.graph({
        entity: "cart",
        fields: [
          "id",
          "completed_at",
          "payment_collection.id",
          "payment_collection.payment_sessions.provider_id",
          "payment_collection.payment_sessions.status",
          "payment_collection.payment_sessions.data",
        ],
        filters: { id: cartId },
      }),
      query.graph({
        entity: "order",
        fields: ["id", "payment_collections.id"],
        filters: { id: result.id },
      }),
    ])
    const completedCart = completedCarts[0]
    const completedOrder = orders[0]
    const completedSessions =
      completedCart?.payment_collection?.payment_sessions?.filter(
        (candidate) => candidate != null
      ) ?? []
    const completedSessionMatches = completedSessions.filter(
      (candidate) =>
        candidate?.provider_id === WEBPAY_PROVIDER_ID &&
        (candidate?.data as Record<string, unknown> | undefined)?.token_ws ===
          token
    )

    assertCompletedReturnState({
      orderId: completedOrder?.id,
      cartCompleted: Boolean(completedCart?.completed_at),
      paymentSessionStatus:
        completedSessionMatches.length === 1
          ? completedSessionMatches[0]?.status
          : undefined,
      paymentCollectionLinked:
        completedOrder?.payment_collections?.some(
          (paymentCollection) => paymentCollection?.id === paymentCollectionId
        ) ?? false,
    })

    return res.redirect(
      303,
      storefrontUrl(
        `/order-success?order_id=${encodeURIComponent(result.id)}`
      )
    )
  } catch {
    req.scope
      .resolve(ContainerRegistrationKeys.LOGGER)
      .error("Webpay return could not be validated")

    return res.redirect(303, storefrontUrl("/pay?webpay=error"))
  }
}

export const GET = handler
export const POST = handler
