import { useEffect, useRef, useState } from "react"
import { createPortal } from "react-dom"
import { CartProvider, useCart } from "./CartContext"
import ProductGrid from "./ProductGrid"
import { formatCLP } from "../lib/medusa"

function CartExperience() {
  const { cart, itemCount, loading, busy, error, updateItem, removeItem } = useCart()
  const [portalHost, setPortalHost] = useState<HTMLElement | null>(null)
  const dialogRef = useRef<HTMLDialogElement>(null)
  const triggerRef = useRef<HTMLButtonElement>(null)

  useEffect(() => {
    setPortalHost(document.getElementById("cart-header-slot"))
  }, [])

  function openCart() {
    if (!dialogRef.current?.open) dialogRef.current?.showModal()
  }

  function closeCart() {
    dialogRef.current?.close()
  }

  const trigger = (
    <button ref={triggerRef} type="button" className="cart-trigger" onClick={openCart}
      aria-label={`Abrir carrito, ${itemCount} productos`} aria-haspopup="dialog">
      Mi carrito <span className="cart-trigger__count">{itemCount}</span>
    </button>
  )

  return (
    <>
      {portalHost ? createPortal(trigger, portalHost) : (
        <div className="cart-trigger--fallback">{trigger}</div>
      )}
      <dialog ref={dialogRef} className="neni-dialog neni-cart-dialog"
        aria-labelledby="neni-cart-title" onClick={event => {
          if (event.target === dialogRef.current) closeCart()
        }}>
        <div className="neni-dialog__header">
          <div>
            <span className="section-kicker">TU SELECCIÓN FLORAL</span>
            <h2 id="neni-cart-title">Tu carrito <span>({itemCount})</span></h2>
          </div>
          <button type="button" className="neni-dialog__close" onClick={closeCart}
            aria-label="Cerrar carrito" autoFocus>×</button>
        </div>
        <div className="neni-cart-dialog__body" aria-busy={busy}>
          {loading ? <p role="status">Recuperando tus flores…</p> : (
            !cart?.items?.length ?
              <p className="cart-summary__empty">Aquí florecerá tu próxima sorpresa. Explora la colección para comenzar.</p> :
              <div className="cart-summary__items">
                {cart.items.map(item => (
                  <article key={item.id} className="cart-item">
                    <div>
                      <strong>{item.product_title ?? item.title ?? "Ramo Neni"}</strong>
                      <small>{formatCLP(item.total ?? (item.unit_price ?? 0) * item.quantity)}</small>
                    </div>
                    <div className="cart-item__quantity">
                      <button type="button" disabled={busy} aria-label={`Quitar una unidad de ${item.product_title ?? item.title ?? "ramo"}`}
                        onClick={() => void updateItem(item.id, item.quantity - 1)}>−</button>
                      <span aria-label={`Cantidad ${item.quantity}`}>{item.quantity}</span>
                      <button type="button" disabled={busy} aria-label={`Agregar una unidad de ${item.product_title ?? item.title ?? "ramo"}`}
                        onClick={() => void updateItem(item.id, item.quantity + 1)}>+</button>
                      <button type="button" className="cart-item__remove" disabled={busy}
                        aria-label={`Eliminar ${item.product_title ?? item.title ?? "ramo"}`}
                        onClick={() => void removeItem(item.id)}>×</button>
                    </div>
                  </article>
                ))}
              </div>
          )}
          {error && <p role="alert" className="cart-summary__error">{error}</p>}
        </div>
        {Boolean(cart?.items?.length) && (
          <div className="neni-cart-dialog__footer">
            <div className="cart-summary__total"><span>Subtotal</span><strong>{formatCLP(cart?.subtotal ?? cart?.total)}</strong></div>
            <p className="checkout-note">El despacho se confirma al completar tus datos.</p>
            <a className="cart-summary__checkout" href="/checkout">Continuar con mi pedido ↗</a>
          </div>
        )}
      </dialog>
    </>
  )
}

export default function Storefront() {
  return (
    <CartProvider>
      <CartExperience />
      <ProductGrid />
    </CartProvider>
  )
}