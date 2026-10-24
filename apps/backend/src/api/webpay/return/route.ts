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

const WEBPAY_PROVIDER_ID = "pp_webpay_webpay"

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

  if (!token && abortToken) {
    return res.redirect(303, storefrontUrl("/pay?webpay=aborted"))
  }

  if (!token) {
    return res.redirect(303, storefrontUrl("/pay?webpay=missing-token"))
  }

  try {
    // No hacemos commit aquí. Primero verificamos que el token pertenece a la
    // Payment Session del Cart y luego devolvemos control al storefront. El
    // storefront usa el endpoint NATIVO POST /store/carts/:id/complete para
    // que Medusa ejecute su flujo oficial y llame authorizePayment() del
    // provider, donde ocurre Transaction.commit(token).
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

    const session = cart.payment_collection?.payment_sessions?.find(
      (candidate) => candidate?.provider_id === WEBPAY_PROVIDER_ID
    )

    if (!session) {
      throw new MedusaError(
        MedusaError.Types.NOT_FOUND,
        "El carrito no tiene una sesión Webpay."
      )
    }

    const sessionToken = (session.data as Record<string, unknown> | undefined)
      ?.token_ws

    if (sessionToken !== token) {
      throw new MedusaError(
        MedusaError.Types.NOT_ALLOWED,
        "El token Webpay no corresponde a la sesión del carrito."
      )
    }

    // Workaround explícito para medusajs/medusa#16407: completeCartWorkflow
    // valida el estado del pago, pero no garantiza que el monto de la sesión
    // coincida con el total actual del carrito.
    if (Number(session.amount) !== Number(cart.total)) {
      throw new MedusaError(
        MedusaError.Types.INVALID_DATA,
        "El monto de la sesión de pago no coincide con el total actual del carrito."
      )
    }

    const { result } = await completeCartWorkflow(req.scope).run({
      input: { id: cartId },
    })

    if (!result?.id) {
      throw new MedusaError(
        MedusaError.Types.UNEXPECTED_STATE,
        "Medusa no devolvió un order_id al completar el carrito."
      )
    }

    return res.redirect(
      303,
      storefrontUrl(
        `/order-success?order_id=${encodeURIComponent(result.id)}`
      )
    )
  } catch (error) {
    req.scope
      .resolve(ContainerRegistrationKeys.LOGGER)
      .error("Webpay return validation failed", error as Error)

    return res.redirect(303, storefrontUrl("/pay?webpay=error"))
  }
}

export const GET = handler
export const POST = handler
