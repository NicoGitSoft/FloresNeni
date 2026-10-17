import {
  CartProvider,
  useCart,
} from "./CartContext"

import ProductGrid from "./ProductGrid"

import {
  formatCLP,
} from "../lib/medusa"

function CartSummary() {
  const {
    cart,
    itemCount,
    loading,
    busy,
    error,
    updateItem,
    removeItem,
  } =
    useCart()

  if (loading) {
    return (
      <div className="cart-summary">
        Cargando carrito...
      </div>
    )
  }

  return (
    <aside
      className="cart-summary"
      aria-label="Carrito"
    >
      <div className="cart-summary__header">

        <strong>
          Carrito
        </strong>

        <span>
          {itemCount}
        </span>

      </div>

      {error && (
        <p className="cart-summary__error">
          {error}
        </p>
      )}

      {!cart ||
      !cart.items?.length ? (

        <p className="cart-summary__empty">
          Tu carrito está vacío.
        </p>

      ) : (

        <>
          <div className="cart-summary__items">

            {cart.items.map(
              item => (

                <article
                  key={item.id}
                  className="cart-item"
                >
                  <div>

                    <strong>
                      {
                        item.product_title ??
                        item.title ??
                        "Ramo Neni"
                      }
                    </strong>

                    <small>
                      {
                        formatCLP(
                          item.total ??
                          (
                            item.unit_price ??
                            0
                          ) *
                          item.quantity
                        )
                      }
                    </small>

                  </div>

                  <div className="cart-item__quantity">

                    <button
                      type="button"
                      disabled={busy}
                      onClick={() =>
                        updateItem(
                          item.id,
                          item.quantity -
                            1
                        )
                      }
                    >
                      −
                    </button>

                    <span>
                      {item.quantity}
                    </span>

                    <button
                      type="button"
                      disabled={busy}
                      onClick={() =>
                        updateItem(
                          item.id,
                          item.quantity +
                            1
                        )
                      }
                    >
                      +
                    </button>

                    <button
                      type="button"
                      className="cart-item__remove"
                      disabled={busy}
                      onClick={() =>
                        removeItem(
                          item.id
                        )
                      }
                    >
                      ×
                    </button>

                  </div>

                </article>
              )
            )}

          </div>

          <div className="cart-summary__total">

            <span>
              Subtotal
            </span>

            <strong>
              {
                formatCLP(
                  cart.subtotal ??
                  cart.total
                )
              }
            </strong>

          </div>
        </>

      )}
    </aside>
  )
}

export default function Storefront() {
  return (
    <CartProvider>

      <CartSummary />

      <ProductGrid />

    </CartProvider>
  )
}