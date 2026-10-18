import {
  useEffect,
  useState,
  type FormEvent,
} from "react"

import { CartProvider, useCart } from "./CartContext"
import {
  formatCLP,
  getChileTodayForDateInput,
  saveNeniCheckout,
  type MedusaCart,
  type NeniCheckoutInput,
} from "../lib/medusa"

type CheckoutFields = {
  first_name: string
  last_name: string
  email: string
  phone: string
  fulfillment_method: "pickup" | "delivery"
  requested_date: string
  address_1: string
  address_2: string
  city: string
  province: string
  postal_code: string
}

const emptyFields: CheckoutFields = {
  first_name: "",
  last_name: "",
  email: "",
  phone: "",
  fulfillment_method: "pickup",
  requested_date: "",
  address_1: "",
  address_2: "",
  city: "",
  province: "",
  postal_code: "",
}

function fieldsFromCart(cart: MedusaCart): CheckoutFields {
  const saved = cart.metadata?.neni_checkout
  const address = cart.shipping_address

  return {
    first_name: saved?.first_name ?? address?.first_name ?? "",
    last_name: saved?.last_name ?? address?.last_name ?? "",
    email: cart.email ?? "",
    phone: saved?.phone ?? address?.phone ?? "",
    fulfillment_method: saved?.fulfillment_method ?? "pickup",
    requested_date: saved?.requested_date ?? "",
    address_1: address?.address_1 ?? "",
    address_2: address?.address_2 ?? "",
    city: address?.city ?? "",
    province: address?.province ?? "",
    postal_code: address?.postal_code ?? "",
  }
}

