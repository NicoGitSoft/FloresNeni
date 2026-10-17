import {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react"

import {
  addCartItem,
  createCart,
  getCart,
  removeCartItem,
  updateCartItem,
  type MedusaCart,
} from "../lib/medusa"

const STORAGE_KEY =
  "neni_cart_id"

type CartContextValue = {
  cart: MedusaCart | null

  loading: boolean
  busy: boolean

  error: string | null

  itemCount: number

  addItem: (
    variantId: string,
    quantity?: number
  ) => Promise<void>

  updateItem: (
    lineItemId: string,
    quantity: number
  ) => Promise<void>

  removeItem: (
    lineItemId: string
  ) => Promise<void>
}

const CartContext =
  createContext<CartContextValue | null>(
    null
  )

export function CartProvider({
  children,
}: {
  children: ReactNode
}) {
  const [cart, setCart] =
    useState<MedusaCart | null>(null)

  const [loading, setLoading] =
    useState(true)

  const [busy, setBusy] =
    useState(false)

  const [error, setError] =
    useState<string | null>(null)

  useEffect(() => {
    async function restoreCart() {
      const cartId =
        localStorage.getItem(
          STORAGE_KEY
        )

      if (!cartId) {
        setLoading(false)
        return
      }

      try {
        const restored =
          await getCart(cartId)

        setCart(restored)

      } catch (err) {
        console.warn(
          "No se pudo recuperar el carrito anterior.",
          err
        )

        localStorage.removeItem(
          STORAGE_KEY
        )

      } finally {
        setLoading(false)
      }
    }

    restoreCart()
  }, [])

  async function ensureCart():
  Promise<MedusaCart> {
    if (cart) {
      return cart
    }

    const created =
      await createCart()

    localStorage.setItem(
      STORAGE_KEY,
      created.id
    )

    setCart(created)

    return created
  }

  async function addItem(
    variantId: string,
    quantity = 1
  ) {
    setBusy(true)
    setError(null)

    try {
      const current =
        await ensureCart()

      const existing =
        current.items?.find(
          item =>
            item.variant_id ===
            variantId
        )

      const updated =
        existing
          ? await updateCartItem(
              current.id,
              existing.id,
              existing.quantity +
                quantity
            )
          : await addCartItem(
              current.id,
              variantId,
              quantity
            )

      setCart(updated)

    } catch (err) {
      console.error(err)

      setError(
        err instanceof Error
          ? err.message
          : "No fue posible agregar el producto."
      )

    } finally {
      setBusy(false)
    }
  }

  async function updateItem(
    lineItemId: string,
    quantity: number
  ) {
    if (!cart) {
      return
    }

    if (quantity <= 0) {
      await removeItem(lineItemId)
      return
    }

    setBusy(true)
    setError(null)

    try {
      const updated =
        await updateCartItem(
          cart.id,
          lineItemId,
          quantity
        )

      setCart(updated)

    } catch (err) {
      console.error(err)

      setError(
        "No fue posible actualizar el carrito."
      )

    } finally {
      setBusy(false)
    }
  }

  async function removeItem(
    lineItemId: string
  ) {
    if (!cart) {
      return
    }

    setBusy(true)
    setError(null)

    try {
      const updated =
        await removeCartItem(
          cart.id,
          lineItemId
        )

      setCart(updated)

    } catch (err) {
      console.error(err)

      setError(
        "No fue posible eliminar el producto."
      )

    } finally {
      setBusy(false)
    }
  }

  const itemCount =
    useMemo(
      () =>
        cart?.items?.reduce(
          (
            total,
            item
          ) =>
            total +
            item.quantity,
          0
        ) ?? 0,
      [cart]
    )

  return (
    <CartContext.Provider
      value={{
        cart,

        loading,
        busy,

        error,

        itemCount,

        addItem,
        updateItem,
        removeItem,
      }}
    >
      {children}
    </CartContext.Provider>
  )
}

export function useCart() {
  const context =
    useContext(CartContext)

  if (!context) {
    throw new Error(
      "useCart debe usarse dentro de CartProvider."
    )
  }

  return context
}