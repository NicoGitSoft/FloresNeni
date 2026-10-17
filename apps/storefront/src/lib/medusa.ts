const backendUrl =
  (
    import.meta.env.PUBLIC_MEDUSA_BACKEND_URL ??
    "http://127.0.0.1:9000"
  ).replace(/\/$/, "")

const publishableKey =
  import.meta.env.PUBLIC_MEDUSA_PUBLISHABLE_KEY

if (!publishableKey) {
  throw new Error(
    "Falta PUBLIC_MEDUSA_PUBLISHABLE_KEY en apps/storefront/.env"
  )
}

const baseHeaders = {
  "x-publishable-api-key": publishableKey,
}

type MedusaFetchOptions = {
  method?: "GET" | "POST" | "DELETE"
  body?: unknown
}

async function medusaFetch<T>(
  path: string,
  options: MedusaFetchOptions = {}
): Promise<T> {
  const response = await fetch(
    `${backendUrl}${path}`,
    {
      method: options.method ?? "GET",

      headers: {
        ...baseHeaders,
        ...(options.body
          ? { "Content-Type": "application/json" }
          : {}),
      },

      body:
        options.body !== undefined
          ? JSON.stringify(options.body)
          : undefined,
    }
  )

  if (!response.ok) {
    const body = await response.text()

    throw new Error(
      `Medusa respondió ${response.status}: ${body}`
    )
  }

  const text = await response.text()

  if (!text) {
    return undefined as T
  }

  return JSON.parse(text) as T
}


/* =========================================================
   REGIONS
   ========================================================= */

export type MedusaRegion = {
  id: string
  name: string
  currency_code: string
}

export async function getChileRegion():
Promise<MedusaRegion> {
  const data =
    await medusaFetch<{
      regions: MedusaRegion[]
    }>("/store/regions?limit=50")

  const chile =
    data.regions.find(
      region =>
        region.name === "Chile" &&
        region.currency_code === "clp"
    )

  if (!chile) {
    throw new Error(
      "No se encontró la región Chile / CLP en Medusa."
    )
  }

  return chile
}


/* =========================================================
   PRODUCTS
   ========================================================= */

export type MedusaCalculatedPrice = {
  calculated_amount?: number
  currency_code?: string
}

export type MedusaVariant = {
  id: string
  title: string
  sku?: string | null

  calculated_price?:
    MedusaCalculatedPrice
}

export type NeniProductMetadata = {
  composition?: string
  variable_design?: boolean

  image_1?: string
  image_2?: string
}

export type MedusaProduct = {
  id: string
  title: string
  handle: string

  description?: string | null
  thumbnail?: string | null

  metadata?:
    NeniProductMetadata | null

  variants?: MedusaVariant[]
}

export async function getProducts():
Promise<MedusaProduct[]> {
  const chile =
    await getChileRegion()

  const params =
    new URLSearchParams({
      limit: "100",
      region_id: chile.id,
      country_code: "cl",

      fields:
        "*variants.calculated_price,+metadata",
    })

  const data =
    await medusaFetch<{
      products: MedusaProduct[]
      count: number
    }>(
      `/store/products?${params.toString()}`
    )

  return data.products
}

export function getProductPrice(
  product: MedusaProduct
): number | undefined {
  return product
    .variants?.[0]
    ?.calculated_price
    ?.calculated_amount
}

export function getProductImage(
  product: MedusaProduct
): string | undefined {
  return (
    product.metadata?.image_1 ??
    product.thumbnail ??
    undefined
  )
}

export function getProductVariantId(
  product: MedusaProduct
): string | undefined {
  return product.variants?.[0]?.id
}


/* =========================================================
   CART
   ========================================================= */

export type MedusaCartLineItem = {
  id: string

  variant_id?: string

  title?: string
  product_title?: string
  variant_title?: string

  thumbnail?: string | null

  quantity: number

  unit_price?: number
  total?: number
}

export type MedusaCart = {
  id: string

  region_id?: string
  currency_code?: string

  items?: MedusaCartLineItem[]

  subtotal?: number
  total?: number
}

export async function createCart():
Promise<MedusaCart> {
  const chile =
    await getChileRegion()

  const data =
    await medusaFetch<{
      cart: MedusaCart
    }>(
      "/store/carts",
      {
        method: "POST",

        body: {
          region_id: chile.id,
        },
      }
    )

  return data.cart
}

export async function getCart(
  cartId: string
): Promise<MedusaCart> {
  const data =
    await medusaFetch<{
      cart: MedusaCart
    }>(
      `/store/carts/${encodeURIComponent(cartId)}`
    )

  return data.cart
}

export async function addCartItem(
  cartId: string,
  variantId: string,
  quantity: number
): Promise<MedusaCart> {
  await medusaFetch(
    `/store/carts/${encodeURIComponent(cartId)}/line-items`,
    {
      method: "POST",

      body: {
        variant_id: variantId,
        quantity,
      },
    }
  )

  return getCart(cartId)
}

export async function updateCartItem(
  cartId: string,
  lineItemId: string,
  quantity: number
): Promise<MedusaCart> {
  await medusaFetch(
    `/store/carts/${encodeURIComponent(cartId)}/line-items/${encodeURIComponent(lineItemId)}`,
    {
      method: "POST",

      body: {
        quantity,
      },
    }
  )

  return getCart(cartId)
}

export async function removeCartItem(
  cartId: string,
  lineItemId: string
): Promise<MedusaCart> {
  await medusaFetch(
    `/store/carts/${encodeURIComponent(cartId)}/line-items/${encodeURIComponent(lineItemId)}`,
    {
      method: "DELETE",
    }
  )

  return getCart(cartId)
}


/* =========================================================
   FORMATTERS
   ========================================================= */

export function formatCLP(
  amount?: number
): string {
  if (amount === undefined) {
    return "Consultar"
  }

  return new Intl.NumberFormat(
    "es-CL",
    {
      style: "currency",
      currency: "CLP",
      maximumFractionDigits: 0,
    }
  ).format(amount)
}