function CheckoutForm() {
  const { cart, loading, refreshCart, replaceCart } = useCart()
  const [fields, setFields] = useState(emptyFields)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [saved, setSaved] = useState(false)

  useEffect(() => {
    if (cart) {
      setFields(fieldsFromCart(cart))
    }
  }, [cart])

  function updateField<Key extends keyof CheckoutFields>(
    key: Key,
    value: CheckoutFields[Key]
  ) {
    setFields((current) => ({ ...current, [key]: value }))
    setSaved(false)
    setError(null)
  }

  async function submitCheckout(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (!cart) {
      return
    }

    setSaving(true)
    setError(null)
    setSaved(false)

    const checkout: NeniCheckoutInput = {
      first_name: fields.first_name,
      last_name: fields.last_name,
      email: fields.email,
      phone: fields.phone,
      fulfillment_method: fields.fulfillment_method,
      requested_date: fields.requested_date,
      ...(fields.fulfillment_method === "delivery"
        ? {
            delivery_address: {
              address_1: fields.address_1,
              address_2: fields.address_2,
              city: fields.city,
              province: fields.province,
              postal_code: fields.postal_code,
            },
          }
        : {}),
    }

    try {
      const updated = await saveNeniCheckout(cart.id, checkout)
      replaceCart(updated)
      try {
        await refreshCart()
      } catch {
        // Keep the successful Store response as the persisted fallback.
      }
      setSaved(true)
    } catch (checkoutError) {
      setError(
        checkoutError instanceof Error
          ? checkoutError.message
          : "No pudimos guardar tus datos. Inténtalo nuevamente."
      )
    } finally {
      setSaving(false)
    }
  }

  if (loading) {
    return <main className="checkout-page"><p role="status">Cargando tu carrito...</p></main>
  }

  if (!cart?.items?.length) {
    return (
      <main className="checkout-page checkout-page--empty">
        <a className="checkout-back" href="/">Volver a las flores</a>
        <span className="checkout-kicker">Checkout Neni</span>
        <h1>Tu carrito está esperando una flor.</h1>
        <p>Agrega un diseño del taller para continuar con tus datos.</p>
      </main>
    )
  }

  return (
    <main className="checkout-page">
      <header className="checkout-heading">
        <a className="checkout-back" href="/">Volver a las flores</a>
        <span className="checkout-kicker">Checkout Neni</span>
        <h1>Cuéntanos cómo recibir tu ramo.</h1>
        <p>Guardaremos tus datos en el carrito para que puedas retomarlo después.</p>
      </header>

      <div className="checkout-layout">
        <form className="checkout-form" onSubmit={submitCheckout}>
          <fieldset className="checkout-fieldset">
            <legend>Datos de contacto</legend>
            <div className="checkout-fields checkout-fields--two">
              <label>
                Nombre
                <input
                  autoComplete="given-name"
                  maxLength={100}
                  name="first_name"
                  onChange={(event) => updateField("first_name", event.target.value)}
                  required
                  value={fields.first_name}
                />
              </label>
              <label>
                Apellido
                <input
                  autoComplete="family-name"
                  maxLength={100}
                  name="last_name"
                  onChange={(event) => updateField("last_name", event.target.value)}
                  required
                  value={fields.last_name}
                />
              </label>
            </div>
            <div className="checkout-fields checkout-fields--two">
              <label>
                Email
                <input
                  autoComplete="email"
                  maxLength={254}
                  name="email"
                  onChange={(event) => updateField("email", event.target.value)}
                  required
                  type="email"
                  value={fields.email}
                />
              </label>
              <label>
                Teléfono
                <input
                  autoComplete="tel"
                  inputMode="tel"
                  maxLength={24}
                  name="phone"
                  onChange={(event) => updateField("phone", event.target.value)}
                  required
                  type="tel"
                  value={fields.phone}
                />
              </label>
            </div>
          </fieldset>

          <fieldset className="checkout-fieldset">
            <legend>¿Cómo prefieres recibirlo?</legend>
            <div className="checkout-methods">
              <label className={fields.fulfillment_method === "pickup" ? "is-selected" : ""}>
                <input
                  checked={fields.fulfillment_method === "pickup"}
                  name="fulfillment_method"
                  onChange={() => updateField("fulfillment_method", "pickup")}
                  type="radio"
                  value="pickup"
                />
                <span>Retiro</span>
              </label>
              <label className={fields.fulfillment_method === "delivery" ? "is-selected" : ""}>
                <input
                  checked={fields.fulfillment_method === "delivery"}
                  name="fulfillment_method"
                  onChange={() => updateField("fulfillment_method", "delivery")}
                  type="radio"
                  value="delivery"
                />
                <span>Despacho</span>
              </label>
            </div>

            {fields.fulfillment_method === "delivery" && (
              <div className="checkout-delivery-fields">
                <label>
                  Dirección
                  <input
                    autoComplete="address-line1"
                    maxLength={255}
                    name="address_1"
                    onChange={(event) => updateField("address_1", event.target.value)}
                    required
                    value={fields.address_1}
                  />
                </label>
                <label>
                  Departamento, oficina o referencia <span>(opcional)</span>
                  <input
                    autoComplete="address-line2"
                    maxLength={255}
                    name="address_2"
                    onChange={(event) => updateField("address_2", event.target.value)}
                    value={fields.address_2}
                  />
                </label>
                <div className="checkout-fields checkout-fields--two">
                  <label>
                    Comuna
                    <input
                      autoComplete="address-level2"
                      maxLength={100}
                      name="city"
                      onChange={(event) => updateField("city", event.target.value)}
                      required
                      value={fields.city}
                    />
                  </label>
                  <label>
                    Región <span>(opcional)</span>
                    <input
                      autoComplete="address-level1"
                      maxLength={100}
                      name="province"
                      onChange={(event) => updateField("province", event.target.value)}
                      value={fields.province}
                    />
                  </label>
                </div>
                <label>
                  Código postal <span>(opcional)</span>
                  <input
                    autoComplete="postal-code"
                    maxLength={30}
                    name="postal_code"
                    onChange={(event) => updateField("postal_code", event.target.value)}
                    value={fields.postal_code}
                  />
                </label>
              </div>
            )}
          </fieldset>

          <fieldset className="checkout-fieldset">
            <legend>Fecha solicitada</legend>
            <label className="checkout-date-field">
              Día que tienes en mente
              <input
                min={getChileTodayForDateInput()}
                name="requested_date"
                onChange={(event) => updateField("requested_date", event.target.value)}
                required
                type="date"
                value={fields.requested_date}
              />
            </label>
            <p className="checkout-note">
              Tomaremos esta fecha como referencia y confirmaremos disponibilidad más adelante.
            </p>
          </fieldset>

          {error && <p className="checkout-error" role="alert">{error}</p>}
          {saved && (
            <div className="checkout-success" role="status">
              <strong>Datos guardados en tu carrito.</strong>
              <p>La fecha que elegiste es una solicitud; la disponibilidad de producción aún está por confirmar.</p>
            </div>
          )}

          <button className="checkout-submit" disabled={saving} type="submit">
            {saving ? "Guardando tus datos..." : "Guardar datos"}
          </button>
        </form>

        <aside className="checkout-order" aria-label="Resumen del carrito">
          <h2>Tu selección</h2>
          <div className="checkout-order__items">
            {cart.items.map((item) => (
              <article className="checkout-order__item" key={item.id}>
                <div>
                  <strong>{item.product_title ?? item.title ?? "Ramo Neni"}</strong>
                  <small>{item.quantity} {item.quantity === 1 ? "unidad" : "unidades"}</small>
                </div>
                <span>{formatCLP(item.total ?? (item.unit_price ?? 0) * item.quantity)}</span>
              </article>
            ))}
          </div>
          <div className="checkout-order__subtotal">
            <span>Subtotal</span>
            <strong>{formatCLP(cart.subtotal ?? cart.total)}</strong>
          </div>
          <p>El subtotal corresponde al carrito calculado por Medusa.</p>
        </aside>
      </div>
    </main>
  )
}

export default function CheckoutPage() {
  return (
    <CartProvider>
      <CheckoutForm />
    </CartProvider>
  )
}