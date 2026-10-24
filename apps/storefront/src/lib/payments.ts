const backendUrl = (
  import.meta.env.PUBLIC_MEDUSA_BACKEND_URL ?? "http://127.0.0.1:9000"
).replace(/\/$/, "")

const publishableKey = import.meta.env.PUBLIC_MEDUSA_PUBLISHABLE_KEY

if (!publishableKey) {
  throw new Error("Falta PUBLIC_MEDUSA_PUBLISHABLE_KEY.")
}

async function api<T>(
  path: string,
  options: {
    method?: "GET" | "POST"
    body?: unknown
  } = {}
): Promise<T> {
  const response = await fetch(`${backendUrl}${path}`, {
    method: options.method ?? "GET",
    headers: {
      "x-publishable-api-key": publishableKey,
      ...(options.body ? { "Content-Type": "application/json" } : {}),
    },
    body:
      options.body !== undefined
        ? JSON.stringify(options.body)
        : undefined,
  })

  const data = await response.json().catch(() => null)

  if (!response.ok) {
    const detail =
      data && typeof data.message === "string"
        ? data.message
        : `HTTP ${response.status}`
    throw new Error(detail)
  }

  return data as T
}

export type PaymentCart = {
  id: string
  region_id?: string
  total?: number
  currency_code?: string
  email?: string | null
  metadata?: {
    neni_checkout?: {
      fulfillment_method?: "pickup" | "delivery"
      requested_date?: string
    }
  } | null
  shipping_methods?: Array<{
    id: string
    shipping_option_id?: string | null
  }>
  payment_collection?: {
    id: string
    payment_sessions?: Array<{
      id: string
      provider_id: string
      status: string
      amount: number
      data?: {
        token_ws?: string
        webpay_url?: string
      }
    }>
  } | null
}

export async function getPaymentCart(cartId: string): Promise<PaymentCart> {
  const fields = [
    "+metadata",
    "+shipping_methods.*",
    "+payment_collection.*",
    "+payment_collection.payment_sessions.*",
  ].join(",")

  const data = await api<{ cart: PaymentCart }>(
    `/store/carts/${encodeURIComponent(cartId)}?fields=${encodeURIComponent(fields)}`
  )
  return data.cart
}

export async function prepareShipping(cart: PaymentCart): Promise<PaymentCart> {
  const method = cart.metadata?.neni_checkout?.fulfillment_method
  if (!method) {
    throw new Error("Primero guarda retiro/despacho en /checkout.")
  }

  const data = await api<{
    shipping_options: Array<{ id: string; name: string }>
  }>(`/store/shipping-options?cart_id=${encodeURIComponent(cart.id)}`)

  const expectedName =
    method === "pickup"
      ? "Retiro Taller Neni (desarrollo)"
      : "Despacho Neni (desarrollo)"

  const option = data.shipping_options.find(
    (candidate) => candidate.name === expectedName
  )

  if (!option) {
    throw new Error(`No está disponible la shipping option: ${expectedName}`)
  }

  const alreadySelected = cart.shipping_methods?.some(
    (candidate) => candidate.shipping_option_id === option.id
  )

  if (!alreadySelected) {
    await api(`/store/carts/${encodeURIComponent(cart.id)}/shipping-methods`, {
      method: "POST",
      body: { option_id: option.id },
    })
  }

  return getPaymentCart(cart.id)
}

export async function listPaymentProviders(regionId: string) {
  return api<{
    payment_providers: Array<{ id: string }>
  }>(`/store/payment-providers?region_id=${encodeURIComponent(regionId)}`)
}

export async function ensurePaymentCollection(
  cart: PaymentCart
): Promise<PaymentCart> {
  if (cart.payment_collection?.id) {
    return cart
  }

  await api("/store/payment-collections", {
    method: "POST",
    body: { cart_id: cart.id },
  })

  return getPaymentCart(cart.id)
}

export async function initiatePayment(
  cart: PaymentCart,
  providerId: string
): Promise<PaymentCart> {
  const withCollection = await ensurePaymentCollection(cart)
  const collectionId = withCollection.payment_collection?.id
  if (!collectionId) {
    throw new Error("Medusa no creó Payment Collection.")
  }

  // No recreamos otra sesión del mismo provider si ya hay una vigente con el
  // monto actual. Esto reduce transacciones huérfanas y evita el patrón de
  // medusajs/medusa#15589.
  const existing = withCollection.payment_collection?.payment_sessions?.find(
    (candidate) =>
      candidate.provider_id === providerId &&
      Number(candidate.amount) === Number(withCollection.total) &&
      !["error", "canceled"].includes(candidate.status)
  )

  if (!existing) {
    await api(
      `/store/payment-collections/${encodeURIComponent(collectionId)}/payment-sessions`,
      {
        method: "POST",
        body: {
          provider_id: providerId,
          data: { cart_id: cart.id },
        },
      }
    )
  }

  return getPaymentCart(cart.id)
}

export async function completeCart(cartId: string) {
  return api<
    | { type: "order"; order: { id: string } }
    | { type: "cart"; cart: PaymentCart; error?: { message?: string } }
  >(`/store/carts/${encodeURIComponent(cartId)}/complete`, {
    method: "POST",
  })
}
