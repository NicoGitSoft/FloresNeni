import { MedusaError } from "@medusajs/framework/utils"

import {
  getChileCivilDate,
  validateCheckoutInput,
  type CheckoutRequest,
} from "../validation"

const today = "2026-10-18"

const pickupCheckout: CheckoutRequest = {
  cart_id: "cart_test",
  first_name: "Denise",
  last_name: "Flores",
  email: "denise@example.com",
  phone: "+56912345678",
  fulfillment_method: "pickup",
  requested_date: today,
}

const deliveryCheckout: CheckoutRequest = {
  ...pickupCheckout,
  fulfillment_method: "delivery",
  delivery_address: {
    address_1: "Avenida Italia 123",
    city: "Providencia",
    province: "Región Metropolitana",
  },
}

function validate(input: unknown, hasItems = true) {
  return validateCheckoutInput(input, { hasItems, today })
}

describe("Neni checkout input validation", () => {
  it("rejects an empty cart", () => {
    expect(() => validate(pickupCheckout, false)).toThrow(MedusaError)
  })

  it("rejects a missing email", () => {
    const { email: _email, ...input } = pickupCheckout
    expect(() => validate(input)).toThrow(MedusaError)
  })

  it("rejects a missing phone", () => {
    const { phone: _phone, ...input } = pickupCheckout
    expect(() => validate(input)).toThrow(MedusaError)
  })

  it("rejects an unsupported fulfillment method", () => {
    expect(() =>
      validate({ ...pickupCheckout, fulfillment_method: "courier" })
    ).toThrow(MedusaError)
  })

  it("rejects browser-supplied totals", () => {
    expect(() => validate({ ...pickupCheckout, subtotal: 1, total: 1 })).toThrow(
      MedusaError
    )
  })

  it("allows pickup without a shipping address", () => {
    expect(validate(pickupCheckout).fulfillment_method).toBe("pickup")
  })

  it("rejects delivery without an address", () => {
    expect(() =>
      validate({ ...pickupCheckout, fulfillment_method: "delivery" })
    ).toThrow("Completa la dirección")
  })

  it("rejects an impossible civil date", () => {
    expect(() =>
      validate({ ...pickupCheckout, requested_date: "2026-02-30" })
    ).toThrow("fecha válida")
  })

  it("rejects a date before the current day in Chile", () => {
    expect(() =>
      validate({ ...pickupCheckout, requested_date: "2026-10-17" })
    ).toThrow("no puede estar en el pasado")
  })

  it("accepts a complete pickup request", () => {
    expect(validate(pickupCheckout)).toMatchObject(pickupCheckout)
  })

  it("accepts a complete delivery request", () => {
    expect(validate(deliveryCheckout)).toMatchObject(deliveryCheckout)
  })

  it("uses the Chile civil day rather than the UTC day", () => {
    expect(getChileCivilDate(new Date("2026-01-01T02:30:00.000Z"))).toBe(
      "2025-12-31"
    )
  })
})