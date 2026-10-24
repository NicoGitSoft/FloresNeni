import { useEffect, useState } from "react"

import {
  completeCart,
  getPaymentCart,
  initiatePayment,
  listPaymentProviders,
  prepareShipping,
  type PaymentCart,
} from "../lib/payments"
import { formatCLP } from "../lib/medusa"

const CART_STORAGE_KEY = "neni_cart_id"
const WEBPAY_PROVIDER = "pp_webpay_webpay"
const SYSTEM_PROVIDER = "pp_system_default"

export default function PaymentLabPage() {
  const [cart, setCart] = useState<PaymentCart | null>(null)
  const [providers, setProviders] = useState<string[]>([])
  const [busy, setBusy] = useState(false)
  const [message, setMessage] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false

    async function boot() {
      const params = new URLSearchParams(window.location.search)
      const webpay = params.get("webpay")
      if (webpay) {
        setMessage(`Retorno Webpay: ${webpay}`)
      }

      const cartId = localStorage.getItem(CART_STORAGE_KEY)

      if (!cartId) {
        setError("No existe carrito local. Agrega un producto primero.")
        return
      }

      try {
        const current = await getPaymentCart(cartId)
        if (cancelled) return
        setCart(current)

        if (current.region_id) {
          const response = await listPaymentProviders(current.region_id)
          if (!cancelled) {
            setProviders(
              response.payment_providers.map((provider) => provider.id)
            )
          }
        }

      } catch (err) {
        if (!cancelled) {
          setError(
            err instanceof Error ? err.message : "No se pudo completar el retorno Webpay."
          )
        }
      } finally {
        if (!cancelled) setBusy(false)
      }
    }

    void boot()
    return () => {
      cancelled = true
    }
  }, [])

  async function prepare(providerId: string) {
    if (!cart) return null
    setBusy(true)
    setError(null)
    setMessage(null)

    try {
      const shipped = await prepareShipping(cart)
      const paid = await initiatePayment(shipped, providerId)
      setCart(paid)
      return paid
    } catch (err) {
      setError(err instanceof Error ? err.message : "Falló preparación de pago.")
      return null
    } finally {
      setBusy(false)
    }
  }

  async function testManualOrder() {
    const prepared = await prepare(SYSTEM_PROVIDER)
    if (!prepared) return

    setBusy(true)
    try {
      const result = await completeCart(prepared.id)
      if (result.type !== "order") {
        throw new Error(result.error?.message ?? "Medusa no completó el carrito.")
      }

      localStorage.removeItem(CART_STORAGE_KEY)
      window.location.href = `/order-success?order_id=${encodeURIComponent(result.order.id)}`
    } catch (err) {
      setError(err instanceof Error ? err.message : "No se pudo crear la orden.")
    } finally {
      setBusy(false)
    }
  }

  async function startWebpay() {
    const prepared = await prepare(WEBPAY_PROVIDER)
    if (!prepared) return

    const session = prepared.payment_collection?.payment_sessions?.find(
      (candidate) => candidate.provider_id === WEBPAY_PROVIDER
    )

    const token = session?.data?.token_ws
    const url = session?.data?.webpay_url

    if (!token || !url) {
      setError("La sesión Webpay no devolvió token/url.")
      return
    }

    const form = document.createElement("form")
    form.method = "POST"
    form.action = url

    const input = document.createElement("input")
    input.type = "hidden"
    input.name = "token_ws"
    input.value = token
    form.appendChild(input)

    document.body.appendChild(form)
    form.submit()
  }

  if (!cart) {
    return (
      <main className="checkout-page">
        <h1>Laboratorio de pago</h1>
        <p>{error ?? "Cargando carrito..."}</p>
        <a href="/">Volver al catálogo</a>
      </main>
    )
  }

  return (
    <main className="checkout-page">
      <div className="checkout-page__heading">
        <span>Prueba e-commerce</span>
        <h1>Pago y creación de orden</h1>
        <p>
          Primero prueba Medusa con pago manual. Después usa Webpay en ambiente
          de integración.
        </p>
      </div>

      <section className="checkout-card">
        <h2>Carrito</h2>
        <p><strong>ID:</strong> {cart.id}</p>
        <p><strong>Total:</strong> {formatCLP(cart.total)}</p>
        <p><strong>Email:</strong> {cart.email ?? "pendiente"}</p>
        <p>
          <strong>Entrega:</strong>{" "}
          {cart.metadata?.neni_checkout?.fulfillment_method ?? "pendiente"}
        </p>
      </section>

      <section className="checkout-card">
        <h2>Providers habilitados</h2>
        <p>{providers.join(", ") || "Ninguno"}</p>
      </section>

      {message && <p className="checkout-notice">{message}</p>}
      {error && <p className="checkout-error">{error}</p>}

      <div className="checkout-actions">
        <button
          type="button"
          disabled={busy || !providers.includes(SYSTEM_PROVIDER)}
          onClick={() => void testManualOrder()}
        >
          {busy ? "Procesando..." : "1. Crear orden con pago manual"}
        </button>

        <button
          type="button"
          disabled={busy || !providers.includes(WEBPAY_PROVIDER)}
          onClick={() => void startWebpay()}
        >
          {busy ? "Procesando..." : "2. Pagar con Webpay (integración)"}
        </button>
      </div>

      <p>
        <a href="/checkout">Volver al checkout</a>
      </p>
    </main>
  )
}
